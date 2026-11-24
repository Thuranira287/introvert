import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminService } from './admin.service';
import { CreateReportDto } from './dto';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly adminService: AdminService) {}

  @Post()
  create(@CurrentUser('id') reporterId: string, @Body() dto: CreateReportDto) {
    return this.adminService.createReport(reporterId, dto);
  }
}
