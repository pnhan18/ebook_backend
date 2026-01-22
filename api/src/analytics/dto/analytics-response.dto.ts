import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DateRevenueDto {
    @ApiProperty({ example: '2026-01-15' })
    date: string;

    @ApiProperty({ example: 500000 })
    bookPurchases: number;

    @ApiProperty({ example: 1200000 })
    subscriptions: number;
}

export class DateUsersDto {
    @ApiProperty({ example: '2026-01-15' })
    date: string;

    @ApiProperty({ example: 150 })
    newUsers: number;
}

export class DateActiveUsersDto {
    @ApiProperty({ example: '2026-01-15' })
    date: string;

    @ApiProperty({ example: 587 })
    activeUsers: number;
}

export class DateViewsDto {
    @ApiProperty({ example: '2026-01-15' })
    date: string;

    @ApiProperty({ example: 5000 })
    views: number;
}

export class RevenueBreakdownDto {
    @ApiProperty({ example: 5000000, description: 'Doanh thu từ mua sách lẻ' })
    bookPurchases: number;

    @ApiProperty({ example: 10000000, description: 'Doanh thu từ subscription' })
    subscriptions: number;
}

export class DateRangeDto {
    @ApiProperty({ example: '2026-01-12' })
    from: string;

    @ApiProperty({ example: '2026-01-18' })
    to: string;
}

export class MetricWithGrowthDto {
    @ApiProperty({ example: 15000, description: 'Giá trị kỳ hiện tại' })
    current: number;

    @ApiProperty({ example: 12000, description: 'Giá trị kỳ trước' })
    previous: number;

    @ApiProperty({ example: 25.0, description: 'Tỷ lệ tăng trưởng (%)' })
    growthRate: number;
}

export class AnalyticsResponseDto {
    @ApiProperty({ example: '7d', description: 'Khoảng thời gian thống kê' })
    period: string;

    @ApiProperty({ type: DateRangeDto })
    dateRange: DateRangeDto;

    // Revenue
    @ApiProperty({ type: MetricWithGrowthDto, description: 'Thống kê doanh thu' })
    revenue: MetricWithGrowthDto;

    @ApiProperty({ type: RevenueBreakdownDto, description: 'Phân loại doanh thu (cho pie chart)' })
    revenueBreakdown: RevenueBreakdownDto;

    @ApiProperty({ type: [DateRevenueDto], description: 'Dữ liệu doanh thu theo ngày (cho line chart)' })
    revenueByDate: DateRevenueDto[];

    // Active Users (from Google Analytics)
    @ApiPropertyOptional({ type: MetricWithGrowthDto, description: 'Thống kê người dùng hoạt động (từ Google Analytics)' })
    activeUsers?: MetricWithGrowthDto;

    @ApiPropertyOptional({ type: [DateActiveUsersDto], description: 'Dữ liệu người dùng hoạt động theo ngày' })
    activeUsersByDate?: DateActiveUsersDto[];

    // New Users
    @ApiProperty({ type: MetricWithGrowthDto, description: 'Thống kê người dùng mới' })
    newUsers: MetricWithGrowthDto;

    @ApiProperty({ type: [DateUsersDto], description: 'Dữ liệu người dùng mới theo ngày' })
    newUsersByDate: DateUsersDto[];

    // Views
    @ApiProperty({ type: MetricWithGrowthDto, description: 'Thống kê lượt xem' })
    views: MetricWithGrowthDto;

    @ApiProperty({ type: [DateViewsDto], description: 'Dữ liệu lượt xem theo ngày' })
    viewsByDate: DateViewsDto[];
}


