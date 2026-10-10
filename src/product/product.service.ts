import { Injectable } from '@nestjs/common';

import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Product } from './entities/product.entity';

import * as factory from 'utils/handlerFactory';
import IQuery from 'interfaces/query.Interface';
import { ProductImage } from './entities/product-image.entity';
import { ProductViewService } from 'src/product-view/product-view.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  PRODUCT_VIEWING_JOB,
  PRODUCT_VIEWING_QUEUE,
} from './product.constants';

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

    @InjectQueue(PRODUCT_VIEWING_QUEUE)
    private readonly productViewingQueue: Queue<ProductViewJobData>,
  ) {}

  async create(createProductDto: CreateProductDto) {
    const { images, ...productData } = createProductDto;

    const data = await factory.createOne(this.productRepo, productData);

    const product = data.data as Product;

    if (images?.length) {
      await this.createProductImage(images, product.id);
    }

    if (images) product.images = images;

    return { ...data, data: product };
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
      await this.productImageRepo.delete({ productId: id });
      await this.createProductImage(images, id);
    }

    return data;
  }

  async remove(id: string) {
    return await factory.deleteOne(this.productRepo, id);
  }

  async createProductImage(images: ProductImage[], productId: string) {
    const productImages = images.map((image, index: number) => {
      const productImage = new ProductImage();
      productImage.productId = productId;
      productImage.url = image.url;
      productImage.key = image.key;

      productImage.isCoverImage = index === 0 ? true : false;

      return productImage;
    });

    return await this.productImageRepo.save(productImages);
  }

  async creatAndCalculateViews(data: { productId: string; userId: string }) {
    const viewCount = await this.productViewService.create(data);

    console.log({ viewCount });

    await this.update(data.productId, { viewCount });
  }
}
