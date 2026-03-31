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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var StripeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const stripe_1 = __importDefault(require("stripe"));
let StripeService = StripeService_1 = class StripeService {
    config;
    stripe;
    logger = new common_1.Logger(StripeService_1.name);
    commissionPercent;
    constructor(config) {
        this.config = config;
        this.stripe = new stripe_1.default(this.config.get('STRIPE_SECRET_KEY'), {
            apiVersion: '2025-03-31.basil',
        });
        this.commissionPercent = Number(this.config.get('STRIPE_PLATFORM_COMMISSION_PERCENT', '15'));
    }
    async createPaymentIntent(params) {
        const amountCents = Math.round(params.amount * 100);
        const platformFeeCents = Math.round(amountCents * (this.commissionPercent / 100));
        const piParams = {
            amount: amountCents,
            currency: params.currency ?? 'usd',
            automatic_payment_methods: { enabled: true },
            metadata: params.metadata ?? {},
        };
        if (params.connectedAccountId) {
            piParams.transfer_data = {
                destination: params.connectedAccountId,
                amount: amountCents - platformFeeCents,
            };
        }
        const paymentIntent = await this.stripe.paymentIntents.create(piParams);
        this.logger.log(`PaymentIntent created: ${paymentIntent.id} for $${params.amount}`);
        return {
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
        };
    }
    async createCheckoutSession(params) {
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
                    application_fee_amount: Math.round(params.lineItems.reduce((s, i) => s + i.amount * i.quantity, 0) * platformFeeRate * 100),
                    transfer_data: { destination: params.connectedAccountId },
                }
                : undefined,
            success_url: params.successUrl,
            cancel_url: params.cancelUrl,
            metadata: params.metadata ?? {},
        });
        this.logger.log(`Checkout session created: ${session.id}`);
        return { sessionId: session.id, url: session.url };
    }
    async createConnectAccount(params) {
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
    async createConnectLoginLink(accountId) {
        const link = await this.stripe.accounts.createLoginLink(accountId);
        return link.url;
    }
    async getConnectAccountStatus(accountId) {
        const account = await this.stripe.accounts.retrieve(accountId);
        return {
            chargesEnabled: account.charges_enabled,
            payoutsEnabled: account.payouts_enabled,
            detailsSubmitted: account.details_submitted,
        };
    }
    async createRefund(paymentIntentId, amountDollars) {
        const params = {
            payment_intent: paymentIntentId,
        };
        if (amountDollars) {
            params.amount = Math.round(amountDollars * 100);
        }
        const refund = await this.stripe.refunds.create(params);
        this.logger.log(`Refund created: ${refund.id} for PI ${paymentIntentId}`);
        return refund;
    }
    async createTransfer(params) {
        const transfer = await this.stripe.transfers.create({
            amount: Math.round(params.amount * 100),
            currency: 'usd',
            destination: params.connectedAccountId,
            description: params.description,
        });
        this.logger.log(`Transfer created: ${transfer.id} to ${params.connectedAccountId}`);
        return transfer;
    }
    async getBalance(connectedAccountId) {
        const balance = await this.stripe.balance.retrieve({
            stripeAccount: connectedAccountId,
        });
        const available = balance.available.reduce((s, b) => s + b.amount, 0) / 100;
        const pending = balance.pending.reduce((s, b) => s + b.amount, 0) / 100;
        return { available, pending };
    }
    constructEvent(payload, signature) {
        const webhookSecret = this.config.get('STRIPE_WEBHOOK_SECRET');
        return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    }
    async retrievePaymentIntent(paymentIntentId) {
        return this.stripe.paymentIntents.retrieve(paymentIntentId);
    }
};
exports.StripeService = StripeService;
exports.StripeService = StripeService = StripeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], StripeService);
//# sourceMappingURL=stripe.service.js.map