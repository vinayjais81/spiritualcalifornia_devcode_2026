import { Controller, Post, Get, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';

@ApiTags('Products')
@Controller('products')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a draft product (published when guide goes live)' })
  create(@CurrentUser() user: CurrentUserData, @Body() dto: CreateProductDto) {
    return this.productsService.create(user.id, dto);
  }

  @Get('mine')
  @ApiOperation({ summary: "List the authenticated guide's products" })
  findMine(@CurrentUser() user: CurrentUserData) {
    return this.productsService.findByGuide(user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a product owned by the authenticated guide' })
  remove(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.productsService.delete(user.id, id);
  }
}
