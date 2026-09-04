import { Test, TestingModule } from '@nestjs/testing';
import { SearchEngine } from '../search-engine';
import { RandomGenerator } from '../random.generator';
import { DomainGuidedGenerator } from '../domain-guided.generator';
import { StrategyRegistry } from '../../registry/strategy.registry';
import { ISTRATEGY_GENERATOR } from '../../../shared/tokens';

describe('SearchEngine', () => {
  let searchEngine: SearchEngine;
  let randomGenerator: RandomGenerator;
  let domainGuidedGenerator: DomainGuidedGenerator;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchEngine,
        RandomGenerator,
        DomainGuidedGenerator,
        StrategyRegistry, // needed by generators
        {
          provide: ISTRATEGY_GENERATOR, // Token ISTRATEGY_GENERATOR
          useFactory: (random: RandomGenerator, domain: DomainGuidedGenerator) => {
            const map = new Map<string, any>();
            map.set('RANDOM', random);
            map.set('DOMAIN_GUIDED', domain);
            return map;
          },
          inject: [RandomGenerator, DomainGuidedGenerator],
        },
      ],
    }).compile();

    searchEngine = module.get<SearchEngine>(SearchEngine);
    randomGenerator = module.get<RandomGenerator>(RandomGenerator);
    domainGuidedGenerator = module.get<DomainGuidedGenerator>(DomainGuidedGenerator);
  });

  it('should be defined', () => {
    expect(searchEngine).toBeDefined();
  });

  it('should return empty array if count <= 0', () => {
    expect(searchEngine.generateCandidates(0, 'RANDOM')).toEqual([]);
    expect(searchEngine.generateCandidates(-5, 'DOMAIN_GUIDED')).toEqual([]);
  });

  it('should call randomGenerator for RANDOM type', () => {
    const spy = jest.spyOn(randomGenerator, 'generate');
    searchEngine.generateCandidates(5, 'RANDOM');
    expect(spy).toHaveBeenCalledWith(5);
  });

  it('should call domainGuidedGenerator for DOMAIN_GUIDED type', () => {
    const spy = jest.spyOn(domainGuidedGenerator, 'generate');
    searchEngine.generateCandidates(3, 'DOMAIN_GUIDED');
    expect(spy).toHaveBeenCalledWith(3);
  });

  it('should throw error for invalid type', () => {
    expect(() => searchEngine.generateCandidates(1, 'INVALID' as any)).toThrow('Generator type not supported: INVALID');
  });
});
