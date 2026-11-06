import { Test, TestingModule } from '@nestjs/testing';
import { WalletController } from './wallet.controller';
import { PaymentService } from 'src/webhook/payment.service';
import { User } from 'src/auth/entities/user.entity';
import { WalletService } from './wallet.service';

describe('WalletController', () => {
  let controller: WalletController;
  let walletService: {
    initializeTransaction: jest.Mock;
  };
  let paymentService: { verify: jest.Mock };

  beforeEach(async () => {
    walletService = {
      initializeTransaction: jest.fn(),
    };
    paymentService = { verify: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WalletController],
      providers: [
        {
          provide: WalletService,
          useValue: walletService,
        },
        { provide: PaymentService, useValue: paymentService },
      ],
    }).compile();

    controller = module.get<WalletController>(WalletController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('verifies a top-up through the payment service, as the user', async () => {
    const result = {
      status: 'success',
      data: { reference: 'ref-1', status: 'success', amount: 5000 },
    };
    paymentService.verify.mockResolvedValue(result);

    await expect(
      controller.verifyTransaction('ref-1', { id: 'user-1' } as User),
    ).resolves.toBe(result);
    expect(paymentService.verify).toHaveBeenCalledWith('ref-1', 'user-1');
  });
});
