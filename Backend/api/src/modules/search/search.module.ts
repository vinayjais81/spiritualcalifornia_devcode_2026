import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { AlgoliaService } from './algolia.service';
import { PostgresSearchService } from './postgres-search.service';

@Module({
  controllers: [SearchController],
  providers: [SearchService, AlgoliaService, PostgresSearchService],
  exports: [SearchService, AlgoliaService],
})
export class SearchModule {}
