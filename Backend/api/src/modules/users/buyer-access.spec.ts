import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UsersService } from './users.service';
import { PrismaService } from '../../database/prisma.service';

// Cover for Phase 1 of docs/practitioners-as-buyers.md — granting a
// practitioner the buyer role and profile so they can purchase from others.
//
// The behaviour that matters here is not "does it create a row". It is that the
// grant is off by default, idempotent, and never replaces a SeekerProfile that
// already exists — that profile owns the account's entire purchase history via
// SeekerProfile.id, so creating a second one would orphan it.

describe('UsersService.ensureBuyerAccess', () => {
  let prisma: any;
  let tx: any;

  async function build(flag: string | undefined) {
    tx = {
      seekerProfile: { create: jest.fn().mockResolvedValue({ id: 'seek_new' }) },
      userRole: { upsert: jest.fn().mockResolvedValue({}) },
    };

    prisma = {
      userRole: { findUnique: jest.fn().mockResolvedValue(null) },
      seekerProfile: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(async (cb: any) => cb(tx)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: () => flag } },
      ],
    }).compile();

    return moduleRef.get(UsersService);
  }

  it('does nothing while the feature flag is off', async () => {
    const service = await build(undefined);
    await expect(service.ensureBuyerAccess('user_1')).resolves.toBe('disabled');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does nothing for any value other than the literal "true"', async () => {
    // Guards against a half-set env var ("1", "yes", "TRUE") silently
    // enabling the feature on an environment nobody meant to switch on.
    for (const value of ['1', 'yes', 'TRUE', 'on', '']) {
      const service = await build(value);
      await expect(service.ensureBuyerAccess('user_1')).resolves.toBe('disabled');
    }
  });

  it('creates the role and the profile for a practitioner who has neither', async () => {
    const service = await build('true');
    await expect(service.ensureBuyerAccess('user_1')).resolves.toBe('granted');
    expect(tx.seekerProfile.create).toHaveBeenCalledWith({ data: { userId: 'user_1' } });
    expect(tx.userRole.upsert).toHaveBeenCalled();
  });

  it('adopts an existing seeker profile instead of creating a second one', async () => {
    // An account can hold a SeekerProfile without the SEEKER role — the admin
    // role editor can strip a role without touching the profile. Creating a
    // fresh profile here would strand every booking, order and ticket that
    // points at the old one.
    const service = await build('true');
    prisma.seekerProfile.findUnique.mockResolvedValue({ id: 'seek_existing' });

    await expect(service.ensureBuyerAccess('user_1')).resolves.toBe('granted');
    expect(tx.seekerProfile.create).not.toHaveBeenCalled();
    expect(tx.userRole.upsert).toHaveBeenCalled();
  });

  it('is a no-op when the practitioner already has both', async () => {
    // Makes the backfill re-runnable, which is how it gets rolled out in
    // batches as more practitioners are verified.
    const service = await build('true');
    prisma.userRole.findUnique.mockResolvedValue({ userId: 'user_1' });
    prisma.seekerProfile.findUnique.mockResolvedValue({ id: 'seek_1' });

    await expect(service.ensureBuyerAccess('user_1')).resolves.toBe('already-had-it');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('backfills a missing profile for someone who somehow has only the role', async () => {
    // This half-state would 403 on every purchase: the checkout paths all
    // start with a SeekerProfile lookup, not a role check.
    const service = await build('true');
    prisma.userRole.findUnique.mockResolvedValue({ userId: 'user_1' });

    await expect(service.ensureBuyerAccess('user_1')).resolves.toBe('granted');
    expect(tx.seekerProfile.create).toHaveBeenCalled();
  });
});
