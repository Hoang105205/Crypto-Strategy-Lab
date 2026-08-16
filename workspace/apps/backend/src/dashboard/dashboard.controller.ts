import { Controller, Get, UseFilters } from '@nestjs/common';
import { InfrastructureErrorFilter } from '../shared/infrastructure-error.filter';
import { DashboardService, type DashboardSummary } from './dashboard.service';

@Controller('api/dashboard')
@UseFilters(InfrastructureErrorFilter)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  getSummary(): Promise<DashboardSummary> {
    return this.dashboard.getSummary();
  }
}
