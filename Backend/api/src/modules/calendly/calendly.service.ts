import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';

export interface CalendlyEventType {
  uri: string;
  name: string;
  slug: string;
  duration: number;
  schedulingUrl: string;
  active: boolean;
  kind: string; // 'solo' | 'group'
  type: string; // 'StandardEventType'
}

export interface CalendlyScheduledEvent {
  uri: string;
  name: string;
  status: string; // 'active' | 'canceled'
  startTime: string;
  endTime: string;
  eventType: string;
  location?: { type: string; join_url?: string };
  inviteesCounter: { total: number; active: number };
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class CalendlyService {
  private readonly logger = new Logger(CalendlyService.name);
  private readonly CALENDLY_API = 'https://api.calendly.com';
  private readonly CALENDLY_AUTH = 'https://auth.calendly.com';

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  // ─── Token Management ──────────────────────────────────────────────────────

  /**
   * Get a valid access token for a guide, refreshing if needed.
   * Calendly access tokens expire after ~2 hours.
   */
  async getValidToken(guideProfileId: string): Promise<string> {
    const guide = await this.prisma.guideProfile.findUnique({
      where: { id: guideProfileId },
      select: {
        calendlyAccessToken: true,
        calendlyRefreshToken: true,
        calendlyConnected: true,
      },
    });

    if (!guide || !guide.calendlyConnected || !guide.calendlyAccessToken) {
      throw new BadRequestException('Calendly is not connected for this guide');
    }

    // Try the current token first
    const testRes = await fetch(`${this.CALENDLY_API}/users/me`, {
      headers: { Authorization: `Bearer ${guide.calendlyAccessToken}` },
    });

    if (testRes.ok) {
      return guide.calendlyAccessToken;
    }

    // Token expired — refresh it
    if (!guide.calendlyRefreshToken) {
      throw new BadRequestException('Calendly refresh token missing. Please reconnect Calendly.');
    }

    return this.refreshToken(guideProfileId, guide.calendlyRefreshToken);
  }

  private async refreshToken(guideProfileId: string, refreshToken: string): Promise<string> {
    const clientId = this.configService.get<string>('CALENDLY_CLIENT_ID', '');
    const clientSecret = this.configService.get<string>('CALENDLY_CLIENT_SECRET', '');

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

      // Mark as disconnected so guide can reconnect
      await this.prisma.guideProfile.update({
        where: { id: guideProfileId },
        data: { calendlyConnected: false, calendlyAccessToken: null, calendlyRefreshToken: null },
      });

      throw new BadRequestException('Calendly token expired. Please reconnect Calendly from your dashboard.');
    }

    const tokens: any = await res.json();
    const newAccessToken: string = tokens.access_token;
    const newRefreshToken: string = tokens.refresh_token ?? refreshToken;

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

  // ─── Fetch Event Types ─────────────────────────────────────────────────────

  /**
   * List the guide's Calendly event types (the scheduling pages they've set up).
   */
  async getEventTypes(userId: string): Promise<CalendlyEventType[]> {
    const guide = await this.requireGuide(userId);
    const token = await this.getValidToken(guide.id);

    const res = await fetch(
      `${this.CALENDLY_API}/event_types?user=${guide.calendlyUserUri}&active=true`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!res.ok) {
      this.logger.error(`[Calendly] Failed to fetch event types: ${res.status}`);
      throw new BadRequestException('Failed to fetch Calendly event types');
    }

    const data: any = await res.json();
    return (data.collection || []).map((et: any) => ({
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

  // ─── Fetch Scheduled Events ────────────────────────────────────────────────

  /**
   * List scheduled events for a guide (upcoming bookings made through Calendly).
   */
  async getScheduledEvents(
    userId: string,
    options: { status?: string; minStartTime?: string; maxStartTime?: string; count?: number } = {},
  ): Promise<CalendlyScheduledEvent[]> {
    const guide = await this.requireGuide(userId);
    const token = await this.getValidToken(guide.id);

    const params = new URLSearchParams({ user: guide.calendlyUserUri! });
    if (options.status) params.set('status', options.status);
    if (options.minStartTime) params.set('min_start_time', options.minStartTime);
    if (options.maxStartTime) params.set('max_start_time', options.maxStartTime);
    if (options.count) params.set('count', String(options.count));
    params.set('sort', 'start_time:asc');

    const res = await fetch(
      `${this.CALENDLY_API}/scheduled_events?${params.toString()}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!res.ok) {
      this.logger.error(`[Calendly] Failed to fetch scheduled events: ${res.status}`);
      throw new BadRequestException('Failed to fetch Calendly events');
    }

    const data: any = await res.json();
    return (data.collection || []).map((ev: any) => ({
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

  // ─── Get Scheduling Link ──────────────────────────────────────────────────

  /**
   * Get the guide's primary scheduling URL for embedding on the booking page.
   * Prefers the stored calendarLink; falls back to first active event type.
   */
  async getSchedulingLink(userId: string): Promise<{ link: string; eventTypes: CalendlyEventType[] }> {
    const guide = await this.requireGuide(userId);

    // If guide has a manually set calendar link, return it
    if (guide.calendarLink) {
      return { link: guide.calendarLink, eventTypes: [] };
    }

    // Otherwise fetch from Calendly API
    const eventTypes = await this.getEventTypes(userId);
    const primary = eventTypes.find(et => et.active) || eventTypes[0];

    return {
      link: primary?.schedulingUrl || '',
      eventTypes,
    };
  }

  // ─── Get Public Scheduling Info (for seeker booking page) ─────────────────

  /**
   * Get scheduling info by guide slug — used on the public booking page.
   * No auth required (public endpoint).
   */
  async getPublicSchedulingInfo(guideSlug: string) {
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
      throw new NotFoundException('Guide not found');
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

  // ─── Calendly Connection Status ────────────────────────────────────────────

  async getConnectionStatus(userId: string) {
    const guide = await this.requireGuide(userId);

    return {
      connected: guide.calendlyConnected,
      calendarLink: guide.calendarLink,
      calendarType: guide.calendarType,
      calendlyUserUri: guide.calendlyUserUri,
    };
  }

  // ─── Disconnect ────────────────────────────────────────────────────────────

  async disconnect(userId: string) {
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

  // ─── Webhook: Handle Calendly Events ───────────────────────────────────────

  /**
   * Process incoming Calendly webhook events.
   * Supports: invitee.created, invitee.canceled
   */
  async handleWebhookEvent(event: any, signature: string) {
    const webhookSecret = this.configService.get<string>('CALENDLY_WEBHOOK_SECRET', '');

    // Verify webhook signature (Calendly uses HMAC-SHA256)
    if (webhookSecret) {
      const crypto = await import('crypto');
      const computedSig = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(event))
        .digest('hex');

      if (signature !== computedSig) {
        this.logger.warn('[Calendly] Invalid webhook signature — rejecting');
        throw new BadRequestException('Invalid webhook signature');
      }
    }

    const eventType = event.event; // 'invitee.created' | 'invitee.canceled'
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

  private async handleInviteeCreated(payload: any) {
    const scheduledEvent = payload.scheduled_event;
    const invitee = payload;

    this.logger.log(
      `[Calendly] New booking: ${invitee.name} (${invitee.email}) ` +
      `for ${scheduledEvent.name} at ${scheduledEvent.start_time}`,
    );

    // Find the guide by their Calendly user URI
    // The scheduled_event URI contains the user info
    const eventMemberships = scheduledEvent.event_memberships || [];
    const guideUserUri = eventMemberships[0]?.user;

    if (guideUserUri) {
      const guide = await this.prisma.guideProfile.findFirst({
        where: { calendlyUserUri: guideUserUri },
      });

      if (guide) {
        // Create a ServiceSlot to mark this time as booked
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

  private async handleInviteeCanceled(payload: any) {
    const scheduledEvent = payload.scheduled_event;

    this.logger.log(
      `[Calendly] Booking canceled: ${payload.name} (${payload.email}) ` +
      `for ${scheduledEvent.name} at ${scheduledEvent.start_time}`,
    );

    // Find and unbook the matching ServiceSlot
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

  // ─── Cancel Calendly Event (for failed payments) ───────────────────────────

  /**
   * Cancel a Calendly invitee when payment fails.
   * Uses the invitee URI to mark the invitee as canceled.
   */
  async cancelInvitee(guideProfileId: string, inviteeUri: string, reason?: string) {
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
    } catch (err) {
      this.logger.error(`[Calendly] Error cancelling invitee: ${err}`);
      return { cancelled: false };
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async requireGuide(userId: string) {
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
      throw new NotFoundException('Guide profile not found');
    }

    return guide;
  }
}
