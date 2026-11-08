import { Controller, Get } from '@nestjs/common';

import { HouseType } from './enums/house-type.enum';

// "two-bedroom" → "Two bedroom"
const label = (type: string) =>
  type.charAt(0).toUpperCase() + type.slice(1).replace(/-/g, ' ');

// The house types POST /housings accepts, so the app's picker can follow the
// server instead of a list built into the app
@Controller('house-types')
export class HouseTypeController {
  @Get()
  findAll() {
    const data = Object.values(HouseType).map((value) => ({
      value,
      label: label(value),
    }));

    return { status: 'success', total: data.length, data };
  }
}
