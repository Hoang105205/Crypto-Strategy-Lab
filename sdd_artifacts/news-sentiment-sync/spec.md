# Feature Specification: news-sentiment-sync

**Feature**: `news-sentiment-sync`
**Created**: 2026-08-18
**Status**: Draft
**Input**: User description: "Tại sao chạy NewsSentimentStrategy lại không có kết quả nhỉ? Bạn hãy thử kiểm tra NewsSentimentStrategy và các file strategy khác của tôi xem có gì khác nhau. Và có thể đồng bộ file NewsSentimentStrategy với các file của tôi được không? Tôi nghĩ là việc sửa này nên dùng /hoang-sdd-on để tạo .intent và làm từ từ, kiểm tra xem có ảnh hưởng tới bất kỳ component nào khác không."

## User Scenarios & Testing

### User Story 1 - Run Backtest with NewsSentimentStrategy (Priority: P1)

Là một người dùng, tôi muốn chọn `NewsSentimentStrategy` trên giao diện, điền các tham số và chạy backtest để hệ thống đánh giá lợi nhuận từ chiến lược Sentiment.

**Why this priority**: Hiện tại, chiến lược này luôn sinh ra lệnh HOLD do lỗi phần lõi kiến trúc chỉ hỗ trợ tính toán đồng bộ, làm chiến lược bị vô hiệu hóa.
**Independent Test**: Gửi REST request hoặc qua UI tạo Backtest Job với loại strategy là `Sentiment`. Nhận kết quả có các giao dịch (Trades) và chỉ số hợp lệ thay vì mảng Trade rỗng.

**Acceptance Scenarios**:
1. **Given** một strategy version Sentiment có sẵn, **When** submit backtest, **Then** IBacktester có thể dùng `analyzeAsync` gọi API tin tức để sinh ra các Signal BUY/SELL thay vì chỉ HOLD.
2. **Given** một chiến lược kỹ thuật thuần túy (e.g. MACD), **When** submit backtest, **Then** hệ thống vẫn chạy đồng bộ bình thường và không bị lỗi.

---

### Edge Cases
- What happens when `NewsService` times out or fails during backtest? (Hệ thống backtester nên handle lỗi và fallback về HOLD hoặc đánh dấu fail).
- How does the system handle Composite strategies containing NewsSentimentStrategy? (Tương tự, `ICombiner` hoặc logic của Composite sẽ cần gọi async nếu child là async, nhưng MVP cho Composite có thể chưa hỗ trợ, cần cẩn trọng).

## Requirements

### Functional Requirements
- **FR-001**: Hệ thống MUST hỗ trợ khai báo thêm hàm `analyzeAsync?(candles: Candle[]): Promise<Signal>` trong `IStrategy` interface.
- **FR-002**: Interface `IBacktester.run()` MUST được đổi thành hàm trả về `Promise<Trade[]>`.
- **FR-003**: `BacktesterService` MUST tự động phát hiện nếu strategy có hàm `analyzeAsync` thì sẽ dùng nó; nếu không, fallback xuống hàm `analyze` cũ.

### Key Entities
- **IStrategy**: Hợp đồng lõi cho mọi chiến lược. Bổ sung tuỳ chọn asynchoronous.
- **IBacktester**: Động cơ Backtest, cần nâng cấp lên Engine Asynchronous.
- **NewsSentimentStrategy**: Chiến lược thực thi logic sentiment bằng hàm `analyzeAsync`.

## Success Criteria
- **SC-001**: Người dùng chạy backtest NewsSentimentStrategy ra được mảng Trade có độ dài > 0 (nếu có tín hiệu thỏa mãn Threshold).
- **SC-002**: Toàn bộ unit test cũ (MACD, RSI, Backtester, SearchLoop) đều Pass (có thể cần gắn thêm `await` vào một số test case).

## Assumptions
- Giả định rằng `NewsService` có đủ hiệu năng để trả về kết quả async trong vòng lặp nến của quá trình Backtest, hoặc Backtester chỉ gọi sentiment theo từng khung thời gian phù hợp để tránh bottleneck.
- `CompositeStrategy` hiện tại không yêu cầu phải hỗ trợ `analyzeAsync` cho child. Nếu cần, nó sẽ được xử lý ở ticket khác.

## KB Cross-References
- **Modules affected**: `Strategy Engine` (backtester, strategies interfaces), `Event Infrastructure` (Queue Worker).
- **E2E flows affected**: Flow 1 (User Backtest Request).
- **Architecture constraints**: Cần tuân thủ quy tắc Loose Coupling giữa `Strategy Engine` và `News` module.
- **Constitution gates**: Giữ nguyên Code Constitution, chỉ nâng cấp Contract (trong `kb/contracts/strategy.yaml`).
- **Glossary terms**: Backtest, Strategy, Async execution.
