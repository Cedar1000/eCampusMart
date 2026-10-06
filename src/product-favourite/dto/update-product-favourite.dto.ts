import { PartialType } from '@nestjs/mapped-types';
import { CreateProductFavouriteDto } from './create-product-favourite.dto';

export class UpdateProductFavouriteDto extends PartialType(CreateProductFavouriteDto) {}
