import {
  Get,
  Body,
  Post,
  Param,
  Patch,
  Query,
  Delete,
  UseGuards,
  UsePipes,
  Controller,
  ValidationPipe,
} from '@nestjs/common';

import type IQuery from 'interfaces/query.Interface';
import { HousingService } from './housing.service';

import { CreateHousingDto } from './dto/create-housing.dto';
import { UpdateHousingDto } from './dto/update-housing.dto';
import { ValidCampusLocationGuard } from './guards/valid-campus-location.guard';

@Controller('housings')
export class HousingController {
  constructor(private readonly housingService: HousingService) {}

  @Post()
  @UseGuards(ValidCampusLocationGuard)
  @UsePipes(ValidationPipe)
  create(@Body() createHousingDto: CreateHousingDto) {
    return this.housingService.create(createHousingDto);
  }

  @Get()
  findAll(@Query() query: Partial<IQuery>) {
    query.relations = 'images';

    if (query.search) query.search = `title,${query.search}`;

    return this.housingService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query() query: Partial<IQuery>) {
    query.relations = 'images';

    return this.housingService.findOne(id, query);
  }

  @Patch(':id')
  @UsePipes(ValidationPipe)
  update(@Param('id') id: string, @Body() updateHousingDto: UpdateHousingDto) {
    return this.housingService.update(id, updateHousingDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.housingService.remove(id);
  }
}
