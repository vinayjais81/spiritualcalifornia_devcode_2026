import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayMaxSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateItineraryDayDto } from './create-tour.dto';

/**
 * Body for `POST /soul-tours/:id/itinerary` (full overwrite).
 *
 * The route was declared `@Body() body: { days: CreateItineraryDayDto[] }`.
 * That reads as validated — it names a decorated DTO — but the *parameter*
 * metatype is a plain object literal, so ValidationPipe skipped the whole
 * body and CreateItineraryDayDto's decorators never ran. Nested validation
 * only happens when the top-level body is itself a class with @ValidateNested.
 */
export class ReplaceItineraryDto {
  @ApiProperty({ type: [CreateItineraryDayDto], description: 'Full replacement itinerary, ordered by dayNumber.' })
  @IsArray()
  @ArrayMaxSize(365, { message: 'An itinerary cannot exceed 365 days.' })
  @ValidateNested({ each: true })
  @Type(() => CreateItineraryDayDto)
  days!: CreateItineraryDayDto[];
}
