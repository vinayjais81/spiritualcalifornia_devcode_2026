import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class SeekersService {
  constructor(private readonly prisma: PrismaService) {}

  async getOnboardingStatus(userId: string) {
    const profile = await this.prisma.seekerProfile.findUnique({ where: { userId } });
    if (!profile) return { step: 1, completed: false };
    return { step: profile.onboardingStep, completed: profile.onboardingCompleted };
  }

  async updateOnboardingStep(userId: string, step: number, completed = false) {
    const profile = await this.prisma.seekerProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Seeker profile not found');
    return this.prisma.seekerProfile.update({
      where: { userId },
      data: { onboardingStep: step, ...(completed ? { onboardingCompleted: true } : {}) },
    });
  }
}
