import { Injectable } from '@nestjs/common';

import { CreateHousingViewDto } from './dto/create-housing-view.dto';

import { HousingView } from './entities/housing-view.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

import * as factory from 'utils/handlerFactory';

@Injectable()
export class HousingViewService {
  constructor(
    @InjectRepository(HousingView)
    private readonly housingViewRepo: Repository<HousingView>,
  ) {}

  async create(dto: CreateHousingViewDto) {
    const data = await factory.createOne(this.housingViewRepo, dto);

    const view = data.data as HousingView;

    const { housingId } = view;

    const viewCount = await this.housingViewRepo.count({
      where: { housingId },
    });

    return viewCount;
  }
}
