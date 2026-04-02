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
var CalendlyService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalendlyService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../../database/prisma.service");
let CalendlyService = CalendlyService_1 = class CalendlyService {
    prisma;
    configService;
    logger = new common_1.Logger(CalendlyService_1.name);
    CALENDLY_API = 'https://api.calendly.com';
    CALENDLY_AUTH = 'https://auth.calendly.com';
    constructor(prisma, configService) {
        this.prisma = prisma;
        this.configService = configService;
    }
    async getValidToken(guideProfileId) {
        const guide = await this.prisma.guideProfile.findUnique({
            where: { id: guideProfileId },
            select: {
                calendlyAccessToken: true,
                calendlyRefreshToken: true,
                calendlyConnected: true,
            },
        });
        if (!guide || !guide.calendlyConnected || !guide.calendlyAccessToken) {
            throw new common_1.BadRequestException('Calendly is not connected for this guide');
        }
        const testRes = await fetch(`${this.CALENDLY_API}/users/me`, {
            headers: { Authorization: `Bearer ${guide.calendlyAccessToken}` },
        });
        if (testRes.ok) {
            return guide.calendlyAccessToken;
        }
        if (!guide.calendlyRefreshToken) {
            throw new common_1.BadRequestException('Calendly refresh token missing. Please reconnect Calendly.');
        }
        return this.refreshToken(guideProfileId, guide.calendlyRefreshToken);
    }
    async refreshToken(guideProfileId, refreshToken) {
        const clientId = this.configService.get('CALENDLY_CLIENT_ID', '');
        const clientSecret = this.configService.get('CALENDLY_CLIENT_SECRET', '');
        const res = await fetch(`${this.CALENDLY_AUTH}/oauth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: clientId,
                client_secret: clientSecret,
            }).toString(),
        });
        if (!res.ok) {
            const errText = await res.text();
            this.logger.error(`[Calendly] Token refresh failed: ${res.status} ${errText}`);
            await this.prisma.guideProfile.update({
                where: { id: guideProfileId },
                data: { calendlyConnected: false, calendlyAccessToken: null, calendlyRefreshToken: null },
            });
            throw new common_1.BadRequestException('Calendly token expired. Please reconnect Calendly from your dashboard.');
        }
        const tokens = await res.json();
        const newAccessToken = tokens.access_token;
        const newRefreshToken = tokens.refresh_token ?? refreshToken;
        await this.prisma.guideProfile.update({
            where: { id: guideProfileId },
            data: {
                calendlyAccessToken: newAccessToken,
                calendlyRefreshToken: newRefreshToken,
            },
        });
        this.logger.log(`[Calendly] Token refreshed for guide ${guideProfileId}`);
        return newAccessToken;
    }
    async getEventTypes(userId) {
        const guide = await this.requireGuide(userId);
        const token = await this.getValidToken(guide.id);
        const res = await fetch(`${this.CALENDLY_API}/event_types?user=${guide.calendlyUserUri}&active=true`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) {
            this.logger.error(`[Calendly] Failed to fetch event types: ${res.status}`);
            throw new common_1.BadRequestException('Failed to fetch Calendly event types');
        }
        const data = await res.json();
        return (data.collection || []).map((et) => ({
            uri: et.uri,
            name: et.name,
            slug: et.slug,
            duration: et.duration,
            schedulingUrl: et.scheduling_url,
            active: et.active,
            kind: et.kind,
            type: et.type,
        }));
    }
    async getScheduledEvents(userId, options = {}) {
        const guide = await this.requireGuide(userId);
        const token = await this.getValidToken(guide.id);
        const params = new URLSearchParams({ user: guide.calendlyUserUri });
        if (options.status)
            params.set('status', options.status);
        if (options.minStartTime)
            params.set('min_start_time', options.minStartTime);
        if (options.maxStartTime)
            params.set('max_start_time', options.maxStartTime);
        if (options.count)
            params.set('count', String(options.count));
        params.set('sort', 'start_time:asc');
        const res = await fetch(`${this.CALENDLY_API}/scheduled_events?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) {
            this.logger.error(`[Calendly] Failed to fetch scheduled events: ${res.status}`);
            throw new common_1.BadRequestException('Failed to fetch Calendly events');
        }
        const data = await res.json();
        return (data.collection || []).map((ev) => ({
            uri: ev.uri,
            name: ev.name,
            status: ev.status,
            startTime: ev.start_time,
            endTime: ev.end_time,
            eventType: ev.event_type,
            location: ev.location,
            inviteesCounter: ev.invitees_counter,
            createdAt: ev.created_at,
            updatedAt: ev.updated_at,
        }));
    }
    async getSchedulingLink(userId) {
        const guide = await this.requireGuide(userId);
        if (guide.calendarLink) {
            return { link: guide.calendarLink, eventTypes: [] };
        }
        const eventTypes = await this.getEventTypes(userId);
        const primary = eventTypes.find(et => et.active) || eventTypes[0];
        return {
            link: primary?.schedulingUrl || '',
            eventTypes,
        };
    }
    async getPublicSchedulingInfo(guideSlug) {
        const guide = await this.prisma.guideProfile.findUnique({
            where: { slug: guideSlug },
            select: {
                id: true,
                slug: true,
                displayName: true,
                calendarLink: true,
                calendlyConnected: true,
                isVerified: true,
                isPublished: true,
                averageRating: true,
                totalReviews: true,
                user: { select: { avatarUrl: true } },
            },
        });
        if (!guide || !guide.isPublished) {
            throw new common_1.NotFoundException('Guide not found');
        }
        const services = await this.prisma.service.findMany({
            where: { guideId: guide.id, isActive: true },
            orderBy: { createdAt: 'asc' },
            select: {
                id: true,
                name: true,
                description: true,
                type: true,
                price: true,
                currency: true,
                durationMin: true,
            },
        });
        return {
            guide: {
                slug: guide.slug,
                displayName: guide.displayName,
                avatarUrl: guide.user.avatarUrl,
                isVerified: guide.isVerified,
                averageRating: guide.averageRating,
                totalReviews: guide.totalReviews,
                calendlyConnected: guide.calendlyConnected,
                calendarLink: guide.calendarLink,
            },
            services,
        };
    }
    async getConnectionStatus(userId) {
        const guide = await this.requireGuide(userId);
        return {
            connected: guide.calendlyConnected,
            calendarLink: guide.calendarLink,
            calendarType: guide.calendarType,
            calendlyUserUri: guide.calendlyUserUri,
        };
    }
    async disconnect(userId) {
        const guide = await this.requireGuide(userId);
        await this.prisma.guideProfile.update({
            where: { id: guide.id },
            data: {
                calendlyConnected: false,
                calendlyAccessToken: null,
                calendlyRefreshToken: null,
                calendlyUserUri: null,
                calendarType: null,
                calendarLink: null,
            },
        });
        this.logger.log(`[Calendly] Disconnected for guide ${guide.id}`);
        return { disconnected: true };
    }
    async handleWebhookEvent(event, signature) {
        const webhookSecret = this.configService.get('CALENDLY_WEBHOOK_SECRET', '');
        if (webhookSecret) {
            const crypto = await Promise.resolve().then(() => __importStar(require('crypto')));
            const computedSig = crypto
                .createHmac('sha256', webhookSecret)
                .update(JSON.stringify(event))
                .digest('hex');
            if (signature !== computedSig) {
                this.logger.warn('[Calendly] Invalid webhook signature — rejecting');
                throw new common_1.BadRequestException('Invalid webhook signature');
            }
        }
        const eventType = event.event;
        const payload = event.payload;
        this.logger.log(`[Calendly] Webhook received: ${eventType}`);
        switch (eventType) {
            case 'invitee.created':
                await this.handleInviteeCreated(payload);
                break;
            case 'invitee.canceled':
                await this.handleInviteeCanceled(payload);
                break;
            default:
                this.logger.log(`[Calendly] Unhandled webhook event type: ${eventType}`);
        }
        return { received: true };
    }
    async handleInviteeCreated(payload) {
        const scheduledEvent = payload.scheduled_event;
        const invitee = payload;
        this.logger.log(`[Calendly] New booking: ${invitee.name} (${invitee.email}) ` +
            `for ${scheduledEvent.name} at ${scheduledEvent.start_time}`);
        const eventMemberships = scheduledEvent.event_memberships || [];
        const guideUserUri = eventMemberships[0]?.user;
        if (guideUserUri) {
            const guide = await this.prisma.guideProfile.findFirst({
                where: { calendlyUserUri: guideUserUri },
            });
            if (guide) {
                const service = await this.prisma.service.findFirst({
                    where: { guideId: guide.id, isActive: true },
                    orderBy: { createdAt: 'asc' },
                });
                if (service) {
                    await this.prisma.serviceSlot.create({
                        data: {
                            serviceId: service.id,
                            startTime: new Date(scheduledEvent.start_time),
                            endTime: new Date(scheduledEvent.end_time),
                            isBooked: true,
                        },
                    });
                    this.logger.log(`[Calendly] ServiceSlot created for guide ${guide.id}`);
                }
            }
        }
    }
    async handleInviteeCanceled(payload) {
        const scheduledEvent = payload.scheduled_event;
        this.logger.log(`[Calendly] Booking canceled: ${payload.name} (${payload.email}) ` +
            `for ${scheduledEvent.name} at ${scheduledEvent.start_time}`);
        const startTime = new Date(scheduledEvent.start_time);
        const endTime = new Date(scheduledEvent.end_time);
        const slot = await this.prisma.serviceSlot.findFirst({
            where: {
                startTime,
                endTime,
                isBooked: true,
            },
        });
        if (slot) {
            await this.prisma.serviceSlot.update({
                where: { id: slot.id },
                data: { isBooked: false },
            });
            this.logger.log(`[Calendly] ServiceSlot unbooked: ${slot.id}`);
        }
    }
    async cancelInvitee(guideProfileId, inviteeUri, reason) {
        try {
            const token = await this.getValidToken(guideProfileId);
            const res = await fetch(`${this.CALENDLY_API}/${inviteeUri}/cancellation`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ reason: reason || 'Payment was not completed' }),
            });
            if (!res.ok) {
                this.logger.warn(`[Calendly] Failed to cancel invitee: ${res.status}`);
                return { cancelled: false };
            }
            this.logger.log(`[Calendly] Invitee cancelled: ${inviteeUri}`);
            return { cancelled: true };
        }
        catch (err) {
            this.logger.error(`[Calendly] Error cancelling invitee: ${err}`);
            return { cancelled: false };
        }
    }
    async requireGuide(userId) {
        const guide = await this.prisma.guideProfile.findUnique({
            where: { userId },
            select: {
                id: true,
                calendarLink: true,
                calendarType: true,
                calendlyConnected: true,
                calendlyAccessToken: true,
                calendlyRefreshToken: true,
                calendlyUserUri: true,
            },
        });
        if (!guide) {
            throw new common_1.NotFoundException('Guide profile not found');
        }
        return guide;
    }
};
exports.CalendlyService = CalendlyService;
exports.CalendlyService = CalendlyService = CalendlyService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService])
], CalendlyService);
//# sourceMappingURL=calendly.service.js.map