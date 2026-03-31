import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CheckoutService } from './checkout.service';
import { ValidatePromoDto } from './dto/validate-promo.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Checkout')
@Controller('checkout')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Public()
  @Get('shipping-methods')
  @ApiOperation({ summary: 'List available shipping methods' })
  getShippingMethods() {
    return this.checkoutService.getShippingMethods();
  }

  @Public()
  @Get('tax-rates')
  @ApiOperation({ summary: 'List tax rates by state' })
  getTaxRates() {
    return this.checkoutService.getTaxRates();
  }

  @Public()
  @Post('validate-promo')
  @ApiOperation({ summary: 'Validate a promo code and calculate discount' })
  validatePromo(@Body() dto: ValidatePromoDto) {
    return this.checkoutService.validatePromoCode(dto.code, dto.subtotal);
  }

  @Post('summary')
  @ApiOperation({ summary: 'Calculate order summary (subtotal, tax, shipping, discount, total)' })
  calculateSummary(@Body() data: any) {
    return this.checkoutService.calculateOrderSummary(data);
  }
}
