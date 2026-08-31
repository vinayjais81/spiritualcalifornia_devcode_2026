import { Controller, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  CurrentUserData,
} from '../auth/decorators/current-user.decorator';
import { UpdateSeekerBasicsDto } from './dto/update-seeker-basics.dto';

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
    // The DTO used to be declared in this file with no length caps, which left
    // bio/location/interests unbounded on the registration path long after
    // PATCH /seekers/me was fixed. See UpdateSeekerBasicsDto.
    @Body() dto: UpdateSeekerBasicsDto,
  ) {
    return this.usersService.updateSeekerProfile(user.id, dto);
  }
}
