import * as ExcelJS from 'exceljs';

/**
 * Turns a practitioner spreadsheet into normalised rows.
 *
 * Written against the client's Bay Area list, whose shape drives every decision
 * here: 15 sheets (one per modality), **11 different column layouts**, trailing
 * "Sources:" commentary rows mixed in with the data, credentials glued onto
 * names, and free-text city values.
 *
 * The rule that matters: **columns are located by header name, per sheet, never
 * by position.** Column 4 is "Email" on one sheet and "Contact (Psychology
 * Today profile)" on another, so positional parsing would quietly write
 * directory URLs into the email field for a third of the file.
 *
 * Nothing here touches the database or decides anything — it reads a file and
 * reports what it found, including what it couldn't understand. Classification
 * lives in the service so it can consult existing users and suppressions.
 */

export interface ParsedRow {
  sheetName: string;
  /** 1-based row number in the sheet, as the admin sees it in Excel. */
  rowNumber: number;
  /** Every cell, keyed by its header — kept verbatim for audit and re-parsing. */
  raw: Record<string, string>;
  name: string;
  email: string | null;
  city: string | null;
  /** The practitioner's stated modality/credential, or the sheet's subject. */
  modality: string | null;
  /** Their own site. Third-party directory profiles are deliberately dropped. */
  websiteUrl: string | null;
  /** A directory profile URL, kept separately — it is a contact route, not a site. */
  directoryUrl: string | null;
  /** True when the row is the sheet's trailing "Sources:" note, not a person. */
  isCommentary: boolean;
  /** True when the name reads as an organisation rather than an individual. */
  looksLikeOrganisation: boolean;
}

export interface ParsedSheet {
  name: string;
  headers: string[];
  /** Headers we couldn't map to anything — surfaced so the admin can look. */
  unmappedHeaders: string[];
  rows: ParsedRow[];
}

export interface ParseResult {
  sheets: ParsedSheet[];
  rows: ParsedRow[];
  totalRows: number;
}

// ─── Patterns ────────────────────────────────────────────────────────────────

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

/**
 * Sites that host practitioner profiles rather than being one. A URL here is a
 * contact route we can't email, so it must never land in `websiteUrl` and be
 * published on a profile as if it were the practitioner's own.
 */
const DIRECTORY_HOSTS =
  /psychologytoday|noomii|healthprofs|goodtherapy|therapyden|zocdoc|yelp|thumbtack|linkedin|instagram|facebook|twitter|mindbody|classpass|eventbrite|meetup|wellness\.com/i;

/**
 * Organisation-shaped names. These import fine but are flagged for review: a
 * studio is a legitimate guide, but the display name and the eventual invite
 * should address it as one rather than greeting a clinic by first name.
 */
const ORGANISATION_RE =
  /\b(center|centre|clinic|institute|collective|studio|school|society|associates|group|academy|sanctuary|healing arts|acupuncture|wellness|llc|inc\.?|l\.l\.c)\b/i;

/**
 * Post-nominals that ride along in the Name cell ("Aisha Nouh, ND"). Stripped
 * from the display name and preserved as the modality hint.
 */
const CREDENTIAL_SUFFIX_RE =
  /,\s*((?:[A-Z][A-Za-z.]{0,6}\s*)+)$|\s+\b(PhD|Ph\.D|MD|LMFT|MFT|LCSW|LPCC|LAc|L\.Ac|RN|DC|ND|DO|MA|MS|MSW|PsyD|DACM|OMD|CMT|RYT|E-RYT|CHT|ACC|PCC|MCC)\b\.?$/;

/** Bay Area city values that aren't cities. */
const VAGUE_CITY_RE = /^(bay area|san francisco bay area|california|ca|usa|us|online|virtual|various|multiple)$/i;

// ─── Header mapping ──────────────────────────────────────────────────────────

type Field = 'name' | 'email' | 'city' | 'modality' | 'website' | 'notes';

/**
 * Header → field, applied per sheet. Order matters: the first pattern that
 * matches a header wins, so the more specific ones are listed first.
 *
 * "Contact (Psychology Today profile)" must resolve to `website`, not `email`,
 * even though a human reads "contact" as "how to reach them" — it is a URL.
 */
