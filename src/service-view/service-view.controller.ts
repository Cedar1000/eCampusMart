import { Controller, Post, Body } from '@nestjs/common';
import { ServiceViewService } from './service-view.service';
import { CreateServiceViewDto } from './dto/create-service-view.dto';
import { CurrentUser } from 'src/auth/decorators/get-current-user.decorator';
import { User } from 'src/auth/entities/user.entity';

@Controller('service-views')
export class ServiceViewController {
  constructor(private readonly serviceViewService: ServiceViewService) {}

  @Post()
  create(@Body() dto: CreateServiceViewDto, @CurrentUser() user: User) {
    return this.serviceViewService.recordView(dto.serviceId, user.id);
  }
}
