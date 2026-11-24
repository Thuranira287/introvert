import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Public()
  @Get()
  search(@Query('q') query: string, @Query('limit') limit?: number) {
    return this.searchService.searchAll(query, limit ? Number(limit) : 5);
  }
}
