import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { TransactionDescription } from 'src/transaction/entities/transaction.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/auth/entities/user.entity';
import { SubscriptionWebhookService } from './subscription-webhook.service';
import { WalletWebhookService } from './wallet-webhook.service';
import { asRecord, asString, PaystackEventData } from './webhook.utils';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  PAYMENT_QUE,
  PAYSTACK_EVENT_JOB,
  PAYSTACK_EVENT_JOB_OPTIONS,
} from './webhook.constants';
import type { PaystackEventJobData } from './processors/payment.processor';

@Injectable()
export class WebhookService {
  constructor(
    private readonly configService: ConfigService,

    private readonly walletWebhookService: WalletWebhookService,

    private readonly subscriptionWebhookService: SubscriptionWebhookService,

    @InjectQueue(PAYMENT_QUE)
    private readonly paymentQueue: Queue<PaystackEventJobData>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async handlePaystackWebhook({
    signature,
    payload,
    rawBody,
  }: {
    signature?: string;
    payload: Record<string, unknown>;
    rawBody?: Buffer;
  }) {
    const secretKey =
      this.configService.get<string>('PAYSTACK_SECRET_KEY') ||
      process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
      throw new InternalServerErrorException(
        'PAYSTACK_SECRET_KEY is not configured',
      );
    }

    if (!signature || !rawBody) {
      throw new UnauthorizedException('Invalid Paystack webhook signature');
    }

    const expectedSignature = createHmac('sha512', secretKey)
      .update(Buffer.from(rawBody))
      .digest('hex');

    if (signature !== expectedSignature) {
      throw new UnauthorizedException('Invalid Paystack webhook signature');
    }

    // Answer straight away and settle in a job, which retries on failure. If Redis is
    // down this throws, Paystack gets a 500 and retries the webhook itself
    await this.paymentQueue.add(
      PAYSTACK_EVENT_JOB,
      { event: asString(payload.event), data: asRecord(payload.data) },
      PAYSTACK_EVENT_JOB_OPTIONS,
    );

    return { status: true, message: 'Webhook received' };
  }

  // Run by the webhook job and by GET /payments/verify; every handler is idempotent
  async processEvent(event: string, data: PaystackEventData) {
    if (event.startsWith('transfer.')) {
      await this.walletWebhookService.handle(event, data);
      return;
    }

    if (
      event === 'customeridentification.success' ||
      event === 'customeridentification.failed'
    ) {
      const customerCode = asString(data.customer_code);

      if (customerCode) {
        await this.userRepository.update(
          { paystackCustomerCode: customerCode },
          {
            bvnVerificationStatus:
              event === 'customeridentification.success'
                ? 'verified'
                : 'failed',
            bvnVerificationMessage:
              event === 'customeridentification.failed'
                ? asString(data.reason) || 'Verification failed'
                : null,
          },
        );
      }
      return;
    }

    if (event.startsWith('refund.')) {
      await this.subscriptionWebhookService.handle(event, data);
      return;
    }

    const description = this.getDescription(event, data);

    switch (description) {
      case TransactionDescription.FUND:
        await this.walletWebhookService.handle(event, data);
        break;

      case TransactionDescription.STORE_SUBSCRIPTION:
        await this.subscriptionWebhookService.handle(event, data);
        break;

      default:
        // Acknowledge so Paystack does not keep retrying an event we can't route
        console.error('Unhandled Paystack webhook', { event, description });
    }
  }

  private getDescription(event: string, data: PaystackEventData) {
    const { description } = this.parseMetadata(data.metadata);

    if (description) return description;

    // Paystack's own subscription, invoice and renewal charge events never carry our metadata
    if (
      event.startsWith('subscription.') ||
      event.startsWith('invoice.') ||
      asRecord(data.plan).plan_code
    ) {
      return TransactionDescription.STORE_SUBSCRIPTION;
    }

    return undefined;
  }

  // Paystack sends metadata back as an object, or as a string when it was sent as one
  private parseMetadata(metadata: unknown): { description?: string } {
    if (typeof metadata === 'string') {
      try {
        return this.parseMetadata(JSON.parse(metadata));
      } catch {
        return {};
      }
    }

    if (!metadata || typeof metadata !== 'object') return {};

    return metadata;
  }
}
