import { Injectable } from '@nestjs/common';
import type { IStrategy } from '@crypto-strategy-lab/shared';
import { RandomGenerator } from './random.generator';
import { DomainGuidedGenerator } from './domain-guided.generator';

export type SearchGeneratorType = 'RANDOM' | 'DOMAIN_GUIDED';

@Injectable()
export class SearchEngine {
  constructor(
    private readonly randomGenerator: RandomGenerator,
    private readonly domainGuidedGenerator: DomainGuidedGenerator,
  ) {}

  /**
   * Sinh các chiến lược ứng viên dựa trên thuật toán được yêu cầu
   * @param count Số lượng ứng viên cần sinh
   * @param type Thuật toán sinh ('RANDOM' hoặc 'DOMAIN_GUIDED')
   * @returns Mảng các chiến lược (đã được khởi tạo)
   * @throws {Error} Nếu type không được hỗ trợ
   */
  generateCandidates(count: number, type: SearchGeneratorType): IStrategy[] {
    if (count <= 0) {
      return [];
    }

    switch (type) {
      case 'RANDOM':
        return this.randomGenerator.generate(count);
      case 'DOMAIN_GUIDED':
        return this.domainGuidedGenerator.generate(count);
      default:
        throw new Error(`Generator type not supported: ${type}`);
    }
  }
}
