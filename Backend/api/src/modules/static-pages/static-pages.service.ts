import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpsertStaticPageDto } from './dto/upsert-static-page.dto';

@Injectable()
export class StaticPagesService {
  constructor(private readonly prisma: PrismaService) {}

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
    return this.prisma.staticPage.create({
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

    return this.prisma.staticPage.update({
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
  }

  async delete(id: string) {
    const existing = await this.prisma.staticPage.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Static page not found');
    await this.prisma.staticPage.delete({ where: { id } });
    return { success: true };
  }
}
