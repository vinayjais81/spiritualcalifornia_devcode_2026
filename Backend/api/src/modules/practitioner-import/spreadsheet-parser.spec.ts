import * as ExcelJS from 'exceljs';
import {
  extractEmail,
  looksLikeCommentary,
  normaliseCity,
  normaliseName,
  normaliseUrl,
  parsePractitionerWorkbook,
} from './spreadsheet-parser';
import { resolveCategory } from './category-map';
import { splitName } from './practitioner-import.service';

// The client's list is 15 sheets with 11 different column layouts, trailing
// "Sources:" commentary rows sitting in the data, credentials glued onto names,
// and directory URLs in columns headed "Contact". Every case below is one of
// those shapes.
//
// The fixture is synthetic on purpose: the real workbook holds 300+ named
// practitioners with contact details, and committing it would put that in git
// history on two remotes forever.

describe('spreadsheet parser — value normalisation', () => {
  describe('normaliseName', () => {
    it('lifts post-nominals out of the name and keeps them as the credential', () => {
      expect(normaliseName('Aisha Nouh, ND')).toEqual({ name: 'Aisha Nouh', credential: 'ND' });
      expect(normaliseName('Sarah Maiden, LMFT')).toEqual({ name: 'Sarah Maiden', credential: 'LMFT' });
    });

    it('strips stacked credentials, not just the last one', () => {
      // Found by running the parser over the client's real file, which was
      // leaving "Veronika Gold, MA" after removing only ", LMFT".
      expect(normaliseName('Veronika Gold, MA, LMFT (Polaris Insight Center)')).toEqual({
        name: 'Veronika Gold',
        credential: 'Polaris Insight Center',
      });
      expect(normaliseName('Jane Roe, MA, LMFT').name).toBe('Jane Roe');
    });

    it('keeps a parenthetical that is part of the name', () => {
      // A dharma name with the legal name inside it — not an organisation.
      expect(normaliseName('Mushim (Patricia) Ikeda').name).toBe('Mushim (Patricia) Ikeda');
    });

    it('separates a practice name in parentheses from the person', () => {
      expect(normaliseName('Christine Rosche (Digestive Health Center)')).toEqual({
        name: 'Christine Rosche',
        credential: 'Digestive Health Center',
      });
    });

    it('leaves an ordinary name untouched', () => {
      expect(normaliseName('  Maya   Rosenberg ')).toEqual({ name: 'Maya Rosenberg', credential: null });
    });

    it('does not mistake a surname for a credential', () => {
      // The danger case for a greedy suffix rule — "Ma" is a real surname.
      expect(normaliseName('Lin Ma').name).toBe('Lin Ma');
    });
  });

  describe('normaliseCity', () => {
    it('drops values that name a region rather than a city', () => {
      // These would otherwise show on a public profile as the practitioner's location.
      expect(normaliseCity('Bay Area')).toBeNull();
      expect(normaliseCity('San Francisco Bay Area')).toBeNull();
      expect(normaliseCity('California')).toBeNull();
      expect(normaliseCity('')).toBeNull();
    });

    it('keeps the primary city out of a compound value', () => {
      expect(normaliseCity('San Rafael (Marin)')).toBe('San Rafael');
      expect(normaliseCity('Oakland / Berkeley')).toBe('Oakland');
    });

    it('normalises casing', () => {
      expect(normaliseCity('san JOSE')).toBe('San Jose');
    });
  });

  describe('extractEmail', () => {
    it('finds an address wherever it is in the row and lowercases it', () => {
      expect(extractEmail(null, 'Contact: Maya@Example.COM for bookings')).toBe('maya@example.com');
    });

    it('returns null rather than guessing from a URL', () => {
      expect(extractEmail('https://www.psychologytoday.com/us/therapists/jane-doe')).toBeNull();
    });
  });

  describe('normaliseUrl', () => {
    it('adds a scheme to a bare domain', () => {
      expect(normaliseUrl('bayareaherbalist.com')).toBe('https://bayareaherbalist.com');
    });

    it('strips trailing punctuation', () => {
      expect(normaliseUrl('see somaticstress.com.')).toBe('https://somaticstress.com');
    });
  });

  describe('looksLikeCommentary', () => {
    it('catches the trailing source notes', () => {
      const note =
        'Sources: Psychology Today directory, filtered by category=somatic, across San Francisco and Oakland. 100 unique individuals.';
      expect(looksLikeCommentary(note, note)).toBe(true);
    });

    it('leaves real names alone', () => {
      expect(looksLikeCommentary('Marcus Webb', 'Marcus Webb Reiki Oakland')).toBe(false);
    });
  });

  describe('splitName', () => {
    it('splits first and last', () => {
      expect(splitName('Maya Rosenberg')).toEqual({ firstName: 'Maya', lastName: 'Rosenberg' });
    });

    it('keeps a multi-word surname together', () => {
      expect(splitName('Ana Maria de la Cruz')).toEqual({
        firstName: 'Ana',
        lastName: 'Maria de la Cruz',
      });
    });

    it('does not duplicate a single-token name', () => {
      // "Sasha Sasha" would appear on the profile and in every email.
      expect(splitName('Sasha')).toEqual({ firstName: 'Sasha', lastName: '' });
    });
  });
});

