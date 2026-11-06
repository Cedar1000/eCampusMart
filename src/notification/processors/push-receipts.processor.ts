import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { PUSH_QUE, PUSH_RECEIPTS_JOB } from '../notification.constants';
import { PendingReceipt, PushService } from '../push.service';

export interface PushReceiptsJobData {
  receipts: PendingReceipt[];
}

// Checks Expo's receipts for sent pushes and removes uninstalled phones' tokens
@Injectable()
@Processor(PUSH_QUE)
export class PushReceiptsProcessor extends WorkerHost {
  private readonly logger = new Logger(PushReceiptsProcessor.name);

  constructor(private readonly pushService: PushService) {
    super();
  }

  async process(job: Job<PushReceiptsJobData>) {
    if (job.name !== PUSH_RECEIPTS_JOB) {
      this.logger.warn(`Received unsupported job ${job.name}.`);
      return;
    }

    await this.pushService.checkReceipts(job.data.receipts);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<PushReceiptsJobData> | undefined, error: Error) {
    this.logger.error(
      `Push receipts check failed (attempt ${job?.attemptsMade}): ${error.message}`,
      error.stack,
    );
  }
}
