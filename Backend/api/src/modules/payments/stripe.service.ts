import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(StripeService.name);
  private readonly commissionPercent: number;

  constructor(private readonly config: ConfigService) {
    this.stripe = new Stripe(this.config.get<string>('STRIPE_SECRET_KEY')!, {
      apiVersion: '2025-03-31.basil' as any,
    });
    this.commissionPercent = Number(this.config.get('STRIPE_PLATFORM_COMMISSION_PERCENT', '15'));
  }

  // ─── Payment Intents (Direct charges with platform fee) ────────────────────

  async createPaymentIntent(params: {
    amount: number; // in dollars
    currency?: string;
    connectedAccountId?: string; // Guide's Stripe Connect account
    metadata?: Record<string, string>;
  }): Promise<{ clientSecret: string; paymentIntentId: string }> {
    const amountCents = Math.round(params.amount * 100);
    const platformFeeCents = Math.round(amountCents * (this.commissionPercent / 100));

    const piParams: Stripe.PaymentIntentCreateParams = {
      amount: amountCents,
      currency: params.currency ?? 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: params.metadata ?? {},
    };

    // If guide has a Connect account, use destination charge
    if (params.connectedAccountId) {
      piParams.transfer_data = {
        destination: params.connectedAccountId,
        amount: amountCents - platformFeeCents, // Guide receives total minus platform fee
      };
    }

    const paymentIntent = await this.stripe.paymentIntents.create(piParams);
    this.logger.log(`PaymentIntent created: ${paymentIntent.id} for $${params.amount}`);

    return {
      clientSecret: paymentIntent.client_secret!,
      paymentIntentId: paymentIntent.id,
    };
  }

  // ─── Checkout Sessions (hosted checkout page) ──────────────────────────────

  async createCheckoutSession(params: {
    lineItems: Array<{ name: string; amount: number; quantity: number; imageUrl?: string }>;
    successUrl: string;
    cancelUrl: string;
    customerEmail?: string;
    connectedAccountId?: string;
    metadata?: Record<string, string>;
  }): Promise<{ sessionId: string; url: string }> {
    const platformFeeRate = this.commissionPercent / 100;

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: params.customerEmail,
      line_items: params.lineItems.map((item) => ({
        price_data: {
          currency: 'usd',
          product_data: {
            name: item.name,
            images: item.imageUrl ? [item.imageUrl] : [],
          },
          unit_amount: Math.round(item.amount * 100),
        },
        quantity: item.quantity,
      })),
      payment_intent_data: params.connectedAccountId
        ? {
            application_fee_amount: Math.round(
              params.lineItems.reduce((s, i) => s + i.amount * i.quantity, 0) * platformFeeRate * 100,
            ),
            transfer_data: { destination: params.connectedAccountId },
          }
        : undefined,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: params.metadata ?? {},
    });

    this.logger.log(`Checkout session created: ${session.id}`);
    return { sessionId: session.id, url: session.url! };
  }

  // ─── Stripe Connect (Guide Onboarding) ─────────────────────────────────────

  async createConnectAccount(params: {
    email: string;
    guideId: string;
    displayName: string;
  }): Promise<{ accountId: string; onboardingUrl: string }> {
    const account = await this.stripe.accounts.create({
      type: 'express',
      email: params.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_profile: {
        name: params.displayName,
        product_description: 'Spiritual wellness services and products',
      },
      metadata: { guideId: params.guideId },
    });

    const accountLink = await this.stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${this.config.get('FRONTEND_URL')}/guide/dashboard/earnings?stripe=refresh`,
      return_url: `${this.config.get('FRONTEND_URL')}/guide/dashboard/earnings?stripe=success`,
      type: 'account_onboarding',
    });

    this.logger.log(`Connect account created: ${account.id} for guide ${params.guideId}`);
    return { accountId: account.id, onboardingUrl: accountLink.url };
  }

  async createConnectLoginLink(accountId: string): Promise<string> {
    const link = await this.stripe.accounts.createLoginLink(accountId);
    return link.url;
  }

  /**
   * Generate a fresh onboarding link for an EXISTING Connect account.
   *
   * Critical: this does NOT create a new account — it only mints a new
   * one-time URL that lets the guide resume Stripe's hosted onboarding for
   * the account they already have. Use this when a guide returns to finish
   * setup; `createConnectAccount` would (silently) create a duplicate
   * account in Stripe and orphan the one our DB is tracking.
   */
  async createConnectOnboardingLink(accountId: string): Promise<string> {
    const accountLink = await this.stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${this.config.get('FRONTEND_URL')}/guide/dashboard/earnings?stripe=refresh`,
      return_url: `${this.config.get('FRONTEND_URL')}/guide/dashboard/earnings?stripe=success`,
      type: 'account_onboarding',
    });
    return accountLink.url;
  }

  /**
   * Best-effort deletion of a Connect account. Stripe only allows delete on
   * Custom accounts (and Express accounts in some test scenarios) — Express
   * accounts in live mode usually need to be rejected instead. We try delete
   * first, fall back to reject, and swallow the final error so a Stripe-side
   * cleanup failure doesn't block the rest of the hard-delete cascade.
   */
  async deleteOrRejectConnectAccount(accountId: string): Promise<{
    method: 'deleted' | 'rejected' | 'failed';
    error?: string;
  }> {
    try {
      await this.stripe.accounts.del(accountId);
      this.logger.log(`[Stripe] Deleted Connect account: ${accountId}`);
      return { method: 'deleted' };
    } catch (delErr: any) {
      this.logger.warn(
        `[Stripe] Could not delete ${accountId} (${delErr.message}); attempting reject`,
      );
      try {
        await this.stripe.accounts.reject(accountId, { reason: 'other' });
        this.logger.log(`[Stripe] Rejected Connect account: ${accountId}`);
        return { method: 'rejected' };
      } catch (rejErr: any) {
        this.logger.error(
          `[Stripe] Failed to delete or reject ${accountId}: ${rejErr.message}`,
        );
        return { method: 'failed', error: rejErr.message };
      }
    }
  }

  async getConnectAccountStatus(accountId: string): Promise<{
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
  }> {
    const account = await this.stripe.accounts.retrieve(accountId);
    return {
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
    };
  }

  // ─── Refunds ───────────────────────────────────────────────────────────────

  async createRefund(paymentIntentId: string, amountDollars?: number): Promise<Stripe.Refund> {
    const params: Stripe.RefundCreateParams = {
      payment_intent: paymentIntentId,
    };
    if (amountDollars) {
      params.amount = Math.round(amountDollars * 100);
    }
    const refund = await this.stripe.refunds.create(params);
    this.logger.log(`Refund created: ${refund.id} for PI ${paymentIntentId}`);
    return refund;
  }

  // ─── Transfers / Payouts ───────────────────────────────────────────────────

  async createTransfer(params: {
    amount: number;
    connectedAccountId: string;
    description?: string;
  }): Promise<Stripe.Transfer> {
    const transfer = await this.stripe.transfers.create({
      amount: Math.round(params.amount * 100),
      currency: 'usd',
      destination: params.connectedAccountId,
      description: params.description,
    });
    this.logger.log(`Transfer created: ${transfer.id} to ${params.connectedAccountId}`);
    return transfer;
  }

  async getBalance(connectedAccountId: string): Promise<{ available: number; pending: number }> {
    const balance = await this.stripe.balance.retrieve({
      stripeAccount: connectedAccountId,
    });
    const available = balance.available.reduce((s, b) => s + b.amount, 0) / 100;
    const pending = balance.pending.reduce((s, b) => s + b.amount, 0) / 100;
    return { available, pending };
  }

  // ─── Webhook Signature Verification ────────────────────────────────────────

  constructEvent(payload: Buffer, signature: string): Stripe.Event {
    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET')!;
    return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }

  // ─── Retrieve Payment Intent ───────────────────────────────────────────────

  async retrievePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.retrieve(paymentIntentId);
  }

  async retrieveCharge(chargeId: string): Promise<Stripe.Charge> {
    return this.stripe.charges.retrieve(chargeId);
  }

  // ─── Reconciliation: balance transactions ──────────────────────────────────

  async listBalanceTransactions(params: {
    since: Date;
    until?: Date;
    limit?: number;
  }): Promise<Stripe.BalanceTransaction[]> {
    const sinceUnix = Math.floor(params.since.getTime() / 1000);
    const untilUnix = params.until ? Math.floor(params.until.getTime() / 1000) : undefined;
    const out: Stripe.BalanceTransaction[] = [];
    for await (const txn of this.stripe.balanceTransactions.list({
      created: {
        gte: sinceUnix,
        ...(untilUnix !== undefined ? { lt: untilUnix } : {}),
      },
      limit: params.limit ?? 100,
    })) {
      out.push(txn);
    }
    return out;
  }

  // ─── Stripe Identity (identity proofing — gov ID + selfie) ──────────────────

  /**
   * Create a Stripe Identity VerificationSession (document + matching selfie).
   * Returns the session ("vs_...") incl. hosted `url` + `client_secret`.
   * `metadata` carries our userId/guideId so the webhook can map back to the
   * IdentityVerification row without a DB lookup on Stripe's side.
   */
  async createIdentityVerificationSession(
    userId: string,
    guideId: string,
    returnUrl: string,
  ): Promise<Stripe.Identity.VerificationSession> {
    return this.stripe.identity.verificationSessions.create({
      type: 'document',
      metadata: { userId, guideId },
      options: {
        document: {
          require_matching_selfie: true,
          require_live_capture: true,
        },
      },
      return_url: returnUrl,
    });
  }

  /**
   * Verify + parse a Stripe Identity webhook using the DEDICATED Identity
   * endpoint secret (separate from the payments STRIPE_WEBHOOK_SECRET so the
   * two webhook endpoints stay isolated).
   */
  constructIdentityEvent(payload: Buffer, signature: string): Stripe.Event {
    const secret = this.config.get<string>('STRIPE_IDENTITY_WEBHOOK_SECRET')!;
    return this.stripe.webhooks.constructEvent(payload, signature, secret);
  }

  /**
   * Fetch the live state of a VerificationSession. Used by the reconciliation
   * job to self-heal rows whose webhook was missed.
   */
  async retrieveIdentitySession(id: string): Promise<Stripe.Identity.VerificationSession> {
    return this.stripe.identity.verificationSessions.retrieve(id);
  }
}
