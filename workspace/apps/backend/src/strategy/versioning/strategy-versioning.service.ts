// StrategyVersioningService — Immutable strategy version snapshots (ADR-0008)
// Owner: Huy
// Persistence: PostgreSQL via PrismaService (with in-memory cache for fast lookups)

import { Injectable, Logger } from '@nestjs/common';
import type { IStrategy, StrategyVersion } from '@crypto-strategy-lab/shared';
import { StrategyType, CombinerType } from '@crypto-strategy-lab/shared';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class StrategyVersioningService {
  private readonly logger = new Logger(StrategyVersioningService.name);
  /** In-memory cache for fast lookups — always backed by PostgreSQL */
  private readonly cache = new Map<string, StrategyVersion>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create an immutable StrategyVersion snapshot and persist it to PostgreSQL.
   * Once created, the version record is never modified (ADR-0008).
   */
  async createVersion(strategy: IStrategy, parentVersionId?: string): Promise<StrategyVersion> {
    const isComposite = strategy.getType() === StrategyType.COMPOSITE;
    const params = strategy.getParameters();

    // Resolve child version IDs for composite strategies
    let childVersionIds: string[] = [];
    if (isComposite && (strategy as any).children) {
      const children = (strategy as any).children as IStrategy[];
      for (const child of children) {
        const versions = await this.getVersionsByName(child.getName());
        if (versions.length > 0) {
          childVersionIds.push(versions[versions.length - 1].id);
        }
      }
    }

    // Compute next monotonic version number for this strategy name
    const nextVersion = await this.getNextVersionNumber(strategy.getName());

    // Persist to PostgreSQL via Prisma
    const dbRecord = await this.prisma.strategyVersion.create({
      data: {
        strategyType: strategy.getType(),
        name: strategy.getName(),
        version: nextVersion,
        parameters: params as any,
        parentVersionId: parentVersionId ?? null,
        isComposite,
        childVersionIds: isComposite ? childVersionIds : [],
        combinerType: isComposite ? (params.combinerType as string) ?? null : null,
        combinerWeights: isComposite && params.weights ? (params.weights as any) : undefined,
      },
    });

    // Map Prisma record to shared StrategyVersion type
    const version: StrategyVersion = {
      id: dbRecord.id,
      strategyType: dbRecord.strategyType as StrategyType,
      name: dbRecord.name,
      version: dbRecord.version,
      parameters: dbRecord.parameters as Record<string, unknown>,
      parentVersionId: dbRecord.parentVersionId ?? undefined,
      isComposite: dbRecord.isComposite,
      childVersionIds: dbRecord.childVersionIds,
      combinerType: dbRecord.combinerType as CombinerType | undefined,
      combinerWeights: dbRecord.combinerWeights as Record<string, number> | undefined,
      createdAt: dbRecord.createdAt,
    };

    // Cache for fast subsequent reads
    this.cache.set(version.id, version);
    this.logger.log(`Created immutable StrategyVersion snapshot [${version.id}] for '${strategy.getName()}' v${nextVersion}`);
    return version;
  }

  /**
   * Retrieve a StrategyVersion by ID (cache-first, DB fallback).
   */
  async getVersion(id: string): Promise<StrategyVersion | undefined> {
    // Check cache first
    if (this.cache.has(id)) {
      return this.cache.get(id);
    }

    // Fallback to database
    const dbRecord = await this.prisma.strategyVersion.findUnique({ where: { id } });
    if (!dbRecord) return undefined;

    const version = this.mapDbToVersion(dbRecord);
    this.cache.set(version.id, version);
    return version;
  }

  /**
   * Retrieve all StrategyVersions from the database.
   */
  async getAllVersions(): Promise<StrategyVersion[]> {
    const records = await this.prisma.strategyVersion.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return records.map((r) => this.mapDbToVersion(r));
  }

  /**
   * Retrieve all versions of a strategy by name.
   */
  async getVersionsByName(name: string): Promise<StrategyVersion[]> {
    const records = await this.prisma.strategyVersion.findMany({
      where: { name },
      orderBy: { version: 'asc' },
    });
    return records.map((r) => this.mapDbToVersion(r));
  }

  /**
   * Get the next monotonic version number for a given strategy name.
   */
  private async getNextVersionNumber(name: string): Promise<number> {
    const latest = await this.prisma.strategyVersion.findFirst({
      where: { name },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    return (latest?.version ?? 0) + 1;
  }

  /**
   * Map a Prisma database record to the shared StrategyVersion interface.
   */
  private mapDbToVersion(dbRecord: any): StrategyVersion {
    return {
      id: dbRecord.id,
      strategyType: dbRecord.strategyType as StrategyType,
      name: dbRecord.name,
      version: dbRecord.version,
      parameters: dbRecord.parameters as Record<string, unknown>,
      parentVersionId: dbRecord.parentVersionId ?? undefined,
      isComposite: dbRecord.isComposite,
      childVersionIds: dbRecord.childVersionIds,
      combinerType: dbRecord.combinerType as CombinerType | undefined,
      combinerWeights: dbRecord.combinerWeights as Record<string, number> | undefined,
      createdAt: dbRecord.createdAt,
    };
  }
}
