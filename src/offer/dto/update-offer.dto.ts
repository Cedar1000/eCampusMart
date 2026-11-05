import { IsIn } from 'class-validator';

import { OfferStatus } from '../entities/offer.entity';

export type OfferAnswer =
  OfferStatus.ACCEPTED | OfferStatus.REJECTED | OfferStatus.CANCELLED;

// Set by the accept and reject routes (the buyer) and the cancel route (the seller)
export class UpdateOfferDto {
  @IsIn([OfferStatus.ACCEPTED, OfferStatus.REJECTED, OfferStatus.CANCELLED])
  status: OfferAnswer;
}
