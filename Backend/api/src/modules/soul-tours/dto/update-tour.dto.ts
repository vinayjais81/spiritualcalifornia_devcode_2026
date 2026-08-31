import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateTourDto, CreateRoomTypeDto } from './create-tour.dto';

/**
 * A room type on the way IN to an update.
 *
 * Identical to CreateRoomTypeDto but carries the row's `id`, which is what
 * makes an edit an edit: with it the server updates the existing row and keeps
 * its live `available` count; without it the row is new.
 *
 * The id has to be declared. The global ValidationPipe runs with
 * `forbidNonWhitelisted`, so an `id` the DTO does not know about does not get
 * quietly dropped — it rejects the whole request.
 */
export class UpdateRoomTypeDto extends CreateRoomTypeDto {
  @ApiPropertyOptional({ description: 'Existing room-type id. Omit to create a new one.' })
  @IsOptional()
  @IsString()
  id?: string;
}

export class UpdateTourDto extends PartialType(CreateTourDto) {
  /**
   * Redeclared so the items validate as UpdateRoomTypeDto (which permits `id`)
   * rather than the inherited CreateRoomTypeDto.
   *
   * Until 2026-08-31 the service destructured `roomTypes` off the body and
   * never applied it, so a guide could edit a room price, get a 200 back with
   * the OLD prices included in the response, and find the change gone on
   * reload. The frontend had independently stopped sending them on edit,
   * deferring to "dedicated sub-endpoints" that exist for departures and
   * itinerary but were never built for room types. Both halves are fixed;
   * see SoulToursService.syncRoomTypes.
   */
  @ApiPropertyOptional({ type: [UpdateRoomTypeDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateRoomTypeDto)
  roomTypes?: UpdateRoomTypeDto[];
}