const HEADER_PATTERNS: Array<{ field: Field; test: RegExp }> = [
  { field: 'email', test: /^e-?mail\b/i },
  { field: 'city', test: /^(city|location|area)\b/i },
  { field: 'website', test: /website|contact|profile|url|link/i },
  { field: 'notes', test: /^(notes?|comments?)\b/i },
  {
    field: 'modality',
    test: /credential|modality|type|role|specialt|lineage|practitioner|training|discipline/i,
  },
  { field: 'name', test: /^(name|practitioner|centre|center|business)\b/i },
];

function mapHeaders(headers: string[]): {
  map: Partial<Record<Field, number[]>>;
  unmapped: string[];
} {
  const map: Partial<Record<Field, number[]>> = {};
  const unmapped: string[] = [];

  headers.forEach((header, index) => {
    const clean = (header || '').trim();
    if (!clean) return;
    const hit = HEADER_PATTERNS.find((p) => p.test.test(clean));
    if (!hit) {
      unmapped.push(clean);
      return;
    }
    (map[hit.field] ||= []).push(index);
  });

  // Column A is the name on every sheet in the client's file, including the one
  // headed "Name / Center". If the header text didn't say so, trust position
  // for this one field rather than importing nameless rows.
  if (!map.name && headers.length > 0) map.name = [0];

  return { map, unmapped };
}

// ─── Value normalisation ─────────────────────────────────────────────────────

export function normaliseName(raw: string): { name: string; credential: string | null } {
  let name = (raw || '').replace(/\s+/g, ' ').trim();
  let credential: string | null = null;

  // "Christine Rosche (Digestive Health Center)" → keep the person, note the org.
  const parenthetical = name.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (parenthetical && parenthetical[1].trim()) {
    name = parenthetical[1].trim();
    credential = parenthetical[2].trim();
  }

  // Repeatedly, because practitioners stack them: "Veronika Gold, MA, LMFT"
  // strips to "Veronika Gold", not "Veronika Gold, MA". Bounded so a
  // pathological value can't spin.
  const collected: string[] = [];
  for (let i = 0; i < 4; i++) {
    const suffix = name.match(CREDENTIAL_SUFFIX_RE);
    if (!suffix) break;
    const captured = (suffix[1] || suffix[2] || '').trim();
    const stripped = name.replace(CREDENTIAL_SUFFIX_RE, '').trim();
    // Never strip away the whole name — "Dr Wong, MD" must not become "".
    if (!stripped) break;
    name = stripped;
    if (captured) collected.push(captured);
  }
  if (!credential && collected.length) credential = collected.reverse().join(', ');

  // Strip a trailing comma left behind by the credential strip.
  name = name.replace(/[,\s]+$/, '');
  return { name, credential };
}

