import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto, AnalyticsResponseDto } from './dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles, ApiSuccessResponse, ApiUnauthorizedResponse, ApiForbiddenResponse } from '../common/decorators';

@ApiTags('Admin Analytics')
@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@ApiBearerAuth('JWT-auth')
export class AnalyticsController {
    constructor(private readonly analyticsService: AnalyticsService) { }

    @Get()
    @ApiOperation({
        summary: 'Lấy thống kê tổng quan',
        description: 'Trả về thống kê người dùng mới, lượt xem, và doanh thu theo khoảng thời gian',
    })
    @ApiSuccessResponse(AnalyticsResponseDto)
    @ApiUnauthorizedResponse()
    @ApiForbiddenResponse()
    getAnalytics(@Query() query: AnalyticsQueryDto): Promise<AnalyticsResponseDto> {
        return this.analyticsService.getAnalytics(query);
    }
}
