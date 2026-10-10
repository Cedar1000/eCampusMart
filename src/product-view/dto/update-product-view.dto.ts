import { PartialType } from '@nestjs/mapped-types';
import { CreateProductViewDto } from './create-product-view.dto';

export class UpdateProductViewDto extends PartialType(CreateProductViewDto) {}
