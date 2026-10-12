import { Test, TestingModule } from '@nestjs/testing';
import { ServiceViewService } from './service-view.service';

describe('ServiceViewService', () => {
  let service: ServiceViewService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ServiceViewService],
    }).compile();

    service = module.get<ServiceViewService>(ServiceViewService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
