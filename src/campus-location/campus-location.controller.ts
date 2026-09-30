import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type IQuery from 'interfaces/query.Interface';
import { CampusLocationService } from './campus-location.service';
import { CreateCampusLocationDto } from './dto/create-campus-location.dto';
import { UpdateCampusLocationDto } from './dto/update-campus-location.dto';

@Controller('campus-locations')
export class CampusLocationController {
  constructor(private readonly campusLocationService: CampusLocationService) {}

  @Post()
  @UsePipes(ValidationPipe)
  create(@Body() createCampusLocationDto: CreateCampusLocationDto) {
    return this.campusLocationService.create(createCampusLocationDto);
  }

  @Get()
  findAll(@Query() query: Partial<IQuery>) {
    if (query.search) query.search = `name,${query.search}`;

    return this.campusLocationService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query() query: Partial<IQuery>) {
    return this.campusLocationService.findOne(id, query);
  }

  @Patch(':id')
  @UsePipes(ValidationPipe)
  update(
    @Param('id') id: string,
    @Body() updateCampusLocationDto: UpdateCampusLocationDto,
  ) {
    return this.campusLocationService.update(id, updateCampusLocationDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.campusLocationService.remove(id);
  }
}
