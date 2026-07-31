import { Test } from '@nestjs/testing';
import { createHash } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { PractitionerImportService } from '../practitioner-import/practitioner-import.service';
import { PractitionerInvitesService } from './practitioner-invites.service';

// Phase 2 of docs/practitioner-import-invite-strategy.md.
//
// Two properties are load-bearing and neither is obvious from the diff:
//   1. Describing a link must never change anything — mail scanners follow
//      every URL in an email, so a delete-on-GET would remove people who never
//      clicked.
//   2. The suppression tombstone must be written in the same transaction as the
//      deletion. Losing it would let the next import of the same spreadsheet
//      recreate the person and email them again.

describe('PractitionerInvitesService', () => {
  let service: PractitionerInvitesService;
  let prisma: any;
  let tx: any;

  const INVITED_USER = {
    id: 'usr_1',
    email: 'maya@example.com',
    firstName: 'Maya',
    lastName: 'Rosenberg',
    passwordHash: null,
    invitedAt: null,
    guideProfile: {
      id: 'gp_1',
      displayName: 'Maya Rosenberg',
      onboardingPath: 'PROACTIVE_INVITE',
      _count: {
        services: 0,
        events: 0,
        products: 0,
        soulTours: 0,
        blogPosts: 0,
        ledgerEntries: 0,
        payoutRequests: 0,
      },
    },
  };

  beforeEach(async () => {
    tx = {
      emailSuppression: { upsert: jest.fn().mockResolvedValue({}) },
      importedProspect: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      user: { delete: jest.fn().mockResolvedValue({}), update: jest.fn().mockResolvedValue({}) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };

    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(INVITED_USER),
        findFirst: jest.fn().mockResolvedValue(INVITED_USER),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(async (cb: any) => cb(tx)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PractitionerInvitesService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback?: string) =>
              key === 'EMAIL_HASH_SECRET'
                ? 'test-secret-value-at-least-32-chars-long'
                : key === 'FRONTEND_URL'
                  ? 'https://spiritualcalifornia.com'
                  : fallback,
          },
        },
        {
          provide: PractitionerImportService,
          // A real one-way hash, not `hash(${email})` — a mock that embeds the
          // address would silently pass the "never log the address" test below.
          useValue: {
            hashEmail: (e: string) => createHash('sha256').update(e).digest('hex'),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(PractitionerInvitesService);
  });

  // ── Token integrity ───────────────────────────────────────────────────────

  describe('unsubscribe tokens', () => {
    it('round-trips a token it issued', async () => {
      const token = service.buildUnsubscribeToken('usr_1');
      await expect(service.describeUnsubscribe(token)).resolves.toMatchObject({ valid: true });
    });

    it('rejects a token whose signature was tampered with', async () => {
      const token = service.buildUnsubscribeToken('usr_1');
      const [id, sig] = token.split('.');
      const forged = `${id}.${sig.slice(0, -1)}${sig.endsWith('a') ? 'b' : 'a'}`;

      await expect(service.describeUnsubscribe(forged)).resolves.toEqual({
        valid: false,
        reason: 'invalid',
      });
      await expect(service.unsubscribeAndDelete(forged)).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("rejects another user's id pasted onto a valid signature", async () => {
      const token = service.buildUnsubscribeToken('usr_1');
      const [, sig] = token.split('.');

      await expect(service.describeUnsubscribe(`usr_2.${sig}`)).resolves.toEqual({
        valid: false,
        reason: 'invalid',
      });
    });

    it('rejects a malformed token without throwing', async () => {
      await expect(service.describeUnsubscribe('nonsense')).resolves.toEqual({
        valid: false,
        reason: 'invalid',
      });
    });
  });

  // ── Describing must not mutate ────────────────────────────────────────────

  describe('describeUnsubscribe', () => {
    it('changes nothing — a mail scanner opening the link must be harmless', async () => {
      await service.describeUnsubscribe(service.buildUnsubscribeToken('usr_1'));

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(tx.user.delete).not.toHaveBeenCalled();
    });

    it('masks the address rather than echoing it back', async () => {
      const result: any = await service.describeUnsubscribe(service.buildUnsubscribeToken('usr_1'));
      expect(result.email).not.toContain('maya@');
      expect(result.email).toMatch(/^m\*+@example\.com$/);
    });

    it('reports an already-removed practitioner as success, not an error', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.describeUnsubscribe(service.buildUnsubscribeToken('usr_1')),
      ).resolves.toEqual({ valid: true, alreadyRemoved: true });
    });
  });

  // ── The deletion itself ───────────────────────────────────────────────────

  describe('unsubscribeAndDelete', () => {
    it('writes the suppression tombstone and deletes an untouched account', async () => {
      const result = await service.unsubscribeAndDelete(
        service.buildUnsubscribeToken('usr_1'),
        '203.0.113.9',
      );

      expect(result).toMatchObject({ removed: true, deactivatedInstead: false });
      expect(tx.emailSuppression.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { emailHash: createHash('sha256').update('maya@example.com').digest('hex') },
          create: expect.objectContaining({ reason: 'DELETED' }),
        }),
      );
      expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: 'usr_1' } });
    });

    it('scrubs the prospect row but keeps the fingerprint that blocks a re-import', async () => {
      await service.unsubscribeAndDelete(service.buildUnsubscribeToken('usr_1'));

      const [[call]] = tx.importedProspect.updateMany.mock.calls;
      expect(call.where).toEqual({ userId: 'usr_1' });
      expect(call.data).toMatchObject({ email: null, city: null, status: 'EXCLUDED' });
      // The fingerprint is what lets a future import of the same list skip this
      // person even when the file has no email for them.
      expect(call.data).not.toHaveProperty('fingerprint');
    });

    it('never writes the deleted address into the audit log', async () => {
      await service.unsubscribeAndDelete(service.buildUnsubscribeToken('usr_1'));

      const audit = tx.auditLog.create.mock.calls[0][0].data;
      expect(JSON.stringify(audit)).not.toContain('maya@example.com');
      expect(audit.newValue.emailHash).toBe(createHash('sha256').update('maya@example.com').digest('hex'));
    });

    it('deactivates instead of deleting when the account has activity', async () => {
      // Services, events and ledger entries do not cascade — a hard delete here
      // would fail on a foreign key halfway through the removal.
      prisma.user.findUnique.mockResolvedValue({
        ...INVITED_USER,
        guideProfile: {
          ...INVITED_USER.guideProfile,
          _count: { ...INVITED_USER.guideProfile._count, services: 2 },
        },
      });

      const result = await service.unsubscribeAndDelete(service.buildUnsubscribeToken('usr_1'));

      expect(result).toMatchObject({ deactivatedInstead: true });
      expect(tx.user.delete).not.toHaveBeenCalled();
      expect(tx.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: false, marketingEmails: false }),
        }),
      );
      // Suppression still happens — that is the part they actually asked for.
      expect(tx.emailSuppression.upsert).toHaveBeenCalled();
    });

    it('is idempotent for an account that is already gone', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.unsubscribeAndDelete(service.buildUnsubscribeToken('usr_1')),
      ).resolves.toEqual({ removed: true, alreadyRemoved: true });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ── Claim tokens ──────────────────────────────────────────────────────────

  describe('issueClaimToken', () => {
    it('mints a 30-day token and stamps invitedAt', async () => {
      const before = Date.now();
      const { token, expiresAt } = await service.issueClaimToken('usr_1');

      expect(token).toHaveLength(64);
      const days = (expiresAt.getTime() - before) / (24 * 60 * 60 * 1000);
      expect(days).toBeGreaterThan(29.9);
      expect(days).toBeLessThan(30.1);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ emailVerifyToken: token }),
        }),
      );
    });

    it('refuses an account that was not created by an import', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...INVITED_USER,
        guideProfile: { ...INVITED_USER.guideProfile, onboardingPath: 'SELF_REGISTRATION' },
      });
      await expect(service.issueClaimToken('usr_1')).rejects.toThrow(BadRequestException);
    });

    it('refuses an account that has already been claimed', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...INVITED_USER, passwordHash: 'hashed' });
      await expect(service.issueClaimToken('usr_1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('describeClaimToken', () => {
    it('reports expiry without revealing whether the account exists to a stranger', async () => {
      prisma.user.findFirst.mockResolvedValue({
        ...INVITED_USER,
        emailVerifyExpiry: new Date(Date.now() - 1000),
      });
      const result: any = await service.describeClaimToken('tok');
      expect(result).toMatchObject({ valid: false, reason: 'expired' });
      // An expired invite still tells them who to ask — they have no other contact.
      expect(result.supportEmail).toBeTruthy();
    });

    it('returns a bare "unknown" for a token that matches nothing', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.describeClaimToken('tok')).resolves.toEqual({
        valid: false,
        reason: 'unknown',
      });
    });
  });

  describe('buildUnsubscribeUrl', () => {
    it('points at the route the token is validated on', () => {
      const url = service.buildUnsubscribeUrl('usr_1');
      expect(url).toMatch(/^https:\/\/spiritualcalifornia\.com\/unsubscribe\?token=usr_1\./);
    });
  });
});
