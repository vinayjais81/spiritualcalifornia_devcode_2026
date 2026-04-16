"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var TicketsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma.service");
const payments_service_1 = require("../payments/payments.service");
const crypto_1 = require("crypto");
const QRCode = __importStar(require("qrcode"));
let TicketsService = TicketsService_1 = class TicketsService {
    prisma;
    paymentsService;
    logger = new common_1.Logger(TicketsService_1.name);
    constructor(prisma, paymentsService) {
        this.prisma = prisma;
        this.paymentsService = paymentsService;
    }
    async eventCheckout(userId, dto) {
        const seeker = await this.prisma.seekerProfile.findUnique({ where: { userId } });
        if (!seeker)
            throw new common_1.ForbiddenException('Seeker profile not found');
        if (dto.attendees.length !== dto.quantity) {
            throw new common_1.BadRequestException(`Expected ${dto.quantity} attendees, got ${dto.attendees.length}`);
        }
        const event = await this.prisma.event.findUnique({
            where: { id: dto.eventId },
            include: {
                guide: {
                    select: { id: true, displayName: true, stripeAccountId: true, user: { select: { firstName: true, lastName: true } } },
                },
                ticketTiers: true,
            },
        });
        if (!event || !event.isPublished)
            throw new common_1.NotFoundException('Event not found or not published');
        if (event.isCancelled)
            throw new common_1.BadRequestException('This event has been cancelled');
        const tier = event.ticketTiers.find((t) => t.id === dto.tierId);
        if (!tier || !tier.isActive)
            throw new common_1.NotFoundException('Ticket tier not found or inactive');
        const remaining = tier.capacity - tier.sold;
        if (remaining < dto.quantity) {
            throw new common_1.BadRequestException(`Only ${remaining} ticket${remaining !== 1 ? 's' : ''} remaining`);
        }
        const pricePerTicket = Number(tier.price);
        const subtotal = pricePerTicket * dto.quantity;
        const bookingFeeRate = 0.05;
        const bookingFee = Math.round(subtotal * bookingFeeRate * 100) / 100;
        const totalAmount = subtotal + bookingFee;
        const purchaseGroupId = (0, crypto_1.randomBytes)(16).toString('hex');
        const purchases = await this.prisma.$transaction(async (tx) => {
            const freshTier = await tx.eventTicketTier.findUnique({ where: { id: tier.id } });
            if (!freshTier || (freshTier.capacity - freshTier.sold) < dto.quantity) {
                throw new common_1.BadRequestException('Tickets sold out while processing');
            }
            const created = [];
            for (const attendee of dto.attendees) {
                const ticket = await tx.ticketPurchase.create({
                    data: {
                        purchaseGroupId,
                        seekerId: seeker.id,
                        tierId: tier.id,
                        quantity: 1,
                        totalAmount: pricePerTicket,
                        bookingFee: bookingFee / dto.quantity,
                        status: 'PENDING',
                        attendeeName: `${attendee.firstName} ${attendee.lastName}`,
                        attendeeEmail: attendee.email,
                        dietaryNeeds: attendee.dietaryNeeds || null,
                        accessibilityNeeds: attendee.accessibilityNeeds || null,
                    },
                });
                created.push(ticket);
            }
            return created;
        });
        const primaryPurchase = purchases[0];
        const guideName = event.guide.displayName || `${event.guide.user.firstName} ${event.guide.user.lastName}`;
        const paymentResult = await this.paymentsService.createPaymentIntent({
            amount: totalAmount,
            currency: tier.currency.toLowerCase(),
            ticketPurchaseId: primaryPurchase.id,
            metadata: {
                eventId: event.id,
                eventTitle: event.title,
                tierId: tier.id,
                tierName: tier.name,
                quantity: dto.quantity,
                purchaseGroupId,
                guideName,
                primaryAttendeeEmail: dto.attendees[0].email,
            },
        });
        this.logger.log(`Event checkout: ${dto.quantity} × "${tier.name}" for "${event.title}" → group ${purchaseGroupId}`);
        return {
            purchaseGroupId,
            ticketPurchaseIds: purchases.map((p) => p.id),
            clientSecret: paymentResult.clientSecret,
            paymentIntentId: paymentResult.paymentIntentId,
            event: {
                id: event.id,
                title: event.title,
                startTime: event.startTime,
                endTime: event.endTime,
                location: event.location,
                type: event.type,
            },
            tier: {
                id: tier.id,
                name: tier.name,
                price: pricePerTicket,
                currency: tier.currency,
            },
            summary: {
                quantity: dto.quantity,
                subtotal,
                bookingFee,
                total: totalAmount,
            },
        };
    }
    async confirmPurchaseGroup(purchaseGroupId) {
        const tickets = await this.prisma.ticketPurchase.findMany({
            where: { purchaseGroupId },
            include: {
                tier: { include: { event: { select: { id: true, title: true, startTime: true, endTime: true, location: true, type: true } } } },
            },
        });
        if (!tickets.length)
            return;
        if (tickets[0].status === 'CONFIRMED')
            return;
        for (const ticket of tickets) {
            const qrData = JSON.stringify({
                ticketId: ticket.id,
                eventId: ticket.tier.event.id,
                eventTitle: ticket.tier.event.title,
                tierName: ticket.tier.name,
                attendeeName: ticket.attendeeName,
            });
            const qrCode = await QRCode.toDataURL(qrData, { width: 200, margin: 2 });
            await this.prisma.ticketPurchase.update({
                where: { id: ticket.id },
                data: { status: 'CONFIRMED', qrCode },
            });
        }
        const tierId = tickets[0].tierId;
        await this.prisma.eventTicketTier.update({
            where: { id: tierId },
            data: { sold: { increment: tickets.length } },
        });
        this.logger.log(`Confirmed ${tickets.length} tickets for group ${purchaseGroupId}`);
    }
    async getPurchaseGroup(userId, purchaseGroupId) {
        const seeker = await this.prisma.seekerProfile.findUnique({ where: { userId } });
        if (!seeker)
            throw new common_1.ForbiddenException('Seeker profile not found');
        const tickets = await this.prisma.ticketPurchase.findMany({
            where: { purchaseGroupId, seekerId: seeker.id },
            include: {
                tier: {
                    include: {
                        event: {
                            select: {
                                id: true, title: true, startTime: true, endTime: true,
                                location: true, type: true, coverImageUrl: true,
                                guide: { select: { displayName: true, user: { select: { firstName: true, lastName: true } } } },
                            },
                        },
                    },
                },
                payment: { select: { id: true, amount: true, status: true, createdAt: true } },
            },
            orderBy: { createdAt: 'asc' },
        });
        if (!tickets.length)
            throw new common_1.NotFoundException('Purchase not found');
        return {
            purchaseGroupId,
            status: tickets[0].status,
            event: tickets[0].tier.event,
            tier: { id: tickets[0].tier.id, name: tickets[0].tier.name, price: Number(tickets[0].tier.price) },
            tickets: tickets.map((t) => ({
                id: t.id,
                attendeeName: t.attendeeName,
                attendeeEmail: t.attendeeEmail,
                dietaryNeeds: t.dietaryNeeds,
                accessibilityNeeds: t.accessibilityNeeds,
                qrCode: t.qrCode,
                status: t.status,
            })),
            summary: {
                quantity: tickets.length,
                subtotal: tickets.reduce((sum, t) => sum + Number(t.totalAmount), 0),
                bookingFee: tickets.reduce((sum, t) => sum + Number(t.bookingFee), 0),
                total: tickets.reduce((sum, t) => sum + Number(t.totalAmount) + Number(t.bookingFee), 0),
            },
        };
    }
    async getMyEventTickets(userId) {
        const seeker = await this.prisma.seekerProfile.findUnique({ where: { userId } });
        if (!seeker)
            throw new common_1.ForbiddenException('Seeker profile not found');
        const tickets = await this.prisma.ticketPurchase.findMany({
            where: { seekerId: seeker.id },
            include: {
                tier: {
                    include: {
                        event: {
                            select: {
                                id: true, title: true, startTime: true, endTime: true, timezone: true,
                                location: true, type: true, coverImageUrl: true, isCancelled: true,
                                guide: { select: { displayName: true, user: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
                            },
                        },
                    },
                },
                payment: { select: { id: true, amount: true, status: true, createdAt: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        const groups = new Map();
        for (const t of tickets) {
            const arr = groups.get(t.purchaseGroupId) || [];
            arr.push(t);
            groups.set(t.purchaseGroupId, arr);
        }
        return Array.from(groups.entries()).map(([groupId, tix]) => {
            const first = tix[0];
            const event = first.tier.event;
            const guideName = event.guide.displayName || `${event.guide.user.firstName} ${event.guide.user.lastName}`;
            return {
                purchaseGroupId: groupId,
                status: first.status,
                ticketCount: tix.length,
                totalAmount: tix.reduce((sum, t) => sum + Number(t.totalAmount), 0),
                bookingFee: tix.reduce((sum, t) => sum + Number(t.bookingFee), 0),
                createdAt: first.createdAt,
                event: {
                    id: event.id,
                    title: event.title,
                    startTime: event.startTime,
                    endTime: event.endTime,
                    timezone: event.timezone,
                    location: event.location,
                    type: event.type,
                    coverImageUrl: event.coverImageUrl,
                    isCancelled: event.isCancelled,
                },
                tier: { name: first.tier.name, price: Number(first.tier.price) },
                guide: {
                    name: guideName,
                    avatarUrl: event.guide.user.avatarUrl,
                },
                tickets: tix.map((t) => ({
                    id: t.id,
                    attendeeName: t.attendeeName,
                    attendeeEmail: t.attendeeEmail,
                    qrCode: t.qrCode,
                    status: t.status,
                })),
            };
        });
    }
};
exports.TicketsService = TicketsService;
exports.TicketsService = TicketsService = TicketsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        payments_service_1.PaymentsService])
], TicketsService);
//# sourceMappingURL=tickets.service.js.map