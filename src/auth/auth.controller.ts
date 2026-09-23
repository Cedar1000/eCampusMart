/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Get,
  Body,
  Post,
  Param,
  Patch,
  Query,
  HttpCode,
  UsePipes,
  UseGuards,
  Controller,
  ValidationPipe,
} from '@nestjs/common';

import { AuthService } from './auth.service';

import { SignUpDto } from './dto/signup.dto';
import { EmailLoginDto, PhoneNumberLoginDto } from './dto/login.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

import IQuery from 'interfaces/query.Interface';
import { VerifyOtpDto } from './dto/verify-otp';
import { CurrentUser } from './decorators/get-current-user.decorator';
import { User } from './entities/user.entity';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { DuplicateEmailGuard } from './guards/duplicate-email.guard';
import { CreatePasswordDto } from './dto/create-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ValidCampusGuard } from './guards/valid-campus.guard';
import { UniquePhoneNumberGuard } from './guards/unique-phone-number.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/signup')
  @HttpCode(201)
  @UsePipes(ValidationPipe)
  @UseGuards(DuplicateEmailGuard)
  async signup(@Body() payload: SignUpDto) {
    return this.authService.signUp(payload);
  }

  @Post('/login/email')
  @HttpCode(200)
  @UsePipes(ValidationPipe)
  async login(@Body() payload: EmailLoginDto) {
    payload.payload = { email: payload.email };
    return this.authService.login(payload);
  }

  @Post('/login/phone')
  @HttpCode(200)
  @UsePipes(ValidationPipe)
  async loginWithPhone(@Body() payload: PhoneNumberLoginDto) {
    payload.payload = {
      countryCode: payload.countryCode,
      phoneNumber: payload.phoneNumber,
    };
    return this.authService.login(payload);
  }

  @Post('/verify-otp')
  @HttpCode(200)
  async verifyOtp(@Body() payload: VerifyOtpDto) {
    const { email, otp } = payload;
    return this.authService.verifyOtp(otp, email.toLocaleLowerCase());
  }

  @Post('/send-otp')
  @HttpCode(200)
  @UsePipes(ValidationPipe)
  async sendOtp(@Body() sendOtpDto: SendOtpDto) {
    return this.authService.sendOtp(sendOtpDto);
  }

  @Post('/refresh-token')
  @HttpCode(200)
  @UsePipes(ValidationPipe)
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    const { refreshToken } = refreshTokenDto;
    return this.authService.refreshToken(refreshToken);
  }

  @Patch('/reset-password/:resetToken')
  @HttpCode(200)
  @UsePipes(ValidationPipe)
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
    @Param('resetToken') resetToken: string,
  ) {
    const { password } = resetPasswordDto;
    return this.authService.resetPassword(resetToken, password);
  }

  @Patch('/create-password/:resetToken')
  @HttpCode(200)
  @UsePipes(ValidationPipe)
  async createPassword(
    @Body() createPasswordDto: CreatePasswordDto,
    @Param('resetToken') resetToken: string,
  ) {
    return this.authService.createPassword(resetToken, createPasswordDto);
  }

  @Patch('/update-password')
  @HttpCode(200)
  @UsePipes(ValidationPipe)
  async updatePassword(
    @Body() payload: UpdatePasswordDto,
    @CurrentUser() user: User,
  ) {
    const { currentPassword, newPassword } = payload;

    return await this.authService.updatePassword(
      currentPassword,
      newPassword,
      user.id,
    );
  }

  @Get('/users')
  async getAllUser(@Query() query: Partial<IQuery>) {
    return this.authService.findAll(query);
  }

  @Get('/users/:id')
  async getSingleUser(
    @Param('id') id: string,
    @Query() query: Partial<IQuery>,
  ) {
    return this.authService.getSingleUser(id, query);
  }

  @Get('/me')
  getMe(@CurrentUser() user: User) {
    return {
      status: 'success',
      message: 'Get user successful!',
      user,
    };
  }

  @Patch('/update-me')
  @UsePipes(ValidationPipe)
  @UseGuards(ValidCampusGuard, UniquePhoneNumberGuard)
  async updateAuthUser(
    @Body() payload: UpdateUserDto,
    @CurrentUser() user: User,
  ) {
    return await this.authService.updateAuthUser(user.id, payload);
  }
}
