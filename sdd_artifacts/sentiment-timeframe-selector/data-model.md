# Data Model: Aggregate Mood Score Timeframe Selector

## Data Transfer Objects (DTOs) & Interfaces

### AggregateSentimentDTO
| Field | Type | Constraints | Description |
|---|---|---|---|
| `score` | number | -1.0 đến 1.0 | Điểm tâm lý trung bình VADER ML (-1.0: rất tiêu cực, +1.0: rất tích cực) |
| `label` | string | `POSITIVE` \| `NEGATIVE` \| `NEUTRAL` | Nhãn xếp loại tâm lý gộp |
| `articleCount` | number | >= 0 | Số lượng bài báo được đưa vào tính toán trong timeframe |
| `updatedAt` | string | ISO8601 | Thời điểm cập nhật dữ liệu |

### TimeframeOption Type
```typescript
export type TimeframeOption = '1h' | '24h' | '7d';
```

## Component State Schema (React Frontend)

```typescript
interface NewsFeedState {
  selectedTimeframe: TimeframeOption; // '1h' | '24h' | '7d', default: '24h'
  aggregate: AggregateSentimentDTO | null;
  // ... existing news states
}
```
