import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from 'src/auth/entities/user.entity';
import { ServiceCategory } from 'src/service-category/entities/service-category.entity';
import { ServiceStoreController } from './service-store.controller';
import { CreateServiceStoreDto } from './dto/create-service-store.dto';
import { ServiceStoreService } from './service-store.service';

describe('ServiceStoreController', () => {
  let controller: ServiceStoreController;
  const serviceStoreService = {
    createServiceStore: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServiceStoreController],
      providers: [
        {
          provide: ServiceStoreService,
          useValue: serviceStoreService,
        },
        {
          provide: getRepositoryToken(ServiceCategory),
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<ServiceStoreController>(ServiceStoreController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('sets the owner and campus from the current user', async () => {
    const createServiceStoreDto = Object.assign(new CreateServiceStoreDto(), {
      categoryId: 'category-id',
      name: 'Repair Store',
    });
    const user = Object.assign(new User(), {
      id: 'owner-id',
      campusId: 'campus-id',
    });

    await controller.create(createServiceStoreDto, user);

    expect(serviceStoreService.createServiceStore).toHaveBeenCalledWith({
      categoryId: 'category-id',
      name: 'Repair Store',
      ownerId: 'owner-id',
      campusId: 'campus-id',
    });
  });
});
