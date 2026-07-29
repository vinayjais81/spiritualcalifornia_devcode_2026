import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { AIThrottle } from '../../common/throttle.decorator';
import { ChatDto, AiQueryDto } from './dto/ai-request.dto';

@ApiTags('AI')
@Controller('ai')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@AIThrottle()
export class AiController {
  constructor(private readonly aiService: AiService) {}

  // All three routes are @Public() and bill a Claude call per request, so the
  // bodies must be DTO classes — an inline type literal is invisible to the
  // global ValidationPipe and leaves message/query/history unbounded.
  // See ai/dto/ai-request.dto.ts.

  @Public()
  @Post('chat')
  @ApiOperation({ summary: 'Chat with the AI Spiritual Guide' })
  chat(@Body() body: ChatDto) {
    return this.aiService.chat(body.message, body.history ?? []);
  }

  @Public()
  @Post('product-finder')
  @ApiOperation({ summary: 'AI-powered product recommendations' })
  productFinder(@Body() body: AiQueryDto) {
    return this.aiService.productFinder(body.query);
  }

  @Public()
  @Post('practitioner-match')
  @ApiOperation({ summary: 'AI-powered practitioner matching' })
  practitionerMatch(@Body() body: AiQueryDto) {
    return this.aiService.practitionerMatcher(body.query);
  }
}
