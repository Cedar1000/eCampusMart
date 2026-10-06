import { PartialType } from '@nestjs/mapped-types';
import { CreateServiceFavouriteDto } from './create-service-favourite.dto';

export class UpdateServiceFavouriteDto extends PartialType(
  CreateServiceFavouriteDto,
) {}
