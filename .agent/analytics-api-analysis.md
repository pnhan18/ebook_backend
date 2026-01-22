# Phân tích API cho Dashboard Analytics

## 📊 Tổng quan Dashboard

Dashboard "Tổng quan phân tích" bao gồm các thành phần:

### 1. Bộ lọc thời gian
- 7 ngày qua
- 30 ngày qua  
- 3 tháng qua

### 2. Thẻ thống kê tổng quan (4 Cards)

| Card | Dữ liệu | So sánh |
|------|---------|---------|
| **Doanh thu** | 397,202,571 VND | ↑11.1% so với 30 ngày trước |
| **Người dùng hoạt động** | 587 | ↓2.0% so với 30 ngày trước |
| **Lượt xem** | 149,671 | ↓4.8% so với 30 ngày trước |
| **Người dùng mới** | 4155 | ↑5.3% so với 30 ngày trước |

### 3. Biểu đồ hiệu suất (Line/Area Chart)
- Toggle: Người dùng hoạt động | Lượt xem | Doanh thu
- Dữ liệu theo ngày trong khoảng thời gian đã chọn

### 4. Biểu đồ nguồn doanh thu (Pie Chart)
- Tổng: 460.0M
- Bán sách: 70%
- Gói hội viên: 30%

---

## 🔍 Phân tích API hiện có

### API đã có: `GET /admin/analytics`

**Endpoint hiện tại trả về:**
```typescript
{
  period: '7d' | '30d' | '90d',
  dateRange: { from: string, to: string },
  current: number,        // Tổng doanh thu kỳ hiện tại
  previous: number,       // Tổng doanh thu kỳ trước
  growthRate: number,     // Tỷ lệ tăng trưởng (%)
  breakdown: {
    bookPurchases: number,    // Doanh thu bán sách
    subscriptions: number     // Doanh thu subscription
  },
  byDate: [{               // Data cho line chart
    date: string,
    bookPurchases: number,
    subscriptions: number
  }]
}
```

**✅ Đã hỗ trợ:**
- Doanh thu (Card 1)
- Biểu đồ doanh thu theo ngày
- Pie chart nguồn doanh thu

---

## 🚀 API cần bổ sung

### 1. Mở rộng API `/admin/analytics` hiện tại

**Dữ liệu cần thêm vào response:**

```typescript
interface AnalyticsResponseDto {
  // ... existing fields ...
  
  // NEW: Card thống kê users
  users: {
    activeUsers: {
      current: number,
      previous: number,
      growthRate: number
    },
    newUsers: {
      current: number,
      previous: number,
      growthRate: number
    }
  },
  
  // NEW: Card thống kê views
  views: {
    current: number,
    previous: number,
    growthRate: number
  },
  
  // NEW: Data theo ngày cho toggle charts
  byDateUsers: [{
    date: string,
    activeUsers: number,
    newUsers: number
  }],
  
  byDateViews: [{
    date: string,
    views: number
  }]
}
```

---

## 📋 Chi tiết Implementation

### Bảng dữ liệu cần query

| Metric | Table | Điều kiện |
|--------|-------|-----------|
| Người dùng mới | `users` | `createdAt` trong khoảng thời gian |
| Người dùng hoạt động | `book_views` | `DISTINCT userId` có activity trong kỳ |
| Lượt xem | `book_views` | `viewedAt` trong khoảng thời gian |

### Repository methods cần thêm

```typescript
interface IAnalyticsRepository {
  // Existing
  getBookPurchasesRevenue(from: Date, to: Date): Promise<number>;
  getSubscriptionsRevenue(from: Date, to: Date): Promise<number>;
  getRevenueByDate(from: Date, to: Date): Promise<DateRevenue[]>;
  
  // NEW - Users
  getNewUsersCount(from: Date, to: Date): Promise<number>;
  getActiveUsersCount(from: Date, to: Date): Promise<number>;
  getUsersByDate(from: Date, to: Date): Promise<DateUsers[]>;
  
  // NEW - Views
  getViewsCount(from: Date, to: Date): Promise<number>;
  getViewsByDate(from: Date, to: Date): Promise<DateViews[]>;
}
```

---

## 📱 Frontend API Call

```typescript
// Single API call với tất cả data cần thiết
GET /admin/analytics?period=30d

// Response có đầy đủ data cho:
// - 4 summary cards với growth rate
// - Toggle chart data (revenue/users/views)
// - Pie chart breakdown
```

---

## ⚡ Ưu tiên Implementation

### Ưu tiên cao (cần cho MVP):
1. ✅ Doanh thu + growth rate (đã có)
2. ✅ Breakdown nguồn doanh thu (đã có)
3. ✅ Chart doanh thu theo ngày (đã có)
4. ⏳ **Người dùng mới + growth rate**
5. ⏳ **Lượt xem + growth rate**
6. ⏳ **Người dùng hoạt động + growth rate**

### Ưu tiên trung bình:
7. ⏳ Chart người dùng theo ngày
8. ⏳ Chart lượt xem theo ngày

---

## 🎯 Kết luận

**Chỉ cần MỞ RỘNG API `/admin/analytics` hiện tại**, thêm các trường:

1. `users.activeUsers` - Số user hoạt động + growth
2. `users.newUsers` - Số user mới + growth  
3. `views` - Số lượt xem + growth
4. `byDateUsers` - Data users theo ngày (cho toggle chart)
5. `byDateViews` - Data views theo ngày (cho toggle chart)

**Không cần tạo API mới** - một API duy nhất trả về tất cả data cho toàn bộ dashboard.
