import { Test, TestingModule } from '@nestjs/testing';
import { HousingViewController } from './housing-view.controller';
import { HousingViewService } from './housing-view.service';
import { User } from 'src/auth/entities/user.entity';

describe('HousingViewController', () => {
  let controller: HousingViewController;
  let viewService: { recordView: jest.Mock };

  beforeEach(async () => {
    viewService = { recordView: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HousingViewController],
      providers: [{ provide: HousingViewService, useValue: viewService }],
    }).compile();

    controller = module.get<HousingViewController>(HousingViewController);
  });

  it('records the view for the signed-in user', async () => {
    await controller.create({ housingId: 'item-id' }, {
      id: 'viewer-id',
    } as User);

    expect(viewService.recordView).toHaveBeenCalledWith('item-id', 'viewer-id');
  });
});
