import { DataSource } from 'typeorm';

import {
  Transaction,
  TransactionStatus,
} from 'src/transaction/entities/transaction.entity';
import { WalletWebhookService } from './wallet-webhook.service';

// Mimics Postgres: the conditional UPDATE only changes a row that is still unpaid
const createDatabase = () => {
  const row = {
    id: 'tx-1',
    walletId: 'wallet-1',
    reference: 'ref-1',
    amount: 1000000,
    currency: 'NGN',
    status: TransactionStatus.PENDING,
  } as Transaction;
  const wallet = { balance: 0 };

  const updateBuilder = (entity: string) => {
    const query = { params: {} as Record<string, unknown> };
    const builder = {
      set: () => builder,
      where: (_sql: string, params: Record<string, unknown>) => {
        Object.assign(query.params, params);
        return builder;
      },
      setParameters: (params: Record<string, unknown>) => {
        Object.assign(query.params, params);
        return builder;
      },
      returning: () => builder,
      execute: () => {
        if (entity === 'Wallet') {
          wallet.balance += Number(query.params.amount);
          return { affected: 1, raw: [{ balance: String(wallet.balance) }] };
        }

        const unpaid = query.params.unpaid as string[] | undefined;
        const changes = unpaid
          ? unpaid.includes(row.status)
          : row.status === query.params.pending;

        if (!changes) return { affected: 0, raw: [] };

        row.status = unpaid
          ? TransactionStatus.SUCCESS
          : TransactionStatus.FAILED;
        return { affected: 1, raw: [] };
      },
    };
    return builder;
  };

  const manager = {
    findOne: jest.fn(() => ({ ...row })),
    update: jest.fn((_entity: unknown, _id: string, values: object) =>
      Object.assign(row, values),
    ),
    createQueryBuilder: () => ({
      update: (entity: { name: string }) => updateBuilder(entity.name),
    }),
  };

  const dataSource = {
    transaction: (run: (m: typeof manager) => unknown) => run(manager),
    createQueryBuilder: manager.createQueryBuilder,
  } as unknown as DataSource;

  return { row, wallet, service: new WalletWebhookService(dataSource) };
};

const paid = { reference: 'ref-1', amount: 1000000, currency: 'NGN' };

describe('WalletWebhookService', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('credits the wallet and records the real balances', async () => {
    const { row, wallet, service } = createDatabase();

    await service.handle('charge.success', paid);

    expect(row.status).toBe(TransactionStatus.SUCCESS);
    expect(wallet.balance).toBe(1000000);
    expect(row).toMatchObject({ beforeBalance: 0, afterBalance: 1000000 });
  });

  it('credits once when the webhook and verify settle it at the same time', async () => {
    const { wallet, service } = createDatabase();

    await Promise.all([
      service.handle('charge.success', paid),
      service.handle('charge.success', paid),
    ]);
    await service.handle('charge.success', paid);

    expect(wallet.balance).toBe(1000000);
  });

  it.each([
    ['amount', { ...paid, amount: 100 }],
    ['currency', { ...paid, currency: 'USD' }],
  ])("doesn't credit when the %s doesn't match", async (_field, data) => {
    const { row, wallet, service } = createDatabase();

    await service.handle('charge.success', data);

    expect(wallet.balance).toBe(0);
    expect(row.status).toBe(TransactionStatus.PENDING);
  });

  it('never marks a credited top-up failed', async () => {
    const { row, service } = createDatabase();

    await service.handle('charge.success', paid);
    await service.handle('charge.failed', paid);

    expect(row.status).toBe(TransactionStatus.SUCCESS);
  });

  it('still credits a top-up paid after it was marked failed', async () => {
    const { row, wallet, service } = createDatabase();

    await service.handle('charge.failed', paid);
    await service.handle('charge.success', paid);

    expect(row.status).toBe(TransactionStatus.SUCCESS);
    expect(wallet.balance).toBe(1000000);
  });
});
