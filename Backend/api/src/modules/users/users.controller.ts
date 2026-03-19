import { Controller, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';

class UpdateSeekerProfileDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  bio?: string;
}

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('seeker/profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update seeker profile (interests, location, bio)' })
  updateSeekerProfile(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: UpdateSeekerProfileDto,
  ) {
    return this.usersService.updateSeekerProfile(user.id, dto);
  }
}
