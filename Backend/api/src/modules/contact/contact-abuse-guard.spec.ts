import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ContactService } from './contact.service';
import { PrismaService } from '../../database/prisma.service';

// Cover for the production abuse found on 2026-09-02: the contact form was an
// unauthenticated, unthrottled endpoint that made the server send email to an
// address the CALLER supplied. 430 submissions arrived in 48 hours aimed at 200
// harvested third-party addresses. See docs/contact-form-abuse.md.
//
// The per-IP throttle on the controller caps one attacker. These tests cover
// the half that survives a distributed one: the auto-reply is what actually
// mails strangers under our sending domain, so it has its own brakes.
//
// The support notification must NEVER be suppressed — it goes to our own inbox,
// carries no reputation risk, and is how the abuse stays visible.

describe('ContactService — auto-reply abuse brakes', () => {
  let service: ContactService;
  let prisma: any;

  const setup = async (counts: { fromAddress: number; siteWide: number }) => {
    prisma = {
      contactLead: {
        create: jest.fn().mockResolvedValue({ id: 'lead_1' }),
        // First call is the per-address count, second is the site-wide count.
        count: jest
          .fn()
          .mockResolvedValueOnce(counts.fromAddress)
          .mockResolvedValueOnce(counts.siteWide),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ContactService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: jest.fn((k: string, d?: any) => d) } },
      ],
    }).compile();

    service = moduleRef.get(ContactService);
  };

  const safe = (email = 'someone@example.com') =>
    (service as any).confirmationIsSafe(email);

  // ── The ordinary case must keep working ───────────────────────────────────

  it('auto-replies to a first-time sender', async () => {
    // 1 = the lead just written for this submission.
    await setup({ fromAddress: 1, siteWide: 3 });
    await expect(safe()).resolves.toBe(true);
  });

  // ── Per-address brake ─────────────────────────────────────────────────────

  it('stops replying to an address that keeps submitting', async () => {
    // The real abuse had single addresses submitting 25 times.
    await setup({ fromAddress: 25, siteWide: 5 });
    await expect(safe()).resolves.toBe(false);
  });

  it('suppresses from the very second submission in a day', async () => {
    // One courtesy reply per address per day is the whole allowance — this is
    // what stops the form being pointed at one person's inbox.
    await setup({ fromAddress: 2, siteWide: 1 });
    await expect(safe()).resolves.toBe(false);
  });

  // ── Site-wide circuit breaker ─────────────────────────────────────────────

  it('opens the breaker when site-wide volume is abnormal', async () => {
    // Observed peak was 30/hour against a genuine baseline of 1-2 per DAY.
    await setup({ fromAddress: 1, siteWide: 30 });
    await expect(safe()).resolves.toBe(false);
  });

  it('stays closed at the cap and opens just above it', async () => {
    // Read the cap rather than restating it: it was tuned down from 20 to 8
    // once the live attack was measured sitting right on top of the old value,
    // and a hardcoded boundary here would have silently stopped testing one.
    const CAP = (ContactService as any).CONFIRMATION_HOURLY_CAP as number;

    await setup({ fromAddress: 1, siteWide: CAP });
    await expect(safe()).resolves.toBe(true);

    await setup({ fromAddress: 1, siteWide: CAP + 1 });
    await expect(safe()).resolves.toBe(false);
  });

  it('breaks site-wide even for an address that has never written before', async () => {
    // A distributed bot rotates addresses, so the per-address brake alone
    // would never fire. This is the one that catches it.
    await setup({ fromAddress: 1, siteWide: 500 });
    await expect(safe()).resolves.toBe(false);
  });

  // ── The lead itself is always recorded ────────────────────────────────────

  it('still persists the lead when the auto-reply will be suppressed', async () => {
    await setup({ fromAddress: 99, siteWide: 99 });

    const res = await service.submitLead({
      name: 'x', email: 'a@b.com', type: 'general',
      subject: 'subject here', message: 'a message long enough',
      // Proof of form render. Without these the submission is now rejected
      // outright as a direct API post — see bot-signals.spec.ts.
      contactReference: '', elapsedMs: 9000,
    } as any);

    expect(prisma.contactLead.create).toHaveBeenCalled();
    expect(res).toEqual({ success: true, id: 'lead_1' });
  });
});
