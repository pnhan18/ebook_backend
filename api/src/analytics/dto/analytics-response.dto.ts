import { ApiProperty } from '@nestjs/swagger';

export class DateRevenueDto {
    @ApiProperty({ example: '2026-01-15' })
    date: string;

    @ApiProperty({ example: 500000 })
    bookPurchases: number;

    @ApiProperty({ example: 1200000 })
    subscriptions: number;
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

export class AnalyticsResponseDto {
    @ApiProperty({ example: '7d', description: 'Khoảng thời gian thống kê' })
    period: string;

    @ApiProperty({ type: DateRangeDto })
    dateRange: DateRangeDto;

    @ApiProperty({ example: 15000000, description: 'Tổng doanh thu kỳ hiện tại' })
    current: number;

    @ApiProperty({ example: 12000000, description: 'Tổng doanh thu kỳ trước' })
    previous: number;

    @ApiProperty({ example: 25.0, description: 'Tỷ lệ tăng trưởng (%)' })
    growthRate: number;

    @ApiProperty({ type: RevenueBreakdownDto, description: 'Phân loại doanh thu (cho pie chart)' })
    breakdown: RevenueBreakdownDto;

    @ApiProperty({ type: [DateRevenueDto], description: 'Dữ liệu theo ngày (cho line chart)' })
    byDate: DateRevenueDto[];
}
