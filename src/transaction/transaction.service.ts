import { Injectable } from '@nestjs/common';
import { Transaction } from './entities/transaction.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

import type IQuery from 'interfaces/query.Interface';
import * as factory from 'utils/handlerFactory';

@Injectable()
export class TransactionService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
  ) {}

  async findAll(query: Partial<IQuery>) {
    return await factory.getAll(this.transactionRepo, query);
  }

  async findOne(id: string, query: Partial<IQuery>) {
    return await factory.getOne(this.transactionRepo, id, query);
  }
}
