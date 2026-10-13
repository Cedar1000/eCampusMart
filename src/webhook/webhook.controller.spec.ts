import { Test, TestingModule } from '@nestjs/testing';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

describe('WebhookController', () => {
  let controller: WebhookController;
  let webhookService: {
    handlePaystackWebhook: jest.Mock;
  };

  beforeEach(async () => {
    webhookService = {
      handlePaystackWebhook: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        {
          provide: WebhookService,
          useValue: webhookService,
        },
      ],
    }).compile();

    controller = module.get<WebhookController>(WebhookController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('forwards Paystack webhook data to the service', () => {
    const rawBody = Buffer.from('{"event":"charge.success"}');
    const payload = { event: 'charge.success' };
    const req = { rawBody };

    controller.handlePaystackWebhook('signature', req as never, payload);

    expect(webhookService.handlePaystackWebhook).toHaveBeenCalledWith({
      signature: 'signature',
      payload,
      rawBody,
    });
  });
});
