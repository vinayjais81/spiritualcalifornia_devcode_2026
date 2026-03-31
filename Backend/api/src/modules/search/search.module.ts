import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { AlgoliaService } from './algolia.service';

@Module({
  controllers: [SearchController],
  providers: [SearchService, AlgoliaService],
  exports: [SearchService, AlgoliaService],
})
export class SearchModule {}
