import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { UpsertStaticPageDto } from './dto/upsert-static-page.dto';

@Injectable()
export class StaticPagesService {
  private readonly logger = new Logger(StaticPagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Fire-and-forget: tell the Next.js frontend to drop its ISR cache for
   * this slug so admin edits appear immediately instead of waiting for the
   * 5-minute revalidate window. Swallows errors — the DB write is
   * authoritative; cache staleness is a soft UX problem, not a hard failure.
   */
  private async revalidateOnWeb(slug: string): Promise<void> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL');
    const secret = this.config.get<string>('STATIC_PAGE_REVALIDATE_SECRET');

    if (!frontendUrl || !secret) {
      this.logger.warn(
        `Skipping revalidation for "${slug}" — FRONTEND_URL or STATIC_PAGE_REVALIDATE_SECRET not set. Public page may be stale for up to 5 minutes.`,
      );
      return;
    }

    const url = `${frontendUrl.replace(/\/$/, '')}/api/revalidate-static-page`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, secret }),
        // Short timeout — we don't want admin saves to hang on a slow Next box.
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.logger.warn(
          `Revalidation webhook returned ${res.status} for "${slug}": ${text}`,
        );
      }
    } catch (err: any) {
      this.logger.warn(
        `Revalidation webhook failed for "${slug}": ${err?.message ?? err}`,
      );
    }
  }

  /**
   * Admin: full list, drafts + published. Used by the admin CRUD page.
   * Returns summaries only (no body) to keep the list light.
   */
  async listAll() {
    return this.prisma.staticPage.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        slug: true,
        title: true,
        isPublished: true,
        publishedAt: true,
        updatedAt: true,
        createdAt: true,
      },
    });
  }

  /** Admin: fetch a single row by id for the edit form. */
  async findById(id: string) {
    const page = await this.prisma.staticPage.findUnique({ where: { id } });
    if (!page) throw new NotFoundException('Static page not found');
    return page;
  }

  /**
   * Public: render by slug. Never returns drafts — if `isPublished` is false
   * we return 404 so the site treats it the same as "no such page".
   */
  async findPublicBySlug(slug: string) {
    const page = await this.prisma.staticPage.findUnique({
      where: { slug },
    });
    if (!page || !page.isPublished) {
      throw new NotFoundException('Static page not found');
    }
    return page;
  }

  async create(dto: UpsertStaticPageDto) {
    const existing = await this.prisma.staticPage.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new ConflictException(
        `A page with slug "${dto.slug}" already exists`,
      );
    }
    const willPublish = dto.isPublished ?? true;
    const created = await this.prisma.staticPage.create({
      data: {
        slug: dto.slug,
        title: dto.title,
        metaTitle: dto.metaTitle,
        metaDescription: dto.metaDescription,
        eyebrow: dto.eyebrow,
        subtitle: dto.subtitle,
        body: dto.body,
        isPublished: willPublish,
        publishedAt: willPublish ? new Date() : null,
      },
    });
    await this.revalidateOnWeb(created.slug);
    return created;
  }

  /**
   * Update: slug changes are blocked because they'd break every inbound link
   * and any cached sitemap entry. Admins can delete + recreate if they need
   * a new slug.
   */
  async update(id: string, dto: UpsertStaticPageDto) {
    const existing = await this.prisma.staticPage.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Static page not found');

    if (dto.slug && dto.slug !== existing.slug) {
      throw new ConflictException(
        'Slug changes are not allowed. Delete the page and recreate it with the new slug.',
      );
    }

    const willPublish = dto.isPublished ?? existing.isPublished;
    // Only stamp publishedAt on the transition draft → published.
    const publishedAt =
      willPublish && !existing.publishedAt
        ? new Date()
        : !willPublish
          ? null
          : existing.publishedAt;

    const updated = await this.prisma.staticPage.update({
      where: { id },
      data: {
        title: dto.title,
        metaTitle: dto.metaTitle,
        metaDescription: dto.metaDescription,
        eyebrow: dto.eyebrow,
        subtitle: dto.subtitle,
        body: dto.body,
        isPublished: willPublish,
        publishedAt,
      },
    });
    await this.revalidateOnWeb(updated.slug);
    return updated;
  }

  async delete(id: string) {
    const existing = await this.prisma.staticPage.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Static page not found');
    await this.prisma.staticPage.delete({ where: { id } });
    // Revalidate so the deleted slug 404s for visitors instead of serving
    // a cached hit until the ISR window expires.
    await this.revalidateOnWeb(existing.slug);
    return { success: true };
  }
}
