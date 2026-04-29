import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PatentSearchTool,
  SimilarPatentSearchTool,
  PatentSearchMode,
} from '../../src/tools/PatentSearchTool.js';
import { GooglePatentsFetchTool } from '../../src/tools/GooglePatentsTool.js';

describe('PatentSearchTool', () => {
  let tool: PatentSearchTool;

  beforeEach(() => {
    tool = new PatentSearchTool();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('has correct metadata', () => {
    expect(tool.metadata.name).toBe('patent_search');
    expect(tool.metadata.category).toBe('patent');
    expect(tool.metadata.isConcurrencySafe).toBe(true);
  });

  it('searches by keyword mode by default', async () => {
    const mockExecute = vi
      .spyOn(GooglePatentsFetchTool.prototype, 'execute')
      .mockResolvedValue({
        results: [
          {
            patentId: 'CN123456789A',
            title: 'Neural Network Chip',
            snippet: 'A chip for neural networks',
            url: 'https://patents.google.com/patent/CN123456789A/',
            assignee: 'Tech Corp',
            publicationDate: '2023-01-01',
            ipcCodes: ['G06N3/00'],
          },
        ],
        total: 1,
        page: 1,
      });

    const context = {} as any;
    const result = await tool.execute({ query: 'neural network', limit: 2 }, context);

    expect(result.patents).toHaveLength(1);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(2);
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);

    // Verify the underlying Google tool was called with correct args
    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'neural network', page: 1 }),
      context
    );
  });

  it('converts Google results to PatentRecord correctly', async () => {
    vi.spyOn(GooglePatentsFetchTool.prototype, 'execute').mockResolvedValue({
      results: [
        {
          patentId: 'CN123456789A',
          title: 'Neural Network Chip',
          snippet: 'A chip for neural networks',
          url: 'https://patents.google.com/patent/CN123456789A/',
          assignee: 'Tech Corp',
          publicationDate: '2023-01-01',
          ipcCodes: ['G06N3/00'],
        },
      ],
      total: 1,
      page: 1,
    });

    const context = {} as any;
    const result = await tool.execute(
      { query: 'neural', mode: PatentSearchMode.KEYWORD, limit: 1 },
      context
    );

    const patent = result.patents[0];
    expect(patent.id).toBe('CN123456789A');
    expect(patent.patentName).toBe('Neural Network Chip');
    expect(patent.applicationNumber).toBe('CN123456789A');
    expect(patent.publicationNumber).toBe('CN123456789A');
    expect(patent.applicant).toBe('Tech Corp');
    expect(patent.ipcCode).toBe('G06N3/00');
    expect(patent.abstract).toBe('A chip for neural networks');
    expect(patent.publicationDate).toBe('2023-01-01');
    expect(patent.url).toBe('https://patents.google.com/patent/CN123456789A/');
  });

  it('uses default values when optional params omitted', async () => {
    vi.spyOn(GooglePatentsFetchTool.prototype, 'execute').mockResolvedValue({
      results: [],
      total: 0,
      page: 1,
    });

    const context = {} as any;
    const result = await tool.execute({ query: 'test' }, context);

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
  });
});

describe('SimilarPatentSearchTool', () => {
  let tool: SimilarPatentSearchTool;

  beforeEach(() => {
    tool = new SimilarPatentSearchTool();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('has correct metadata', () => {
    expect(tool.metadata.name).toBe('similar_patent_search');
    expect(tool.metadata.category).toBe('patent');
  });

  it('builds enhanced query correctly', () => {
    const query = (tool as any).buildEnhancedQuery('neural network', ['chip', 'accelerator']);
    expect(query).toContain('neural network');
    expect(query).toContain('chip');
    expect(query).toContain('accelerator');
    expect(query).toContain('OR');
  });

  it('calculates similarity correctly', () => {
    const similarity = (tool as any).calculateSimilarity(
      'neural network chip',
      'neural network processor chip'
    );
    expect(similarity).toBeGreaterThan(0);
    expect(similarity).toBeLessThanOrEqual(1);
  });

  it('returns zero similarity for completely different texts', () => {
    const similarity = (tool as any).calculateSimilarity('abc xyz', '123 456');
    expect(similarity).toBe(0);
  });

  it('returns zero similarity for empty query', () => {
    const similarity = (tool as any).calculateSimilarity('', 'some content');
    expect(similarity).toBe(0);
  });

  it('executes search and returns sorted results', async () => {
    vi.spyOn(GooglePatentsFetchTool.prototype, 'execute').mockResolvedValue({
      results: [
        {
          patentId: 'CN123456789A',
          title: 'Neural Network Chip',
          snippet: 'A chip for neural networks',
          url: 'https://patents.google.com/patent/CN123456789A/',
          assignee: 'Tech Corp',
          publicationDate: '2023-01-01',
          ipcCodes: ['G06N3/00'],
        },
        {
          patentId: 'CN987654321B',
          title: 'Deep Learning Accelerator',
          snippet: 'An accelerator for deep learning',
          url: 'https://patents.google.com/patent/CN987654321B/',
          assignee: 'AI Inc',
          publicationDate: '2022-06-01',
          ipcCodes: ['G06N3/02'],
        },
      ],
      total: 2,
      page: 1,
    });

    const context = {} as any;
    const result = await tool.execute(
      { technology: 'neural network', features: ['chip'], limit: 2 },
      context
    );

    expect(result.similarPatents).toHaveLength(2);
    expect(result.similarityScores).toHaveLength(2);
    expect(result.similarityScores[0]).toBeGreaterThanOrEqual(0);
  });
});
