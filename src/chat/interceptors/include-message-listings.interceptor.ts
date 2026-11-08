import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, mergeMap } from 'rxjs';

import { Message } from '../entities/message.entity';
import { MessageListingsService } from '../message-listings.service';

type MessagesResponse = {
  data?: Message[];
  [key: string]: unknown;
};

// Adds each message's listing and offer to GET messages (see MessageListingsService)
@Injectable()
export class IncludeMessageListingsInterceptor implements NestInterceptor {
  constructor(private readonly listings: MessageListingsService) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<MessagesResponse> {
    return next.handle().pipe(
      mergeMap(async (response: MessagesResponse) => {
        if (!response.data?.length) return response;

        return { ...response, data: await this.listings.attach(response.data) };
      }),
    );
  }
}
