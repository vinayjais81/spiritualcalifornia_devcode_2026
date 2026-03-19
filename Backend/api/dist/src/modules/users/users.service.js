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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma.service");
let UsersService = class UsersService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findById(id) {
        return this.prisma.user.findUnique({
            where: { id },
            include: { roles: true },
        });
    }
    async findByEmail(email) {
        return this.prisma.user.findUnique({
            where: { email },
            include: { roles: true },
        });
    }
    async findByIdOrThrow(id) {
        const user = await this.findById(id);
        if (!user)
            throw new common_1.NotFoundException('User not found');
        return user;
    }
    async create(data) {
        return this.prisma.user.create({
            data,
            include: { roles: true },
        });
    }
    async update(id, data) {
        return this.prisma.user.update({ where: { id }, data });
    }
    async assignRole(userId, role) {
        return this.prisma.userRole.upsert({
            where: { userId_role: { userId, role } },
            create: { userId, role },
            update: {},
        });
    }
    async removeRole(userId, role) {
        return this.prisma.userRole.deleteMany({ where: { userId, role } });
    }
    async getRoles(userId) {
        const userRoles = await this.prisma.userRole.findMany({ where: { userId } });
        return userRoles.map((r) => r.role);
    }
    async createSeekerProfile(userId, location) {
        return this.prisma.seekerProfile.create({
            data: { userId, ...(location ? { location } : {}) },
        });
    }
    async updateSeekerProfile(userId, data) {
        return this.prisma.seekerProfile.update({ where: { userId }, data });
    }
    async findAll(params) {
        const { page, limit, search } = params;
        const skip = (page - 1) * limit;
        const where = search
            ? {
                OR: [
                    { email: { contains: search, mode: 'insensitive' } },
                    { firstName: { contains: search, mode: 'insensitive' } },
                    { lastName: { contains: search, mode: 'insensitive' } },
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
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UsersService);
//# sourceMappingURL=users.service.js.map