import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HousingService } from './housing.service';
import { Housing } from './entities/housing.entity';
import { HousingImage } from './entities/housing-image.entity';

describe('HousingService', () => {
  let service: HousingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
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
      ],
    }).compile();

    service = module.get<HousingService>(HousingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
