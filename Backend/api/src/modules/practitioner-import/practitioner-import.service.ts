import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import {
  ImportBatchStatus,
  OnboardingPath,
  ProspectStatus,
  Role,
  SuppressionReason,
  VerificationStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { parsePractitionerWorkbook, ParsedRow } from './spreadsheet-parser';
import { resolveCategory } from './category-map';

/** Statuses that will become accounts when the batch is committed. */
const IMPORTABLE: ProspectStatus[] = [ProspectStatus.PENDING];

/** Rows an admin can still rescue by supplying an email. */
const RESCUABLE: ProspectStatus[] = [
  ProspectStatus.SKIPPED_NO_EMAIL,
  ProspectStatus.SKIPPED_DUPLICATE,
  ProspectStatus.NEEDS_REVIEW,
];

@Injectable()
export class PractitionerImportService {
  private readonly logger = new Logger(PractitionerImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ─── Suppression ───────────────────────────────────────────────────────────

  /**
   * One-way hash of an address, so a practitioner who asked to be removed can
   * be recognised on a future import without us keeping their address.
   *
   * Falls back to the JWT secret when `EMAIL_HASH_SECRET` is unset so this
   * can't silently hash with an empty key — but rotating that secret would
   * orphan every existing tombstone and let deleted people be re-imported, so
   * production must set a dedicated one.
   */
  hashEmail(email: string): string {
    const secret =
      this.config.get<string>('EMAIL_HASH_SECRET') ??
      this.config.get<string>('JWT_ACCESS_SECRET');
    if (!secret) {
      throw new Error('EMAIL_HASH_SECRET (or JWT_ACCESS_SECRET) must be set to hash suppressions');
    }
    if (!this.config.get<string>('EMAIL_HASH_SECRET')) {
      this.logger.warn(
        'EMAIL_HASH_SECRET is not set — falling back to JWT_ACCESS_SECRET. Rotating that secret will orphan every suppression tombstone.',
      );
    }
    return createHmac('sha256', secret).update(email.trim().toLowerCase()).digest('hex');
  }

  async isSuppressed(email: string): Promise<boolean> {
    const row = await this.prisma.emailSuppression.findUnique({
      where: { emailHash: this.hashEmail(email) },
      select: { id: true },
    });
    return !!row;
  }

  async suppress(email: string, reason: SuppressionReason, note?: string) {
    return this.prisma.emailSuppression.upsert({
      where: { emailHash: this.hashEmail(email) },
      update: { reason, note },
      create: { emailHash: this.hashEmail(email), reason, note },
    });
  }

  // ─── Upload + parse ────────────────────────────────────────────────────────

  /**
   * Parse a workbook into prospects. Creates nothing but the batch and its
   * rows — no user accounts, no email. Committing is a separate, explicit act,
   * because a bulk operation that writes 300 accounts off one click is how a
   * bad file becomes a bad database.
   */
  async uploadAndParse(
    adminUserId: string,
    file: { originalname: string; buffer: Buffer; size: number },
    sourceLabel?: string,
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('No file received.');

    let parsed;
    try {
      parsed = await parsePractitionerWorkbook(file.buffer);
    } catch (err: any) {
      this.logger.error(`Workbook parse failed (${file.originalname}): ${err?.message}`);
      throw new BadRequestException(
        'That file could not be read as a spreadsheet. Export it as .xlsx and try again.',
      );
    }

    if (parsed.totalRows === 0) {
      throw new BadRequestException('No data rows found — is the first row of each sheet a header?');
    }

    const classified = await this.classifyRows(parsed.rows);

    const batch = await this.prisma.importBatch.create({
      data: {
        filename: file.originalname,
        sourceLabel: sourceLabel?.trim() || null,
        uploadedById: adminUserId,
        status: ImportBatchStatus.DRAFT,
        rowsTotal: classified.length,
        rowsImportable: classified.filter((r) => IMPORTABLE.includes(r.status)).length,
        prospects: {
          create: classified.map((row) => ({
            sheetName: row.sheetName,
            rowNumber: row.rowNumber,
            fingerprint: row.fingerprint,
            rawJson: row.raw,
            name: row.name,
            email: row.email,
            city: row.city,
            modality: row.modality,
            websiteUrl: row.websiteUrl,
            categorySlug: row.categorySlug,
            subcategorySlug: row.subcategorySlug,
            status: row.status,
            skipReason: row.skipReason,
            workedNote: row.workedNote,
            workedAt: row.workedAt,
          })),
        },
      },
      select: { id: true },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'admin.practitionerImport.upload',
        entity: 'ImportBatch',
        entityId: batch.id,
        newValue: {
          filename: file.originalname,
          rows: classified.length,
          sheets: parsed.sheets.map((s) => ({
            name: s.name,
            rows: s.rows.length,
            unmappedHeaders: s.unmappedHeaders,
          })),
        },
      },
    });

    return this.getBatch(batch.id);
  }

  /**
   * Decide what happens to each parsed row. Order is deliberate: the cheapest
   * and most absolute exclusions come first, so a suppressed practitioner is
   * never reported as merely "duplicate", and commentary rows never reach the
   * name-shape checks.
   */
  private async classifyRows(rows: ParsedRow[]) {
    const emails = [...new Set(rows.map((r) => r.email).filter((e): e is string => !!e))];

    // One query each rather than per-row lookups: 300 rows × 3 queries is a
    // needlessly slow upload.
    const [existingUsers, suppressions, priorProspects] = await Promise.all([
      this.prisma.user.findMany({
        where: { email: { in: emails } },
        select: { email: true },
      }),
      this.prisma.emailSuppression.findMany({
        where: { emailHash: { in: emails.map((e) => this.hashEmail(e)) } },
        select: { emailHash: true },
      }),
      this.prisma.importedProspect.findMany({
        where: { fingerprint: { in: rows.map((r) => this.fingerprint(r)) } },
        select: { fingerprint: true, status: true, workedNote: true, workedAt: true },
      }),
    ]);

    const takenEmails = new Set(existingUsers.map((u) => u.email.toLowerCase()));
    const suppressedHashes = new Set(suppressions.map((s) => s.emailHash));
    const priorByFingerprint = new Map(priorProspects.map((p) => [p.fingerprint, p]));
    const seenEmails = new Set<string>();

    return rows.map((row) => {
      const fingerprint = this.fingerprint(row);
      const prior = priorByFingerprint.get(fingerprint);
      const category = resolveCategory(row.sheetName, row.modality);

      const base = {
        sheetName: row.sheetName,
        rowNumber: row.rowNumber,
        fingerprint,
        raw: row.raw as any,
        name: row.name,
        email: row.email,
        city: row.city,
        modality: row.modality,
        websiteUrl: row.websiteUrl,
        categorySlug: category?.categorySlug ?? null,
        subcategorySlug: category?.subcategorySlug ?? null,
        // Outreach notes survive a re-import — losing them would make people
        // re-chase practitioners who already said no.
        workedNote: prior?.workedNote ?? null,
        workedAt: prior?.workedAt ?? null,
      };

      const skip = (status: ProspectStatus, skipReason: string) => ({ ...base, status, skipReason });

      // An exclusion the admin made previously outranks everything.
      if (prior?.status === ProspectStatus.EXCLUDED) {
        return skip(ProspectStatus.EXCLUDED, 'Excluded by an admin on a previous import');
      }
      if (row.isCommentary || !row.name) {
        return skip(ProspectStatus.SKIPPED_NOT_A_PERSON, 'Row is source commentary, not a practitioner');
      }
      if (!row.email) {
        return skip(
          ProspectStatus.SKIPPED_NO_EMAIL,
          row.directoryUrl
            ? 'No email — the listed contact is a third-party directory profile'
            : 'No email address in the row',
        );
      }
      if (suppressedHashes.has(this.hashEmail(row.email))) {
        return skip(
          ProspectStatus.SKIPPED_SUPPRESSED,
          'This address previously asked to be removed — do not contact',
        );
      }
      if (takenEmails.has(row.email)) {
        return skip(ProspectStatus.SKIPPED_DUPLICATE, 'An account already exists for this address');
      }
      if (seenEmails.has(row.email)) {
        return skip(
          ProspectStatus.SKIPPED_DUPLICATE,
          'Another row in this file uses the same address (shared inbox)',
        );
      }
      seenEmails.add(row.email);

      if (row.looksLikeOrganisation) {
        return {
          ...base,
          status: ProspectStatus.NEEDS_REVIEW,
          skipReason: 'Name reads as an organisation — confirm how it should be addressed',
        };
      }
      if (!category) {
        return {
          ...base,
          status: ProspectStatus.NEEDS_REVIEW,
          skipReason: `Sheet "${row.sheetName}" has no category mapping — set one before committing`,
        };
      }

      return { ...base, status: ProspectStatus.PENDING, skipReason: null };
    });
  }

  /**
   * Stable identity for a practitioner across re-imports. Deliberately excludes
   * the email: an admin adding a missing address by hand must not turn the row
   * into a different person on the next upload.
   */
  private fingerprint(row: { sheetName: string; name: string; city: string | null }): string {
    const key = [row.sheetName, row.name, row.city ?? '']
      .map((part) => (part || '').trim().toLowerCase().replace(/\s+/g, ' '))
      .join('|');
    return createHmac('sha256', 'import-fingerprint').update(key).digest('hex').slice(0, 32);
  }

  // ─── Reads ─────────────────────────────────────────────────────────────────

  async listBatches() {
    return this.prisma.importBatch.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        uploadedBy: { select: { firstName: true, lastName: true, email: true } },
        _count: { select: { prospects: true } },
      },
    });
  }

  async getBatch(batchId: string) {
    const batch = await this.prisma.importBatch.findUnique({
      where: { id: batchId },
      include: { uploadedBy: { select: { firstName: true, lastName: true, email: true } } },
    });
    if (!batch) throw new NotFoundException('Import batch not found');

    const [byStatus, bySheet] = await Promise.all([
      this.prisma.importedProspect.groupBy({
        by: ['status'],
        where: { batchId },
        _count: { _all: true },
      }),
      this.prisma.importedProspect.groupBy({
        by: ['sheetName'],
        where: { batchId },
        _count: { _all: true },
      }),
    ]);

    return {
      ...batch,
      counts: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
      sheets: bySheet
        .map((s) => ({ name: s.sheetName, rows: s._count._all }))
        .sort((a, b) => b.rows - a.rows),
    };
  }

  async listRows(
    batchId: string,
    opts: { status?: ProspectStatus; sheet?: string; q?: string; page?: number; limit?: number },
  ) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(200, Math.max(1, opts.limit ?? 50));

    const where = {
      batchId,
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.sheet ? { sheetName: opts.sheet } : {}),
      ...(opts.q
        ? {
            OR: [
              { name: { contains: opts.q, mode: 'insensitive' as const } },
              { email: { contains: opts.q, mode: 'insensitive' as const } },
              { city: { contains: opts.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.importedProspect.findMany({
        where,
        orderBy: [{ sheetName: 'asc' }, { rowNumber: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.importedProspect.count({ where }),
    ]);

    return { rows, total, page, limit, pages: Math.ceil(total / limit) };
  }

  /**
   * One row with everything the spreadsheet said about it. `rawJson` is what
   * lets an admin judge a skip reason without opening the original file.
   */
  async getRow(rowId: string) {
    const row = await this.prisma.importedProspect.findUnique({
      where: { id: rowId },
      include: {
        batch: { select: { id: true, filename: true, sourceLabel: true, status: true } },
      },
    });
    if (!row) throw new NotFoundException('Prospect not found');
    return row;
  }

  // ─── Row edits ─────────────────────────────────────────────────────────────

  /**
   * Edit a prospect before commit — chiefly the inline "add email" that turns a
   * skipped row into an importable one. This is the workflow that reaches the
   * practitioners whose address wasn't in the file at all, so a supplied
   * address is re-run through the same checks the import applies: an admin
   * pasting a suppressed or already-registered address must not bypass them.
   */
  async updateRow(
    adminUserId: string,
    rowId: string,
    dto: { email?: string; name?: string; city?: string; workedNote?: string },
  ) {
    const row = await this.prisma.importedProspect.findUnique({ where: { id: rowId } });
    if (!row) throw new NotFoundException('Prospect not found');
    if (row.status === ProspectStatus.ACCOUNT_CREATED) {
      throw new BadRequestException('This row already has an account — edit the guide instead.');
    }

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.city !== undefined) data.city = dto.city.trim() || null;
    if (dto.workedNote !== undefined) {
      data.workedNote = dto.workedNote.trim() || null;
      data.workedAt = dto.workedNote.trim() ? new Date() : null;
    }

    if (dto.email !== undefined) {
      const email = dto.email.trim().toLowerCase();
      if (!email) {
        data.email = null;
        data.status = ProspectStatus.SKIPPED_NO_EMAIL;
        data.skipReason = 'Email removed by an admin';
      } else {
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) {
          throw new BadRequestException('That does not look like an email address.');
        }
        if (await this.isSuppressed(email)) {
          throw new BadRequestException(
            'That address previously asked to be removed from Spiritual California. It cannot be re-added.',
          );
        }
        const taken = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
        if (taken) {
          data.email = email;
          data.status = ProspectStatus.SKIPPED_DUPLICATE;
          data.skipReason = 'An account already exists for this address';
        } else {
          const clash = await this.prisma.importedProspect.findFirst({
            where: { batchId: row.batchId, email, id: { not: rowId }, status: { in: IMPORTABLE } },
            select: { id: true },
          });
          data.email = email;
          data.status = clash ? ProspectStatus.SKIPPED_DUPLICATE : ProspectStatus.PENDING;
          data.skipReason = clash ? 'Another row in this batch already uses this address' : null;
        }
      }
    }

    const updated = await this.prisma.importedProspect.update({ where: { id: rowId }, data });
    await this.refreshImportableCount(row.batchId);

    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'admin.practitionerImport.updateRow',
        entity: 'ImportedProspect',
        entityId: rowId,
        oldValue: { email: row.email, status: row.status },
        newValue: { email: updated.email, status: updated.status },
      },
    });

    return updated;
  }

  /** Approve a NEEDS_REVIEW row (organisation name, unmapped sheet) for import. */
  async approveRow(adminUserId: string, rowId: string) {
    const row = await this.prisma.importedProspect.findUnique({ where: { id: rowId } });
    if (!row) throw new NotFoundException('Prospect not found');
    if (row.status !== ProspectStatus.NEEDS_REVIEW) {
      throw new BadRequestException('Only rows awaiting review can be approved.');
    }
    if (!row.email) throw new BadRequestException('Add an email address before approving this row.');
    if (!row.categorySlug) {
      throw new BadRequestException(
        'This row has no category. Its sheet is unmapped — add a mapping before importing it.',
      );
    }

    const updated = await this.prisma.importedProspect.update({
      where: { id: rowId },
      data: { status: ProspectStatus.PENDING, skipReason: null },
    });
    await this.refreshImportableCount(row.batchId);
    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'admin.practitionerImport.approveRow',
        entity: 'ImportedProspect',
        entityId: rowId,
      },
    });
    return updated;
  }

  /** Exclude a row permanently. Survives re-imports of the same list. */
  async excludeRow(adminUserId: string, rowId: string, reason?: string) {
    const row = await this.prisma.importedProspect.findUnique({ where: { id: rowId } });
    if (!row) throw new NotFoundException('Prospect not found');
    if (row.status === ProspectStatus.ACCOUNT_CREATED) {
      throw new BadRequestException('This row already has an account — deactivate the guide instead.');
    }

    const updated = await this.prisma.importedProspect.update({
      where: { id: rowId },
      data: {
        status: ProspectStatus.EXCLUDED,
        skipReason: reason?.trim() || 'Excluded by an admin',
      },
    });
    await this.refreshImportableCount(row.batchId);
    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'admin.practitionerImport.excludeRow',
        entity: 'ImportedProspect',
        entityId: rowId,
        newValue: { reason: reason ?? null },
      },
    });
    return updated;
  }

  private async refreshImportableCount(batchId: string) {
    const rowsImportable = await this.prisma.importedProspect.count({
      where: { batchId, status: { in: IMPORTABLE } },
    });
    await this.prisma.importBatch.update({ where: { id: batchId }, data: { rowsImportable } });
  }

  // ─── Commit ────────────────────────────────────────────────────────────────

  /**
   * Turn every importable row into an invited guide account.
   *
   * Each row commits in its own transaction, so one bad row can't roll back the
   * batch — with 300 rows off a hand-made spreadsheet, something will be wrong,
   * and losing 299 good accounts to it would be absurd. Failures are recorded
   * on the row and reported.
   *
   * Accounts land deliberately inert: no password (nobody can log in, including
   * us), unverified email, unpublished and unverified profile, so they fail the
   * public visibility gate. Nothing is emailed here — sending is Phase 3.
   */
  async commit(adminUserId: string, batchId: string) {
    const batch = await this.prisma.importBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new NotFoundException('Import batch not found');
    if (batch.status === ImportBatchStatus.ARCHIVED) {
      throw new BadRequestException('This batch is archived.');
    }

    const rows = await this.prisma.importedProspect.findMany({
      where: { batchId, status: { in: IMPORTABLE } },
      orderBy: [{ sheetName: 'asc' }, { rowNumber: 'asc' }],
    });
    if (rows.length === 0) {
      throw new BadRequestException('Nothing to import — no rows are marked ready.');
    }

    const categories = await this.loadCategoryIds();
    let created = 0;
    const failures: Array<{ rowId: string; name: string; reason: string }> = [];

    for (const row of rows) {
      try {
        await this.createAccountForProspect(row, batch.id, categories);
        created++;
      } catch (err: any) {
        const reason = this.explainCommitFailure(err);
        failures.push({ rowId: row.id, name: row.name, reason });
        // A unique-constraint clash genuinely is a duplicate. Anything else is
        // unexplained, and labelling it "duplicate" would send the admin looking
        // for a conflict that doesn't exist — park it for review instead.
        const status =
          err?.code === 'P2002' ? ProspectStatus.SKIPPED_DUPLICATE : ProspectStatus.NEEDS_REVIEW;
        await this.prisma.importedProspect.update({
          where: { id: row.id },
          data: { status, skipReason: reason },
        });
        this.logger.warn(`Import row ${row.id} (${row.name}) failed: ${reason}`);
      }
    }

    const updated = await this.prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: ImportBatchStatus.COMMITTED,
        committedAt: new Date(),
        accountsCreated: { increment: created },
        rowsImportable: await this.prisma.importedProspect.count({
          where: { batchId, status: { in: IMPORTABLE } },
        }),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'admin.practitionerImport.commit',
        entity: 'ImportBatch',
        entityId: batchId,
        newValue: { created, failed: failures.length, failures: failures.slice(0, 20) },
      },
    });

    return { batch: updated, created, failed: failures.length, failures };
  }

  private async createAccountForProspect(
    row: {
      id: string;
      name: string;
      email: string | null;
      city: string | null;
      modality: string | null;
      websiteUrl: string | null;
      categorySlug: string | null;
      subcategorySlug: string | null;
    },
    batchId: string,
    categories: Map<string, { categoryId: string; subcategories: Map<string, string> }>,
  ) {
    if (!row.email) throw new BadRequestException('Row has no email address');

    const { firstName, lastName } = splitName(row.name);
    const slug = await this.uniqueGuideSlug(row.name);

    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: row.email!,
          firstName,
          lastName,
          // No password: the account cannot be logged into by anyone, including
          // us, until the practitioner claims it and sets one.
          passwordHash: null,
          isEmailVerified: false,
          isActive: true,
          roles: { create: { role: Role.GUIDE } },
          guideProfile: {
            create: {
              slug,
              displayName: row.name,
              city: row.city,
              location: row.city,
              websiteUrl: row.websiteUrl,
              modalities: row.modality ? [row.modality] : [],
              onboardingPath: OnboardingPath.PROACTIVE_INVITE,
              importBatchId: batchId,
              // Fails the public visibility gate on all three counts, so the
              // profile is invisible until they claim, complete and verify it.
              isPublished: false,
              isVerified: false,
              verificationStatus: VerificationStatus.PENDING,
            },
          },
        },
        select: { id: true, guideProfile: { select: { id: true } } },
      });

      const category = row.categorySlug ? categories.get(row.categorySlug) : undefined;
      if (category && user.guideProfile) {
        const subcategoryId = row.subcategorySlug
          ? category.subcategories.get(row.subcategorySlug)
          : undefined;
        await tx.guideCategory.create({
          data: {
            guideId: user.guideProfile.id,
            categoryId: category.categoryId,
            subcategoryId: subcategoryId ?? null,
          },
        });
      }

      await tx.importedProspect.update({
        where: { id: row.id },
        data: { status: ProspectStatus.ACCOUNT_CREATED, skipReason: null, userId: user.id },
      });
    });
  }

  private explainCommitFailure(err: any): string {
    if (err?.code === 'P2002') {
      const target = Array.isArray(err?.meta?.target) ? err.meta.target.join(', ') : 'a unique field';
      return `Conflicts with an existing record (${target}) — created between preview and commit`;
    }
    return err?.message ?? 'Unknown error';
  }

  private async loadCategoryIds() {
    const rows = await this.prisma.category.findMany({
      select: { id: true, slug: true, subcategories: { select: { id: true, slug: true } } },
    });
    return new Map(
      rows.map((c) => [
        c.slug,
        { categoryId: c.id, subcategories: new Map(c.subcategories.map((s) => [s.slug, s.id])) },
      ]),
    );
  }

  /**
   * Reserve the practitioner's preferred URL at import time so it is still
   * theirs when they claim the account.
   */
  private async uniqueGuideSlug(name: string): Promise<string> {
    const base =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'practitioner';

    let candidate = base;
    for (let i = 2; i < 100; i++) {
      const taken = await this.prisma.guideProfile.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!taken) return candidate;
      candidate = `${base}-${i}`;
    }
    return `${base}-${Date.now().toString(36)}`;
  }

  // ─── Housekeeping ──────────────────────────────────────────────────────────

  async archiveBatch(adminUserId: string, batchId: string) {
    const batch = await this.prisma.importBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new NotFoundException('Import batch not found');

    const updated = await this.prisma.importBatch.update({
      where: { id: batchId },
      data: { status: ImportBatchStatus.ARCHIVED },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'admin.practitionerImport.archive',
        entity: 'ImportBatch',
        entityId: batchId,
      },
    });
    return updated;
  }

  /** CSV of the current filter, for outreach done outside the admin panel. */
  async exportRowsCsv(batchId: string, status?: ProspectStatus, sheet?: string): Promise<string> {
    const rows = await this.prisma.importedProspect.findMany({
      where: { batchId, ...(status ? { status } : {}), ...(sheet ? { sheetName: sheet } : {}) },
      orderBy: [{ sheetName: 'asc' }, { rowNumber: 'asc' }],
    });

    const header = ['Sheet', 'Row', 'Name', 'Email', 'City', 'Modality', 'Website', 'Status', 'Reason', 'Worked note'];
    const escape = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = rows.map((r) =>
      [r.sheetName, r.rowNumber, r.name, r.email, r.city, r.modality, r.websiteUrl, r.status, r.skipReason, r.workedNote]
        .map(escape)
        .join(','),
    );
    return [header.join(','), ...lines].join('\n');
  }

  static get rescuableStatuses(): ProspectStatus[] {
    return RESCUABLE;
  }
}

/**
 * "Maya Rosenberg" → first/last. A single-word name keeps the surname empty
 * rather than duplicating the token, which would read as "Sasha Sasha" on every
 * profile and email.
 */
export function splitName(full: string): { firstName: string; lastName: string } {
  const parts = (full || '').replace(/\s+/g, ' ').trim().split(' ');
  if (parts.length === 0 || !parts[0]) return { firstName: 'Practitioner', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}
