import { Injectable, Inject } from '@nestjs/common';
import type { IStrategyGenerator, IStrategy } from '@crypto-strategy-lab/shared';
import { StrategyGeneratorType } from '@crypto-strategy-lab/shared';
import { ISTRATEGY_GENERATOR } from '../../shared/tokens';

export interface ISearchEngine {
  generateCandidates(count: number, type: StrategyGeneratorType): IStrategy[];
}

@Injectable()
export class SearchEngine implements ISearchEngine {
  constructor(
    @Inject(ISTRATEGY_GENERATOR)
    private readonly generators: Map<StrategyGeneratorType, IStrategyGenerator>,
  ) {}

  /**
   * Sinh các chiến lược ứng viên dựa trên thuật toán được yêu cầu
   * @param count Số lượng ứng viên cần sinh
   * @param type Thuật toán sinh ('RANDOM' hoặc 'DOMAIN_GUIDED')
   * @returns Mảng các chiến lược (đã được khởi tạo)
   * @throws {Error} Nếu type không được hỗ trợ
   */
  generateCandidates(count: number, type: StrategyGeneratorType): IStrategy[] {
    if (count <= 0) {
      return [];
    }

    const generator = this.generators.get(type);
    if (!generator) {
      throw new Error(`Generator type not supported: ${type}`);
    }

    return generator.generate(count);
  }
}
