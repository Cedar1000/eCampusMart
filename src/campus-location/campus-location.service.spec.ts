import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CampusLocationService } from './campus-location.service';
import { CampusLocation } from './entities/campus-location.entity';

describe('CampusLocationService', () => {
  let service: CampusLocationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampusLocationService,
        {
          provide: getRepositoryToken(CampusLocation),
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<CampusLocationService>(CampusLocationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