export function normaliseCity(raw: string | null | undefined): string | null {
  const value = (raw || '').replace(/\s+/g, ' ').trim();
  if (!value) return null;
  // "San Rafael (Marin)" → "San Rafael"; "Oakland / Berkeley" → "Oakland".
  const primary = value.split(/[/;]|\s+\(/)[0].replace(/[,\s]+$/, '').trim();
  if (!primary || VAGUE_CITY_RE.test(primary)) return null;
  return primary
    .split(' ')
    .map((word) =>
      word.length <= 2 && word === word.toUpperCase()
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join(' ');
}

export function extractEmail(...candidates: Array<string | null | undefined>): string | null {
  for (const candidate of candidates) {
    const hit = (candidate || '').match(EMAIL_RE);
    if (hit) return hit[0].toLowerCase();
  }
  return null;
}

export function normaliseUrl(raw: string | null | undefined): string | null {
  const value = (raw || '').trim();
  if (!value) return null;
  const hit = value.match(/(https?:\/\/[^\s,;)]+|(?:www\.)?[a-z0-9-]+\.[a-z]{2,}(?:\/[^\s,;)]*)?)/i);
  if (!hit) return null;
  const url = hit[0].replace(/[.,;]+$/, '');
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

/**
 * The sheets end with a paragraph explaining where the list came from, sitting
 * in the Name column. Left alone it imports as a practitioner called
 * "Source: Psychology Today directory, filtered by…".
 */
export function looksLikeCommentary(name: string, rowText: string): boolean {
  const value = (name || '').trim();
  if (!value) return false;
  if (/^sources?\s*:/i.test(value)) return true;
  // A name is a name — anything paragraph-length in the name cell isn't one.
  if (value.length > 90) return true;
  // Prose markers that never appear in a person's name.
  if (/\b(entries|directory|scraped|verified entries|flagging|cross-checked)\b/i.test(rowText) && value.length > 60) {
    return true;
  }
  return false;
}

// ─── Parse ───────────────────────────────────────────────────────────────────

export async function parsePractitionerWorkbook(buffer: Buffer): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  const sheets: ParsedSheet[] = [];
  const allRows: ParsedRow[] = [];

  workbook.eachSheet((worksheet) => {
    const headerRow = worksheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headers[colNumber - 1] = cellText(cell);
    });

    const { map, unmapped } = mapHeaders(headers);
    const rows: ParsedRow[] = [];

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;

      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cells[colNumber - 1] = cellText(cell);
      });
      if (!cells.some((c) => (c || '').trim())) return;

      const raw: Record<string, string> = {};
      headers.forEach((header, i) => {
        if (header && (cells[i] || '').trim()) raw[header] = cells[i].trim();
      });

      const pick = (field: Field): string | null => {
        for (const index of map[field] ?? []) {
          const value = (cells[index] || '').trim();
          if (value) return value;
        }
        return null;
      };
      const pickAll = (field: Field): string[] =>
        (map[field] ?? []).map((i) => (cells[i] || '').trim()).filter(Boolean);

      const rowText = cells.filter(Boolean).join(' ');
      const rawName = pick('name') ?? '';
      const { name, credential } = normaliseName(rawName);

      // Email: prefer the mapped column, but fall back to anywhere in the row —
      // several sheets tuck an address into "Website / Contact" or Notes.
      const email = extractEmail(...pickAll('email'), rowText);

      // Split URLs into "their site" and "a directory profile". Only the former
      // may ever be shown as the practitioner's website.
      let websiteUrl: string | null = null;
      let directoryUrl: string | null = null;
      for (const candidate of pickAll('website')) {
        const url = normaliseUrl(candidate);
        if (!url) continue;
        if (DIRECTORY_HOSTS.test(url)) directoryUrl ??= url;
        else websiteUrl ??= url;
      }

      const modality = pick('modality') ?? credential ?? worksheet.name;

      rows.push({
        sheetName: worksheet.name,
        rowNumber,
        raw,
        name,
        email,
        city: normaliseCity(pick('city')),
        modality: modality ? modality.replace(/\s+/g, ' ').trim().slice(0, 120) : null,
        websiteUrl,
        directoryUrl,
        isCommentary: looksLikeCommentary(rawName, rowText),
        looksLikeOrganisation: ORGANISATION_RE.test(rawName),
      });
    });

    sheets.push({ name: worksheet.name, headers: headers.filter(Boolean), unmappedHeaders: unmapped, rows });
    allRows.push(...rows);
  });

  return { sheets, rows: allRows, totalRows: allRows.length };
}

/**
 * Cell text for any cell type. Hyperlink cells matter: a URL typed into Excel
 * becomes `{ text, hyperlink }`, and reading `.value` naively yields
 * "[object Object]" — which is exactly the sort of thing that silently
 * populates a database with junk.
 */
function cellText(cell: ExcelJS.Cell): string {
  const value = cell?.value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const anyValue = value as any;
    if (typeof anyValue.text === 'string') return anyValue.text.trim();
    if (typeof anyValue.hyperlink === 'string') return anyValue.hyperlink.trim();
    if (typeof anyValue.result === 'string' || typeof anyValue.result === 'number') {
      return String(anyValue.result).trim();
    }
    if (Array.isArray(anyValue.richText)) {
      return anyValue.richText.map((part: any) => part?.text ?? '').join('').trim();
    }
  }
  return String(value).trim();
}
