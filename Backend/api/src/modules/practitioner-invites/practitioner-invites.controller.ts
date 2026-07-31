import { Body, Controller, Get, Ip, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';
import { PractitionerInvitesService } from './practitioner-invites.service';
import { InviteSenderService } from './invite-sender.service';
import { IssueClaimTokenDto, PauseWaveDto, QueueWaveDto } from './dto/practitioner-invites.dto';

@ApiTags('Practitioner Invites')
@Controller('invites')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PractitionerInvitesController {
  constructor(
    private readonly service: PractitionerInvitesService,
    private readonly sender: InviteSenderService,
  ) {}

  // ─── Public: the two links that appear in an invite email ─────────────────

  @Public()
  @Get('claim/:token')
  @ApiOperation({ summary: 'Describe a claim link without consuming it' })
  describeClaim(@Param('token') token: string) {
    return this.service.describeClaimToken(token);
  }

  /**
   * Read-only by design. Mail scanners follow every link in an email, so the
   * removal itself lives on the POST below.
   */
  @Public()
  @Get('unsubscribe/:token')
  @ApiOperation({ summary: 'Describe an unsubscribe link. Changes nothing.' })
  describeUnsubscribe(@Param('token') token: string) {
    return this.service.describeUnsubscribe(token);
  }

  @Public()
  @Post('unsubscribe/:token')
  @ApiOperation({
    summary: "Remove the practitioner's information and suppress the address permanently",
  })
  unsubscribe(@Param('token') token: string, @Ip() ip: string) {
    return this.service.unsubscribeAndDelete(token, ip);
  }

  // ─── Admin ────────────────────────────────────────────────────────────────

  @Post('claim-token')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mint a 30-day claim link for an invited guide' })
  async issueClaimToken(
    @CurrentUser() _user: CurrentUserData,
    @Body() dto: IssueClaimTokenDto,
  ) {
    const { token, expiresAt } = await this.service.issueClaimToken(dto.userId);
    return {
      claimUrl: this.service.buildClaimUrl(token),
      unsubscribeUrl: this.service.buildUnsubscribeUrl(dto.userId),
      expiresAt,
    };
  }

  // ─── Admin: sending a wave ────────────────────────────────────────────────

  @Get('batches/:batchId/stats')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send state, per-status counts, cap and window for a wave' })
  stats(@Param('batchId') batchId: string) {
    return this.sender.batchSendStats(batchId);
  }

  @Post('batches/:batchId/queue')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Queue a wave. Sends nothing itself — the worker drains it inside the daily cap and send window.',
  })
  queueWave(
    @CurrentUser() user: CurrentUserData,
    @Param('batchId') batchId: string,
    @Body() dto: QueueWaveDto,
  ) {
    return this.sender.queueBatch(user.id, batchId, dto.segment ?? 'personal');
  }

  @Post('batches/:batchId/pause')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Stop a wave mid-flight' })
  async pause(
    @CurrentUser() user: CurrentUserData,
    @Param('batchId') batchId: string,
    @Body() dto: PauseWaveDto,
  ) {
    await this.sender.pause(batchId, dto.reason?.trim() || 'Paused by an admin', user.id);
    return { paused: true };
  }

  @Post('batches/:batchId/resume')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resume a paused wave' })
  resume(@CurrentUser() user: CurrentUserData, @Param('batchId') batchId: string) {
    return this.sender.resume(batchId, user.id);
  }
}
