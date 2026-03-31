import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('Orders')
@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Roles(Role.SEEKER)
  @ApiOperation({ summary: 'Create an order with payment intent' })
  create(@CurrentUser() user: CurrentUserData, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(user.id, dto);
  }

  @Get('mine')
  @Roles(Role.SEEKER)
  @ApiOperation({ summary: "List seeker's orders" })
  findMine(@CurrentUser() user: CurrentUserData) {
    return this.ordersService.findMyOrders(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order details' })
  findOne(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.ordersService.findOne(user.id, id);
  }
}
