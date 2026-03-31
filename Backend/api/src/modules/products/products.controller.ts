import { Controller, Post, Get, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('Products')
@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles(Role.GUIDE)
  @ApiOperation({ summary: 'Create a draft product' })
  create(@CurrentUser() user: CurrentUserData, @Body() dto: CreateProductDto) {
    return this.productsService.create(user.id, dto);
  }

  @Get('mine')
  @Roles(Role.GUIDE)
  @ApiOperation({ summary: "List the authenticated guide's products" })
  findMine(@CurrentUser() user: CurrentUserData) {
    return this.productsService.findByGuide(user.id);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a single product by ID (public)' })
  @ApiResponse({ status: 200, description: 'Product details' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Put(':id')
  @Roles(Role.GUIDE)
  @ApiOperation({ summary: 'Update a product' })
  update(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @Roles(Role.GUIDE)
  @ApiOperation({ summary: 'Delete a product' })
  remove(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.productsService.delete(user.id, id);
  }
}
