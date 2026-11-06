import {
  IsEnum,
  IsNotEmpty,
  IsString,
  Validate,
  ValidatorConstraint,
} from 'class-validator';
import type { ValidatorConstraintInterface } from 'class-validator';
import { Expo } from 'expo-server-sdk';

import { PushPlatform } from '../entities/push-token.entity';

@ValidatorConstraint({ name: 'isExpoPushToken' })
class IsExpoPushToken implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return Expo.isExpoPushToken(value);
  }

  defaultMessage() {
    return 'token must be an Expo push token';
  }
}

export class SavePushTokenDto {
  @Validate(IsExpoPushToken)
  token: string;

  @IsEnum(PushPlatform)
  platform: PushPlatform;
}

// Any string, so a token from an older format can still be removed on sign-out
export class RemovePushTokenDto {
  @IsNotEmpty()
  @IsString()
  token: string;
}
