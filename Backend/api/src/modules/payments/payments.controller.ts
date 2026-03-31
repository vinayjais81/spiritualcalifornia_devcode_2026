import { Controller, Get, Post, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Payments')
@Controller('payments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get payment details' })
  findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(id);
  }

  @Post(':id/refund')
  @ApiOperation({ summary: 'Refund a payment (full or partial)' })
  refund(@Param('id') id: string, @Body('amount') amount?: number) {
    return this.paymentsService.refund(id, amount);
  }

  @Public()
  @Post('webhook/stripe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook endpoint' })
  handleWebhook(@Body() payload: any) {
    return this.paymentsService.handleStripeWebhook(payload);
  }
}
