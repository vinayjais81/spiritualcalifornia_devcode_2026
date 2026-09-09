import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { AdminService } from './admin.service';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LedgerService } from '../payments/ledger.service';
import { VerificationService } from '../verification/verification.service';
import { UploadService } from '../upload/upload.service';
import { EmailService } from '../notifications/email.service';
import { CacheService } from '../../database/cache.service';
import { SearchService } from '../search/search.service';

// Cover for PATCH /admin/users/:id/roles.
//
// This endpoint applied whatever it was handed, with no validation whatsoever.
// That is how production can hold accounts in states no application flow can
// produce — and, worse, how any ADMIN could grant SUPER_ADMIN to an account
// they control. The adjacent setUserPassword has always had that rail; this
// never did.
//
// See docs/practitioners-as-buyers.md (Phase 3).

describe('AdminService.setUserRoles', () => {
  let service: AdminService;
  let prisma: any;
  let tx: any;

  const ADMIN: { id: string; roles: Role[]; email: string } =
    { id: 'actor_admin', roles: [Role.ADMIN], email: 'admin@sc.test' };
  const SUPER: { id: string; roles: Role[]; email: string } =
    { id: 'actor_super', roles: [Role.SUPER_ADMIN], email: 'super@sc.test' };

  /** Target user as loaded by setUserRoles. */
  const target = (over: Partial<Record<string, any>> = {}) => ({
    id: 'user_1',
    email: 'target@sc.test',
    roles: [{ role: Role.SEEKER }],
    seekerProfile: { id: 'seek_1' },
    guideProfile: null,
    ...over,
  });

  beforeEach(async () => {
    tx = {
      seekerProfile: { create: jest.fn().mockResolvedValue({ id: 'seek_new' }) },
      userRole: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };

    prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(target()) },
      $transaction: jest.fn(async (cb: any) => cb(tx)),
    };

    const stub = {} as any;
    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: stub },
        { provide: ConfigService, useValue: { get: () => undefined } },
        { provide: LedgerService, useValue: stub },
        { provide: VerificationService, useValue: stub },
        { provide: UploadService, useValue: stub },
        { provide: EmailService, useValue: stub },
        { provide: CacheService, useValue: stub },
        { provide: SearchService, useValue: stub },
      ],
    }).compile();

    service = moduleRef.get(AdminService);
  });

  const call = (roles: Role[], actor = ADMIN, targetUserId = 'user_1') =>
    service.setUserRoles({ targetUserId, roles, actor });

  // ── Privilege escalation ───────────────────────────────────────────────────

  it('refuses to let a plain admin grant a staff role', () => {
    return expect(call([Role.SEEKER, Role.SUPER_ADMIN])).rejects.toThrow(ForbiddenException);
  });

  it('refuses to let a plain admin revoke a staff role', async () => {
    prisma.user.findUnique.mockResolvedValue(
      target({ roles: [{ role: Role.ADMIN }, { role: Role.SEEKER }] }),
    );
    await expect(call([Role.SEEKER])).rejects.toThrow(ForbiddenException);
  });

  it('lets a super admin grant a staff role', async () => {
    await expect(call([Role.SEEKER, Role.ADMIN], SUPER)).resolves.toBeDefined();
    expect(tx.userRole.createMany).toHaveBeenCalled();
  });

  it('lets a plain admin edit marketplace roles on an account that already holds staff', async () => {
    // The gate is on the difference, not the resulting set — otherwise an
    // admin could never touch a colleague's seeker role at all.
    prisma.user.findUnique.mockResolvedValue(
      target({ roles: [{ role: Role.ADMIN }], seekerProfile: null }),
    );
    await expect(call([Role.ADMIN, Role.SEEKER])).resolves.toBeDefined();
  });

  it('refuses to let anyone edit their own roles', () => {
    return expect(call([Role.SEEKER], ADMIN, ADMIN.id)).rejects.toThrow(BadRequestException);
  });

  // ── Roles must have a profile behind them ─────────────────────────────────

  it('refuses the practitioner role when there is no practitioner profile', () => {
    // A GUIDE role with no GuideProfile breaks every practitioner screen.
    return expect(call([Role.GUIDE])).rejects.toThrow(/practitioner onboarding/i);
  });

  it('creates the missing buyer profile when granting the seeker role', async () => {
    // A SEEKER role with no SeekerProfile 403s on every purchase: the checkout
    // paths start from a profile lookup, not a role check.
    prisma.user.findUnique.mockResolvedValue(target({ roles: [], seekerProfile: null }));
    await call([Role.SEEKER]);
    expect(tx.seekerProfile.create).toHaveBeenCalledWith({ data: { userId: 'user_1' } });
  });

  it('does not create a second buyer profile when one exists', async () => {
    await call([Role.SEEKER]);
    expect(tx.seekerProfile.create).not.toHaveBeenCalled();
  });

  it('allows practitioner + seeker together', async () => {
    // The dual-role shape this whole change exists to produce.
    prisma.user.findUnique.mockResolvedValue(
      target({ roles: [{ role: Role.GUIDE }], guideProfile: { id: 'g1', isPublished: false } }),
    );
    await expect(call([Role.GUIDE, Role.SEEKER])).resolves.toBeDefined();
  });

  // ── Other footguns ────────────────────────────────────────────────────────

  it('refuses to strip the practitioner role while the profile is still published', async () => {
    // Public visibility keys off isVerified/isPublished/isActive, not the role
    // — so this would leave a live listing its owner cannot manage.
    prisma.user.findUnique.mockResolvedValue(
      target({ roles: [{ role: Role.GUIDE }], guideProfile: { id: 'g1', isPublished: true } }),
    );
    await expect(call([Role.SEEKER])).rejects.toThrow(/unpublish/i);
  });

  it('refuses an empty role set', () => {
    return expect(call([])).rejects.toThrow(BadRequestException);
  });

  it('deduplicates repeated roles', async () => {
    // createMany would otherwise trip the (userId, role) unique constraint.
    await call([Role.SEEKER, Role.SEEKER]);
    expect(tx.userRole.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'user_1', role: Role.SEEKER }],
    });
  });

  it('records the change in the audit log', async () => {
    await call([Role.SEEKER], SUPER);
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'admin.user.roles',
          entityId: 'user_1',
          userId: SUPER.id,
        }),
      }),
    );
  });
});
