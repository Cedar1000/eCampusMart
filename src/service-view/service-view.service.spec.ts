import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ServiceViewService } from './service-view.service';
import { ServiceView } from './entities/service-view.entity';
import { Service } from 'src/service/entities/service.entity';
import { SERVICE_VIEW_JOB, SERVICE_QUE } from 'src/service/service.constant';

describe('ServiceViewService', () => {
  let service: ServiceViewService;
  let serviceRepo: { findOne: jest.Mock };
  let queue: { add: jest.Mock };

  beforeEach(async () => {
    serviceRepo = { findOne: jest.fn() };
    queue = { add: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceViewService,
        { provide: getRepositoryToken(ServiceView), useValue: {} },
        { provide: getRepositoryToken(Service), useValue: serviceRepo },
        { provide: getQueueToken(SERVICE_QUE), useValue: queue },
      ],
    }).compile();

    service = module.get<ServiceViewService>(ServiceViewService);
  });

  it('queues a view job for a viewer who is not the owner', async () => {
    serviceRepo.findOne.mockResolvedValue({
      id: 'item-id',
      ownerId: 'owner-id',
    });

    await expect(service.recordView('item-id', 'viewer-id')).resolves.toEqual({
      status: 'success',
      message: 'View recorded',
    });

    expect(queue.add).toHaveBeenCalledWith(
      SERVICE_VIEW_JOB,
      { serviceId: 'item-id', userId: 'viewer-id' },
      expect.objectContaining({ attempts: 3 }),
    );
  });

  it("doesn't count the owner viewing their own listing", async () => {
    serviceRepo.findOne.mockResolvedValue({
      id: 'item-id',
      ownerId: 'owner-id',
    });

    await service.recordView('item-id', 'owner-id');

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('throws when the service does not exist', async () => {
    serviceRepo.findOne.mockResolvedValue(null);

    await expect(service.recordView('missing-id', 'viewer-id')).rejects.toThrow(
      NotFoundException,
    );

    expect(queue.add).not.toHaveBeenCalled();
  });
});
