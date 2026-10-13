import { Body, Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { WebhookService } from './webhook.service';

@Controller('webhook')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post('paystack')
  @HttpCode(200)
  handlePaystackWebhook(
    @Headers('x-paystack-signature') signature: string | undefined,
    @Req() req: Request & { rawBody?: Buffer },
    @Body() payload: Record<string, unknown>,
  ) {
    return this.webhookService.handlePaystackWebhook({
      signature,
      payload,
      rawBody: req.rawBody,
    });
  }
}
