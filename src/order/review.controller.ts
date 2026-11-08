import { Controller, Get, ParseUUIDPipe, Query } from '@nestjs/common';

import { CurrentUser } from 'src/auth/decorators/get-current-user.decorator';
import { User } from 'src/auth/entities/user.entity';
import { ReviewService } from './review.service';
import type { ReviewQuery } from './review.service';

// Reviews are the ratings left after orders (POST /orders/:id/rating)
@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  // Anyone's, for their profile: ?userId=…, or the caller's own without it.
  // Includes reviews of the user's product stores
  @Get('received')
  received(
    @Query() { page, limit }: ReviewQuery,
    @CurrentUser() user: User,
    @Query('userId', new ParseUUIDPipe({ optional: true })) userId?: string,
  ) {
    return this.reviewService.received(userId ?? user.id, { page, limit });
  }

  // The caller's own only
  @Get('given')
  given(@Query() { page, limit }: ReviewQuery, @CurrentUser() user: User) {
    return this.reviewService.given(user.id, { page, limit });
  }

  @Get('summary')
  summary(
    @CurrentUser() user: User,
    @Query('userId', new ParseUUIDPipe({ optional: true })) userId?: string,
  ) {
    return this.reviewService.summary(userId ?? user.id);
  }
}
