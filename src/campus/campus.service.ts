import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campus } from './entities/campus.entity';
import * as factory from 'utils/handlerFactory';
import IQuery from 'interfaces/query.Interface';

@Injectable()
export class CampusService {
  constructor(
    @InjectRepository(Campus)
    private readonly campusRepo: Repository<Campus>,
  ) {}

  async findAllCampuses(query: Partial<IQuery>) {
    return await factory.getAll(this.campusRepo, query);
  }

  async findCampusById(id: string, query: Partial<IQuery>) {
    return await factory.getOne(this.campusRepo, id, query);
  }

  async deleteCampus(id: string) {
    return await factory.deleteOne(this.campusRepo, id);
  }
}
