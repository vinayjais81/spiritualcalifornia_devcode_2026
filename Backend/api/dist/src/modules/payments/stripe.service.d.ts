import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
export declare class StripeService {
    private readonly config;
    private readonly stripe;
    private readonly logger;
    private readonly commissionPercent;
    constructor(config: ConfigService);
    createPaymentIntent(params: {
        amount: number;
        currency?: string;
        connectedAccountId?: string;
        metadata?: Record<string, string>;
    }): Promise<{
        clientSecret: string;
        paymentIntentId: string;
    }>;
    createCheckoutSession(params: {
        lineItems: Array<{
            name: string;
            amount: number;
            quantity: number;
            imageUrl?: string;
        }>;
        successUrl: string;
        cancelUrl: string;
        customerEmail?: string;
        connectedAccountId?: string;
        metadata?: Record<string, string>;
    }): Promise<{
        sessionId: string;
        url: string;
    }>;
    createConnectAccount(params: {
        email: string;
        guideId: string;
        displayName: string;
    }): Promise<{
        accountId: string;
        onboardingUrl: string;
    }>;
    createConnectLoginLink(accountId: string): Promise<string>;
    getConnectAccountStatus(accountId: string): Promise<{
        chargesEnabled: boolean;
        payoutsEnabled: boolean;
        detailsSubmitted: boolean;
    }>;
    createRefund(paymentIntentId: string, amountDollars?: number): Promise<Stripe.Refund>;
    createTransfer(params: {
        amount: number;
        connectedAccountId: string;
        description?: string;
    }): Promise<Stripe.Transfer>;
    getBalance(connectedAccountId: string): Promise<{
        available: number;
        pending: number;
    }>;
    constructEvent(payload: Buffer, signature: string): Stripe.Event;
    retrievePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent>;
}
