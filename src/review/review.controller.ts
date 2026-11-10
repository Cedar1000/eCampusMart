import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';

import type IQuery from 'interfaces/query.Interface';
import { CurrentUser } from 'src/auth/decorators/get-current-user.decorator';
import { User } from 'src/auth/entities/user.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { IncludeReviewListingsInterceptor } from './interceptors/include-review-listings.interceptor';
import { ReviewService } from './review.service';

@Controller('review')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get()
  @UseInterceptors(IncludeReviewListingsInterceptor)
  findAll(@Query() query: Partial<IQuery>) {
    return this.reviewService.findAll(query);
  }

  @Get('pending')
  @UseInterceptors(IncludeReviewListingsInterceptor)
  findAllPending(@Query() query: Partial<IQuery>, @CurrentUser() user: User) {
    return this.reviewService.findAllPending(query, user.id);
  }

  // POST /review { pendingReviewId, rating: 1-5, body?: string }
  @Post()
  create(@Body() createReviewDto: CreateReviewDto, @CurrentUser() user: User) {
    return this.reviewService.create(createReviewDto, user.id);
  }
}
