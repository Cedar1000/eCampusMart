import { IsIn } from 'class-validator';

import { OfferStatus } from '../entities/offer.entity';

// The buyer's answer to an offer; set by the accept and reject routes
export class UpdateOfferDto {
  @IsIn([OfferStatus.ACCEPTED, OfferStatus.REJECTED])
  status: OfferStatus.ACCEPTED | OfferStatus.REJECTED;
}
