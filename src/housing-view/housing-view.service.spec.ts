import { Test, TestingModule } from '@nestjs/testing';
import { HousingViewService } from './housing-view.service';

describe('HousingViewService', () => {
  let service: HousingViewService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HousingViewService],
    }).compile();

    service = module.get<HousingViewService>(HousingViewService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
