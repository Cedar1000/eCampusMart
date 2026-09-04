import { PartialType } from '@nestjs/mapped-types';
import { CreateProductStoreDto } from './create-product-store.dto';

export class UpdateProductStoreDto extends PartialType(CreateProductStoreDto) {}
