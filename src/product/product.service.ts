import { Injectable } from '@nestjs/common';

import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Product } from './entities/product.entity';

import * as factory from 'utils/handlerFactory';
import IQuery from 'interfaces/query.Interface';
import { ProductImage } from './entities/product-image.entity';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    @InjectRepository(ProductImage)
    private readonly productImageRepo: Repository<ProductImage>,
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

  async findAll(query: Partial<IQuery>) {
    return await factory.getAll(this.productRepo, query);
  }

  async findOne(id: string, query: Partial<IQuery>) {
    return await factory.getOne(this.productRepo, id, query);
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    return await factory.updateOne(this.productRepo, id, updateProductDto);
  }

  async remove(id: string) {
    return await factory.deleteOne(this.productRepo, id);
  }

  async createProductImage(images: ProductImage[], productId: string) {
    const productImages = images.map((image) => {
      const productImage = new ProductImage();
      productImage.productId = productId;
      productImage.url = image.url;
      productImage.key = image.key;

      return productImage;
    });

    return await this.productImageRepo.save(productImages);
  }
}
