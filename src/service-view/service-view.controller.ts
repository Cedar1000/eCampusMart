import { Controller, Post, Body } from '@nestjs/common';
import { ServiceViewService } from './service-view.service';
import { CreateServiceViewDto } from './dto/create-service-view.dto';

@Controller('service-view')
export class ServiceViewController {
  constructor(private readonly serviceViewService: ServiceViewService) {}

  @Post()
  create(@Body() createServiceViewDto: CreateServiceViewDto) {
    return this.serviceViewService.create(createServiceViewDto);
  }
}
