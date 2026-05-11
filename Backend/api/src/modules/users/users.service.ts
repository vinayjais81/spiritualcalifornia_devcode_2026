import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Role, User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
        | 'isBanned'
        | 'bannedReason'
        | 'emailVerifyToken'
        | 'emailVerifyExpiry'
        | 'passwordResetToken'
        | 'passwordResetExpiry'
        | 'passwordHash'
        | 'lastLoginAt'
        | 'marketingEmails'
        | 'pendingIntent'
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

  async getRoles(userId: string): Promise<Role[]> {
    const userRoles = await this.prisma.userRole.findMany({ where: { userId } });
    return userRoles.map((r) => r.role);
  }

  async createSeekerProfile(userId: string, location?: string) {
    return this.prisma.seekerProfile.create({
      data: { userId, ...(location ? { location } : {}) },
    });
  }

  async updateSeekerProfile(userId: string, data: { interests?: string[]; location?: string; bio?: string }) {
    return this.prisma.seekerProfile.update({ where: { userId }, data });
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
