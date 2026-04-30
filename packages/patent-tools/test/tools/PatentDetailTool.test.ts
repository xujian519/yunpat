import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PatentDetailTool, HighCitationPatentsTool } from '../../src/tools/PatentDetailTool.js';
import { GooglePatentDetailTool } from '../../src/tools/GooglePatentsTool.js';
import { GooglePatentsFetchTool } from '../../src/tools/GooglePatentsTool.js';

describe('PatentDetailTool', () => {
  let tool: PatentDetailTool;

  beforeEach(() => {
    tool = new PatentDetailTool();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('has correct metadata', () => {
    expect(tool.metadata.name).toBe('patent_detail');
    expect(tool.metadata.category).toBe('patent');
  });

  it('returns detailed patent analysis with claims', async () => {
    vi.spyOn(GooglePatentDetailTool.prototype, 'execute').mockResolvedValue({
      patentNumber: 'CN123456789A',
      title: 'Test Patent',
      abstract: 'Test abstract about neural networks',
      claims: [
        '一种装置，其特征在于，包括：A模块；',
        '根据权利要求1所述的装置，其特征在于，所述A模块采用B技术。',
      ],
      description: 'Test description',
      ipcCodes: ['G06N3/00', 'G06F17/00'],
      applicant: 'Tech Corp',
      inventor: ['John Doe'],
      publicationDate: '2023-01-01',
      filingDate: '2022-01-01',
    });

    const context = {} as any;
    const result = await tool.execute(
      { patentNumber: 'CN123456789A', includeClaims: true, includeAnalysis: true },
      context
    );

    expect(result.basicInfo.patentNumber).toBe('CN123456789A');
    expect(result.basicInfo.title).toBe('Test Patent');
    expect(result.basicInfo.applicant).toBe('Tech Corp');
    expect(result.technicalInfo.ipcCodes).toEqual(['G06N3/00', 'G06F17/00']);
    expect(result.technicalInfo.technologyField).toBe('物理技术');
    expect(result.claims.totalClaims).toBe(2);
    expect(result.claims.independentClaims).toBe(1);
    expect(result.claims.dependentClaims).toBe(1);
    expect(result.legalStatus.status).toBe('Active');
  });

  it('skips claims analysis when includeClaims is false', async () => {
    vi.spyOn(GooglePatentDetailTool.prototype, 'execute').mockResolvedValue({
      patentNumber: 'CN123456789A',
      title: 'Test Patent',
      abstract: 'Test abstract',
      claims: ['Claim 1'],
      description: 'Test description',
      ipcCodes: ['G06N3/00'],
      applicant: 'Tech Corp',
      inventor: ['John Doe'],
      publicationDate: '2023-01-01',
      filingDate: '2022-01-01',
    });

    const context = {} as any;
    const result = await tool.execute(
      { patentNumber: 'CN123456789A', includeClaims: false },
      context
    );

    expect(result.claims.totalClaims).toBe(0);
    expect(result.claims.independentClaims).toBe(0);
    expect(result.claims.dependentClaims).toBe(0);
    expect(result.claims.claimTexts).toEqual([]);
  });

  it('analyzes claims correctly via private method', () => {
    const analyzeClaims = (tool as any).analyzeClaims.bind(tool);

    const claims = [
      '一种装置，其特征在于，包括：A模块；',
      '根据权利要求1所述的装置，其特征在于，所述A模块采用B技术。',
      '根据权利要求1所述的装置，其中所述B技术为C技术。',
    ];

    const result = analyzeClaims(claims);
    expect(result.totalClaims).toBe(3);
    expect(result.independentClaims).toBe(1);
    expect(result.dependentClaims).toBe(2);
    expect(result.claimTexts).toEqual(claims);
  });

  it('handles empty claims array', () => {
    const analyzeClaims = (tool as any).analyzeClaims.bind(tool);
    const result = analyzeClaims([]);
    expect(result.totalClaims).toBe(0);
    expect(result.independentClaims).toBe(0);
    expect(result.dependentClaims).toBe(0);
  });

  it('handles claims with "wherein" keyword', () => {
    const analyzeClaims = (tool as any).analyzeClaims.bind(tool);
    const claims = [
      'A device comprising: a module;',
      'The device of claim 1, wherein the module includes a processor.',
    ];

    const result = analyzeClaims(claims);
    expect(result.independentClaims).toBe(1);
    expect(result.dependentClaims).toBe(1);
  });

  it('returns correct IPC description', () => {
    const getIPCDescription = (tool as any).getIPCDescription.bind(tool);
    expect(getIPCDescription('G06N3/00')).toBe('物理');
    expect(getIPCDescription('H01L21/00')).toBe('电学');
    expect(getIPCDescription('A01B1/00')).toBe(
      '人类生活需要（农业、食品、烟草、个人或家用物品、健康、救生、娱乐）'
    );
    expect(getIPCDescription('X99Z1/00')).toBe('Unknown');
  });

  it('extracts keywords from text', () => {
    const extractKeywords = (tool as any).extractKeywords.bind(tool);
    const keywords = extractKeywords('Neural network chip for deep learning');
    expect(keywords.length).toBeGreaterThan(0);
    expect(keywords.length).toBeLessThanOrEqual(10);
    expect(keywords).toContain('neural');
    expect(keywords).toContain('network');
    expect(keywords).toContain('chip');
    expect(keywords).toContain('deep');
    expect(keywords).toContain('learning');
  });

  it('returns empty keywords for short text', () => {
    const extractKeywords = (tool as any).extractKeywords.bind(tool);
    const keywords = extractKeywords('a b');
    expect(keywords).toEqual([]);
  });

  it('returns correct technology field', () => {
    const getTechnologyField = (tool as any).getTechnologyField.bind(tool);
    expect(getTechnologyField('G06N')).toBe('物理技术');
    expect(getTechnologyField('H01L')).toBe('电子电气');
    expect(getTechnologyField('A01B')).toBe('生活必需品');
    expect(getTechnologyField('Z99Z')).toBe('Other');
  });
});

describe('HighCitationPatentsTool', () => {
  let tool: HighCitationPatentsTool;

  beforeEach(() => {
    tool = new HighCitationPatentsTool();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('has correct metadata', () => {
    expect(tool.metadata.name).toBe('high_citation_patents');
    expect(tool.metadata.category).toBe('patent');
  });

  it('returns high citation patents with stats', async () => {
    vi.spyOn(GooglePatentsFetchTool.prototype, 'execute').mockResolvedValue({
      results: [
        {
          patentId: 'P1',
          title: 'Patent 1',
          snippet: 'Abstract A',
          url: 'https://patents.google.com/patent/P1/',
          assignee: 'Corp A',
          publicationDate: '2020-01-01',
          ipcCodes: ['G06N'],
        },
        {
          patentId: 'P2',
          title: 'Patent 2',
          snippet: 'Abstract B',
          url: 'https://patents.google.com/patent/P2/',
          assignee: 'Corp B',
          publicationDate: '2019-01-01',
          ipcCodes: ['H01L'],
        },
      ],
      total: 2,
      page: 1,
    });

    const context = {} as any;
    const result = await tool.execute(
      { technology: 'neural network', minCitations: 5, limit: 2 },
      context
    );

    expect(result.highCitationPatents.length).toBeLessThanOrEqual(2);
    expect(result.citationStats).toHaveProperty('avgCitations');
    expect(result.citationStats).toHaveProperty('maxCitations');
    expect(result.citationStats).toHaveProperty('minCitations');
    expect(result.citationStats.maxCitations).toBeGreaterThanOrEqual(
      result.citationStats.minCitations
    );
    expect(result.citationStats.avgCitations).toBeGreaterThanOrEqual(
      result.citationStats.minCitations
    );
    expect(result.citationStats.avgCitations).toBeLessThanOrEqual(
      result.citationStats.maxCitations
    );
  });
});
