import { ValidationPipe } from '@nestjs/common';

import { CreateProductDto } from './create-product.dto';
import { UpdateProductDto } from './update-product.dto';

// Same options as the global pipe in main.ts
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

const validate = (metatype: new () => object, value: object) =>
  pipe.transform(value, { type: 'body', metatype });

describe('isNegotiable', () => {
  const product = {
    name: 'iPhone 12',
    description: 'Clean',
    categoryId: 'phones',
    price: 75000,
    images: [],
  };

  it('is accepted when creating a product', async () => {
    await expect(
      validate(CreateProductDto, { ...product, isNegotiable: false }),
    ).resolves.toMatchObject({ isNegotiable: false });
  });

  // Left undefined, so the column's default (true) applies
  it('is optional', async () => {
    const dto = (await validate(CreateProductDto, product)) as CreateProductDto;

    expect(dto.isNegotiable).toBeUndefined();
  });

  it('is accepted when updating a product', async () => {
    await expect(
      validate(UpdateProductDto, { isNegotiable: true }),
    ).resolves.toMatchObject({ isNegotiable: true });
  });

  it('must be a boolean', async () => {
    await expect(
      validate(UpdateProductDto, { isNegotiable: 'no' }),
    ).rejects.toThrow();
  });
});
