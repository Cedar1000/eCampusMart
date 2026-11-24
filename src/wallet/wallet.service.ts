import {
  Injectable,
  BadRequestException,
  BadGatewayException,
  InternalServerErrorException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import axios, { AxiosError } from 'axios';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomInt, randomUUID } from 'crypto';

import { InitializeTransactionDto } from './dto/initialize-transaction.dto';

import generateReference from 'utils/generateReference';
import { Wallet } from './entities/wallet.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, MoreThan, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';

import {
  Transaction,
  TransactionDescription,
  TransactionStatus,
  TransactionType,
} from 'src/transaction/entities/transaction.entity';
import { User } from 'src/auth/entities/user.entity';
import {
  createPaystackTransferRecipient,
  finalizePaystackTransfer,
  initiatePaystackTransfer,
  listPaystackBanks,
  resolvePaystackAccount,
  getPaystackTransfer,
} from 'utils/paystack';
import { ResolveAccountNumberDto } from './dto/resolve-account-number.dto';
import { BankAccount } from 'src/bank-account/entities/bank-account.entity';
import sendEmail from 'utils/sendEmail';

const TRANSACTION_PIN_LOCK_MS = 30 * 60 * 1000;

interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,

    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(BankAccount)
    private readonly bankAccountRepository: Repository<BankAccount>,

    private readonly configService: ConfigService,

    private readonly dataSource: DataSource,
  ) {}

  async getBanks() {
    try {
      return { status: 'success', data: await listPaystackBanks('NGN') };
    } catch (error) {
      console.error('Paystack bank list failed', error);
      throw new BadGatewayException('Unable to load banks');
    }
  }

  async resolveAccount(dto: ResolveAccountNumberDto) {
    const { accountNumber, bankCode } = dto;
    try {
      const data = await resolvePaystackAccount(accountNumber, bankCode);
      return { status: 'success', data };
    } catch (error) {
      const message = (error as AxiosError<{ message?: string }>).response?.data
        ?.message;
      if (message) throw new BadRequestException(message);
      throw new BadGatewayException('Unable to resolve bank account');
    }
  }

  async createTransactionPin(userId: string, pin: string) {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect([
        'user.transactionPinHash',
        'user.transactionPinLockedUntil',
        'user.transactionPinAttempts',
      ])
      .where('user.id = :userId', { userId })
      .getOne();

    if (!user) throw new NotFoundException('User not found');

    if (user.transactionPinHash) {
      throw new ConflictException('Transaction PIN has already been created');
    }

    await this.userRepository.update(userId, {
      transactionPinHash: await bcrypt.hash(pin, 12),
    });

    return { status: 'success', message: 'Transaction PIN created' };
  }

  async updateTransactionPin(
    userId: string,
    currentPin: string,
    newPin: string,
  ) {
    await this.verifyTransactionPin(userId, currentPin);
    await this.userRepository.update(userId, {
      transactionPinHash: await bcrypt.hash(newPin, 12),
      transactionPinAttempts: 0,
      transactionPinLockedUntil: null,
    });
    return { status: 'success', message: 'Transaction PIN updated' };
  }

  async verifyTransactionPin(userId: string, pin: string) {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect([
        'user.transactionPinHash',
        'user.transactionPinLockedUntil',
        'user.transactionPinAttempts',
      ])
      .where('user.id = :userId', { userId })
      .getOne();

    if (!user) throw new NotFoundException('User not found');

    if (!user.transactionPinHash) {
      throw new BadRequestException('Create a transaction PIN first');
    }

    if (
      user.transactionPinLockedUntil &&
      user.transactionPinLockedUntil > new Date()
    ) {
      const remainingSeconds = Math.ceil(
        (user.transactionPinLockedUntil.getTime() - Date.now()) / 1000,
      );

      const minutesRemaining = Math.max(1, Math.ceil(remainingSeconds / 60));

      throw new ForbiddenException({
        message: `Transaction PIN is locked. Try again in ${minutesRemaining} ${minutesRemaining === 1 ? 'minute' : 'minutes'}.`,
        lockedUntil: user.transactionPinLockedUntil.toISOString(),
        remainingSeconds,
      });
    }

    if (!(await bcrypt.compare(pin, user.transactionPinHash))) {
      const attempts = (user.transactionPinAttempts || 0) + 1;

      const lockedUntil =
        attempts >= 5 ? new Date(Date.now() + TRANSACTION_PIN_LOCK_MS) : null;

      await this.userRepository.update(userId, {
        transactionPinAttempts: attempts,
        ...(lockedUntil && { transactionPinLockedUntil: lockedUntil }),
      });

      if (attempts >= 5) {
        throw new ForbiddenException({
          message: 'Transaction PIN is locked. Try again in 30 minutes.',
          lockedUntil: lockedUntil!.toISOString(),
          remainingSeconds: Math.ceil(
            (lockedUntil!.getTime() - Date.now()) / 1000,
          ),
        });
      }

      throw new UnauthorizedException('Transaction PIN is incorrect');
    }

    await this.userRepository.update(userId, {
      transactionPinAttempts: 0,
      transactionPinLockedUntil: null,
    });
    return { status: 'success', message: 'Transaction PIN is correct' };
  }

  async sendPinOtp(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'email', 'firstName'],
    });

    if (!user) throw new NotFoundException('User not found');

    const otp = randomInt(0, 1_000_000).toString().padStart(6, '0');

    await this.userRepository.update(userId, {
      pinOtp: Number(otp),
      pinOtpExpiration: new Date(Date.now() + 10 * 60 * 1000),
      pinOtpAttempts: 0,
    });

    try {
      await sendEmail({
        to: user.email,
        subject: 'Your transaction PIN reset code',
        text: `Hi ${user.firstName || 'there'}, your transaction PIN reset code is ${otp}. It expires in 10 minutes.`,
      });
    } catch {
      await this.userRepository.update(userId, {
        pinOtp: null,
        pinOtpExpiration: null,
      });
      throw new BadGatewayException('Could not send PIN reset code');
    }

    return { status: 'success', message: 'PIN reset code sent' };
  }

  async verifyPinOtp(userId: string, otp: string) {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect([
        'user.pinOtp',
        'user.pinOtpExpiration',
        'user.pinOtpAttempts',
      ])
      .where('user.id = :userId', { userId })
      .getOne();

    if (!user) throw new NotFoundException('User not found');

    if (
      user.pinOtp === null ||
      user.pinOtp === undefined ||
      !user.pinOtpExpiration ||
      user.pinOtpExpiration <= new Date()
    ) {
      throw new BadRequestException('PIN reset code is invalid or expired');
    }

    if (Number(otp) !== user.pinOtp) {
      const attempts = (user.pinOtpAttempts || 0) + 1;

      await this.userRepository.update(userId, {
        pinOtpAttempts: attempts,
        ...(attempts >= 5 && { pinOtp: null, pinOtpExpiration: null }),
      });

      throw new UnauthorizedException('PIN reset code is incorrect');
    }

    const resetPinToken = randomBytes(32).toString('hex');

    const hashedToken = createHash('sha256')
      .update(resetPinToken)
      .digest('hex');

    await this.userRepository.update(userId, {
      pinOtp: null,
      pinOtpExpiration: null,
      pinOtpAttempts: 0,
      resetPinToken: hashedToken,
      resetPinTokenExpires: new Date(Date.now() + 15 * 60 * 1000),
    });

    return {
      status: 'success',
      message: 'Otp verification success!',
      resetPinToken,
    };
  }

  async resetTransactionPin(resetPinToken: string, pin: string) {
    const hashedToken = createHash('sha256')
      .update(resetPinToken)
      .digest('hex');
    const user = await this.userRepository.findOne({
      where: {
        resetPinToken: hashedToken,
        resetPinTokenExpires: MoreThan(new Date()),
      },
      select: ['id'],
    });
    if (!user) {
      throw new BadRequestException('Reset PIN token is invalid or expired');
    }

    await this.userRepository.update(user.id, {
      transactionPinHash: await bcrypt.hash(pin, 12),
      transactionPinAttempts: 0,
      transactionPinLockedUntil: null,
      resetPinToken: null,
      resetPinTokenExpires: null,
    });

    return { status: 'success', message: 'Transaction PIN reset successful' };
  }

  async transferToUser(
    senderId: string,
    recipientId: string,
    amount: number,
    pin: string,
  ) {
    if (senderId === recipientId) {
      throw new BadRequestException('You cannot transfer to yourself');
    }
    await this.verifyTransactionPin(senderId, pin);

    const [sender, recipient] = await Promise.all([
      this.userRepository.findOne({
        where: { id: senderId },
        select: ['id', 'firstName', 'lastName'],
      }),
      this.userRepository.findOne({
        where: { id: recipientId, isActive: true },
        select: ['id', 'firstName', 'lastName'],
      }),
    ]);
    if (!sender || !recipient) throw new NotFoundException('User not found');

    const senderName =
      `${sender.firstName || ''} ${sender.lastName || ''}`.trim();
    const recipientName =
      `${recipient.firstName || ''} ${recipient.lastName || ''}`.trim();
    const result = await this.dataSource.transaction(async (manager) => {
      const wallets = await manager
        .getRepository(Wallet)
        .createQueryBuilder('wallet')
        .where('wallet.userId IN (:...userIds)', {
          userIds: [senderId, recipientId],
        })
        .orderBy('wallet.id', 'ASC')
        .setLock('pessimistic_write')
        .getMany();
      const from = wallets.find((wallet) => wallet.userId === senderId);
      const to = wallets.find((wallet) => wallet.userId === recipientId);
      if (!from || !to) throw new NotFoundException('Wallet not found');
      if (from.currency !== 'NGN' || to.currency !== 'NGN') {
        throw new BadRequestException(
          'Wallet transfers currently support NGN only',
        );
      }
      if (Number(from.balance) < amount) {
        throw new BadRequestException('Insufficient wallet balance');
      }
      const beforeFrom = Number(from.balance);
      const beforeTo = Number(to.balance);
      from.balance = beforeFrom - amount;
      to.balance = beforeTo + amount;
      await manager.save([from, to]);

      const now = new Date();
      const debit = manager.create(Transaction, {
        walletId: from.id,
        amount,
        beforeBalance: beforeFrom,
        afterBalance: beforeFrom - amount,
        type: TransactionType.DEBIT,
        status: TransactionStatus.SUCCESS,
        reference: randomUUID(),
        description: TransactionDescription.TRANSFER,
        currency: from.currency,
        expiresAt: now,
        counterpartyId: recipientId,
        counterpartyName: recipientName,
      });
      const credit = manager.create(Transaction, {
        walletId: to.id,
        amount,
        beforeBalance: beforeTo,
        afterBalance: beforeTo + amount,
        type: TransactionType.CREDIT,
        status: TransactionStatus.SUCCESS,
        reference: randomUUID(),
        description: TransactionDescription.TRANSFER,
        currency: to.currency,
        expiresAt: now,
        counterpartyId: senderId,
        counterpartyName: senderName,
      });
      await manager.save([debit, credit]);
      return { debit, credit };
    });

    return {
      status: 'success',
      message: 'Transfer sent',
      data: { reference: result.debit.reference, amount: amount / 100 },
    };
  }

  async withdraw(
    userId: string,
    payload: {
      amount: number;
      accountId: string;
      pin: string;
    },
  ) {
    await this.verifyTransactionPin(userId, payload.pin);

    const account = await this.bankAccountRepository.findOne({
      where: { id: payload.accountId, wallet: { userId } },
    });

    if (!account) throw new NotFoundException('Bank account not found');

    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'firstName', 'lastName'],
    });

    if (!user) throw new NotFoundException('User not found');

    if (user.id !== account.userId) {
      throw new BadRequestException(
        'You can only withdraw to your own bank account',
      );
    }

    let recipient: Record<string, unknown>;

    try {
      // resolved = await resolvePaystackAccount(
      //   account.accountNumber,
      //   account.bankCode,
      // );

      recipient = await createPaystackTransferRecipient({
        name: String(account.accountName || account.accountName || ''),
        account_number: account.accountNumber,
        bank_code: account.bankCode,
        currency: 'NGN',
      });
    } catch (error) {
      const message = (error as AxiosError<{ message?: string }>).response?.data
        ?.message;
      if (message) throw new BadRequestException(message);
      throw new BadGatewayException('Could not validate withdrawal account');
    }
    const recipientCode = String(recipient.recipient_code || '');

    if (!recipientCode)
      throw new BadGatewayException('Paystack returned no recipient code');

    const reference = generateReference();

    await this.dataSource.transaction(async (manager) => {
      const wallet = await manager.findOne(Wallet, {
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!wallet) throw new NotFoundException('Wallet not found');

      if (wallet.currency !== 'NGN') {
        throw new BadRequestException('Withdrawals currently support NGN only');
      }

      const beforeBalance = Number(wallet.balance);

      if (beforeBalance < payload.amount) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      wallet.balance = beforeBalance - payload.amount;

      await manager.save(wallet);

      await manager.save(
        manager.create(Transaction, {
          walletId: wallet.id,
          amount: payload.amount,
          beforeBalance,
          afterBalance: wallet.balance,
          type: TransactionType.DEBIT,
          status: TransactionStatus.PENDING,
          reference,
          description: TransactionDescription.WITHDRAW,
          currency: 'NGN',
          expiresAt: new Date(),
          counterpartyName: String(account.accountName || ''),
        }),
      );
    });

    try {
      const transfer = await initiatePaystackTransfer({
        amount: payload.amount,
        recipient: recipientCode,
        reference,
        reason: `eCampusMart wallet withdrawal for ${user.firstName || 'customer'}`,
      });

      const status = String(transfer.status || '').toLowerCase();

      if (status === 'failed' || status === 'rejected') {
        await this.releaseWithdrawal(reference);
        throw new BadGatewayException('Paystack could not start this transfer');
      }

      const transferCode = String(transfer.transfer_code || '');

      if (transferCode) {
        await this.transactionRepository
          .createQueryBuilder()
          .update(Transaction)
          .set({ transferCode })
          .where('reference = :reference', { reference })
          .execute();
      }
      return {
        status: 'success',
        message:
          status === 'otp'
            ? 'Transfer needs Paystack approval'
            : 'Withdrawal started',
        data: {
          reference,
          amount: payload.amount / 100,
          accountName: account.accountName,
          transferStatus: status || 'pending',
          requiresApproval: status === 'otp',
        },
      };
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      const responseStatus = (error as AxiosError).response?.status;
      if (responseStatus && responseStatus < 500) {
        await this.releaseWithdrawal(reference);
        const message = (error as AxiosError<{ message?: string }>).response
          ?.data?.message;
        throw new BadRequestException(
          message || 'Paystack rejected the transfer',
        );
      }

      // A timeout or 5xx can mean Paystack accepted the transfer. Verify by the
      // stable reference and keep the debit pending if the provider is unclear.
      let transfer: Record<string, unknown>;
      try {
        transfer = await getPaystackTransfer(reference);
      } catch {
        throw new BadGatewayException(
          `Withdrawal is pending Paystack confirmation (${reference})`,
        );
      }
      const status = String(transfer.status || '').toLowerCase();
      if (
        status === 'failed' ||
        status === 'rejected' ||
        status === 'reversed'
      ) {
        await this.releaseWithdrawal(reference);
        throw new BadGatewayException(
          'Paystack could not complete this transfer',
        );
      }
      const transferCode = String(transfer.transfer_code || '');
      if (transferCode) {
        await this.transactionRepository.update(
          { reference },
          { transferCode },
        );
      }
      return {
        status: 'success',
        message: 'Withdrawal is awaiting Paystack confirmation',
        data: {
          reference,
          amount: payload.amount / 100,
          transferStatus: status || 'pending',
          requiresApproval: status === 'otp',
        },
      };
    }
  }

  async finalizeWithdrawal(userId: string, reference: string, otp: string) {
    const transaction = await this.transactionRepository
      .createQueryBuilder('transaction')
      .innerJoin(Wallet, 'wallet', 'wallet.id = transaction.walletId')
      .addSelect('transaction.transferCode')
      .where('transaction.reference = :reference', { reference })
      .andWhere('wallet.userId = :userId', { userId })
      .andWhere('transaction.description = :description', {
        description: TransactionDescription.WITHDRAW,
      })
      .getOne();
    if (!transaction) throw new NotFoundException('Withdrawal not found');
    if (
      transaction.status !== TransactionStatus.PENDING ||
      !transaction.transferCode
    ) {
      throw new BadRequestException('Withdrawal does not need approval');
    }
    try {
      const transfer = await finalizePaystackTransfer(
        transaction.transferCode,
        otp,
      );
      return {
        status: 'success',
        data: {
          reference,
          transferStatus: String(transfer.status || 'pending'),
        },
      };
    } catch (error) {
      const message = (error as AxiosError<{ message?: string }>).response?.data
        ?.message;
      throw new BadRequestException(message || 'Could not approve withdrawal');
    }
  }

  private async releaseWithdrawal(reference: string) {
    await this.dataSource.transaction(async (manager) => {
      const transaction = await manager.findOne(Transaction, {
        where: { reference, description: TransactionDescription.WITHDRAW },
        lock: { mode: 'pessimistic_write' },
      });
      if (!transaction || transaction.status !== TransactionStatus.PENDING)
        return;
      const wallet = await manager.findOne(Wallet, {
        where: { id: transaction.walletId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!wallet) return;
      const beforeBalance = Number(wallet.balance);
      wallet.balance = beforeBalance + Number(transaction.amount);
      transaction.status = TransactionStatus.FAILED;
      transaction.beforeBalance = beforeBalance;
      transaction.afterBalance = wallet.balance;
      await manager.save([wallet, transaction]);
    });
  }

  async createForUser(userId: string, currency = 'NGN'): Promise<Wallet> {
    const existingWallet = await this.walletRepository.findOne({
      where: { userId },
    });

    if (existingWallet) {
      return existingWallet;
    }

    return this.walletRepository.save(
      this.walletRepository.create({
        userId,
        currency,
        isActive: true,
      }),
    );
  }

  async findByUserId(
    userId: string,
    includeBankAccounts = false,
  ): Promise<Wallet | null> {
    return this.walletRepository.findOne({
      where: { userId },
      ...(includeBankAccounts && { relations: { bankAccounts: true } }),
    });
  }

  async initializeTransaction(
    payload: InitializeTransactionDto & { userId: string; email: string },
  ) {
    const secretKey =
      this.configService.get<string>('PAYSTACK_SECRET_KEY') ||
      process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
      throw new InternalServerErrorException(
        'PAYSTACK_SECRET_KEY is not configured',
      );
    }

    if (!payload.email) {
      throw new BadRequestException('Authenticated user email is required');
    }

    const currency = payload.currency?.toUpperCase() || 'NGN';
    const reference = generateReference();

    const wallet = await this.createForUser(payload.userId, currency);

    const callbackUrl =
      payload.callbackUrl ||
      this.configService.get<string>('PAYSTACK_CALLBACK_URL') ||
      process.env.PAYSTACK_CALLBACK_URL;

    try {
      const { data: response } = await axios.post<PaystackInitializeResponse>(
        'https://api.paystack.co/transaction/initialize',
        {
          email: payload.email,
          amount: Math.round(payload.amount), // Convert to smallest currency unit
          currency,
          reference,
          callback_url: callbackUrl,
          metadata: {
            userId: payload.userId,
            walletId: wallet.id,
            description: TransactionDescription.FUND,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      console.log({ balance: wallet.balance, amount: payload.amount });

      await this.transactionRepository.save(
        this.transactionRepository.create({
          walletId: wallet.id,
          amount: payload.amount, // Store in smallest currency unit
          type: TransactionType.CREDIT,
          status: TransactionStatus.PENDING,
          reference,
          description: TransactionDescription.FUND,
          currency,
          beforeBalance: wallet.balance,
          afterBalance: +wallet.balance + payload.amount,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000), // Expires in 15 mins
        }),
      );

      return {
        status: response.status,
        message: response.message,
        data: {
          ...(response.data || {}),
          walletId: wallet.id,
          reference,
        },
      };
    } catch (error) {
      const paystackError = error as AxiosError<{ message?: string }>;

      console.error(
        'Paystack initialization failed',
        paystackError.response?.data || paystackError.message,
      );
      throw new BadGatewayException(
        paystackError.response?.data?.message ||
          'Unable to initialize transaction',
      );
    }
  }
}
