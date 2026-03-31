import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Headers } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';

@ApiTags('Cart')
@Controller('cart')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get cart (authenticated user or guest via x-session-id header)' })
  getCart(@CurrentUser() user: CurrentUserData | null, @Headers('x-session-id') sessionId?: string) {
    return this.cartService.getCart(user?.id, sessionId);
  }

  @Public()
  @Post('items')
  @ApiOperation({ summary: 'Add item to cart' })
  addItem(
    @CurrentUser() user: CurrentUserData | null,
    @Headers('x-session-id') sessionId: string,
    @Body() dto: AddCartItemDto,
  ) {
    return this.cartService.addItem(dto, user?.id, sessionId);
  }

  @Public()
  @Put('items/:itemId')
  @ApiOperation({ summary: 'Update cart item quantity' })
  updateItem(
    @CurrentUser() user: CurrentUserData | null,
    @Headers('x-session-id') sessionId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateItem(itemId, dto, user?.id, sessionId);
  }

  @Public()
  @Delete('items/:itemId')
  @ApiOperation({ summary: 'Remove item from cart' })
  removeItem(
    @CurrentUser() user: CurrentUserData | null,
    @Headers('x-session-id') sessionId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.cartService.removeItem(itemId, user?.id, sessionId);
  }

  @Delete()
  @ApiOperation({ summary: 'Clear entire cart' })
  clearCart(@CurrentUser() user: CurrentUserData) {
    return this.cartService.clearCart(user.id);
  }

  @Post('merge')
  @ApiOperation({ summary: 'Merge guest cart into authenticated user cart (call after login)' })
  mergeGuestCart(
    @CurrentUser() user: CurrentUserData,
    @Headers('x-session-id') sessionId: string,
  ) {
    return this.cartService.mergeGuestCart(user.id, sessionId);
  }
}
