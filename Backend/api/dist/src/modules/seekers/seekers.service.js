"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeekersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma.service");
let SeekersService = class SeekersService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getOnboardingStatus(userId) {
        const profile = await this.prisma.seekerProfile.findUnique({ where: { userId } });
        if (!profile)
            return { step: 1, completed: false };
        return { step: profile.onboardingStep, completed: profile.onboardingCompleted };
    }
    async updateOnboardingStep(userId, step, completed = false) {
        const profile = await this.prisma.seekerProfile.findUnique({ where: { userId } });
        if (!profile)
            throw new common_1.NotFoundException('Seeker profile not found');
        return this.prisma.seekerProfile.update({
            where: { userId },
            data: { onboardingStep: step, ...(completed ? { onboardingCompleted: true } : {}) },
        });
    }
    async getMyProfile(userId) {
        const profile = await this.prisma.seekerProfile.findUnique({
            where: { userId },
            include: {
                user: {
                    select: {
                        id: true, email: true, firstName: true, lastName: true,
                        avatarUrl: true, phone: true, createdAt: true,
                    },
                },
            },
        });
        if (!profile)
            throw new common_1.NotFoundException('Seeker profile not found');
        return profile;
    }
    async updateProfile(userId, dto) {
        const profile = await this.prisma.seekerProfile.findUnique({ where: { userId } });
        if (!profile)
            throw new common_1.NotFoundException('Seeker profile not found');
        return this.prisma.seekerProfile.update({
            where: { userId },
            data: dto,
        });
    }
    async getDashboardStats(userId) {
        const profile = await this.prisma.seekerProfile.findUnique({ where: { userId } });
        if (!profile)
            return { totalBookings: 0, upcomingBookings: 0, completedBookings: 0, totalSpent: 0, favoriteGuides: 0 };
        const now = new Date();
        const [totalBookings, upcomingBookings, completedBookings, payments, favoriteGuides] = await Promise.all([
            this.prisma.booking.count({ where: { seekerId: profile.id } }),
            this.prisma.booking.count({
                where: {
                    seekerId: profile.id,
                    status: { in: ['PENDING', 'CONFIRMED'] },
                    slot: { startTime: { gte: now } },
                },
            }),
            this.prisma.booking.count({ where: { seekerId: profile.id, status: 'COMPLETED' } }),
            this.prisma.payment.findMany({
                where: { booking: { seekerId: profile.id }, status: 'SUCCEEDED' },
                select: { amount: true },
            }),
            this.prisma.favorite.count({ where: { seekerId: profile.id } }),
        ]);
        const totalSpent = payments.reduce((sum, p) => sum + Number(p.amount), 0);
        return { totalBookings, upcomingBookings, completedBookings, totalSpent, favoriteGuides };
    }
    async getPaymentHistory(userId) {
        const profile = await this.prisma.seekerProfile.findUnique({ where: { userId } });
        if (!profile)
            return [];
        return this.prisma.payment.findMany({
            where: {
                OR: [
                    { booking: { seekerId: profile.id } },
                    { order: { seekerId: profile.id } },
                    { ticketPurchase: { seekerId: profile.id } },
                    { tourBooking: { seekerId: profile.id } },
                ],
            },
            include: {
                booking: {
                    select: {
                        id: true,
                        service: { select: { name: true, guide: { select: { displayName: true } } } },
                        slot: { select: { startTime: true } },
                    },
                },
                order: { select: { id: true, items: { select: { product: { select: { name: true } } } } } },
                ticketPurchase: { select: { id: true, tier: { select: { name: true, event: { select: { title: true } } } } } },
                tourBooking: { select: { id: true, tour: { select: { title: true } } } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async getFavorites(userId) {
        const profile = await this.prisma.seekerProfile.findUnique({ where: { userId } });
        if (!profile)
            return [];
        return this.prisma.favorite.findMany({
            where: { seekerId: profile.id },
            include: {
                seeker: false,
            },
            orderBy: { createdAt: 'desc' },
        }).then(async (favs) => {
            const guideIds = favs.map(f => f.guideId);
            const guides = await this.prisma.guideProfile.findMany({
                where: { id: { in: guideIds } },
                select: {
                    id: true, slug: true, displayName: true, tagline: true,
                    averageRating: true, totalReviews: true, isVerified: true,
                    user: { select: { avatarUrl: true } },
                },
            });
            const guideMap = new Map(guides.map(g => [g.id, g]));
            return favs.map(f => ({ ...f, guide: guideMap.get(f.guideId) || null }));
        });
    }
    async addFavorite(userId, guideId) {
        const profile = await this.prisma.seekerProfile.findUnique({ where: { userId } });
        if (!profile)
            throw new common_1.NotFoundException('Seeker profile not found');
        const guide = await this.prisma.guideProfile.findUnique({ where: { id: guideId } });
        if (!guide)
            throw new common_1.NotFoundException('Guide not found');
        const existing = await this.prisma.favorite.findUnique({
            where: { seekerId_guideId: { seekerId: profile.id, guideId } },
        });
        if (existing)
            throw new common_1.ConflictException('Already in favorites');
        return this.prisma.favorite.create({
            data: { seekerId: profile.id, guideId },
        });
    }
    async removeFavorite(userId, guideId) {
        const profile = await this.prisma.seekerProfile.findUnique({ where: { userId } });
        if (!profile)
            throw new common_1.NotFoundException('Seeker profile not found');
        await this.prisma.favorite.deleteMany({
            where: { seekerId: profile.id, guideId },
        });
        return { deleted: true };
    }
};
exports.SeekersService = SeekersService;
exports.SeekersService = SeekersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SeekersService);
//# sourceMappingURL=seekers.service.js.map