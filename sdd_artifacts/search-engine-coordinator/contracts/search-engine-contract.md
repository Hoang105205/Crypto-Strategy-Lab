# Contract: SearchEngine API (Internal Service)

*Lưu ý: Đây là interface nội bộ của NestJS Module, không phải REST API.*

## Interface

### `ISearchEngine`
```typescript
import { IStrategy } from '@crypto-strategy-lab/shared';

export type SearchGeneratorType = 'RANDOM' | 'DOMAIN_GUIDED';

export interface ISearchEngine {
  /**
   * Sinh các chiến lược ứng viên dựa trên thuật toán được yêu cầu
   * @param count Số lượng ứng viên cần sinh
   * @param type Thuật toán sinh ('RANDOM' hoặc 'DOMAIN_GUIDED')
   * @returns Mảng các chiến lược (đã được khởi tạo)
   */
  generateCandidates(count: number, type: SearchGeneratorType): IStrategy[];
}
```

## Events
N/A - Không trực tiếp phát hay nhận sự kiện qua EventBus (Phần này do `LoopController` lo).
