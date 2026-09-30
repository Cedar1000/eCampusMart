import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type IQuery from 'interfaces/query.Interface';
import * as factory from 'utils/handlerFactory';
import { Repository } from 'typeorm';
import { CreateHousingDto } from './dto/create-housing.dto';
import { UpdateHousingDto } from './dto/update-housing.dto';
import { HousingImage } from './entities/housing-image.entity';
import { Housing } from './entities/housing.entity';

@Injectable()
export class HousingService {
  constructor(
    @InjectRepository(Housing)
    private readonly housingRepo: Repository<Housing>,
    @InjectRepository(HousingImage)
    private readonly housingImageRepo: Repository<HousingImage>,
  ) {}

  async create(createHousingDto: CreateHousingDto) {
    const { images, ...housingData } = createHousingDto;
    const data = await factory.createOne(this.housingRepo, housingData);
    const housing = data.data as Housing;

    if (images?.length) {
      await this.createHousingImages(images, housing.id);
    }

    if (images) housing.images = images;

    return { ...data, data: housing };
  }

  async findAll(query: Partial<IQuery>) {
    return await factory.getAll(this.housingRepo, query);
  }

  async findOne(id: string, query: Partial<IQuery>) {
    return await factory.getOne(this.housingRepo, id, query);
  }

  async update(id: string, updateHousingDto: UpdateHousingDto) {
    return await factory.updateOne(this.housingRepo, id, updateHousingDto);
  }

  async remove(id: string) {
    return await factory.deleteOne(this.housingRepo, id);
  }

  async createHousingImages(images: HousingImage[], housingId: string) {
    const housingImages = images.map((image) => {
      const housingImage = new HousingImage();
      housingImage.housingId = housingId;
      housingImage.url = image.url;
      housingImage.key = image.key;

      return housingImage;
    });

    return await this.housingImageRepo.save(housingImages);
  }
}
