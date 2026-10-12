import { Test, TestingModule } from '@nestjs/testing';
import { ServiceViewController } from './service-view.controller';
import { ServiceViewService } from './service-view.service';

describe('ServiceViewController', () => {
  let controller: ServiceViewController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServiceViewController],
      providers: [ServiceViewService],
    }).compile();

    controller = module.get<ServiceViewController>(ServiceViewController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
