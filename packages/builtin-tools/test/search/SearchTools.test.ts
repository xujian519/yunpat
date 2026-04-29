import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GrepTool, GlobTool } from '../../src/search/SearchTools.js';

const mockContext = {
  registry: {} as any,
  llm: {} as any,
  memory: {} as any,
  eventBus: {} as any,
};

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    promises: {
      ...actual.promises,
      readFile: vi.fn(),
    },
  };
});

vi.mock('glob', () => ({
  glob: vi.fn(),
}));

import { promises as fs } from 'fs';
import { glob } from 'glob';

describe('SearchTools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GrepTool', () => {
    it('should search in a single file', async () => {
      const mockedReadFile = vi.mocked(fs.readFile);
      mockedReadFile.mockResolvedValue('hello world\nfoo bar\nhello again');

      const tool = new GrepTool();
      const result = await tool.execute(
        { pattern: 'hello', filePath: '/test/file.txt' },
        mockContext
      );

      expect(result.matches).toHaveLength(2);
      expect(result.matches[0].lineNumber).toBe(1);
      expect(result.matches[0].match).toBe('hello');
      expect(result.matches[1].lineNumber).toBe(3);
    });

    it('should respect maxResults limit', async () => {
      const mockedReadFile = vi.mocked(fs.readFile);
      mockedReadFile.mockResolvedValue('hello\nhello\nhello\nhello');

      const tool = new GrepTool();
      const result = await tool.execute(
        { pattern: 'hello', filePath: '/test/file.txt', maxResults: 2 },
        mockContext
      );

      expect(result.matches).toHaveLength(2);
    });

    it('should throw error when neither filePath nor directory is specified', async () => {
      const tool = new GrepTool();
      await expect(
        tool.execute({ pattern: 'test' }, mockContext)
      ).rejects.toThrow('Either filePath or directory must be specified');
    });

    it('should search in directory with glob', async () => {
      const mockedGlob = vi.mocked(glob);
      const mockedReadFile = vi.mocked(fs.readFile);

      mockedGlob.mockResolvedValue(['/test/a.ts', '/test/b.ts']);
      mockedReadFile.mockImplementation(async (filePath) => {
        if (filePath === '/test/a.ts') return 'const x = 1;';
        return 'const y = 2;';
      });

      const tool = new GrepTool();
      const result = await tool.execute(
        { pattern: 'const', directory: '/test', filePattern: '*.ts' },
        mockContext
      );

      expect(result.matches).toHaveLength(2);
      expect(mockedGlob).toHaveBeenCalledWith(
        expect.stringContaining('*.ts'),
        expect.any(Object)
      );
    });
  });

  describe('GlobTool', () => {
    it('should return matched files', async () => {
      const mockedGlob = vi.mocked(glob);
      mockedGlob.mockResolvedValue(['/test/a.ts', '/test/b.ts']);

      const tool = new GlobTool();
      const result = await tool.execute(
        { pattern: '**/*.ts', cwd: '/test' },
        mockContext
      );

      expect(result.files).toEqual(['/test/a.ts', '/test/b.ts']);
      expect(mockedGlob).toHaveBeenCalledWith('**/*.ts', {
        cwd: '/test',
        nodir: true,
        absolute: true,
        dot: false,
      });
    });

    it('should include hidden files when requested', async () => {
      const mockedGlob = vi.mocked(glob);
      mockedGlob.mockResolvedValue(['/test/.hidden']);

      const tool = new GlobTool();
      await tool.execute(
        { pattern: '.*', cwd: '/test', includeHidden: true },
        mockContext
      );

      expect(mockedGlob).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ dot: true })
      );
    });
  });
});
