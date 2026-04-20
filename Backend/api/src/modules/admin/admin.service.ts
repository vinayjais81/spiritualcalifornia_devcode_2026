import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Role, VerificationStatus, PaymentStatus, BookingStatus, TourBookingStatus, PayoutStatus } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

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

  async getUsers(params: { page: number; limit: number; search?: string }) {
    const { page, limit, search } = params;
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

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
          isBanned: true,
          bannedReason: true,
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

  async banUser(userId: string, reason?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.isBanned) throw new BadRequestException('User is already banned');

    return this.prisma.user.update({
      where: { id: userId },
      data: { isBanned: true, bannedReason: reason ?? null, isActive: false },
      select: { id: true, isBanned: true, bannedReason: true },
    });
  }

  async unbanUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.isBanned) throw new BadRequestException('User is not banned');

    return this.prisma.user.update({
      where: { id: userId },
      data: { isBanned: false, bannedReason: null, isActive: true },
      select: { id: true, isBanned: true },
    });
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
              isBanned: true,
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

    const [guides, total] = await Promise.all([
      this.prisma.guideProfile.findMany({
        where: { verificationStatus: VerificationStatus.PENDING },
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
      this.prisma.guideProfile.count({
        where: { verificationStatus: VerificationStatus.PENDING },
      }),
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
    if (guide.verificationStatus !== VerificationStatus.PENDING) {
      throw new BadRequestException('Guide is not in pending status');
    }

    return this.prisma.guideProfile.update({
      where: { id: guideId },
      data: { verificationStatus: VerificationStatus.APPROVED },
      select: { id: true, verificationStatus: true },
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
}
