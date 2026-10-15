import { Controller, Post, Body } from '@nestjs/common';

import { HousingViewService } from './housing-view.service';

import { CreateHousingViewDto } from './dto/create-housing-view.dto';
import { CurrentUser } from 'src/auth/decorators/get-current-user.decorator';
import { User } from 'src/auth/entities/user.entity';

@Controller('housing-views')
export class HousingViewController {
  constructor(private readonly housingViewService: HousingViewService) {}

  @Post()
  create(@Body() dto: CreateHousingViewDto, @CurrentUser() user: User) {
    return this.housingViewService.recordView(dto.housingId, user.id);
  }
}
