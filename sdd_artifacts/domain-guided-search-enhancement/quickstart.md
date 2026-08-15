# Quickstart: domain-guided-search-enhancement

## Prerequisites
- Đã start Backend NestJS.
- Đã chạy News Module (để có NewsSentimentStrategy).

## Validation Scenarios

### Scenario 1: Sinh chiến lược bằng Domain Guided
1. Gọi API `GET /api/strategies/search?count=10&type=DOMAIN_GUIDED` (hoặc test trực tiếp trên UI).
2. ✅ Expected: Hệ thống trả về 10 chiến lược. Mỗi chiến lược Composite sẽ chứa tên các Domain đã kết hợp (VD: `DomainComposite_Trend_Momentum_Information_1`).

### Scenario 2: Kiểm tra thư viện chiến lược
1. Gọi API `GET /api/strategies`
2. ✅ Expected: Trả về danh sách chứa MACD, Stochastic, ATR bên cạnh các chiến lược cũ.
