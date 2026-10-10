import { Test, TestingModule } from '@nestjs/testing';
import { HousingFavouriteController } from './housing-favourite.controller';
import { HousingFavouriteService } from './housing-favourite.service';

describe('HousingFavouriteController', () => {
  let controller: HousingFavouriteController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HousingFavouriteController],
      providers: [HousingFavouriteService],
    }).compile();

    controller = module.get<HousingFavouriteController>(HousingFavouriteController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
