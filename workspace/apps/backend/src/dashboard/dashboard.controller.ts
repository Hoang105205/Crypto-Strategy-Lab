import { Controller, Get, UseFilters, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/supabase-jwt.guard';
import { InfrastructureErrorFilter } from '../shared/infrastructure-error.filter';
import { DashboardService, type DashboardSummary } from './dashboard.service';

@Controller('api/dashboard')
@UseFilters(InfrastructureErrorFilter)
@UseGuards(SupabaseJwtGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  getSummary(
    @CurrentUser() viewerUserId: string | null = null,
  ): Promise<DashboardSummary> {
    return this.dashboard.getSummary(viewerUserId);
  }
}
