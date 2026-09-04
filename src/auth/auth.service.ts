/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';

import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

import { User } from './entities/user.entity';

import IQuery from 'interfaces/query.Interface';

import { SignUpDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateRoleDto } from './dto/user-role.dto';

import { token, refreshAccessToken } from 'utils/signToken';

import * as factory from 'utils/handlerFactory';
import { SendOtpDto } from './dto/send-otp.dto';
import { CreatePasswordDto } from './dto/create-password.dto';

import { generateRandomNumber } from 'utils/generate-random-number';
import { UpdateUserDto } from './dto/update-user.dto';
// import { sendOtpEmail } from 'src/email-templates/send-otp-email';
import sendEmail from 'utils/sendEmail';

@Injectable()
export class AuthService {
  constructor(@InjectRepository(User) private userRepo: Repository<User>) {}

  async signUp(signUpDto: SignUpDto) {
    const { email, lastName, firstName, phoneNumber, countryCode } = signUpDto;

    //check email
    const emailCheck = await this.userRepo.findOne({
      where: { email },
    });

    if (emailCheck) {
      throw new ConflictException('a user already exists with that email');
    }

    const payload = {
      email,
      firstName,
      lastName,
      phoneNumber,
      countryCode,
    };

    const result = await factory.createOne(this.userRepo, payload);

    const user: User = result.data;

    const otp = generateRandomNumber(6);

    const otpExpiration = new Date(
      Date.now() + 60 * 10 * 60 * 1000,
    ).toISOString();

    await this.userRepo.update({ email }, { otp, otpExpiration });

    await this.sendOtp({ email });

    return { status: 'success', data: user };
  }

