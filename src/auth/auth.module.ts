import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from './entities/user.entity';
import { Campus } from 'src/campus/entities/campus.entity';
import { DuplicateEmailGuard } from './guards/duplicate-email.guard';
import { ValidCampusGuard } from './guards/valid-campus.guard';
import { UniquePhoneNumberGuard } from './guards/unique-phone-number.guard';

@Module({
  imports: [TypeOrmModule.forFeature([User, Campus])],
  controllers: [AuthController],
  providers: [
    AuthService,
    DuplicateEmailGuard,
    ValidCampusGuard,
    UniquePhoneNumberGuard,
  ],
})
export class AuthModule {}
