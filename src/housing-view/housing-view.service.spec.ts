import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HousingViewService } from './housing-view.service';
import { HousingView } from './entities/housing-view.entity';
import { Housing } from 'src/housing/entities/housing.entity';
import { HOUSING_VIEW_JOB, HOUSING_QUE } from 'src/housing/housing.constants';

describe('HousingViewService', () => {
  let service: HousingViewService;
  let housingRepo: { findOne: jest.Mock };
  let queue: { add: jest.Mock };

  beforeEach(async () => {
    housingRepo = { findOne: jest.fn() };
    queue = { add: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HousingViewService,
        { provide: getRepositoryToken(HousingView), useValue: {} },
        { provide: getRepositoryToken(Housing), useValue: housingRepo },
        { provide: getQueueToken(HOUSING_QUE), useValue: queue },
      ],
    }).compile();

    service = module.get<HousingViewService>(HousingViewService);
  });

  it('queues a view job for a viewer who is not the owner', async () => {
    housingRepo.findOne.mockResolvedValue({
      id: 'item-id',
      userId: 'owner-id',
    });

    await expect(service.recordView('item-id', 'viewer-id')).resolves.toEqual({
      status: 'success',
      message: 'View recorded',
    });

    expect(queue.add).toHaveBeenCalledWith(
      HOUSING_VIEW_JOB,
      { housingId: 'item-id', userId: 'viewer-id' },
      expect.objectContaining({ attempts: 3 }),
    );
  });

  it("doesn't count the owner viewing their own listing", async () => {
    housingRepo.findOne.mockResolvedValue({
      id: 'item-id',
      userId: 'owner-id',
    });

    await service.recordView('item-id', 'owner-id');

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('throws when the housing does not exist', async () => {
    housingRepo.findOne.mockResolvedValue(null);

    await expect(service.recordView('missing-id', 'viewer-id')).rejects.toThrow(
      NotFoundException,
    );

    expect(queue.add).not.toHaveBeenCalled();
  });
});
