import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Role, VerificationStatus, PaymentStatus } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Dashboard ───────────────────────────────────────────────────────────────

  async getDashboardStats() {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const [
      totalUsers,
      totalGuides,
      totalBookings,
      revenueAgg,
      pendingVerifications,
      newUsersThisWeek,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.guideProfile.count({
        where: { verificationStatus: VerificationStatus.APPROVED },
      }),
      this.prisma.booking.count(),
      this.prisma.payment.aggregate({
        _sum: { platformFee: true },
        where: { status: PaymentStatus.SUCCEEDED },
      }),
      this.prisma.guideProfile.count({
        where: { verificationStatus: VerificationStatus.PENDING },
      }),
      this.prisma.user.count({
        where: { createdAt: { gte: oneWeekAgo } },
      }),
    ]);

    return {
      totalUsers,
      totalGuides,
      totalBookings,
      totalRevenue: Number(revenueAgg._sum?.platformFee ?? 0),
      pendingVerifications,
      newUsersThisWeek,
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
}
