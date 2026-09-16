import { Controller, Get, Query, Param } from '@nestjs/common';
import { CampusService } from './campus.service';

import type IQuery from 'interfaces/query.Interface';

@Controller('campuses')
export class CampusController {
  constructor(private readonly campusService: CampusService) {}

  @Get()
  findAll(@Query() query: Partial<IQuery>) {
    if (query.search) {
      query.search = `name,${query.search}-abbreviation,${query.search}`;
    }

    return this.campusService.findAllCampuses(query);
  }

  @Get(':id')
  findOneById(@Param('id') id: string, @Query() query: Partial<IQuery>) {
    return this.campusService.findCampusById(id, query);
  }
}
