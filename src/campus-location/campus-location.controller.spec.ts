import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CampusLocationController } from './campus-location.controller';
import { CampusLocationService } from './campus-location.service';
import { CampusLocation } from './entities/campus-location.entity';

describe('CampusLocationController', () => {
  let controller: CampusLocationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CampusLocationController],
      providers: [
        CampusLocationService,
        {
          provide: getRepositoryToken(CampusLocation),
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<CampusLocationController>(CampusLocationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
