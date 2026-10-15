import { Controller, Get } from '@nestjs/common';

import {
  HOUSING_LISTING_FEE,
  PRODUCT_FEE_PER_UNIT,
  SERVICE_LISTING_FEE,
} from './fees.constants';

@Controller('fees')
export class FeesController {
  // In naira, like the rest of the app's amounts
  @Get()
  findAll() {
    return {
      status: 'success',
      data: {
        currency: 'NGN',
        product: { perUnit: PRODUCT_FEE_PER_UNIT / 100 },
        housing: { perListing: HOUSING_LISTING_FEE / 100 },
        service: { perListing: SERVICE_LISTING_FEE / 100 },
      },
    };
  }
}
