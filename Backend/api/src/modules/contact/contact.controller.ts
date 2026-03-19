import { Controller, Post, Get, Patch, Body, Param, Query, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ContactService } from './contact.service';

class SubmitContactDto {
  @IsString() @IsNotEmpty() @MaxLength(100) name: string;
  @IsEmail() email: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsString() @IsNotEmpty() type: string;
  @IsString() @IsNotEmpty() @MinLength(3) @MaxLength(150) subject: string;
  @IsString() @IsNotEmpty() @MinLength(10) @MaxLength(2000) message: string;
}

@ApiTags('Contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  // ─── Public: submit contact form ────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit a contact / lead form' })
  @ApiResponse({ status: 200, description: 'Lead saved and emails dispatched' })
  submit(@Body() dto: SubmitContactDto) {
    return this.contactService.submitLead(dto);
  }

  // ─── Admin: list leads ──────────────────────────────────────────────────────

  @Get('leads')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin — list contact leads with filters + pagination' })
  getLeads(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.contactService.getLeads({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      status,
      type,
    });
  }

  // ─── Admin: update lead status ──────────────────────────────────────────────

  @Patch('leads/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin — update contact lead status' })
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.contactService.updateLeadStatus(id, body.status);
  }
}
