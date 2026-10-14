import { Global, Module } from '@nestjs/common';

import { ListingCleanupService } from './listing-cleanup.service';

@Global()
@Module({
  providers: [ListingCleanupService],
  exports: [ListingCleanupService],
})
export class ListingCleanupModule {}
