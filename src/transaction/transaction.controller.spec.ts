import { Test, TestingModule } from '@nestjs/testing';
import { TransactionController } from './transaction.controller';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from 'src/auth/entities/user.entity';
import { Wallet } from 'src/wallet/entities/wallet.entity';
import { PaymentService } from 'src/webhook/payment.service';
import { TransactionService } from './transaction.service';

describe('TransactionController', () => {
  let controller: TransactionController;
  const paymentService = { verify: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionController],
      providers: [
        { provide: TransactionService, useValue: {} },
        { provide: getRepositoryToken(Wallet), useValue: {} },
        { provide: PaymentService, useValue: paymentService },
      ],
    }).compile();

    controller = module.get<TransactionController>(TransactionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('verifies a payment through the payment service, as the user', async () => {
    const result = {
      status: 'success',
      data: { reference: 'ref-1', purpose: 'fund', status: 'success' },
    };
    paymentService.verify.mockResolvedValue(result);

    await expect(
      controller.verify('ref-1', { id: 'user-1' } as User),
    ).resolves.toBe(result);
    expect(paymentService.verify).toHaveBeenCalledWith('ref-1', 'user-1');
  });
});
