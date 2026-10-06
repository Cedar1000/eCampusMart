import { Test, TestingModule } from '@nestjs/testing';
import { ServiceFavouriteController } from './service-favourite.controller';
import { ServiceFavouriteService } from './service-favourite.service';

describe('ServiceFavouriteController', () => {
  let controller: ServiceFavouriteController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServiceFavouriteController],
      providers: [ServiceFavouriteService],
    }).compile();

    controller = module.get<ServiceFavouriteController>(
      ServiceFavouriteController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
