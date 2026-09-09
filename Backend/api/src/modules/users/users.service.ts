import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { Role, User } from '@prisma/client';

/** What ensureBuyerAccess actually did, for logging and backfill reporting. */
export type BuyerAccessResult =
  | 'granted' // role and/or profile created
  | 'already-had-it' // nothing to do
  | 'disabled'; // PRACTITIONER_BUYER_ENABLED is off

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { roles: true },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: { roles: true },
    });
  }

  async findByIdOrThrow(id: string) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(data: {
    email: string;
    passwordHash?: string;
    firstName: string;
    lastName: string;
    googleId?: string;
    isTestAccount?: boolean;
  }) {
    return this.prisma.user.create({
      data,
      include: { roles: true },
    });
  }

  async update(
    id: string,
    data: Partial<
      Pick<
        User,
        | 'firstName'
        | 'lastName'
        | 'avatarUrl'
        | 'phone'
        | 'isEmailVerified'
        | 'isActive'
        | 'deactivatedAt'
        | 'deactivatedReason'
        | 'deactivatedBy'
        | 'emailVerifyToken'
        | 'emailVerifyExpiry'
        | 'passwordResetToken'
        | 'passwordResetExpiry'
        | 'passwordHash'
        | 'lastLoginAt'
        | 'marketingEmails'
        | 'pendingIntent'
        | 'isTestAccount'
        | 'email'
      >
    >,
  ) {
    return this.prisma.user.update({ where: { id }, data });
  }

  async assignRole(userId: string, role: Role) {
    return this.prisma.userRole.upsert({
      where: { userId_role: { userId, role } },
      create: { userId, role },
      update: {},
    });
  }

  async removeRole(userId: string, role: Role) {
    return this.prisma.userRole.deleteMany({ where: { userId, role } });
  }

  /** True when practitioners are allowed to buy (Phase 1 of the change). */
  isPractitionerBuyerEnabled(): boolean {
    return this.config.get<string>('PRACTITIONER_BUYER_ENABLED') === 'true';
  }

  /**
   * Give a practitioner the buyer role and profile so they can purchase from
   * other practitioners. See docs/practitioners-as-buyers.md (Phase 1).
   *
   * The single grant path, called from every place a practitioner account comes
   * into existence — register-with-intent, verify-email-with-intent, and
   * startOnboarding — plus the backfill script for accounts that predate this.
   * One implementation because the three creation paths have already drifted
   * from each other once (they each rebuild the guide slug separately), and a
   * buyer profile that exists on two of the three routes would be worse than
   * none at all: the failure would be invisible until someone tried to buy.
   *
   * Idempotent by construction — upsert on the role, existence check on the
   * profile — so re-running it is always safe, which is what makes the backfill
   * re-runnable.
   *
   * NOTE the direction. This grants SEEKER to a practitioner and nothing else.
   * The reverse (a seeker becoming a practitioner) stays closed under decision
   * D1 and is still refused by guides.service.startOnboarding, because it pulls
   * in identity verification, credential review, payout onboarding and the
   * listing subscription.
   */
  async ensureBuyerAccess(userId: string): Promise<BuyerAccessResult> {
    if (!this.isPractitionerBuyerEnabled()) return 'disabled';

    const [existingRole, existingProfile] = await Promise.all([
      this.prisma.userRole.findUnique({
        where: { userId_role: { userId, role: Role.SEEKER } },
        select: { userId: true },
      }),
      this.prisma.seekerProfile.findUnique({ where: { userId }, select: { id: true } }),
    ]);

    if (existingRole && existingProfile) return 'already-had-it';

    // Adopt an existing profile rather than replacing it. An account can
    // already hold a SeekerProfile without the SEEKER role — the admin role
    // editor can strip a role without touching the profile — and that profile
    // owns their entire purchase history via SeekerProfile.id. Creating a
    // second one would orphan it.
    await this.prisma.$transaction(async (tx) => {
      if (!existingProfile) {
        await tx.seekerProfile.create({ data: { userId } });
      }
      await tx.userRole.upsert({
        where: { userId_role: { userId, role: Role.SEEKER } },
        create: { userId, role: Role.SEEKER },
        update: {},
      });
    });

    this.logger.log(
      `Buyer access granted: user=${userId} ` +
        `(role=${existingRole ? 'existing' : 'created'}, profile=${existingProfile ? 'adopted' : 'created'})`,
    );
    return 'granted';
  }

  async getRoles(userId: string): Promise<Role[]> {
    const userRoles = await this.prisma.userRole.findMany({ where: { userId } });
    return userRoles.map((r) => r.role);
  }

  async createSeekerProfile(userId: string, location?: string) {
    return this.prisma.seekerProfile.create({
      data: { userId, ...(location ? { location } : {}) },
    });
  }

  // Length caps live on UpdateSeekerBasicsDto (shared with PATCH /seekers/me
  // via common/seeker-profile-limits.ts) — this must not be called with an
  // unvalidated body.
  async updateSeekerProfile(userId: string, data: { interests?: string[]; location?: string; bio?: string }) {
    const profile = await this.prisma.seekerProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Seeker profile not found');
    // Map explicitly rather than spreading, so a future DTO field can't
    // silently become a writable column. Same reasoning as
    // SeekersService.updateProfile.
    return this.prisma.seekerProfile.update({
      where: { userId },
      data: {
        interests: data.interests,
        location: data.location,
        bio: data.bio,
      },
    });
  }

  async findAll(params: { page: number; limit: number; search?: string }) {
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
        include: { roles: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
