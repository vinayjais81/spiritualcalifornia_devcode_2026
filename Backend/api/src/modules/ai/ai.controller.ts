import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { AIThrottle } from '../../common/throttle.decorator';

@ApiTags('AI')
@Controller('ai')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@AIThrottle()
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Public()
  @Post('chat')
  @ApiOperation({ summary: 'Chat with the AI Spiritual Guide' })
  chat(@Body() body: { message: string; history?: Array<{ role: 'user' | 'assistant'; content: string }> }) {
    return this.aiService.chat(body.message, body.history ?? []);
  }

  @Public()
  @Post('product-finder')
  @ApiOperation({ summary: 'AI-powered product recommendations' })
  productFinder(@Body() body: { query: string }) {
    return this.aiService.productFinder(body.query);
  }

  @Public()
  @Post('practitioner-match')
  @ApiOperation({ summary: 'AI-powered practitioner matching' })
  practitionerMatch(@Body() body: { query: string }) {
    return this.aiService.practitionerMatcher(body.query);
  }
}
