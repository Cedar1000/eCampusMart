import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { PAYMENT_QUE, PAYSTACK_EVENT_JOB } from '../webhook.constants';
import { WebhookService } from '../webhook.service';
import { asString, PaystackEventData } from '../webhook.utils';

export interface PaystackEventJobData {
  event: string;
  data: PaystackEventData;
}

// Settles Paystack webhook events after the webhook has answered
@Injectable()
@Processor(PAYMENT_QUE)
export class PaymentProcessor extends WorkerHost {
  private readonly logger = new Logger(PaymentProcessor.name);

  constructor(private readonly webhookService: WebhookService) {
    super();
  }

  async process(job: Job<PaystackEventJobData>) {
    if (job.name !== PAYSTACK_EVENT_JOB) {
      this.logger.warn(`Received unsupported job ${job.name}.`);
      return;
    }

    await this.webhookService.processEvent(job.data.event, job.data.data);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<PaystackEventJobData> | undefined, error: Error) {
    this.logger.error(
      `Failed ${job?.data.event} for ${asString(job?.data.data.reference) || 'unknown'} (attempt ${job?.attemptsMade}): ${error.message}`,
      error.stack,
    );
  }
}
