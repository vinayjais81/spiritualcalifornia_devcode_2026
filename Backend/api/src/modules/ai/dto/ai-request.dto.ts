import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsIn,
  MaxLength,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Bodies for the `/ai/*` endpoints.
 *
 * These were inline `@Body() body: { message: string }` type literals, which
 * Nest's ValidationPipe skips entirely (it only validates class metatypes).
 * That matters more here than anywhere else in the API: all three routes are
 * `@Public()` and every request bills a Claude call, so an unbounded `message`
 * or a 10,000-entry `history` was an uncapped spend and context-window vector
 * from unauthenticated callers. `@AIThrottle()` capped the request *rate*, not
 * the size of each request.
 *
 * See docs/inline-body-validation-sweep.md.
 */

export class ChatMessageDto {
  @ApiProperty({ enum: ['user', 'assistant'] })
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @ApiProperty({ maxLength: 4000 })
  @IsString()
  @MaxLength(4000, { message: 'Each history message must be 4000 characters or fewer.' })
  content!: string;
}

export class ChatDto {
  @ApiProperty({ maxLength: 2000, example: 'How do I start a meditation practice?' })
  @IsString()
  @IsNotEmpty({ message: 'Message cannot be empty.' })
  @MaxLength(2000, { message: 'Message must be 2000 characters or fewer.' })
  message!: string;

  @ApiPropertyOptional({ type: [ChatMessageDto], description: 'Prior turns, most recent last. Max 20.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20, { message: 'Conversation history is limited to 20 messages.' })
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  history?: ChatMessageDto[];
}

export class AiQueryDto {
  @ApiProperty({ maxLength: 500, example: 'something calming for sleep' })
  @IsString()
  @IsNotEmpty({ message: 'Query cannot be empty.' })
  @MaxLength(500, { message: 'Query must be 500 characters or fewer.' })
  query!: string;
}