describe('sheet → category mapping', () => {
  it('maps the plain sheets', () => {
    expect(resolveCategory('Somatic Healers')).toEqual({
      categorySlug: 'body-healing',
      subcategorySlug: 'somatic-therapy',
    });
    expect(resolveCategory('Hypnotherapists')).toEqual({
      categorySlug: 'mind-healing',
      subcategorySlug: 'hypnotherapy',
    });
  });

  it('splits the Doulas sheet on the row\'s own type', () => {
    expect(resolveCategory('Doulas (Birth & Death)', 'Birth doula')).toEqual({
      categorySlug: 'family-children',
      subcategorySlug: 'birth-doula',
    });
    expect(resolveCategory('Doulas (Birth & Death)', 'End-of-life doula')).toEqual({
      categorySlug: 'soul-spirit',
      subcategorySlug: 'end-of-life-doula',
    });
  });

  it('splits yoga from meditation', () => {
    expect(resolveCategory('Yoga & Meditation Teachers', 'Vipassana meditation teacher')?.subcategorySlug)
      .toBe('meditation');
    expect(resolveCategory('Yoga & Meditation Teachers', 'Hatha yoga')?.subcategorySlug).toBe('yoga');
  });

  it('returns null for an unknown sheet instead of guessing a category', () => {
    expect(resolveCategory('Crystal Therapists')).toBeNull();
  });
});

describe('parsePractitionerWorkbook', () => {
  /** Builds a workbook in the shapes the client's file actually uses. */
  async function buildWorkbook(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();

    // Layout A — Email in column 6, a directory URL in a column headed "Contact".
    const a = wb.addWorksheet('Somatic Healers');
    a.addRow(['Name', 'Credentials', 'City', 'Contact (Psychology Today profile)', 'Website', 'Email', 'Notes']);
    a.addRow([
      'Maya Rosenberg, LMFT',
      'Somatic Experiencing',
      'San Francisco',
      'https://www.psychologytoday.com/us/therapists/maya-rosenberg',
      'mayasomatics.com',
      'maya@mayasomatics.com',
      '',
    ]);
    a.addRow([
      'Jennie Tranter',
      'SEP',
      'Bay Area',
      'https://www.psychologytoday.com/us/therapists/jennie-tranter',
      '',
      '',
      '',
    ]);
    a.addRow([
      'Sources: Psychology Today directory, filtered by category=somatic across San Francisco, Oakland and Berkeley. 100 unique individuals.',
      '', '', '', '', '', '',
    ]);

    // Layout B — Email in column 4, different header wording entirely.
    const b = wb.addWorksheet('Energy Healers');
    b.addRow(['Name', 'Modality', 'City', 'Email', 'Website / Contact', 'Notes']);
    b.addRow(['Marcus Webb', 'Reiki', 'Oakland', 'info@sfreikicenter.com', 'sfreikicenter.com', '']);
    b.addRow(['Natasha Nirvana', 'Reiki', 'Palo Alto', 'info@sfreikicenter.com', 'sfreikicenter.com', '']);
    b.addRow(['SF Reiki Center', 'Reiki', 'San Francisco', 'desk@sfreikicenter.com', '', '']);

    // exceljs types its own ArrayBuffer-ish return; Buffer.from normalises it.
    return Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);
  }

  let parsed: Awaited<ReturnType<typeof parsePractitionerWorkbook>>;

  beforeAll(async () => {
    parsed = await parsePractitionerWorkbook(await buildWorkbook());
  });

  it('reads every sheet and every data row', () => {
    expect(parsed.sheets.map((s) => s.name)).toEqual(['Somatic Healers', 'Energy Healers']);
    expect(parsed.totalRows).toBe(6);
  });

  it('locates columns by header name, not position', () => {
    // Column 4 is a directory URL on sheet A and the email on sheet B. This is
    // the failure that would silently write profile URLs into email fields.
    const maya = parsed.rows.find((r) => r.name === 'Maya Rosenberg')!;
    const marcus = parsed.rows.find((r) => r.name === 'Marcus Webb')!;
    expect(maya.email).toBe('maya@mayasomatics.com');
    expect(marcus.email).toBe('info@sfreikicenter.com');
  });

  it('separates the practitioner\'s own site from a directory profile', () => {
    const maya = parsed.rows.find((r) => r.name === 'Maya Rosenberg')!;
    expect(maya.websiteUrl).toBe('https://mayasomatics.com');
    expect(maya.directoryUrl).toContain('psychologytoday.com');
  });

  it('flags the trailing source note as commentary rather than a practitioner', () => {
    const commentary = parsed.rows.filter((r) => r.isCommentary);
    expect(commentary).toHaveLength(1);
    expect(commentary[0].sheetName).toBe('Somatic Healers');
  });

  it('strips credentials from the name and keeps the row identifiable', () => {
    expect(parsed.rows.some((r) => r.name === 'Maya Rosenberg')).toBe(true);
    expect(parsed.rows.some((r) => r.name.includes('LMFT'))).toBe(false);
  });

  it('drops a region masquerading as a city', () => {
    const jennie = parsed.rows.find((r) => r.name === 'Jennie Tranter')!;
    expect(jennie.city).toBeNull();
    expect(jennie.email).toBeNull(); // directory-only row — nothing to invite
  });

  it('flags organisation-shaped names for review', () => {
    const centre = parsed.rows.find((r) => r.name === 'SF Reiki Center')!;
    expect(centre.looksLikeOrganisation).toBe(true);
    const person = parsed.rows.find((r) => r.name === 'Marcus Webb')!;
    expect(person.looksLikeOrganisation).toBe(false);
  });

  it('reports the row number the admin sees in Excel', () => {
    const maya = parsed.rows.find((r) => r.name === 'Maya Rosenberg')!;
    expect(maya.rowNumber).toBe(2); // row 1 is the header
  });

  it('keeps every original cell for audit', () => {
    const maya = parsed.rows.find((r) => r.name === 'Maya Rosenberg')!;
    expect(maya.raw['Credentials']).toBe('Somatic Experiencing');
    expect(maya.raw['Website']).toBe('mayasomatics.com');
  });
});
