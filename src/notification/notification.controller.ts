import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import { CurrentUser } from 'src/auth/decorators/get-current-user.decorator';
import { User } from 'src/auth/entities/user.entity';
import { RemovePushTokenDto, SavePushTokenDto } from './dto/push-token.dto';
import { PushService } from './push.service';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly pushService: PushService) {}

  // Sent by the app after every sign-in and whenever the token changes:
  // 201 for a new token, 200 for one it already had
  @Post('push-tokens')
  async saveToken(
    @Body() savePushTokenDto: SavePushTokenDto,
    @CurrentUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ) {
    const created = await this.pushService.saveToken(user.id, savePushTokenDto);

    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
  }

  // Sent on sign-out; a token that's already gone isn't an error
  @Delete('push-tokens')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeToken(
    @Body() { token }: RemovePushTokenDto,
    @CurrentUser() user: User,
  ) {
    await this.pushService.removeToken(user.id, token);
  }
}
