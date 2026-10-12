import { Controller, Post, Body } from '@nestjs/common';

import { HousingViewService } from './housing-view.service';

import { CreateHousingViewDto } from './dto/create-housing-view.dto';

@Controller('product-view')
export class HousingViewController {
  constructor(private readonly housingViewService: HousingViewService) {}

  @Post()
  create(@Body() createHousingViewDto: CreateHousingViewDto) {
    return this.housingViewService.create(createHousingViewDto);
  }
}
