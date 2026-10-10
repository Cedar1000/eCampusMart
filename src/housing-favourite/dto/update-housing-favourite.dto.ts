import { PartialType } from '@nestjs/mapped-types';
import { CreateHousingFavouriteDto } from './create-housing-favourite.dto';

export class UpdateHousingFavouriteDto extends PartialType(CreateHousingFavouriteDto) {}
