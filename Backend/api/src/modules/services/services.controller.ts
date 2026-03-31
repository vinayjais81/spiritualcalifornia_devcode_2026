import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@ApiTags('Services')
@Controller('services')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  // ─── Create Service (Guide only) ───────────────────────────────────────────

  @Post()
  @Roles(Role.GUIDE)
  @ApiOperation({ summary: 'Create a new service offering' })
  @ApiResponse({ status: 201, description: 'Service created' })
  create(@CurrentUser() user: CurrentUserData, @Body() dto: CreateServiceDto) {
    return this.servicesService.create(user.id, dto);
  }

  // ─── List My Services (Guide Dashboard) ────────────────────────────────────

  @Get('mine')
  @Roles(Role.GUIDE)
  @ApiOperation({ summary: "List authenticated guide's services" })
  findMine(@CurrentUser() user: CurrentUserData) {
    return this.servicesService.findByGuide(user.id);
  }

  // ─── Get Single Service (Public) ───────────────────────────────────────────

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a single service by ID (public)' })
  @ApiResponse({ status: 200, description: 'Service details' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  findOne(@Param('id') id: string) {
    return this.servicesService.findOne(id);
  }

  // ─── Update Service (Guide only) ───────────────────────────────────────────

  @Put(':id')
  @Roles(Role.GUIDE)
  @ApiOperation({ summary: 'Update a service offering' })
  update(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.servicesService.update(user.id, id, dto);
  }

  // ─── Delete Service (Guide only) ───────────────────────────────────────────

  @Delete(':id')
  @Roles(Role.GUIDE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a service offering' })
  delete(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.servicesService.delete(user.id, id);
  }
}
