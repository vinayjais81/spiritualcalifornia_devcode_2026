import { Controller } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Bookings')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}
}
