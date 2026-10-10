import { Test, TestingModule } from '@nestjs/testing';
import { HousingFavouriteService } from './housing-favourite.service';

describe('HousingFavouriteService', () => {
  let service: HousingFavouriteService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HousingFavouriteService],
    }).compile();

    service = module.get<HousingFavouriteService>(HousingFavouriteService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
