import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UploadService } from '../upload/upload.service';
import { Role, VerificationStatus } from '@prisma/client';
import { UpdateGuideProfileDto } from './dto/update-profile.dto';
import { SetCategoriesDto } from './dto/set-categories.dto';
import { AddCredentialDto } from './dto/add-credential.dto';
import { SetCalendarDto } from './dto/set-calendar.dto';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class GuidesService {
  private readonly logger = new Logger(GuidesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
  ) {}

  // ─── Categories ─────────────────────────────────────────────────────────────

  async listCategories() {
    return this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        subcategories: {
          where: { isApproved: true },
          orderBy: { name: 'asc' },
        },
      },
    });
  }

  // ─── Onboarding: Start ──────────────────────────────────────────────────────

  async startOnboarding(userId: string) {
    const existing = await this.prisma.guideProfile.findUnique({ where: { userId } });
    if (existing) return existing;

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });

    const baseSlug = slugify(`${user.firstName} ${user.lastName}`);
    const slug = await this.ensureUniqueSlug(baseSlug);

    const [guideProfile] = await Promise.all([
      this.prisma.guideProfile.create({
        data: {
          userId,
          slug,
          displayName: `${user.firstName} ${user.lastName}`,
          verificationStatus: VerificationStatus.PENDING,
        },
      }),
      this.prisma.userRole.upsert({
        where: { userId_role: { userId, role: Role.GUIDE } },
        create: { userId, role: Role.GUIDE },
        update: {},
      }),
    ]);

    this.logger.log(`Guide onboarding started: user=${userId} profile=${guideProfile.id}`);
    return guideProfile;
  }

  // ─── Onboarding: Update Profile ─────────────────────────────────────────────

  async updateProfile(userId: string, dto: UpdateGuideProfileDto) {
    const guide = await this.findGuideByUserId(userId);

    const profileData: Record<string, unknown> = {};
    const fields = ['displayName', 'tagline', 'bio', 'location', 'timezone',
                    'websiteUrl', 'instagramUrl', 'youtubeUrl'] as const;
    for (const f of fields) {
      if (dto[f] !== undefined) profileData[f] = dto[f];
    }

    if (dto.languages !== undefined) profileData['languages'] = dto.languages;

    const userPatch: Record<string, unknown> = {};
    if (dto.avatarS3Key) userPatch['avatarUrl'] = this.uploadService.getFileUrl(dto.avatarS3Key);
    if (dto.phone !== undefined) userPatch['phone'] = dto.phone;
    if (Object.keys(userPatch).length > 0) {
      await this.prisma.user.update({ where: { id: userId }, data: userPatch });
    }

    return this.prisma.guideProfile.update({ where: { id: guide.id }, data: profileData });
  }

  // ─── Onboarding: Set Categories ─────────────────────────────────────────────

  async setCategories(userId: string, dto: SetCategoriesDto) {
    const guide = await this.findGuideByUserId(userId);

    await this.prisma.guideCategory.deleteMany({ where: { guideId: guide.id } });

    for (const selection of dto.categories) {
      const category = await this.prisma.category.findUnique({ where: { id: selection.categoryId } });
      if (!category) throw new NotFoundException(`Category ${selection.categoryId} not found`);

      const customSubIds: string[] = [];
      for (const name of selection.customSubcategoryNames ?? []) {
        const slug = slugify(name);
        const sub = await this.prisma.subcategory.upsert({
          where: { categoryId_slug: { categoryId: selection.categoryId, slug } },
          create: { categoryId: selection.categoryId, name, slug, isCustom: true, isApproved: false },
          update: {},
        });
        customSubIds.push(sub.id);
      }

      const allSubIds = [...(selection.subcategoryIds ?? []), ...customSubIds];

      if (allSubIds.length > 0) {
        for (const subcategoryId of allSubIds) {
          await this.prisma.guideCategory.create({
            data: { guideId: guide.id, categoryId: selection.categoryId, subcategoryId },
          });
        }
      } else {
        await this.prisma.guideCategory.create({
          data: { guideId: guide.id, categoryId: selection.categoryId },
        });
      }
    }

    const profilePatch: Record<string, unknown> = {};
    if (dto.modalities !== undefined) profilePatch['modalities'] = dto.modalities;
    if (dto.issuesHelped !== undefined) profilePatch['issuesHelped'] = dto.issuesHelped;
    if (Object.keys(profilePatch).length > 0) {
      await this.prisma.guideProfile.update({ where: { id: guide.id }, data: profilePatch });
    }

    return this.prisma.guideProfile.findUnique({
      where: { id: guide.id },
      include: { categories: { include: { category: true, subcategory: true } } },
    });
  }

  // ─── Onboarding: Add Credential ─────────────────────────────────────────────

  async addCredential(userId: string, dto: AddCredentialDto) {
    const guide = await this.findGuideByUserId(userId);

    const documentUrl = dto.documentS3Key
      ? this.uploadService.getFileUrl(dto.documentS3Key)
      : undefined;

    return this.prisma.credential.create({
      data: {
        guideId: guide.id,
        title: dto.title,
        institution: dto.institution,
        issuedYear: dto.issuedYear,
        documentUrl,
        verificationStatus: VerificationStatus.PENDING,
      },
    });
  }

  // ─── Onboarding: Delete Credential ──────────────────────────────────────────

  async deleteCredential(userId: string, credentialId: string) {
    const guide = await this.findGuideByUserId(userId);
    const credential = await this.prisma.credential.findUnique({ where: { id: credentialId } });
    if (!credential || credential.guideId !== guide.id) {
      throw new ForbiddenException('Credential not found');
    }
    await this.prisma.credential.delete({ where: { id: credentialId } });
    return { deleted: true };
  }

  // ─── Onboarding: Save Calendar Settings ────────────────────────────────────

  async saveCalendarSettings(userId: string, dto: SetCalendarDto) {
    const guide = await this.findGuideByUserId(userId);
    const data: Record<string, unknown> = {};
    if (dto.calendarType !== undefined) data['calendarType'] = dto.calendarType;
    if (dto.calendarLink !== undefined) data['calendarLink'] = dto.calendarLink;
    if (dto.sessionPricingJson !== undefined) data['sessionPricingJson'] = dto.sessionPricingJson;
    return this.prisma.guideProfile.update({ where: { id: guide.id }, data });
  }

  // ─── Save Calendly OAuth Tokens ─────────────────────────────────────────────

  async saveCalendlyTokens(
    userId: string,
    tokens: { accessToken: string; refreshToken: string; userUri: string },
  ) {
    const guide = await this.findGuideByUserId(userId);
    return this.prisma.guideProfile.update({
      where: { id: guide.id },
      data: {
        calendarType: 'Calendly',
        calendlyConnected: true,
        calendlyAccessToken: tokens.accessToken,
        calendlyRefreshToken: tokens.refreshToken,
        calendlyUserUri: tokens.userUri,
      },
    });
  }

    // ─── Onboarding: Submit ─────────────────────────────────────────────────────

  async submitOnboarding(userId: string) {
    const guide = await this.findGuideByUserId(userId, true);

    if (guide.verificationStatus === VerificationStatus.IN_REVIEW) {
      throw new ConflictException('Already submitted and under review');
    }
    if (guide.verificationStatus === VerificationStatus.APPROVED) {
      throw new ConflictException('Guide is already verified');
    }

    const guideWithRelations = guide as typeof guide & {
      categories?: unknown[];
      credentials?: unknown[];
    };

    if (!guideWithRelations.bio && !guideWithRelations.tagline) {
      throw new BadRequestException('Profile bio or tagline required before submitting');
    }
    if (!(guideWithRelations.categories as unknown[]).length) {
      throw new BadRequestException('At least one category required before submitting');
    }

    const updated = await this.prisma.guideProfile.update({
      where: { id: guide.id },
      data: { verificationStatus: VerificationStatus.IN_REVIEW },
    });

    this.logger.log(`Guide ${guide.id} submitted for verification`);
    // VerificationService.enqueueGuideVerification(guide.id) called from controller
    return updated;
  }

  // ─── Onboarding: Get Status ─────────────────────────────────────────────────

  async getOnboardingStatus(userId: string) {
    const guide = await this.prisma.guideProfile.findUnique({
      where: { userId },
      include: { categories: true, credentials: true },
    });

    if (!guide) return { started: false };

    return {
      started: true,
      guideId: guide.id,
      displayName: guide.displayName,
      verificationStatus: guide.verificationStatus,
      isPublished: guide.isPublished,
      isVerified: guide.isVerified,
      categoriesSet: guide.categories.length > 0,
      credentialsCount: guide.credentials.length,
      completedSteps: this.resolveCompletedSteps(guide),
    };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  async findGuideByUserId(userId: string, includeRelations = false) {
    const guide = await this.prisma.guideProfile.findUnique({
      where: { userId },
      include: includeRelations ? { categories: true, credentials: true } : undefined,
    });
    if (!guide) throw new NotFoundException('Guide profile not found — start onboarding first');
    return guide;
  }

  private resolveCompletedSteps(guide: {
    bio: string | null;
    tagline: string | null;
    displayName: string;
    categories: unknown[];
    credentials: unknown[];
    verificationStatus: VerificationStatus;
  }): number[] {
    const steps = [0];
    if (guide.categories.length > 0) steps.push(1);
    if (guide.bio || guide.tagline || guide.displayName) steps.push(2);
    if (guide.credentials.length > 0) steps.push(3);
    if (([VerificationStatus.IN_REVIEW, VerificationStatus.APPROVED] as VerificationStatus[]).includes(guide.verificationStatus)) {
      steps.push(4);
    }
    return steps;
  }

  // ─── Public: Guide Profile by Slug ──────────────────────────────────────────

  async getPublicProfile(slug: string) {
    const guide = await this.prisma.guideProfile.findUnique({
      where: { slug },
      include: {
        user: { select: { firstName: true, lastName: true, avatarUrl: true, createdAt: true } },
        categories: {
          include: {
            category: { select: { id: true, name: true, slug: true } },
            subcategory: { select: { id: true, name: true } },
          },
        },
        credentials: {
          where: { verifiedAt: { not: null } },
          select: { id: true, title: true, institution: true, issuedYear: true },
        },
      },
    });

    if (!guide) throw new NotFoundException(`Guide not found: ${slug}`);

    // Group category tags for display
    const tags = guide.categories.map((gc) => ({
      category: gc.category.name,
      subcategory: gc.subcategory?.name ?? null,
      isVerified: guide.verificationStatus === 'APPROVED',
    }));

    return {
      id: guide.id,
      slug: guide.slug,
      displayName: guide.displayName,
      tagline: guide.tagline,
      bio: guide.bio,
      location: guide.location,
      avatarUrl: guide.user.avatarUrl,
      websiteUrl: guide.websiteUrl,
      instagramUrl: guide.instagramUrl,
      youtubeUrl: guide.youtubeUrl,
      verificationStatus: guide.verificationStatus,
      isVerified: guide.verificationStatus === 'APPROVED',
      tags,
      credentials: guide.credentials,
      // stats placeholders — will be live when booking/review modules are built
      stats: { rating: null, sessions: 0, reviews: 0, yearsExperience: null },
      memberSince: guide.user.createdAt,
    };
  }

  private async ensureUniqueSlug(base: string): Promise<string> {
    let slug = base;
    let attempt = 0;
    while (true) {
      const exists = await this.prisma.guideProfile.findUnique({ where: { slug } });
      if (!exists) return slug;
      slug = `${base}-${++attempt}`;
    }
  }
}
