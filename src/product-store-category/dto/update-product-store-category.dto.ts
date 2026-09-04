import { PartialType } from '@nestjs/mapped-types';
import { CreateProductStoreCategoryDto } from './create-product-store-category.dto';

export class UpdateProductStoreCategoryDto extends PartialType(CreateProductStoreCategoryDto) {}
