import {
  BadRequestException,
  Controller,
  Headers,
  Logger,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { Webhook } from 'svix';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InviteSenderService } from './invite-sender.service';

/**
 * Resend delivery webhooks — delivered, bounced, complained, opened.
 *
 * Without these we cannot answer "did it arrive?", and bounces would keep
 * accumulating against the sending domain unnoticed. Complaints in particular
 * must reach the suppression list immediately: a second email to someone who
 * pressed "spam" is how a domain gets blocklisted.
 *
 * Resend signs with Svix. The signature is verified over the **raw** bytes, so
 * `main.ts` registers this path for raw-body handling alongside the Stripe
 * webhooks — parsing first and re-serialising would change the bytes and every
 * signature check would fail.
 */
@ApiTags('Webhooks')
@Controller('invites/webhook')
@UseGuards(JwtAuthGuard)
export class InviteWebhookController {
  private readonly logger = new Logger(InviteWebhookController.name);

  constructor(
    private readonly sender: InviteSenderService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('resend')
  @ApiExcludeEndpoint()
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('svix-id') svixId: string,
    @Headers('svix-timestamp') svixTimestamp: string,
    @Headers('svix-signature') svixSignature: string,
  ) {
    const secret = this.config.get<string>('RESEND_WEBHOOK_SECRET');
    if (!secret) {
      // Refuse rather than trust: an unverified endpoint that mutates
      // suppression state is an invitation to have arbitrary addresses
      // suppressed by anyone who finds the URL.
      this.logger.error('RESEND_WEBHOOK_SECRET is not set — refusing to process webhooks.');
      throw new BadRequestException('Webhook not configured.');
    }

    // Same lesson as the Stripe webhook: some middleware leaves the parsed body
    // on req.body, so fall back to it rather than silently failing every check.
    const rawBody = req.rawBody ?? (req.body as unknown as Buffer);
    if (!Buffer.isBuffer(rawBody)) {
      throw new BadRequestException('Expected a raw request body.');
    }

    let event: { type?: string; data?: { email_id?: string } };
    try {
      event = new Webhook(secret).verify(rawBody.toString('utf8'), {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as typeof event;
    } catch (err: any) {
      this.logger.warn(`Rejected a Resend webhook with a bad signature: ${err?.message}`);
      throw new BadRequestException('Invalid signature.');
    }

    const result = await this.sender.applyDeliveryEvent({
      type: event.type ?? '',
      messageId: event.data?.email_id ?? null,
    });

    // Always 200 for a verified event, even when it matches nothing we sent —
    // a 4xx would make Resend retry an event we will never recognise.
    return { received: true, ...result };
  }
}
