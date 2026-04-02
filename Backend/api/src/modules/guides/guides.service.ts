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
import { ServicesService } from '../services/services.service';
import { EventsService } from '../events/events.service';
import { ProductsService } from '../products/products.service';
import { ReviewsService } from '../reviews/reviews.service';
import { BlogService } from '../blog/blog.service';
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
    private readonly servicesService: ServicesService,
    private readonly eventsService: EventsService,
    private readonly productsService: ProductsService,
    private readonly reviewsService: ReviewsService,
    private readonly blogService: BlogService,
  ) {}

  private async requireGuide(userId: string) {
    const guide = await this.prisma.guideProfile.findUnique({ where: { userId } });
    if (!guide) throw new NotFoundException('Guide profile not found');
    return guide;
  }

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
    const fields = ['displayName', 'tagline', 'bio', 'location', 'studioName',
                    'streetAddress', 'city', 'state', 'zipCode', 'country', 'timezone',
                    'websiteUrl', 'instagramUrl', 'youtubeUrl', 'yearsExperience'] as const;
    for (const f of fields) {
      if (dto[f] !== undefined) profileData[f] = dto[f];
    }

    if (dto.languages !== undefined) profileData['languages'] = dto.languages;
    if (dto.modalities !== undefined) profileData['modalities'] = dto.modalities;

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

    // If disconnecting (nulling out), also clear OAuth tokens
    if (dto.calendarType === null || dto.calendarLink === null) {
      data['calendlyConnected'] = false;
      data['calendlyAccessToken'] = null;
      data['calendlyRefreshToken'] = null;
      data['calendlyUserUri'] = null;
    }

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

  // ─── My Profile (editable fields for dashboard) ────────────────────────────

  async getMyProfile(userId: string) {
    const guide = await this.prisma.guideProfile.findUnique({
      where: { userId },
      include: {
        user: { select: { firstName: true, lastName: true, avatarUrl: true, phone: true } },
        categories: {
          include: {
            category: { select: { id: true, name: true, slug: true } },
            subcategory: { select: { id: true, name: true } },
          },
        },
        credentials: true,
      },
    });

    if (!guide) throw new NotFoundException('Guide profile not found — start onboarding first');

    // Fetch Persona identity verification status
    const personaVerification = await this.prisma.personaVerification.findUnique({
      where: { userId },
      select: { status: true, completedAt: true },
    });

    return {
      id: guide.id,
      slug: guide.slug,
      displayName: guide.displayName,
      tagline: guide.tagline,
      bio: guide.bio,
      location: guide.location,
      studioName: guide.studioName,
      streetAddress: guide.streetAddress,
      city: guide.city,
      state: guide.state,
      zipCode: guide.zipCode,
      country: guide.country,
      timezone: guide.timezone,
      languages: guide.languages,
      modalities: guide.modalities,
      issuesHelped: guide.issuesHelped,
      yearsExperience: guide.yearsExperience,
      websiteUrl: guide.websiteUrl,
      instagramUrl: guide.instagramUrl,
      youtubeUrl: guide.youtubeUrl,
      calendarType: guide.calendarType,
      calendarLink: guide.calendarLink,
      calendlyConnected: guide.calendlyConnected,
      sessionPricingJson: guide.sessionPricingJson,
      isPublished: guide.isPublished,
      isVerified: guide.isVerified,
      verificationStatus: guide.verificationStatus,
      avatarUrl: guide.user.avatarUrl,
      phone: guide.user.phone,
      firstName: guide.user.firstName,
      lastName: guide.user.lastName,
      categories: guide.categories,
      credentials: guide.credentials,
      identityVerification: personaVerification
        ? { status: personaVerification.status, completedAt: personaVerification.completedAt }
        : null,
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

  // ─── Public: Guide Profile by Slug (Aggregated) ────────────────────────────

  async getPublicProfile(slug: string) {
    const guide = await this.prisma.guideProfile.findUnique({
      where: { slug },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            createdAt: true,
          },
        },
        categories: {
          include: {
            category: { select: { id: true, name: true, slug: true } },
            subcategory: { select: { id: true, name: true } },
          },
        },
        credentials: {
          select: {
            id: true,
            title: true,
            institution: true,
            issuedYear: true,
            verificationStatus: true,
            verifiedAt: true,
          },
        },
      },
    });

    if (!guide) throw new NotFoundException(`Guide not found: ${slug}`);

    // Aggregate all related data in parallel
    const [services, events, products, blogPosts, reviewData, testimonials] =
      await Promise.all([
        this.servicesService.findByGuideId(guide.id),
        this.eventsService.findPublishedByGuideId(guide.id),
        this.productsService.findActiveByGuideId(guide.id),
        this.blogService.findPublishedByGuideId(guide.id),
        this.reviewsService.findByGuideUserId(guide.userId, 1, 5),
        this.reviewsService.findTestimonialsByGuideId(guide.id),
      ]);

    // Group category tags
    const tags = guide.categories.map((gc) => ({
      category: gc.category.name,
      categorySlug: gc.category.slug,
      subcategory: gc.subcategory?.name ?? null,
    }));

    // Separate verified/unverified credentials
    const verifiedCredentials = guide.credentials.filter(
      (c) => c.verificationStatus === 'APPROVED' || c.verifiedAt,
    );

    return {
      id: guide.id,
      userId: guide.userId,
      slug: guide.slug,
      displayName: guide.displayName,
      tagline: guide.tagline,
      bio: guide.bio,
      location: guide.location,
      timezone: guide.timezone,
      languages: guide.languages,
      avatarUrl: guide.user.avatarUrl,
      websiteUrl: guide.websiteUrl,
      instagramUrl: guide.instagramUrl,
      youtubeUrl: guide.youtubeUrl,
      calendarType: guide.calendarType,
      calendarLink: guide.calendarLink,
      sessionPricingJson: guide.sessionPricingJson,
      verificationStatus: guide.verificationStatus,
      isVerified: guide.isVerified,
      tags,
      credentials: verifiedCredentials,
      services,
      events,
      products,
      blogPosts,
      reviews: reviewData.reviews,
      reviewStats: {
        averageRating: guide.averageRating,
        totalReviews: guide.totalReviews,
        ratingDistribution: reviewData.ratingDistribution,
      },
      testimonials,
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

  // ─── Public: Guide Services by Slug ─────────────────────────────────────────

  async getPublicServices(slug: string) {
    const guide = await this.prisma.guideProfile.findUnique({
      where: { slug },
      select: { id: true, isPublished: true },
    });

    if (!guide) throw new NotFoundException(`Guide not found: ${slug}`);

    return this.servicesService.findByGuideId(guide.id);
  }

  // ─── Availability Management ───────────────────────────────────────────────

  async getAvailability(userId: string) {
    const guide = await this.requireGuide(userId);
    return this.prisma.availability.findMany({
      where: { guideId: guide.id },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async setAvailability(userId: string, dto: { slots: Array<{ dayOfWeek: number; startTime: string; endTime: string; isRecurring?: boolean; bufferMin?: number }> }) {
    const guide = await this.requireGuide(userId);

    // Replace all existing availability with new slots
    await this.prisma.availability.deleteMany({ where: { guideId: guide.id } });

    if (dto.slots.length === 0) return [];

    await this.prisma.availability.createMany({
      data: dto.slots.map(s => ({
        guideId: guide.id,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        isRecurring: s.isRecurring ?? true,
        bufferMin: s.bufferMin ?? 0,
      })),
    });

    return this.getAvailability(userId);
  }

  async generateBookableSlots(userId: string, daysAhead = 14) {
    const guide = await this.requireGuide(userId);
    const availability = await this.prisma.availability.findMany({ where: { guideId: guide.id } });
    if (availability.length === 0) return [];

    const services = await this.prisma.service.findMany({
      where: { guideId: guide.id, isActive: true },
      select: { id: true, durationMin: true },
    });
    const defaultDuration = services[0]?.durationMin ?? 60;

    // Get already-booked slots
    const now = new Date();
    const endDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    const bookedSlots = await this.prisma.serviceSlot.findMany({
      where: {
        service: { guideId: guide.id },
        startTime: { gte: now, lte: endDate },
        OR: [{ isBooked: true }, { isBlocked: true }],
      },
      select: { startTime: true, endTime: true },
    });

    const bookedRanges = bookedSlots.map(s => ({ start: s.startTime.getTime(), end: s.endTime.getTime() }));

    // Generate slots for each day
    const slots: Array<{ date: string; startTime: string; endTime: string; available: boolean }> = [];

    for (let d = 0; d < daysAhead; d++) {
      const date = new Date(now.getTime() + d * 24 * 60 * 60 * 1000);
      const dayOfWeek = date.getDay();
      const dayAvailability = availability.filter(a => a.dayOfWeek === dayOfWeek);

      for (const avail of dayAvailability) {
        const [startH, startM] = avail.startTime.split(':').map(Number);
        const [endH, endM] = avail.endTime.split(':').map(Number);

        let cursor = startH * 60 + startM;
        const endMin = endH * 60 + endM;

        while (cursor + defaultDuration <= endMin) {
          const slotStart = new Date(date);
          slotStart.setHours(Math.floor(cursor / 60), cursor % 60, 0, 0);
          const slotEnd = new Date(slotStart.getTime() + defaultDuration * 60 * 1000);

          // Check if this slot overlaps with any booked slot
          const isBooked = bookedRanges.some(br =>
            slotStart.getTime() < br.end && slotEnd.getTime() > br.start,
          );

          if (slotStart.getTime() > now.getTime()) {
            slots.push({
              date: date.toISOString().split('T')[0],
              startTime: slotStart.toISOString(),
              endTime: slotEnd.toISOString(),
              available: !isBooked,
            });
          }

          cursor += defaultDuration + avail.bufferMin;
        }
      }
    }

    return slots;
  }
}
