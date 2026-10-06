import { Test, TestingModule } from '@nestjs/testing';
import { ServiceFavouriteService } from './service-favourite.service';

describe('ServiceFavouriteService', () => {
  let service: ServiceFavouriteService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ServiceFavouriteService],
    }).compile();

    service = module.get<ServiceFavouriteService>(ServiceFavouriteService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
