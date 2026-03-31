import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { HomeService } from './home.service';

@ApiTags('Home')
@Controller('home')
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get aggregated home page data (guides, blogs, products, events)' })
  @ApiResponse({ status: 200, description: 'Home page data' })
  getHomePageData() {
    return this.homeService.getHomePageData();
  }
}
