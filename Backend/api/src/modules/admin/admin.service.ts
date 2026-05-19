import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../database/cache.service';
import { Role, VerificationStatus, PaymentStatus, BookingStatus, TourBookingStatus, PayoutStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../notifications/email.service';
import { LedgerService } from '../payments/ledger.service';
import { VerificationService } from '../verification/verification.service';
import { UploadService } from '../upload/upload.service';
import { SearchService } from '../search/search.service';
import { checkPasswordPolicy } from '../../common/validators/is-strong-password.validator';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    private readonly ledger: LedgerService,
    private readonly verification: VerificationService,
    private readonly upload: UploadService,
    private readonly email: EmailService,
    private readonly cache: CacheService,
    private readonly search: SearchService,
  ) {}

  /**
   * Mint a short-lived signed S3 GET URL so an admin can preview a guide's
   * uploaded credential document. Storing a public CloudFront URL on the
   * row is enough for the OCR pipeline to download the bytes server-side,
   * but the bucket is private and the public URL 403s in the admin's
   * browser. Signed URLs sidestep that without making the bucket public.
   */
  async getCredentialDocumentUrl(credentialId: string): Promise<{ url: string }> {
    const credential = await this.prisma.credential.findUnique({
      where: { id: credentialId },
      select: { documentUrl: true },
    });
    if (!credential) throw new NotFoundException('Credential not found');
    if (!credential.documentUrl) {
      throw new BadRequestException('No document uploaded for this credential');
    }

    // Pull the S3 key out of the stored URL (works for CloudFront + S3-direct).
    let key: string;
    try {
      key = new URL(credential.documentUrl).pathname.replace(/^\/+/, '');
    } catch {
      throw new BadRequestException('Stored document URL is malformed');
    }
    if (!key) throw new BadRequestException('Stored document URL has no key');

    // 10-minute TTL: enough for the admin to open + review, short enough
    // that a leaked link can't be replayed long-term.
    const url = await this.upload.getPresignedDownloadUrl(key, 600);
    return { url };
  }

  // ─── Dashboard ───────────────────────────────────────────────────────────────

  async getDashboardStats() {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalUsers,
      totalGuides,
      serviceBookings,
      tourBookings,
      serviceRevenueAgg,
      tourRevenueAgg,
      revenueThisMonth,
      pendingVerifications,
      newUsersThisWeek,
      topGuides,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.guideProfile.count({
        where: { verificationStatus: VerificationStatus.APPROVED },
      }),
      this.prisma.booking.count(),
      this.prisma.tourBooking.count(),
      this.prisma.payment.aggregate({
        _sum: { amount: true, platformFee: true },
        where: { status: PaymentStatus.SUCCEEDED, bookingId: { not: null } },
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true, platformFee: true },
        where: { status: PaymentStatus.SUCCEEDED, tourBookingId: { not: null } },
      }),
      this.prisma.payment.aggregate({
        _sum: { platformFee: true },
        where: { status: PaymentStatus.SUCCEEDED, createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.guideProfile.count({
        where: { verificationStatus: VerificationStatus.PENDING },
      }),
      this.prisma.user.count({
        where: { createdAt: { gte: oneWeekAgo } },
      }),
      // Top 5 guides by revenue
      this.prisma.$queryRaw<Array<{
        guideId: string;
        displayName: string;
        firstName: string;
        lastName: string;
        totalRevenue: string;
        totalBookings: string;
      }>>`
        SELECT
          gp.id AS "guideId",
          gp."displayName",
          u."firstName",
          u."lastName",
          COALESCE(SUM(p.amount), 0)::text AS "totalRevenue",
          COUNT(DISTINCT COALESCE(p."bookingId", p."tourBookingId"))::text AS "totalBookings"
        FROM guide_profiles gp
        JOIN users u ON u.id = gp."userId"
        LEFT JOIN services s ON s."guideId" = gp.id
        LEFT JOIN bookings b ON b."serviceId" = s.id
        LEFT JOIN payments p ON (p."bookingId" = b.id OR p."tourBookingId" IN (
          SELECT tb.id FROM tour_bookings tb
          JOIN soul_tours st ON st.id = tb."tourId"
          WHERE st."guideId" = gp.id
        )) AND p.status = 'SUCCEEDED'
        WHERE gp."verificationStatus" = 'APPROVED'
        GROUP BY gp.id, gp."displayName", u."firstName", u."lastName"
        ORDER BY COALESCE(SUM(p.amount), 0) DESC
        LIMIT 5
      `,
    ]);

    const totalServiceRevenue = Number(serviceRevenueAgg._sum?.amount ?? 0);
    const totalTourRevenue = Number(tourRevenueAgg._sum?.amount ?? 0);

    return {
      totalUsers,
      totalGuides,
      totalBookings: serviceBookings + tourBookings,
      serviceBookings,
      tourBookings,
      totalRevenue: Number((serviceRevenueAgg._sum?.platformFee ?? 0)) + Number((tourRevenueAgg._sum?.platformFee ?? 0)),
      totalServiceRevenue,
      totalTourRevenue,
      revenueThisMonth: Number(revenueThisMonth._sum?.platformFee ?? 0),
      pendingVerifications,
      newUsersThisWeek,
      topGuides: topGuides.map((g) => ({
        guideId: g.guideId,
        displayName: g.displayName,
        name: `${g.firstName} ${g.lastName}`,
        totalRevenue: Number(g.totalRevenue),
        totalBookings: Number(g.totalBookings),
      })),
    };
  }

  // ─── Users ────────────────────────────────────────────────────────────────

  async getUsers(params: {
    page: number;
    limit: number;
    search?: string;
    status?: 'active' | 'deactivated' | 'unverified';
  }) {
    const { page, limit, search, status } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' as const } },
        { firstName: { contains: search, mode: 'insensitive' as const } },
        { lastName: { contains: search, mode: 'insensitive' as const } },
      ];
    }
    if (status === 'active') {
      where.isActive = true;
      where.isEmailVerified = true;
    } else if (status === 'deactivated') {
      where.isActive = false;
    } else if (status === 'unverified') {
      where.isActive = true;
      where.isEmailVerified = false;
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          avatarUrl: true,
          isEmailVerified: true,
          isActive: true,
          deactivatedAt: true,
          deactivatedReason: true,
          deactivatedBy: true,
          lastLoginAt: true,
          createdAt: true,
          roles: { select: { role: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUserDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: true,
        seekerProfile: true,
        guideProfile: {
          include: {
            credentials: true,
            services: { take: 5 },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // ─── Activate / Deactivate (replaces Ban/Unban) ──────────────────────────
  //
  // Replaces the old ban flow (2026-05-19, client request). One toggle:
  //   • Deactivate → User.isActive = false. Login is blocked, public surfaces
  //     stop showing the guide. Reversible. Reason required + audit-logged.
  //     All refresh tokens are revoked so live sessions die immediately.
  //     Bookings, payouts, and other money flows are intentionally untouched.
  //   • Activate   → flips isActive back to true, clears deactivation cols.
  //
  // Role-gate (mirrors password-set in admin.service.setUserPassword):
  //   • ADMIN may toggle SEEKER / GUIDE.
  //   • SUPER_ADMIN is required to toggle another ADMIN / SUPER_ADMIN.
  //   • Nobody may toggle their own account.

  async deactivateUser(params: {
    targetUserId: string;
    actor: { id: string; roles: Role[]; email: string };
    reason: string;
  }) {
    const { targetUserId, actor, reason } = params;
    if (!reason || !reason.trim()) {
      throw new BadRequestException('Deactivation reason is required');
    }
    if (targetUserId === actor.id) {
      throw new BadRequestException('You cannot deactivate your own account.');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        roles: true,
        // GuideProfile presence drives the Algolia cascade: SEEKERs have no
        // search-index footprint, so we skip the cleanup for them.
        guideProfile: { select: { id: true } },
      },
    });
    if (!target) throw new NotFoundException('User not found');
    if (!target.isActive) {
      throw new BadRequestException('User is already deactivated');
    }

    const targetIsAdminish = target.roles.some(
      (r) => r.role === Role.ADMIN || r.role === Role.SUPER_ADMIN,
    );
    const actorIsSuperAdmin = actor.roles.includes(Role.SUPER_ADMIN);
    if (targetIsAdminish && !actorIsSuperAdmin) {
      throw new ForbiddenException(
        "Only a SUPER_ADMIN can deactivate another administrator's account.",
      );
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: targetUserId },
        data: {
          isActive: false,
          deactivatedAt: now,
          deactivatedReason: reason,
          deactivatedBy: actor.id,
        },
      }),
      // Kill every active session immediately.
      this.prisma.refreshToken.updateMany({
        where: { userId: targetUserId, isRevoked: false },
        data: { isRevoked: true, revokedAt: now },
      }),
      this.prisma.auditLog.create({
        data: {
          userId: actor.id,
          action: 'admin.user.deactivate',
          entity: 'User',
          entityId: targetUserId,
          newValue: {
            reason,
            targetEmail: target.email,
            actorEmail: actor.email,
          },
        },
      }),
    ]);

    // Bust the home-page cache so the deactivated guide's offerings stop
    // showing up immediately (otherwise they linger up to 5 minutes).
    await this.cache.del(CacheService.keys.homeData());

    // Scrub Algolia so search results stop returning the guide + their
    // products + events. Best-effort: errors are logged inside Algolia
    // calls but never thrown — search drift is preferable to a failed
    // deactivation.
    let searchCascade: { productsRemoved: number; eventsRemoved: number } | null = null;
    if (target.guideProfile) {
      const result = await this.search.removeAllForGuide(target.guideProfile.id);
      searchCascade = {
        productsRemoved: result.productsRemoved,
        eventsRemoved: result.eventsRemoved,
      };
    }

    return {
      userId: targetUserId,
      isActive: false,
      deactivatedAt: now,
      searchCascade,
    };
  }

  async activateUser(params: {
    targetUserId: string;
    actor: { id: string; roles: Role[]; email: string };
  }) {
    const { targetUserId, actor } = params;
    if (targetUserId === actor.id) {
      throw new BadRequestException('You cannot toggle your own account.');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        roles: true,
        guideProfile: { select: { id: true } },
      },
    });
    if (!target) throw new NotFoundException('User not found');
    if (target.isActive) {
      throw new BadRequestException('User is already active');
    }

    const targetIsAdminish = target.roles.some(
      (r) => r.role === Role.ADMIN || r.role === Role.SUPER_ADMIN,
    );
    const actorIsSuperAdmin = actor.roles.includes(Role.SUPER_ADMIN);
    if (targetIsAdminish && !actorIsSuperAdmin) {
      throw new ForbiddenException(
        "Only a SUPER_ADMIN can reactivate another administrator's account.",
      );
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: targetUserId },
        data: {
          isActive: true,
          deactivatedAt: null,
          deactivatedReason: null,
          deactivatedBy: null,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          userId: actor.id,
          action: 'admin.user.activate',
          entity: 'User',
          entityId: targetUserId,
          newValue: {
            targetEmail: target.email,
            actorEmail: actor.email,
          },
        },
      }),
    ]);

    await this.cache.del(CacheService.keys.homeData());

    // Restore Algolia entries for the guide + their current public-eligible
    // products and events. Best-effort: search drift can be repaired by a
    // full reindex if anything goes wrong.
    let searchCascade: { productsIndexed: number; eventsIndexed: number } | null = null;
    if (target.guideProfile) {
      const result = await this.search.reindexAllForGuide(target.guideProfile.id);
      searchCascade = {
        productsIndexed: result.productsIndexed,
        eventsIndexed: result.eventsIndexed,
      };
    }

    return { userId: targetUserId, isActive: true, searchCascade };
  }

  async setUserRoles(userId: string, roles: Role[]) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Replace all roles atomically
    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId } }),
      this.prisma.userRole.createMany({
        data: roles.map((role) => ({ userId, role })),
      }),
    ]);

    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, roles: true },
    });
  }

  // ─── Admin-set user password ──────────────────────────────────────────────
  //
  // Direct password set: admin types a new password, system hashes it and
  // overwrites passwordHash. Use sparingly — this is an impersonation vector
  // until the user logs in and rotates the password. Safety rails:
  //   1. Role-gate: ADMIN can reset SEEKER + GUIDE only. ADMIN/SUPER_ADMIN
  //      targets require SUPER_ADMIN actor. Nobody can reset themselves via
  //      this path (use /auth/change-password instead).
  //   2. Existing strength policy: handled by SetUserPasswordDto +
  //      assertPasswordNotPersonal below (mirrors auth.service rules so a
  //      target's name/email can't end up in their new password).
  //   3. Revoke ALL refresh tokens — any open sessions die immediately.
  //   4. Clear pending password-reset tokens (the new password should be
  //      the only working credential).
  //   5. AuditLog row with actor + reason; the target user is also emailed.

  async setUserPassword(params: {
    targetUserId: string;
    actor: { id: string; roles: string[]; email: string };
    newPassword: string;
    reason: string;
  }) {
    const { targetUserId, actor, newPassword, reason } = params;

    if (targetUserId === actor.id) {
      throw new BadRequestException(
        'Use /auth/change-password to update your own password.',
      );
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: { roles: true },
    });
    if (!target) throw new NotFoundException('User not found');

    // Role-gate: only SUPER_ADMIN may reset another admin's password.
    const targetIsAdminish = target.roles.some(
      (r) => r.role === Role.ADMIN || r.role === Role.SUPER_ADMIN,
    );
    const actorIsSuperAdmin = actor.roles.includes(Role.SUPER_ADMIN);
    if (targetIsAdminish && !actorIsSuperAdmin) {
      throw new ForbiddenException(
        'Only a SUPER_ADMIN can reset another administrator\'s password.',
      );
    }

    // Re-run the strength check defensively (DTO already enforces this, but
    // belt-and-suspenders matters for an impersonation vector).
    const policy = checkPasswordPolicy(newPassword);
    if (!policy.valid) {
      throw new BadRequestException(policy.errors.join(' '));
    }

    // Cross-field: password must not contain the TARGET's name/email. The
    // DTO can't enforce this because it doesn't know who the target is.
    const lower = newPassword.toLowerCase();
    const localPart = target.email.split('@')[0]?.toLowerCase() ?? '';
    const personalCandidates = [
      localPart,
      target.firstName.toLowerCase(),
      target.lastName.toLowerCase(),
    ].filter((s) => s.length >= 4);
    for (const candidate of personalCandidates) {
      if (lower.includes(candidate)) {
        throw new BadRequestException(
          'Password cannot contain the user\'s name or email.',
        );
      }
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: targetUserId },
        data: {
          passwordHash,
          // Clear any in-flight reset token so the new password is the only
          // credential that works.
          passwordResetToken: null,
          passwordResetExpiry: null,
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: targetUserId, isRevoked: false },
        data: { isRevoked: true, revokedAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          userId: actor.id,
          action: 'admin.password.set',
          entity: 'User',
          entityId: targetUserId,
          newValue: {
            reason,
            targetEmail: target.email,
            actorEmail: actor.email,
          },
        },
      }),
    ]);

    // Fire-and-forget the notification — failures must NOT roll back the
    // password change. (EmailService.send already swallows errors.)
    await this.email.sendAdminPasswordChange(target.email, {
      firstName: target.firstName,
      adminEmail: actor.email,
      reason,
    });

    return {
      userId: targetUserId,
      passwordChangedAt: new Date(),
      sessionsRevoked: true,
    };
  }

  // ─── Guides ───────────────────────────────────────────────────────────────

  async getGuides(params: {
    page: number;
    limit: number;
    search?: string;
    status?: VerificationStatus;
  }) {
    const { page, limit, search, status } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.verificationStatus = status;
    if (search) {
      where.user = {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [guides, total] = await Promise.all([
      this.prisma.guideProfile.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          displayName: true,
          tagline: true,
          location: true,
          verificationStatus: true,
          averageRating: true,
          totalReviews: true,
          isFeatured: true,
          isVerified: true,
          isPublished: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
              isActive: true,
            },
          },
          credentials: {
            select: { id: true, verificationStatus: true, title: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.guideProfile.count({ where }),
    ]);

    return {
      guides,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── Verification Queue ───────────────────────────────────────────────────

  async getVerificationQueue(params: { page: number; limit: number }) {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    const queueWhere = {
      verificationStatus: VerificationStatus.PENDING,
    };

    const [guides, total] = await Promise.all([
      this.prisma.guideProfile.findMany({
        where: queueWhere,
        skip,
        take: limit,
        select: {
          id: true,
          displayName: true,
          tagline: true,
          location: true,
          verificationStatus: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
            },
          },
          credentials: {
            select: {
              id: true,
              title: true,
              institution: true,
              verificationStatus: true,
              documentUrl: true,
              issuedYear: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' }, // oldest first
      }),
      this.prisma.guideProfile.count({ where: queueWhere }),
    ]);

    return {
      guides,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async approveGuide(guideId: string) {
    const guide = await this.prisma.guideProfile.findUnique({
      where: { id: guideId },
    });
    if (!guide) throw new NotFoundException('Guide profile not found');
    if (
      guide.verificationStatus !== VerificationStatus.PENDING &&
      guide.verificationStatus !== VerificationStatus.IN_REVIEW
    ) {
      throw new BadRequestException('Guide is not in pending or in-review status');
    }

    // Delegate to VerificationService.reviewGuide so the visibility flags
    // (isVerified, isPublished) flip together with verificationStatus —
    // single source of truth for the approval transition.
    await this.verification.reviewGuide(guideId, 'approve');

    return this.prisma.guideProfile.findUnique({
      where: { id: guideId },
      select: {
        id: true,
        verificationStatus: true,
        isVerified: true,
        isPublished: true,
      },
    });
  }

  async setFeatured(guideId: string, isFeatured: boolean) {
    const guide = await this.prisma.guideProfile.findUnique({ where: { id: guideId } });
    if (!guide) throw new NotFoundException('Guide profile not found');
    return this.prisma.guideProfile.update({
      where: { id: guideId },
      data: { isFeatured },
      select: { id: true, slug: true, displayName: true, isFeatured: true },
    });
  }

  async rejectGuide(guideId: string, reason: string) {
    const guide = await this.prisma.guideProfile.findUnique({
      where: { id: guideId },
    });
    if (!guide) throw new NotFoundException('Guide profile not found');

    return this.prisma.guideProfile.update({
      where: { id: guideId },
      data: { verificationStatus: VerificationStatus.REJECTED },
      select: { id: true, verificationStatus: true },
    });
  }

  // ─── Tour Bookings ─────────────────────────────────────────────────────────

  async getTourBookings(params: {
    page: number;
    limit: number;
    search?: string;
    status?: TourBookingStatus;
    guideId?: string;
  }) {
    const { page, limit, search, status, guideId } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (guideId) where.tour = { guideId };
    if (search) {
      where.OR = [
        { bookingReference: { contains: search, mode: 'insensitive' } },
        { contactEmail: { contains: search, mode: 'insensitive' } },
        { contactFirstName: { contains: search, mode: 'insensitive' } },
        { contactLastName: { contains: search, mode: 'insensitive' } },
        { tour: { title: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [bookings, total, statusCounts] = await Promise.all([
      this.prisma.tourBooking.findMany({
        where,
        skip,
        take: limit,
        include: {
          tour: {
            select: {
              id: true,
              title: true,
              slug: true,
              location: true,
              guide: {
                select: {
                  id: true,
                  displayName: true,
                  user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
                },
              },
            },
          },
          departure: { select: { startDate: true, endDate: true, status: true } },
          roomType: { select: { name: true, totalPrice: true } },
          seeker: {
            select: {
              user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
            },
          },
          payments: {
            select: { id: true, amount: true, platformFee: true, guideAmount: true, paymentType: true, status: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
          },
          travelers_rel: {
            select: { id: true, isPrimary: true, firstName: true, lastName: true, nationality: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.tourBooking.count({ where }),
      this.prisma.tourBooking.groupBy({
        by: ['status'],
        _count: true,
      }),
    ]);

    const counts: Record<string, number> = {};
    statusCounts.forEach((s) => { counts[s.status] = s._count; });

    return {
      bookings,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      statusCounts: counts,
    };
  }

  // ─── Service Bookings ─────────────────────────────────────────────────────

  async getServiceBookings(params: {
    page: number;
    limit: number;
    search?: string;
    status?: BookingStatus;
    guideId?: string;
  }) {
    const { page, limit, search, status, guideId } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (guideId) where.service = { guide: { id: guideId } };
    if (search) {
      where.OR = [
        { seeker: { user: { email: { contains: search, mode: 'insensitive' } } } },
        { seeker: { user: { firstName: { contains: search, mode: 'insensitive' } } } },
        { service: { title: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [bookings, total, statusCounts] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take: limit,
        include: {
          service: {
            select: {
              id: true,
              name: true,
              type: true,
              durationMin: true,
              price: true,
              guide: {
                select: {
                  id: true,
                  displayName: true,
                  user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
                },
              },
            },
          },
          seeker: {
            select: {
              user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
            },
          },
          slot: { select: { startTime: true, endTime: true } },
          payment: {
            select: { id: true, amount: true, platformFee: true, guideAmount: true, status: true, createdAt: true },
          },
          review: {
            select: { id: true, rating: true, body: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.booking.count({ where }),
      this.prisma.booking.groupBy({
        by: ['status'],
        _count: true,
      }),
    ]);

    const counts: Record<string, number> = {};
    statusCounts.forEach((s) => { counts[s.status] = s._count; });

    return {
      bookings,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      statusCounts: counts,
    };
  }

  // ─── Guide-wise Revenue Analytics ─────────────────────────────────────────

  async getGuideRevenue(params: { page: number; limit: number; search?: string }) {
    const { page, limit, search } = params;
    const offset = (page - 1) * limit;

    const searchPattern = search ? `%${search}%` : '%';
    const guideRevenue = await this.prisma.$queryRaw<Array<{
      guideId: string;
      displayName: string;
      firstName: string;
      lastName: string;
      email: string;
      avatarUrl: string | null;
      serviceBookings: string;
      serviceRevenue: string;
      servicePlatformFee: string;
      tourBookings: string;
      tourRevenue: string;
      tourPlatformFee: string;
    }>>`
      WITH service_rev AS (
        SELECT
          gp.id AS "guideId",
          COUNT(DISTINCT b.id)::text AS bookings,
          COALESCE(SUM(p.amount), 0)::text AS revenue,
          COALESCE(SUM(p."platformFee"), 0)::text AS "platformFee"
        FROM guide_profiles gp
        LEFT JOIN services s ON s."guideId" = gp.id
        LEFT JOIN bookings b ON b."serviceId" = s.id AND b.status != 'CANCELLED'
        LEFT JOIN payments p ON p."bookingId" = b.id AND p.status = 'SUCCEEDED'
        GROUP BY gp.id
      ),
      tour_rev AS (
        SELECT
          gp.id AS "guideId",
          COUNT(DISTINCT tb.id)::text AS bookings,
          COALESCE(SUM(p.amount), 0)::text AS revenue,
          COALESCE(SUM(p."platformFee"), 0)::text AS "platformFee"
        FROM guide_profiles gp
        LEFT JOIN soul_tours st ON st."guideId" = gp.id
        LEFT JOIN tour_bookings tb ON tb."tourId" = st.id AND tb.status NOT IN ('CANCELLED')
        LEFT JOIN payments p ON p."tourBookingId" = tb.id AND p.status = 'SUCCEEDED'
        GROUP BY gp.id
      )
      SELECT
        gp.id AS "guideId",
        gp."displayName",
        u."firstName",
        u."lastName",
        u.email,
        u."avatarUrl",
        COALESCE(sr.bookings, '0') AS "serviceBookings",
        COALESCE(sr.revenue, '0') AS "serviceRevenue",
        COALESCE(sr."platformFee", '0') AS "servicePlatformFee",
        COALESCE(tr.bookings, '0') AS "tourBookings",
        COALESCE(tr.revenue, '0') AS "tourRevenue",
        COALESCE(tr."platformFee", '0') AS "tourPlatformFee"
      FROM guide_profiles gp
      JOIN users u ON u.id = gp."userId"
      LEFT JOIN service_rev sr ON sr."guideId" = gp.id
      LEFT JOIN tour_rev tr ON tr."guideId" = gp.id
      WHERE gp."verificationStatus" = 'APPROVED'
        AND (
          ${!search}::boolean = true
          OR gp."displayName" ILIKE ${searchPattern}
          OR u."firstName" ILIKE ${searchPattern}
          OR u."lastName" ILIKE ${searchPattern}
          OR u.email ILIKE ${searchPattern}
        )
      ORDER BY (COALESCE(sr.revenue, '0')::numeric + COALESCE(tr.revenue, '0')::numeric) DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const totalCount = await this.prisma.guideProfile.count({
      where: {
        verificationStatus: VerificationStatus.APPROVED,
        ...(search ? {
          OR: [
            { displayName: { contains: search, mode: 'insensitive' } },
            { user: { firstName: { contains: search, mode: 'insensitive' } } },
            { user: { lastName: { contains: search, mode: 'insensitive' } } },
            { user: { email: { contains: search, mode: 'insensitive' } } },
          ],
        } : {}),
      },
    });

    // Platform totals
    const [totalServiceRev, totalTourRev] = await Promise.all([
      this.prisma.payment.aggregate({
        _sum: { amount: true, platformFee: true, guideAmount: true },
        where: { status: PaymentStatus.SUCCEEDED, bookingId: { not: null } },
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true, platformFee: true, guideAmount: true },
        where: { status: PaymentStatus.SUCCEEDED, tourBookingId: { not: null } },
      }),
    ]);

    return {
      guides: guideRevenue.map((g) => ({
        guideId: g.guideId,
        displayName: g.displayName,
        firstName: g.firstName,
        lastName: g.lastName,
        email: g.email,
        avatarUrl: g.avatarUrl,
        serviceBookings: Number(g.serviceBookings),
        serviceRevenue: Number(g.serviceRevenue),
        servicePlatformFee: Number(g.servicePlatformFee),
        tourBookings: Number(g.tourBookings),
        tourRevenue: Number(g.tourRevenue),
        tourPlatformFee: Number(g.tourPlatformFee),
        totalRevenue: Number(g.serviceRevenue) + Number(g.tourRevenue),
        totalPlatformFee: Number(g.servicePlatformFee) + Number(g.tourPlatformFee),
      })),
      totals: {
        serviceRevenue: Number(totalServiceRev._sum?.amount ?? 0),
        servicePlatformFee: Number(totalServiceRev._sum?.platformFee ?? 0),
        serviceGuideAmount: Number(totalServiceRev._sum?.guideAmount ?? 0),
        tourRevenue: Number(totalTourRev._sum?.amount ?? 0),
        tourPlatformFee: Number(totalTourRev._sum?.platformFee ?? 0),
        tourGuideAmount: Number(totalTourRev._sum?.guideAmount ?? 0),
      },
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    };
  }

  // ─── Financials ───────────────────────────────────────────────────────────

  async getFinancials(params: { page: number; limit: number }) {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalRevenueAgg,
      monthlyRevenueAgg,
      totalPayments,
      recentPayments,
      revenueByMonth,
    ] = await Promise.all([
      this.prisma.payment.aggregate({
        _sum: { platformFee: true },
        where: { status: PaymentStatus.SUCCEEDED },
      }),
      this.prisma.payment.aggregate({
        _sum: { platformFee: true },
        where: { status: PaymentStatus.SUCCEEDED, createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.payment.count(),
      this.prisma.payment.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          amount: true,
          platformFee: true,
          status: true,
          createdAt: true,
          booking: {
            select: {
              seeker: {
                select: {
                  user: { select: { firstName: true, lastName: true } },
                },
              },
              service: {
                select: {
                  guide: {
                    select: {
                      user: { select: { firstName: true, lastName: true } },
                      displayName: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      // Revenue grouped by month (last 6 months)
      this.prisma.$queryRaw<Array<{ month: string; revenue: number }>>`
        SELECT
          TO_CHAR(DATE_TRUNC('month', "createdAt"), 'Mon YYYY') AS month,
          SUM("platformFee")::float AS revenue
        FROM "payments"
        WHERE status = 'SUCCEEDED'
          AND "createdAt" >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', "createdAt")
        ORDER BY DATE_TRUNC('month', "createdAt") ASC
      `,
    ]);

    return {
      summary: {
        totalRevenue: Number(totalRevenueAgg._sum?.platformFee ?? 0),
        monthlyRevenue: Number(monthlyRevenueAgg._sum?.platformFee ?? 0),
        totalPayments,
      },
      revenueByMonth,
      payments: recentPayments,
      total: totalPayments,
      page,
      limit,
      totalPages: Math.ceil(totalPayments / limit),
    };
  }

  // ─── Payout Management ────────────────────────────────────────────────────

  async getPayoutRequests(params: { page: number; limit: number; status?: PayoutStatus }) {
    const { page, limit, status } = params;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (status) where.status = status;

    const [requests, total, statusCounts] = await Promise.all([
      this.prisma.payoutRequest.findMany({
        where,
        skip,
        take: limit,
        include: {
          guide: {
            select: {
              id: true,
              displayName: true,
              stripeAccountId: true,
              stripeOnboardingDone: true,
              user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
            },
          },
          payoutAccount: {
            select: { availableBalance: true, pendingBalance: true, totalEarned: true, totalPaidOut: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payoutRequest.count({ where }),
      this.prisma.payoutRequest.groupBy({ by: ['status'], _count: true }),
    ]);

    const counts: Record<string, number> = {};
    statusCounts.forEach((s) => { counts[s.status] = s._count; });

    return {
      requests: requests.map((r) => ({
        id: r.id,
        amount: Number(r.amount),
        currency: r.currency,
        status: r.status,
        stripePayoutId: r.stripePayoutId,
        processedAt: r.processedAt,
        createdAt: r.createdAt,
        guide: {
          id: r.guide.id,
          displayName: r.guide.displayName,
          name: `${r.guide.user.firstName} ${r.guide.user.lastName}`,
          email: r.guide.user.email,
          avatarUrl: r.guide.user.avatarUrl,
          stripeConnected: !!r.guide.stripeAccountId && r.guide.stripeOnboardingDone,
        },
        balance: {
          available: Number(r.payoutAccount.availableBalance),
          totalEarned: Number(r.payoutAccount.totalEarned),
          totalPaidOut: Number(r.payoutAccount.totalPaidOut),
        },
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      statusCounts: counts,
    };
  }

  async getGuideBalances(params: { page: number; limit: number; search?: string }) {
    const { page, limit, search } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.guide = {
        OR: [
          { displayName: { contains: search, mode: 'insensitive' } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
          { user: { firstName: { contains: search, mode: 'insensitive' } } },
        ],
      };
    }

    const [accounts, total] = await Promise.all([
      this.prisma.payoutAccount.findMany({
        where,
        skip,
        take: limit,
        include: {
          guide: {
            select: {
              id: true,
              displayName: true,
              stripeAccountId: true,
              stripeOnboardingDone: true,
              user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
            },
          },
          _count: { select: { payoutRequests: true } },
        },
        orderBy: { totalEarned: 'desc' },
      }),
      this.prisma.payoutAccount.count({ where }),
    ]);

    return {
      accounts: accounts.map((a) => ({
        id: a.id,
        guideId: a.guide.id,
        displayName: a.guide.displayName,
        name: `${a.guide.user.firstName} ${a.guide.user.lastName}`,
        email: a.guide.user.email,
        avatarUrl: a.guide.user.avatarUrl,
        stripeConnected: !!a.guide.stripeAccountId && a.guide.stripeOnboardingDone,
        availableBalance: Number(a.availableBalance),
        pendingBalance: Number(a.pendingBalance),
        totalEarned: Number(a.totalEarned),
        totalPaidOut: Number(a.totalPaidOut),
        payoutRequestsCount: a._count.payoutRequests,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── Blog Management (platform-wide) ───────────────────────────────────────
  // Admins have full CRUD across any guide's posts — no ownership check, no
  // 1-per-24h publish rate limit. Attribution is still required (posts live
  // under /journal/[guideSlug]/[postSlug]), so create/update take an explicit
  // guideId.

  /**
   * Return every potential blog author — both existing guide profiles and
   * admin users. Admins without a guide profile are still listed; when one
   * is chosen, `resolveAuthorToGuideId` lazily creates a minimal, unpublished
   * profile for them so the BlogPost.guideId FK is satisfied.
   */
  async listBlogAuthors() {
    const [guides, admins] = await Promise.all([
      this.prisma.guideProfile.findMany({
        orderBy: { displayName: 'asc' },
        select: {
          id: true,
          displayName: true,
          slug: true,
          user: { select: { id: true, avatarUrl: true, roles: true } },
        },
      }),
      // Every user with ADMIN or SUPER_ADMIN role
      this.prisma.user.findMany({
        where: { roles: { some: { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] } } } },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        include: { guideProfile: { select: { id: true } } },
      }),
    ]);

    const guideAuthors = guides.map((g) => ({
      id: g.id,
      kind: 'guide' as const,
      displayName: g.displayName,
      avatarUrl: g.user?.avatarUrl ?? null,
      // Admins who also happen to have a guide profile come through here too,
      // so we don't double-list them in the admins bucket below.
      isAdmin: (g.user?.roles ?? []).some((r: any) => r.role === Role.ADMIN || r.role === Role.SUPER_ADMIN),
    }));

    const adminAuthors = admins
      // Exclude admins who already appear as guides (via their guide profile)
      .filter((u) => !u.guideProfile)
      .map((u) => ({
        id: u.id, // NOTE: this is a userId, not a guideId
        kind: 'admin' as const,
        displayName: `${u.firstName} ${u.lastName}`.trim() || u.email,
        avatarUrl: u.avatarUrl ?? null,
        isAdmin: true,
      }));

    return { guides: guideAuthors, admins: adminAuthors };
  }

  /**
   * Turn a selected author (guide id OR admin user id) into a concrete
   * GuideProfile id that can be written to BlogPost.guideId. If the admin
   * doesn't have a profile yet, we create a minimal unpublished, unverified
   * one attributed to them.
   */
  private async resolveAuthorToGuideId(authorId: string, authorKind: 'guide' | 'admin'): Promise<string> {
    if (authorKind === 'guide') {
      const guide = await this.prisma.guideProfile.findUnique({ where: { id: authorId } });
      if (!guide) throw new NotFoundException('Guide profile not found');
      return guide.id;
    }

    // authorKind === 'admin' → authorId is a userId
    const user = await this.prisma.user.findUnique({
      where: { id: authorId },
      include: { guideProfile: true, roles: true },
    });
    if (!user) throw new NotFoundException('Admin user not found');
    const isAdmin = user.roles.some((r) => r.role === Role.ADMIN || r.role === Role.SUPER_ADMIN);
    if (!isAdmin) throw new BadRequestException('Selected user is not an admin');

    if (user.guideProfile) return user.guideProfile.id;

    // Lazily create a shell guide profile for this admin so the blog post FK
    // can reference it. Keeps it unpublished + unverified so it doesn't leak
    // into public /practitioners listings — admin isn't offering services.
    const baseSlug = this.slugify(`${user.firstName} ${user.lastName}`) || `admin-${user.id.slice(-6)}`;
    const slug = await this.uniqueGuideSlug(baseSlug);
    const profile = await this.prisma.guideProfile.create({
      data: {
        userId: user.id,
        slug,
        displayName: `${user.firstName} ${user.lastName}`.trim() || 'Editorial Team',
        tagline: 'Spiritual California Editorial',
        isPublished: false,
        isVerified: false,
        verificationStatus: VerificationStatus.APPROVED, // admin is trusted, skip review
      },
    });
    return profile.id;
  }

  private async uniqueGuideSlug(baseSlug: string, excludeId?: string): Promise<string> {
    let slug = baseSlug;
    let counter = 0;
    while (true) {
      const existing = await this.prisma.guideProfile.findFirst({
        where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      });
      if (!existing) return slug;
      counter++;
      slug = `${baseSlug}-${counter}`;
    }
  }

  async listAllPosts(params: {
    page?: number;
    limit?: number;
    search?: string;
    guideId?: string;
    status?: 'all' | 'published' | 'draft';
  }) {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.guideId) where.guideId = params.guideId;
    if (params.status === 'published') where.isPublished = true;
    if (params.status === 'draft') where.isPublished = false;
    if (params.search) {
      where.OR = [
        { title: { contains: params.search, mode: 'insensitive' } },
        { excerpt: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [posts, total] = await Promise.all([
      this.prisma.blogPost.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          guide: {
            select: {
              id: true,
              slug: true,
              displayName: true,
              user: { select: { avatarUrl: true } },
            },
          },
        },
      }),
      this.prisma.blogPost.count({ where }),
    ]);

    return { posts, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getPost(postId: string) {
    const post = await this.prisma.blogPost.findUnique({
      where: { id: postId },
      include: {
        guide: {
          select: {
            id: true,
            slug: true,
            displayName: true,
            user: { select: { avatarUrl: true } },
          },
        },
      },
    });
    if (!post) throw new NotFoundException('Blog post not found');
    return post;
  }

  async createPost(dto: {
    authorId: string;
    authorKind: 'guide' | 'admin';
    title: string;
    content: string;
    excerpt?: string;
    coverImageUrl?: string;
    tags?: string[];
    publish?: boolean;
  }) {
    const guideId = await this.resolveAuthorToGuideId(dto.authorId, dto.authorKind);

    if (dto.publish && !dto.coverImageUrl) {
      throw new BadRequestException('A cover image is required to publish a blog post.');
    }

    const baseSlug = this.slugify(dto.title);
    const slug = await this.uniqueBlogSlug(guideId, baseSlug);

    return this.prisma.blogPost.create({
      data: {
        guideId,
        title: dto.title,
        slug,
        content: dto.content,
        excerpt: dto.excerpt || dto.content.replace(/<[^>]*>/g, '').substring(0, 200),
        coverImageUrl: dto.coverImageUrl,
        tags: dto.tags ?? [],
        isPublished: dto.publish ?? false,
        publishedAt: dto.publish ? new Date() : null,
      },
    });
  }

  async updatePost(postId: string, dto: {
    authorId?: string;
    authorKind?: 'guide' | 'admin';
    title?: string;
    content?: string;
    excerpt?: string;
    coverImageUrl?: string;
    tags?: string[];
    publish?: boolean;
  }) {
    const post = await this.prisma.blogPost.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Blog post not found');

    const data: any = {};
    let newGuideId = post.guideId;

    // Author reassignment — only when both fields sent together
    if (dto.authorId && dto.authorKind) {
      const resolved = await this.resolveAuthorToGuideId(dto.authorId, dto.authorKind);
      if (resolved !== post.guideId) {
        data.guideId = resolved;
        newGuideId = resolved;
      }
    }

    if (dto.title !== undefined) {
      data.title = dto.title;
      data.slug = await this.uniqueBlogSlug(newGuideId, this.slugify(dto.title), postId);
    } else if (newGuideId !== post.guideId) {
      // Re-attributed to a new guide — ensure slug is still unique under the new owner
      data.slug = await this.uniqueBlogSlug(newGuideId, post.slug, postId);
    }

    if (dto.content !== undefined) data.content = dto.content;
    if (dto.excerpt !== undefined) data.excerpt = dto.excerpt;
    if (dto.coverImageUrl !== undefined) data.coverImageUrl = dto.coverImageUrl;
    if (dto.tags !== undefined) data.tags = dto.tags;

    if (dto.publish === true) {
      const hasCover = dto.coverImageUrl ?? post.coverImageUrl;
      if (!hasCover) throw new BadRequestException('A cover image is required to publish a blog post.');
      data.isPublished = true;
      if (!post.isPublished) data.publishedAt = new Date();
    } else if (dto.publish === false) {
      data.isPublished = false;
    }

    return this.prisma.blogPost.update({
      where: { id: postId },
      data,
    });
  }

  async deletePost(postId: string) {
    const post = await this.prisma.blogPost.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Blog post not found');
    await this.prisma.blogPost.delete({ where: { id: postId } });
    return { deleted: true };
  }

  // ── Blog helpers ─────────────────────────────────────────────────────────

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async uniqueBlogSlug(
    guideId: string,
    baseSlug: string,
    excludeId?: string,
  ): Promise<string> {
    let slug = baseSlug || 'post';
    let counter = 0;
    while (true) {
      const existing = await this.prisma.blogPost.findFirst({
        where: {
          guideId,
          slug,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
      });
      if (!existing) return slug;
      counter++;
      slug = `${baseSlug}-${counter}`;
    }
  }

  // ─── Payouts v2 — admin actions ────────────────────────────────────────────

  /**
   * Freeze a guide's payouts. Clearance cron skips them, claim endpoint
   * refuses. Audit-logged.
   */
  async holdGuidePayouts(input: {
    guideId: string;
    actorUserId: string;
    reason: string;
  }) {
    if (!input.reason?.trim()) {
      throw new BadRequestException('A reason is required when placing a payout hold');
    }
    const account = await this.prisma.payoutAccount.findUnique({
      where: { guideId: input.guideId },
      include: {
        guide: {
          select: {
            displayName: true,
            user: { select: { id: true, email: true } },
          },
        },
      },
    });
    if (!account) throw new NotFoundException('Payout account not found');

    const before = {
      holdActive: account.holdActive,
      holdReason: account.holdReason,
      holdSetAt: account.holdSetAt,
      holdSetBy: account.holdSetBy,
    };

    const updated = await this.prisma.payoutAccount.update({
      where: { guideId: input.guideId },
      data: {
        holdActive: true,
        holdReason: input.reason,
        holdSetAt: new Date(),
        holdSetBy: input.actorUserId,
      },
    });

    await this.prisma.payoutAuditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: 'HOLD',
        guideId: input.guideId,
        reason: input.reason,
        beforeState: before,
        afterState: {
          holdActive: updated.holdActive,
          holdReason: updated.holdReason,
          holdSetAt: updated.holdSetAt,
          holdSetBy: updated.holdSetBy,
        },
      },
    });

    // Fire-and-forget notification to the guide.
    if (account.guide?.user?.email && account.guide.user.id) {
      this.notifications
        .notifyPayoutHeld({
          userId: account.guide.user.id,
          email: account.guide.user.email,
          guideName: account.guide.displayName,
          reason: input.reason,
          supportEmail:
            this.config.get<string>('SUPPORT_EMAIL') ?? 'support@spiritualcalifornia.com',
        })
        .catch(() => undefined);
    }

    return { ok: true };
  }

  async releaseGuidePayouts(input: {
    guideId: string;
    actorUserId: string;
    reason: string;
  }) {
    if (!input.reason?.trim()) {
      throw new BadRequestException('A reason is required when releasing a payout hold');
    }
    const account = await this.prisma.payoutAccount.findUnique({
      where: { guideId: input.guideId },
    });
    if (!account) throw new NotFoundException('Payout account not found');

    const before = {
      holdActive: account.holdActive,
      holdReason: account.holdReason,
    };

    await this.prisma.payoutAccount.update({
      where: { guideId: input.guideId },
      data: {
        holdActive: false,
        holdReason: null,
        holdSetAt: null,
        holdSetBy: null,
      },
    });

    await this.prisma.payoutAuditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: 'RELEASE',
        guideId: input.guideId,
        reason: input.reason,
        beforeState: before,
        afterState: { holdActive: false },
      },
    });
    return { ok: true };
  }

  /**
   * Reject a PENDING payout request without sending money. Releases the
   * reservation (v2) or restores the cached balance (v1). Audit-logged.
   */
  async rejectPayoutRequest(input: {
    payoutRequestId: string;
    actorUserId: string;
    reason: string;
  }) {
    if (!input.reason?.trim()) {
      throw new BadRequestException('A reason is required when rejecting a payout');
    }
    const payout = await this.prisma.payoutRequest.findUnique({
      where: { id: input.payoutRequestId },
    });
    if (!payout) throw new NotFoundException('Payout request not found');
    if (payout.status !== 'PENDING')
      throw new BadRequestException(`Cannot reject — payout is ${payout.status}`);

    const before = { status: payout.status };

    await this.prisma.payoutRequest.update({
      where: { id: payout.id },
      data: {
        status: 'REJECTED',
        rejectedReason: input.reason,
      },
    });

    // Release the reservation. Critical: branch on the active path so we
    // don't double-credit. v1 owns availableBalance directly; v2 derives it
    // from ledger SUM via recomputeCachedBalance, so clearing payoutRequestId
    // is enough — incrementing the column on top would double the credit.
    if (this.ledger.isV2Live()) {
      await this.prisma.ledgerEntry.updateMany({
        where: { payoutRequestId: payout.id },
        data: { payoutRequestId: null },
      });
      await this.ledger.recomputeCachedBalance(payout.guideId);
    } else {
      await this.prisma.payoutAccount.update({
        where: { id: payout.payoutAccountId },
        data: { availableBalance: { increment: Number(payout.amount) } },
      });
    }

    await this.prisma.payoutAuditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: 'REJECT',
        guideId: payout.guideId,
        payoutRequestId: payout.id,
        reason: input.reason,
        beforeState: before,
        afterState: { status: 'REJECTED' },
      },
    });
    return { ok: true };
  }

  // ─── Payouts v2 — commission rate management ──────────────────────────────

  async listCommissionRates() {
    const rates = await this.prisma.commissionRate.findMany({
      orderBy: [{ category: 'asc' }, { effectiveFrom: 'desc' }],
      include: {
        guide: { select: { id: true, displayName: true } },
      },
    });
    return rates.map((r) => ({
      id: r.id,
      category: r.category,
      guideId: r.guideId,
      guideName: r.guide?.displayName ?? null,
      percent: Number(r.percent),
      effectiveFrom: r.effectiveFrom,
      effectiveUntil: r.effectiveUntil,
      createdBy: r.createdBy,
      createdAt: r.createdAt,
    }));
  }

  async upsertCommissionRate(input: {
    actorUserId: string;
    category: 'SERVICE' | 'EVENT' | 'TOUR' | 'PRODUCT';
    guideId?: string | null;
    percent: number;
    effectiveFrom?: Date;
    effectiveUntil?: Date | null;
  }) {
    if (input.percent < 0 || input.percent > 100) {
      throw new BadRequestException('Commission percent must be between 0 and 100');
    }

    // Close out any currently-effective row for this (category, guideId)
    // by setting effectiveUntil = now. Then insert the new row.
    const now = new Date();
    await this.prisma.commissionRate.updateMany({
      where: {
        category: input.category,
        guideId: input.guideId ?? null,
        effectiveFrom: { lte: now },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
      },
      data: { effectiveUntil: now },
    });

    const created = await this.prisma.commissionRate.create({
      data: {
        category: input.category,
        guideId: input.guideId ?? null,
        percent: input.percent,
        effectiveFrom: input.effectiveFrom ?? now,
        effectiveUntil: input.effectiveUntil ?? null,
        createdBy: input.actorUserId,
      },
    });

    await this.prisma.payoutAuditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: 'OVERRIDE_RATE',
        // Null for platform-default rate changes (no specific guide targeted).
        guideId: input.guideId ?? null,
        reason: `Set ${input.category} rate to ${input.percent}%${input.guideId ? ` for guide ${input.guideId}` : ' (platform default)'}`,
        afterState: {
          rateId: created.id,
          category: input.category,
          percent: input.percent,
        },
      },
    });

    return created;
  }

  // ─── Payouts v2 — audit log read ──────────────────────────────────────────

  async getPayoutAuditLog(params: { guideId?: string; payoutRequestId?: string; limit?: number }) {
    return this.prisma.payoutAuditLog.findMany({
      where: {
        ...(params.guideId ? { guideId: params.guideId } : {}),
        ...(params.payoutRequestId ? { payoutRequestId: params.payoutRequestId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: params.limit ?? 50,
    });
  }

  // ─── Payouts v2 — reconciliation ──────────────────────────────────────────

  async listReconciliationMismatches(params: { resolved?: boolean; limit?: number }) {
    const where: any = {};
    if (params.resolved !== undefined) where.resolved = params.resolved;
    return this.prisma.reconciliationMismatch.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: params.limit ?? 100,
    });
  }

  async resolveReconciliationMismatch(input: {
    id: string;
    actorUserId: string;
    note: string;
  }) {
    if (!input.note?.trim()) {
      throw new BadRequestException('A resolution note is required');
    }
    const row = await this.prisma.reconciliationMismatch.findUnique({
      where: { id: input.id },
    });
    if (!row) throw new NotFoundException('Mismatch row not found');
    if (row.resolved) throw new BadRequestException('Already resolved');
    return this.prisma.reconciliationMismatch.update({
      where: { id: input.id },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy: input.actorUserId,
        resolutionNote: input.note,
      },
    });
  }

  // ─── Payouts v2 — financials summary ──────────────────────────────────────

  /**
   * Aggregate dashboard for ops: gross volume, commission revenue, Stripe
   * fees, paid out, and outstanding payable. Bounded by date range and
   * optionally filtered by category. Reads from ledger when v2 is live;
   * pre-cutover reads from `payments` table for compatibility.
   */
  async getPayoutsSummary(params: {
    since: Date;
    until: Date;
    category?: 'SERVICE' | 'EVENT' | 'TOUR' | 'PRODUCT';
  }) {
    const dateFilter = { createdAt: { gte: params.since, lt: params.until } };

    const [
      grossSales,
      commission,
      stripeFee,
      netPayable,
      paidOut,
      outstanding,
    ] = await Promise.all([
      this.prisma.ledgerEntry.aggregate({
        where: {
          ...dateFilter,
          entryType: 'SALE',
          ...(params.category ? { category: params.category } : {}),
        },
        _sum: { amount: true },
      }),
      this.prisma.ledgerEntry.aggregate({
        where: {
          ...dateFilter,
          entryType: 'COMMISSION',
          ...(params.category ? { category: params.category } : {}),
        },
        _sum: { amount: true },
      }),
      this.prisma.ledgerEntry.aggregate({
        where: {
          ...dateFilter,
          entryType: 'STRIPE_FEE',
          ...(params.category ? { category: params.category } : {}),
        },
        _sum: { amount: true },
      }),
      this.prisma.ledgerEntry.aggregate({
        where: {
          ...dateFilter,
          entryType: 'NET_PAYABLE',
          ...(params.category ? { category: params.category } : {}),
        },
        _sum: { amount: true },
      }),
      this.prisma.ledgerEntry.aggregate({
        where: {
          ...dateFilter,
          entryType: 'PAYOUT',
        },
        _sum: { amount: true },
      }),
      // Outstanding payable = AVAILABLE + PENDING_CLEARANCE NET_PAYABLE not
      // yet consumed (across all time, not date-bounded — represents what
      // the platform owes guides right now).
      this.prisma.ledgerEntry.aggregate({
        where: {
          status: { in: ['AVAILABLE', 'PENDING_CLEARANCE'] },
          payoutRequestId: null,
          entryType: { in: ['NET_PAYABLE', 'REFUND_REVERSAL', 'ADJUSTMENT', 'PAYOUT_REVERSAL'] },
        },
        _sum: { amount: true },
      }),
    ]);

    return {
      window: { since: params.since, until: params.until },
      category: params.category ?? 'ALL',
      grossSales: Number(grossSales._sum.amount ?? 0),
      commissionRevenue: Math.abs(Number(commission._sum.amount ?? 0)),
      stripeFees: Math.abs(Number(stripeFee._sum.amount ?? 0)),
      netPayableAccrued: Number(netPayable._sum.amount ?? 0),
      paidOut: Math.abs(Number(paidOut._sum.amount ?? 0)),
      outstandingPayable: Number(outstanding._sum.amount ?? 0),
    };
  }
}
