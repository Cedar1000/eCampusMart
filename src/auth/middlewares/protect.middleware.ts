/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import { User } from 'src/auth/entities/user.entity';
import { Repository } from 'typeorm';

import { Request, Response, NextFunction } from 'express';
import { promisify } from 'util';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class ProtectMiddleware implements NestMiddleware {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
  ) {}

  private getToken(req: Request) {
    const authHeader = req.headers.authorization;
    const authHeaderExists = !!authHeader;
    if (!authHeaderExists) return;

    const authHeaderStartsCorrectlyFormatted = authHeader.startsWith('Bearer');
    if (!authHeaderStartsCorrectlyFormatted) return;

    const token = authHeader.split(' ')[1];
    if (!token) return;

    return token;
  }

  async use(req: Request, res: Response, next: NextFunction) {
    const token = this.getToken(req);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      // 2) Verify token
      const decoded: any = await promisify<string, string>(jwt.verify)(
        token,
        // @ts-expect-error
        process.env.JWT_SECRET,
      );

      const now = Math.floor(Date.now() / 1000); // current time in seconds
      const isExpired = now > decoded.exp;

      const currentUser = await this.userRepository.findOne({
        where: { id: decoded.id },
      });

      if (!currentUser || isExpired) {
        throw new UnauthorizedException('Invalid or expired token');
      }

      // TODO: Check if user changed password after json web token was issued
      res.locals.user = currentUser;
      next();
    } catch (error) {
      // Handle JWT verification errors
      throw new UnauthorizedException(error.message || 'Invalid token');
    }
  }
}
