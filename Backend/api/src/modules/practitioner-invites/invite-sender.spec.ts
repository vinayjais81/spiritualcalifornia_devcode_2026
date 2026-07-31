import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { PractitionerImportService } from '../practitioner-import/practitioner-import.service';
import { PractitionerInvitesService } from './practitioner-invites.service';
import { InviteSenderService } from './invite-sender.service';

// Phase 3. The tests below concentrate on the failures that cannot be undone:
// mailing a real practitioner from a test environment, mailing someone who
// already asked us not to, and continuing to send while the sending domain is
// being damaged.

const sendMock = jest.fn();
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send: (...a: unknown[]) => sendMock(...a) } })),
}));

describe('InviteSenderService', () => {
  let service: InviteSenderService;
  let prisma: any;
  let env: Record<string, string>;

  const QUEUED_RECORD = {
    id: 'snd_1',
    status: 'QUEUED',
    openedAt: null,
    emailHash: 'hash1',
    importBatchId: 'bat_1',
    userId: 'usr_1',
    user: {
      id: 'usr_1',
      email: 'maya@example.com',
      firstName: 'Maya',
      passwordHash: null,
      isActive: true,
      marketingEmails: true,
      guideProfile: {
        onboardingPath: 'PROACTIVE_INVITE',
        city: 'Oakland',
        modalities: ['Somatic Therapy'],
        importBatchId: 'bat_1',
      },
    },
    batch: { id: 'bat_1', inviteState: 'SENDING', sourceLabel: 'Bay Area list' },
  };

  const build = async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        InviteSenderService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { get: (k: string, d?: string) => env[k] ?? d },
        },
        {
          provide: PractitionerImportService,
          useValue: {
            hashEmail: (e: string) => `h:${e}`,
            isSuppressed: jest.fn().mockResolvedValue(false),
          },
        },
        {
          provide: PractitionerInvitesService,
          useValue: {
            issueClaimToken: jest.fn().mockResolvedValue({ token: 'tok', expiresAt: new Date() }),
            buildClaimUrl: (t: string) => `https://sc.test/guide/claim?token=${t}`,
            buildUnsubscribeUrl: (u: string) => `https://sc.test/unsubscribe?token=${u}.sig`,
          },
        },
      ],
    }).compile();
    return moduleRef.get(InviteSenderService);
  };

  beforeEach(async () => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ data: { id: 'msg_1' }, error: null });
    env = {};

    prisma = {
      emailSend: {
        findUnique: jest.fn().mockResolvedValue(QUEUED_RECORD),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({}),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0),
      },
      importBatch: {
        findUnique: jest.fn().mockResolvedValue({ id: 'bat_1', inviteState: 'SENDING' }),
        update: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
      emailSuppression: { upsert: jest.fn().mockResolvedValue({}) },
      commissionRate: { findFirst: jest.fn().mockResolvedValue({ percent: 20 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };

    service = await build();
  });

  // ── The safety default ────────────────────────────────────────────────────

  describe('send mode', () => {
    it('defaults to redirect when nothing is configured', async () => {
      // The property that stops an environment nobody configured from mailing
      // 136 real practitioners.
      expect(service.isLive).toBe(false);
    });

    it('sends to the redirect address, not the practitioner, in test mode', async () => {
      env.INVITE_EMAIL_REDIRECT_TO = 'qa@nityo.com';
      service = await build();

      await service.sendOne('snd_1');

      const payload = sendMock.mock.calls[0][0];
      expect(payload.to).toBe('qa@nityo.com');
      expect(payload.to).not.toBe('maya@example.com');
      // The real recipient is named in the subject so a test run is traceable.
      expect(payload.subject).toContain('maya@example.com');
      expect(payload.html).toContain('Test mode');
    });

    it('marks redirected sends so they cannot pollute deliverability stats', async () => {
      await service.sendOne('snd_1');
      expect(prisma.emailSend.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ redirected: true }) }),
      );
    });

    it('sends to the practitioner only when explicitly set live', async () => {
      env.INVITE_EMAIL_MODE = 'live';
      service = await build();

      await service.sendOne('snd_1');

      expect(sendMock.mock.calls[0][0].to).toBe('maya@example.com');
      expect(sendMock.mock.calls[0][0].subject).not.toContain('TEST');
    });
  });

  // ── Re-checking eligibility at send time ──────────────────────────────────

  describe('pre-send checks', () => {
    it.each([
      ['already claimed', { passwordHash: 'hashed' }],
      ['deactivated', { isActive: false }],
      ['opted out', { marketingEmails: false }],
    ])('refuses to send to an account that is %s', async (_label, patch) => {
      prisma.emailSend.findUnique.mockResolvedValue({
        ...QUEUED_RECORD,
        user: { ...QUEUED_RECORD.user, ...patch },
      });

      const result = await service.sendOne('snd_1');

      expect(result.status).toBe('SKIPPED');
      expect(sendMock).not.toHaveBeenCalled();
    });

    it('refuses when the wave was paused after queueing', async () => {
      prisma.emailSend.findUnique.mockResolvedValue({
        ...QUEUED_RECORD,
        batch: { ...QUEUED_RECORD.batch, inviteState: 'PAUSED' },
      });

      const result = await service.sendOne('snd_1');

      expect(result.status).toBe('SKIPPED');
      expect(sendMock).not.toHaveBeenCalled();
    });

    it('refuses a suppressed address even though it passed the queue-time check', async () => {
      // Days pass between queueing and sending; an unsubscribe in that window
      // must win.
      const suppressed = await Test.createTestingModule({
        providers: [
          InviteSenderService,
          { provide: PrismaService, useValue: prisma },
          { provide: ConfigService, useValue: { get: (k: string, d?: string) => env[k] ?? d } },
          {
            provide: PractitionerImportService,
            useValue: {
              hashEmail: (e: string) => `h:${e}`,
              isSuppressed: jest.fn().mockResolvedValue(true),
            },
          },
          {
            provide: PractitionerInvitesService,
            useValue: {
              issueClaimToken: jest.fn(),
              buildClaimUrl: () => '',
              buildUnsubscribeUrl: () => '',
            },
          },
        ],
      }).compile();

      const result = await suppressed.get(InviteSenderService).sendOne('snd_1');

      expect(result.status).toBe('SKIPPED');
      expect(sendMock).not.toHaveBeenCalled();
    });

    it('never sends the same invite twice', async () => {
      prisma.emailSend.findUnique.mockResolvedValue({ ...QUEUED_RECORD, status: 'SENT' });
      const result = await service.sendOne('snd_1');
      expect(result.reason).toBe('already processed');
      expect(sendMock).not.toHaveBeenCalled();
    });
  });

  // ── The message itself ────────────────────────────────────────────────────

  describe('message content', () => {
    it('carries the one-click unsubscribe headers mailbox providers look for', async () => {
      await service.sendOne('snd_1');
      const headers = sendMock.mock.calls[0][0].headers;
      expect(headers['List-Unsubscribe']).toMatch(/^<https:\/\/sc\.test\/unsubscribe/);
      expect(headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    });

    it('includes a plain-text part, the removal link and the postal address', async () => {
      await service.sendOne('snd_1');
      const payload = sendMock.mock.calls[0][0];
      expect(payload.text).toContain('unsubscribe?token=');
      expect(payload.html).toContain('Remove my information');
      // CAN-SPAM requires a physical address in every commercial email.
      expect(payload.html).toContain('Sunnyvale');
    });

    it('takes the commission figure from the live rate row, not a literal', async () => {
      prisma.commissionRate.findFirst.mockResolvedValue({ percent: 25 });
      await service.sendOne('snd_1');
      const payload = sendMock.mock.calls[0][0];
      expect(payload.html).toContain('25%');
      expect(payload.html).toContain('75%'); // what the guide keeps
    });

    it('sets a reply-to a human actually reads', async () => {
      await service.sendOne('snd_1');
      expect(sendMock.mock.calls[0][0].replyTo).toBe('hello@spiritualcalifornia.com');
    });
  });

  // ── Circuit breaker ───────────────────────────────────────────────────────

  describe('circuit breaker', () => {
    const sends = (statuses: string[]) => statuses.map((status) => ({ status }));

    it('pauses the wave when hard bounces exceed 5%', async () => {
      prisma.emailSend.findMany.mockResolvedValue(
        sends([...Array(18).fill('DELIVERED'), 'BOUNCED', 'BOUNCED']), // 10%
      );

      const result = await service.evaluateCircuitBreaker('bat_1');

      expect(result.paused).toBe(true);
      expect(prisma.importBatch.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ inviteState: 'PAUSED' }) }),
      );
    });

    it('pauses on a single spam complaint in a small window', async () => {
      // 0.1% is the limit; one complaint in 20 is 5%.
      prisma.emailSend.findMany.mockResolvedValue(
        sends([...Array(19).fill('DELIVERED'), 'COMPLAINED']),
      );
      await expect(service.evaluateCircuitBreaker('bat_1')).resolves.toMatchObject({ paused: true });
    });

    it('does not pause a healthy wave', async () => {
      prisma.emailSend.findMany.mockResolvedValue(sends(Array(30).fill('DELIVERED')));
      await expect(service.evaluateCircuitBreaker('bat_1')).resolves.toEqual({ paused: false });
      expect(prisma.importBatch.update).not.toHaveBeenCalled();
    });

    it('waits for a meaningful sample before judging', async () => {
      // One bounce out of three is 33%, but it is also nothing to conclude from.
      prisma.emailSend.findMany.mockResolvedValue(sends(['DELIVERED', 'DELIVERED', 'BOUNCED']));
      await expect(service.evaluateCircuitBreaker('bat_1')).resolves.toEqual({ paused: false });
    });
  });

  // ── Delivery webhooks ─────────────────────────────────────────────────────

  describe('applyDeliveryEvent', () => {
    beforeEach(() => {
      prisma.emailSend.findFirst.mockResolvedValue({
        id: 'snd_1',
        emailHash: 'h:maya@example.com',
        userId: 'usr_1',
        importBatchId: 'bat_1',
        openedAt: null,
      });
    });

    it('suppresses the address on a bounce', async () => {
      await service.applyDeliveryEvent({ type: 'email.bounced', messageId: 'msg_1' });

      expect(prisma.emailSuppression.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { emailHash: 'h:maya@example.com' },
          create: expect.objectContaining({ reason: 'BOUNCED' }),
        }),
      );
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { marketingEmails: false } }),
      );
    });

    it('suppresses on a spam complaint — a second email would be the real damage', async () => {
      await service.applyDeliveryEvent({ type: 'email.complained', messageId: 'msg_1' });
      expect(prisma.emailSuppression.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create: expect.objectContaining({ reason: 'COMPLAINED' }) }),
      );
    });

    it('records a delivery without suppressing anything', async () => {
      await service.applyDeliveryEvent({ type: 'email.delivered', messageId: 'msg_1' });
      expect(prisma.emailSuppression.upsert).not.toHaveBeenCalled();
    });

    it('ignores an event for a message we never sent', async () => {
      prisma.emailSend.findFirst.mockResolvedValue(null);
      await expect(
        service.applyDeliveryEvent({ type: 'email.bounced', messageId: 'unknown' }),
      ).resolves.toEqual({ applied: false });
      expect(prisma.emailSuppression.upsert).not.toHaveBeenCalled();
    });
  });

  // ── Throttling ────────────────────────────────────────────────────────────

  describe('throttling', () => {
    it('counts only real sends against the daily cap', async () => {
      env.INVITE_SEND_PER_DAY = '40';
      service = await build();
      prisma.emailSend.count.mockResolvedValue(12);

      await expect(service.remainingToday()).resolves.toBe(28);
      // Redirected test traffic is excluded from the count.
      expect(prisma.emailSend.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ redirected: false }) }),
      );
    });

    it('never returns a negative allowance', async () => {
      env.INVITE_SEND_PER_DAY = '10';
      service = await build();
      prisma.emailSend.count.mockResolvedValue(25);
      await expect(service.remainingToday()).resolves.toBe(0);
    });

    it('ignores the send window in test mode so a developer can press the button', () => {
      expect(service.isWithinSendWindow(new Date('2026-08-02T04:00:00Z'))).toBe(true); // Sunday
    });

    it('holds live mail outside weekday business hours', async () => {
      env.INVITE_EMAIL_MODE = 'live';
      service = await build();
      // Sunday 04:00 UTC = Saturday 21:00 Pacific.
      expect(service.isWithinSendWindow(new Date('2026-08-02T04:00:00Z'))).toBe(false);
      // Wednesday 18:00 UTC = 11:00 Pacific.
      expect(service.isWithinSendWindow(new Date('2026-08-05T18:00:00Z'))).toBe(true);
    });
  });
});
