import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ListingCleanupService } from 'src/common/listing-cleanup/listing-cleanup.service';

import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { Product } from './entities/product.entity';

import * as factory from 'utils/handlerFactory';
import IQuery from 'interfaces/query.Interface';
import { ProductImage } from './entities/product-image.entity';
import { ProductViewService } from 'src/product-view/product-view.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PRODUCT_QUE, PRODUCT_VIEWING_JOB } from './product.constants';
import { Wallet } from 'src/wallet/entities/wallet.entity';
import {
  Transaction,
  TransactionDescription,
  TransactionStatus,
  TransactionType,
} from 'src/transaction/entities/transaction.entity';
import generateReference from 'utils/generateReference';

interface ProductViewJobData {
  userId: string;
  productId: string;
}

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    @InjectRepository(ProductImage)
    private readonly productImageRepo: Repository<ProductImage>,

    private readonly productViewService: ProductViewService,

    @InjectQueue(PRODUCT_QUE)
    private readonly productViewingQueue: Queue<ProductViewJobData>,

    private readonly dataSource: DataSource,

    private readonly listingCleanupService: ListingCleanupService,
  ) {}

  async create(createProductDto: CreateProductDto) {
    const { images, ...productData } = createProductDto;
    const uploadAmount = this.getUploadAmount(productData.quantity);

    return await this.dataSource.transaction(async (manager) => {
      const wallet = await manager.findOne(Wallet, {
        where: { userId: productData.userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!wallet) throw new NotFoundException('User does not have a wallet');

      const beforeBalance = Number(wallet.balance);

      if (beforeBalance < uploadAmount) {
        throw new ForbiddenException(
          'Insufficient wallet balance to upload product',
        );
      }

      const product = await manager.save(
        Product,
        manager.create(Product, productData),
      );

      if (images?.length) {
        const productImages = this.buildProductImages(images, product.id);
        await manager.save(ProductImage, productImages);
      }

      const afterBalance = beforeBalance - uploadAmount;

      wallet.balance = afterBalance;

      await manager.save(Wallet, wallet);

      await manager.save(
        Transaction,
        manager.create(Transaction, {
          walletId: wallet.id,
          amount: uploadAmount,
          type: TransactionType.DEBIT,
          status: TransactionStatus.SUCCESS,
          reference: generateReference(),
          description: TransactionDescription.PRODUCT_UPLOAD,
          currency: wallet.currency,
          beforeBalance,
          afterBalance,
          expiresAt: new Date(),
        }),
      );

      if (images) product.images = images;

      return {
        status: 'success',
        message: 'create successful!',
        data: product,
      };
    });
  }

  async findAll(query: IQuery) {
    return await factory.getAll(this.productRepo, query);
  }

  async findOne(id: string, query: IQuery, userId: string) {
    const data = await factory.getOne(this.productRepo, id, query);

    const product = data.data as Product;

    if (product.userId !== userId) {
      await this.productViewingQueue.add(
        PRODUCT_VIEWING_JOB,
        { productId: product.id, userId },
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

  async update(id: string, updateProductDto: UpdateProductDto) {
    const { images, ...productData } = updateProductDto;

    const data = await factory.updateOne(this.productRepo, id, productData);

    if (images?.length) {
      const previous = await this.productImageRepo.find({
        where: { productId: id },
        select: ['key'],
      });

      await this.productImageRepo.delete({ productId: id });
      await this.createProductImage(images, id);
      await this.listingCleanupService.deleteReplacedImages(
        previous.map(({ key }) => key),
        images,
      );
    }

    return data;
  }

  async remove(id: string) {
    const deleted = await this.listingCleanupService.deleteListings('product', {
      id,
    });

    if (!deleted) throw new NotFoundException('No resource with that ID');

    return { status: 'success', message: 'delete successful!' };
  }

  async createProductImage(images: ProductImage[], productId: string) {
    const productImages = this.buildProductImages(images, productId);

    return await this.productImageRepo.save(productImages);
  }

  private buildProductImages(images: ProductImage[], productId: string) {
    return images.map((image, index: number) => {
      const productImage = new ProductImage();
      productImage.productId = productId;
      productImage.url = image.url;
      productImage.key = image.key;

      productImage.isCoverImage = index === 0 ? true : false;

      return productImage;
    });
  }

  private getUploadAmount(quantity = 1) {
    const productQuantity = Number(quantity);

    if (!Number.isFinite(productQuantity) || productQuantity <= 0) {
      throw new BadRequestException('Product quantity must be greater than 0');
    }

    return productQuantity * 10000;
  }

  async creatAndCalculateViews(data: { productId: string; userId: string }) {
    const viewCount = await this.productViewService.create(data);

    console.log({ viewCount });

    await this.update(data.productId, { viewCount });
  }
}
