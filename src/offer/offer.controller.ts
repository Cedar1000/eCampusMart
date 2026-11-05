import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import type IQuery from 'interfaces/query.Interface';
import { OfferService } from './offer.service';
import { CurrentUser } from 'src/auth/decorators/get-current-user.decorator';
import { User } from 'src/auth/entities/user.entity';
import { OfferStatus } from './entities/offer.entity';

@Controller('offers')
export class OfferController {
  constructor(private readonly offerService: OfferService) {}

  @Get()
  findAll(@Query() query: Partial<IQuery>) {
    return this.offerService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.offerService.findOne(+id);
  }

  @Patch(':id/accept')
  accept(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.offerService.update(
      id,
      { status: OfferStatus.ACCEPTED },
      user.id,
    );
  }

  @Patch(':id/reject')
  reject(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.offerService.update(
      id,
      { status: OfferStatus.REJECTED },
      user.id,
    );
  }

  @Patch(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.offerService.update(
      id,
      { status: OfferStatus.CANCELLED },
      user.id,
    );
  }
}
