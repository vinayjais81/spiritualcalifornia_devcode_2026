import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';
import { SeekersService } from './seekers.service';

@ApiTags('Seekers')
@Controller('seekers')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SeekersController {
  constructor(private readonly seekersService: SeekersService) {}

  @Get('onboarding/status')
  @ApiOperation({ summary: 'Get seeker onboarding completion status' })
  getStatus(@CurrentUser() user: CurrentUserData) {
    return this.seekersService.getOnboardingStatus(user.id);
  }

  @Patch('onboarding/step')
  @ApiOperation({ summary: 'Save seeker onboarding progress' })
  updateStep(
    @CurrentUser() user: CurrentUserData,
    @Body() body: { step: number; completed?: boolean },
  ) {
    return this.seekersService.updateOnboardingStep(user.id, body.step, body.completed ?? false);
  }
}
