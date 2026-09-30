import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HousingController } from './housing.controller';
import { HousingService } from './housing.service';
import { Housing } from './entities/housing.entity';
import { HousingImage } from './entities/housing-image.entity';
import { CampusLocation } from 'src/campus-location/entities/campus-location.entity';

describe('HousingController', () => {
  let controller: HousingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HousingController],
      providers: [
        HousingService,
        {
          provide: getRepositoryToken(Housing),
          useValue: {},
        },
        {
          provide: getRepositoryToken(HousingImage),
          useValue: {},
        },
        {
          provide: getRepositoryToken(CampusLocation),
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<HousingController>(HousingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