  async createPassword(
    resetToken: string,
    createPasswordDto: CreatePasswordDto,
  ) {
    const { password } = createPasswordDto;

    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    const user = await this.userRepo.findOne({
      where: {
        passwordResetToken: hashedToken,
        passwordResetTokenExpires: MoreThan(new Date()),
      },
      select: ['id', 'email', 'password'],
    });

    if (!user) {
      throw new BadRequestException('Token is invalid or has expired');
    }

    if (user.password) {
      throw new BadRequestException('Password has already been created');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const passwordChangedAt = new Date(Date.now() - 1000).toISOString();

    await this.userRepo.update(
      { id: user.id },
      {
        password: passwordHash,
        passwordChangedAt,
        passwordResetToken: null,
        passwordResetTokenExpires: null,
      },
    );

    const { token: accessToken, refreshToken } = token(user.id);

    return {
      status: 'success',
      token: accessToken,
      refreshToken,
      message: 'Password Created Successfully!',
    };
  }

  async verifyOtp(otp: number, email: string) {
    //find user with email gotten from req body
    const user = await this.userRepo.findOne({
      where: { email },
      select: ['email', 'id'],
    });

    // Throw error if user not found
    if (!user) {
      throw new NotFoundException(`Can't find user with email: ${email}`);
    }

    const otpUser = await this.userRepo.findOne({
      where: { email },
      select: ['otp', 'otpExpiration'],
    });

    if (!otpUser) {
      throw new NotFoundException('OTP not found. Please request a new one.');
    }

    //compare OTP
    if (otp !== otpUser.otp) throw new UnauthorizedException('Invalid OTP!');

    //Check if OTP has expired
    if (user.otpExpiration && new Date(Date.now()) > user.otpExpiration) {
      throw new ForbiddenException('OTP Expired!');
    }

    const resetPasswordToken = crypto.randomBytes(32).toString('hex');
    const passwordResetToken = crypto
      .createHash('sha256')
      .update(resetPasswordToken)
      .digest('hex');

    const passwordResetTokenExpires = new Date(
      Date.now() + 10 * 60 * 1000,
    ).toISOString();

    await this.userRepo.update(
      { email },
      {
        passwordResetToken,
        passwordResetTokenExpires,
        emailVerified: true,
        otp: null,
      },
    );

    const { token: accessToken, refreshToken } = token(user.id);

    return {
      status: 'success',
      message: 'Otp verification success!',
      token: accessToken,
      resetPasswordToken,
      refreshToken,
    };
  }

  async login(loginData: LoginDto) {
    const { email, password } = loginData;

    // Find User From Database
    const user = await this.userRepo.findOne({
      where: { email },
      select: [
        'id',
        'firstName',
        'lastName',
        'email',
        'isActive',
        'password',
        'emailVerified',
      ],

      // relations: ['companies'],
    });

    if (!user) throw new NotFoundException('Email or password is incorrect');

    if (!user.emailVerified) {
      throw new UnauthorizedException('Your email is no verified!');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Your account is not active!');
    }

    const passwordCheck = await bcrypt.compare(password, user.password);

    // Checks if user does not exists in db and password is incorrect.
    if (!user || !passwordCheck) {
      throw new BadRequestException('Email or password is incorrect');
    }

    const { token: accessToken, refreshToken } = token(user.id);

    const userClone: Omit<typeof user, 'password'> & {
      password?: string;
    } = {
      ...user,
    };

    delete userClone.password;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //@ts-ignore
    delete userClone.companies;

    const { id } = user;

    await this.userRepo.update({ id }, { lastLoggedIn: new Date() });

    return {
      status: 'success',
      token: accessToken,
      refreshToken,
      user: userClone,
    };
  }

  async sendOtp(sendOtpDto: SendOtpDto) {
    const { email } = sendOtpDto;
    // Find User From Database
    const user = await this.userRepo.findOne({
      where: { email },
    });

    // Checks if user does not exists in db and password is incorrect
    if (!user) {
      throw new NotFoundException('No user with that email');
    }

    let otp: number;
    let otpExpiration: string;

    //Check if OTP has expired
    if (
      !user.otp ||
      (user.otpExpiration && new Date(Date.now()) > user.otpExpiration)
    ) {
      //Generate 4 digit OTP and expiry date
      otp = generateRandomNumber(6);
      otpExpiration = new Date(Date.now() + 60 * 2 * 60 * 1000).toISOString();
      await this.userRepo.update({ email }, { otp, otpExpiration });
    } else {
      otp = user.otp;
    }

    await sendEmail({
      subject: 'Your OTP Code',
      text: `Dear ${user.firstName}, Your OTP code is ${otp}. It will expire in 10 minutes.`,
      to: user.email,
    });

    return {
      status: 'success',
      message: 'email sent!',
    };
  }

  async resetPassword(resetToken: string, password: string) {
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // (Get user with resetToken if the token is not yet expired)
    const user = await this.userRepo.findOne({
      where: {
        passwordResetToken: hashedToken,
        passwordResetTokenExpires: MoreThan(new Date()),
      },
      select: ['id', 'email', 'password'],
    });

    if (!user) {
      throw new BadRequestException('Token is invalid or has expired');
    }

    if (!user.password) {
      throw new BadRequestException('Please create your password first');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await this.userRepo.update(
      { email: user.email },
      {
        password: passwordHash,
        passwordResetToken: null,
        passwordResetTokenExpires: null,
      },
    );

    // const options = {
    //   subject: 'Your Password Has Been Changed',
    //   text: `Dear ${user.firstName}, Your password was recently changed`,
    //   to: user.email,
    // };

    // await sendEmail(options);

    const { token: accessToken, refreshToken } = token(user.id);

    return {
      status: 'success',
      token: accessToken,
      refreshToken,
      message: 'Password Reset Successful!',
    };
  }

  async updatePassword(
    currentPassword: string,
    newPassword: string,
    user_id: string,
  ) {
    const user = await this.userRepo.findOne({
      where: { id: user_id },
      select: ['id', 'firstName', 'lastName', 'email', 'password'], // Include the 'password' field
    });

    if (!user) {
      throw new NotFoundException('No user with that id');
    }

    const passwordCheck = await bcrypt.compare(currentPassword, user.password);

    // Checks if the current password matches the one in the database
    if (!passwordCheck) {
      throw new UnauthorizedException('Your current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await this.userRepo.update({ id: user_id }, { password: passwordHash });

    const { token: accessToken, refreshToken } = token(user_id);

    return { status: 'success', token: accessToken, refreshToken, user };
  }

  async refreshToken(refreshTokenInput: string) {
    try {
      const { token: newAccessToken, userId } =
        await refreshAccessToken(refreshTokenInput);

      // Verify user still exists
      const user = await this.userRepo.findOne({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return {
        status: 'success',
        token: newAccessToken,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
        },
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async getSingleUser(id: string, query: Partial<IQuery>) {
    return await factory.getOne(this.userRepo, id, query);
  }

  async findAll(query: Partial<IQuery>) {
    return await factory.getAll(this.userRepo, query);
  }

  async updateRole(userId: string, payload: UpdateRoleDto) {
    return await factory.updateOne(this.userRepo, userId, payload);
  }

  async updateAuthUser(id: string, payload: UpdateUserDto) {
    return await factory.updateOne(this.userRepo, id, payload);
  }
}
