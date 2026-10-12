import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type IQuery from 'interfaces/query.Interface';
import * as factory from 'utils/handlerFactory';
import { DataSource, Repository } from 'typeorm';
import { CreateHousingDto } from './dto/create-housing.dto';
import { UpdateHousingDto } from './dto/update-housing.dto';
import { HousingImage } from './entities/housing-image.entity';
import { Housing } from './entities/housing.entity';
import { InjectQueue } from '@nestjs/bullmq';

import { HOUSING_VIEW_JOB, HOUSING_VIEW_QUE } from './housing.constants';
import { Queue } from 'bullmq';
import { HousingViewService } from 'src/housing-view/housing-view.service';
import { Wallet } from 'src/wallet/entities/wallet.entity';
import {
  Transaction,
  TransactionDescription,
  TransactionStatus,
  TransactionType,
} from 'src/transaction/entities/transaction.entity';
import generateReference from 'utils/generateReference';

interface HousingViewJobData {
  userId: string;
  housingId: string;
}

const HOUSING_LISTING_FEE = 500 * 100;

@Injectable()
export class HousingService {
  constructor(
    @InjectRepository(Housing)
    private readonly housingRepo: Repository<Housing>,

    @InjectRepository(HousingImage)
    private readonly housingImageRepo: Repository<HousingImage>,

    @InjectQueue(HOUSING_VIEW_QUE)
    private readonly housingViewingQueue: Queue<HousingViewJobData>,

    private readonly housingViewService: HousingViewService,

    private readonly dataSource: DataSource,
  ) {}

  async create(createHousingDto: CreateHousingDto) {
    const { images, ...housingData } = createHousingDto;

    return await this.dataSource.transaction(async (manager) => {
      const wallet = await manager.findOne(Wallet, {
        where: { userId: housingData.userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!wallet) throw new NotFoundException('User does not have a wallet');

      const beforeBalance = Number(wallet.balance);

      if (beforeBalance < HOUSING_LISTING_FEE) {
        throw new ForbiddenException(
          'Insufficient wallet balance to upload housing',
        );
      }

      const housing = await manager.save(
        Housing,
        manager.create(Housing, housingData),
      );

      if (images?.length) {
        const housingImages = this.buildHousingImages(images, housing.id);
        await manager.save(HousingImage, housingImages);
      }

      const afterBalance = beforeBalance - HOUSING_LISTING_FEE;

      wallet.balance = afterBalance;

      await manager.save(Wallet, wallet);

      await manager.save(
        Transaction,
        manager.create(Transaction, {
          walletId: wallet.id,
          amount: HOUSING_LISTING_FEE,
          type: TransactionType.DEBIT,
          status: TransactionStatus.SUCCESS,
          reference: generateReference(),
          description: TransactionDescription.HOUSING_UPLOAD,
          currency: wallet.currency,
          beforeBalance,
          afterBalance,
          expiresAt: new Date(),
        }),
      );

      if (images) housing.images = images;

      return {
        status: 'success',
        message: 'create successful!',
        data: housing,
      };
    });
  }

  async findAll(query: Partial<IQuery>) {
    return await factory.getAll(this.housingRepo, query);
  }

  async findOne(id: string, query: IQuery, userId: string) {
    const data = await factory.getOne(this.housingRepo, id, query);

    const housing = data.data as Housing;

    if (housing.userId !== userId) {
      await this.housingViewingQueue.add(
        HOUSING_VIEW_JOB,
        { housingId: housing.id, userId },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      );
    }

    return data;
  }

  async update(id: string, updateHousingDto: UpdateHousingDto) {
    const { images, ...housingData } = updateHousingDto;

    const data = await factory.updateOne(this.housingRepo, id, housingData);

    if (images?.length) {
      await this.housingImageRepo.delete({ housingId: id });
      await this.createHousingImages(images, id);
    }

    const housing = data.data as Housing;

    if (images) housing.images = images;

    return { ...data, data: housing };
  }

  async remove(id: string) {
    const housing = await this.housingRepo.findOne({
      where: { id },
      relations: { images: true },
    });

    if (!housing) {
      return await factory.deleteOne(this.housingRepo, id);
    }

    if (housing.images?.length) {
      await this.housingImageRepo.remove(housing.images);
    }

    return await factory.deleteOne(this.housingRepo, id);
  }

  async createHousingImages(images: HousingImage[], housingId: string) {
    const housingImages = this.buildHousingImages(images, housingId);

    return await this.housingImageRepo.save(housingImages);
  }

  private buildHousingImages(images: HousingImage[], housingId: string) {
    return images.map((image, index) => {
      const housingImage = new HousingImage();
      housingImage.housingId = housingId;
      housingImage.url = image.url;
      housingImage.key = image.key;

      housingImage.isCoverImage = index === 0 ? true : false;

      return housingImage;
    });
  }

  async creatAndCalculateViews(data: { housingId: string; userId: string }) {
    console.log({ data });
    const viewCount = await this.housingViewService.create(data);

    await this.housingRepo.update({ id: data.housingId }, { viewCount });
  }
}
