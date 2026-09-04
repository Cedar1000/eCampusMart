import { Entity } from 'typeorm';

import {
  IsNotEmpty,
  MinLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'passwordMatch', async: false })
export class PasswordMatchConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const newPassword = (args.object as any).newPassword;
    return value === newPassword;
  }

  defaultMessage() {
    return 'Passwords do not match';
  }
}

@Entity()
export class UpdatePasswordDto {
  @IsNotEmpty()
  @MinLength(8)
  currentPassword: string;

  @IsNotEmpty()
  @MinLength(8)
  newPassword: string;

  @IsNotEmpty()
  @MinLength(8)
  @Validate(PasswordMatchConstraint)
  newConfirmPassword: string;
}
