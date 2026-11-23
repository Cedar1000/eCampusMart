import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type IQuery from 'interfaces/query.Interface';
import * as factory from 'utils/handlerFactory';
import { Repository } from 'typeorm';
import { Wallet } from 'src/wallet/entities/wallet.entity';
import { BankAccount } from './entities/bank-account.entity';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';
import { WalletService } from 'src/wallet/wallet.service';

@Injectable()
export class BankAccountService {
  constructor(
    @InjectRepository(BankAccount)
    private readonly bankAccountRepo: Repository<BankAccount>,
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    private readonly walletService: WalletService,
  ) {}

  async create(userId: string, dto: CreateBankAccountDto) {
    const wallet = await this.walletRepo.findOne({ where: { userId } });

    if (!wallet) throw new NotFoundException('Wallet not found');

    const { data: resolved } = await this.walletService.resolveAccount({
      accountNumber: dto.accountNumber,
      bankCode: dto.bankCode,
    });

    return factory.createOne(this.bankAccountRepo, {
      ...dto,
      accountName: String(resolved.account_name || ''),
      userId,
      walletId: wallet.id,
    });
  }

  async findAll(userId: string, query: Partial<IQuery>) {
    const wallet = await this.walletRepo.findOne({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    return factory.getAll(this.bankAccountRepo, query, { walletId: wallet.id });
  }

  async findOne(userId: string, id: string, query: Partial<IQuery>) {
    await this.assertOwner(userId, id);
    return factory.getOne(this.bankAccountRepo, id, query);
  }

  async update(userId: string, id: string, dto: UpdateBankAccountDto) {
    const account = await this.assertOwner(userId, id);
    await this.walletService.verifyTransactionPin(userId, dto.pin);
    const { pin, ...accountUpdates } = dto;
    const accountNumber = accountUpdates.accountNumber ?? account.accountNumber;
    const bankCode = accountUpdates.bankCode ?? account.bankCode;
    const { data: resolved } = await this.walletService.resolveAccount({
      accountNumber,
      bankCode,
    });

    return factory.updateOne(this.bankAccountRepo, id, {
      ...accountUpdates,
      accountName: String(resolved.account_name || ''),
    });
  }

  async remove(userId: string, id: string) {
    await this.assertOwner(userId, id);
    return factory.deleteOne(this.bankAccountRepo, id);
  }

  private async assertOwner(userId: string, id: string) {
    const account = await this.bankAccountRepo.findOne({
      where: { id, wallet: { userId } },
      select: ['id'],
    });
    if (!account) throw new NotFoundException('No bank account with that ID');
    return account;
  }
}
