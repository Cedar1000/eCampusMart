import { Test, TestingModule } from '@nestjs/testing';
import { ServiceViewController } from './service-view.controller';
import { ServiceViewService } from './service-view.service';
import { User } from 'src/auth/entities/user.entity';

describe('ServiceViewController', () => {
  let controller: ServiceViewController;
  let viewService: { recordView: jest.Mock };

  beforeEach(async () => {
    viewService = { recordView: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServiceViewController],
      providers: [{ provide: ServiceViewService, useValue: viewService }],
    }).compile();

    controller = module.get<ServiceViewController>(ServiceViewController);
  });

  it('records the view for the signed-in user', async () => {
    await controller.create({ serviceId: 'item-id' }, {
      id: 'viewer-id',
    } as User);

    expect(viewService.recordView).toHaveBeenCalledWith('item-id', 'viewer-id');
  });
});
