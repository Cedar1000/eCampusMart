import {
  Injectable,
  BadRequestException,
  BadGatewayException,
  InternalServerErrorException,
} from '@nestjs/common';

import axios, { AxiosError } from 'axios';

import { InitializeTransactionDto } from './dto/initialize-transaction.dto';

import generateReference from 'utils/generateReference';
import { Wallet } from './entities/wallet.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';

import {
  Transaction,
  TransactionDescription,
  TransactionStatus,
  TransactionType,
} from 'src/transaction/entities/transaction.entity';

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

    private readonly configService: ConfigService,
  ) {}

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

  async findByUserId(userId: string): Promise<Wallet | null> {
    return this.walletRepository.findOne({ where: { userId } });
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
