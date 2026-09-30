import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type IQuery from 'interfaces/query.Interface';
import * as factory from 'utils/handlerFactory';
import { Repository } from 'typeorm';
import { CreateCampusLocationDto } from './dto/create-campus-location.dto';
import { UpdateCampusLocationDto } from './dto/update-campus-location.dto';
import { CampusLocation } from './entities/campus-location.entity';

@Injectable()
export class CampusLocationService {
  constructor(
    @InjectRepository(CampusLocation)
    private readonly campusLocationRepo: Repository<CampusLocation>,
  ) {}

  async create(createCampusLocationDto: CreateCampusLocationDto) {
    return await factory.createOne(
      this.campusLocationRepo,
      createCampusLocationDto,
    );
  }

  async findAll(query: Partial<IQuery>) {
    return await factory.getAll(this.campusLocationRepo, query);
  }

  async findOne(id: string, query: Partial<IQuery>) {
    return await factory.getOne(this.campusLocationRepo, id, query);
  }

  async update(id: string, updateCampusLocationDto: UpdateCampusLocationDto) {
    return await factory.updateOne(
      this.campusLocationRepo,
      id,
      updateCampusLocationDto,
    );
  }

  async remove(id: string) {
    return await factory.deleteOne(this.campusLocationRepo, id);
  }
}
