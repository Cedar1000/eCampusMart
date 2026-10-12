import { Test, TestingModule } from '@nestjs/testing';
import { HousingViewController } from './housing-view.controller';
import { HousingViewService } from './housing-view.service';

describe('HousingViewController', () => {
  let controller: HousingViewController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HousingViewController],
      providers: [HousingViewService],
    }).compile();

    controller = module.get<HousingViewController>(HousingViewController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
