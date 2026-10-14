import { Controller, Get, Param } from '@nestjs/common';

import { CurrentUser } from 'src/auth/decorators/get-current-user.decorator';
import { User } from 'src/auth/entities/user.entity';
import { PaymentService } from './payment.service';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  // Works for wallet top-ups and store subscriptions
  @Get('verify/:reference')
  verify(@Param('reference') reference: string, @CurrentUser() user: User) {
    return this.paymentService.verify(reference, user.id);
  }
}
