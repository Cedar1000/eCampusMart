import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Request, Response } from 'express';
import { User } from 'src/auth/entities/user.entity';
import { Wallet } from 'src/wallet/entities/wallet.entity';
import { Repository } from 'typeorm';
import { HOUSING_LISTING_FEE } from 'src/fees/fees.constants';

@Injectable()
export class HasHousingUploadBalanceGuard implements CanActivate {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();

    const request = http.getRequest<Request & { user?: User }>();
    const response = http.getResponse<Response & { locals: { user?: User } }>();

    const user = request.user ?? response.locals.user;

    if (!user) throw new UnauthorizedException('You must be logged in');

    const wallet = await this.walletRepo.findOne({
      where: { userId: user.id },
      select: ['id', 'balance'],
    });

    if (!wallet) throw new NotFoundException('User does not have a wallet');

    if (Number(wallet.balance) < HOUSING_LISTING_FEE) {
      throw new ForbiddenException(
        'Insufficient wallet balance to upload housing',
      );
    }

    return true;
  }
}
