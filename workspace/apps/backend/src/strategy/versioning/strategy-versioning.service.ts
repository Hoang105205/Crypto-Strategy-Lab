import { Injectable, Logger } from '@nestjs/common';
import type { IStrategy, StrategyVersion } from '@crypto-strategy-lab/shared';
import { StrategyType } from '@crypto-strategy-lab/shared';
@Injectable()
export class StrategyVersioningService {
  private readonly logger = new Logger(StrategyVersioningService.name);
  private readonly versions = new Map<string, StrategyVersion>();

  createVersion(strategy: IStrategy, parentVersionId?: string): StrategyVersion {
    const id = `ver_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    const version: StrategyVersion = {
      id,
      strategyType: strategy.getType(),
      name: strategy.getName(),
      version: this.getNextVersionNumber(strategy.getName()),
      parameters: strategy.getParameters(),
      parentVersionId,
      isComposite: strategy.getType() === StrategyType.COMPOSITE,
      createdAt: new Date(),
    };

    this.versions.set(id, version);
    this.logger.log(`Created immutable StrategyVersion snapshot [${id}] for '${strategy.getName()}'`);
    return version;
  }

  getVersion(id: string): StrategyVersion | undefined {
    return this.versions.get(id);
  }

  getAllVersions(): StrategyVersion[] {
    return Array.from(this.versions.values());
  }

  getVersionsByName(name: string): StrategyVersion[] {
    return Array.from(this.versions.values()).filter(v => v.name === name);
  }

  private getNextVersionNumber(name: string): number {
    const existing = Array.from(this.versions.values()).filter((v) => v.name === name);
    return existing.length + 1;
  }
}
