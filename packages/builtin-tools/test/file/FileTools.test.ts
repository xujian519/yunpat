import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  FileReadTool,
  FileWriteTool,
  FileAppendTool,
  FileDeleteTool,
  DirectoryListTool,
} from '../../src/file/FileTools.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tmpDir = path.join(__dirname, '..', '..', 'tmp-test-dir');

const mockContext = {
  registry: {} as any,
  llm: {} as any,
  memory: {} as any,
  eventBus: {} as any,
};

describe('FileTools', () => {
  beforeEach(async () => {
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('FileReadTool', () => {
    it('should read file content', async () => {
      const testFile = path.join(tmpDir, 'read-test.txt');
      await fs.writeFile(testFile, 'hello world', 'utf-8');

      const tool = new FileReadTool();
      const result = await tool.execute({ filePath: testFile }, mockContext);

      expect(result.content).toBe('hello world');
    });

    it('should throw error for non-existent file', async () => {
      const tool = new FileReadTool();
      await expect(
        tool.execute({ filePath: path.join(tmpDir, 'nonexistent.txt') }, mockContext)
      ).rejects.toThrow('Failed to read file');
    });
  });

  describe('FileWriteTool', () => {
    it('should write content to file', async () => {
      const testFile = path.join(tmpDir, 'write-test.txt');
      const tool = new FileWriteTool();

      const result = await tool.execute(
        { filePath: testFile, content: 'test content' },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.bytesWritten).toBeGreaterThan(0);

      const readContent = await fs.readFile(testFile, 'utf-8');
      expect(readContent).toBe('test content');
    });

    it('should create directories if needed', async () => {
      const testFile = path.join(tmpDir, 'nested', 'dir', 'file.txt');
      const tool = new FileWriteTool();

      await tool.before({ filePath: testFile, content: 'nested' }, mockContext);
      const result = await tool.execute({ filePath: testFile, content: 'nested' }, mockContext);

      expect(result.success).toBe(true);
      const readContent = await fs.readFile(testFile, 'utf-8');
      expect(readContent).toBe('nested');
    });
  });

  describe('FileAppendTool', () => {
    it('should append content to file', async () => {
      const testFile = path.join(tmpDir, 'append-test.txt');
      await fs.writeFile(testFile, 'first', 'utf-8');

      const tool = new FileAppendTool();
      const result = await tool.execute({ filePath: testFile, content: '-second' }, mockContext);

      expect(result.success).toBe(true);

      const readContent = await fs.readFile(testFile, 'utf-8');
      expect(readContent).toBe('first-second');
    });
  });

  describe('FileDeleteTool', () => {
    it('should delete a file', async () => {
      const testFile = path.join(tmpDir, 'delete-test.txt');
      await fs.writeFile(testFile, 'to be deleted', 'utf-8');

      const tool = new FileDeleteTool();
      const result = await tool.execute({ filePath: testFile }, mockContext);

      expect(result.success).toBe(true);
      await expect(fs.access(testFile)).rejects.toThrow();
    });

    it('should throw error for non-existent file', async () => {
      const tool = new FileDeleteTool();
      await expect(
        tool.execute({ filePath: path.join(tmpDir, 'nonexistent.txt') }, mockContext)
      ).rejects.toThrow('Failed to delete file');
    });
  });

  describe('DirectoryListTool', () => {
    it('should list directory entries', async () => {
      await fs.writeFile(path.join(tmpDir, 'file1.txt'), 'a', 'utf-8');
      await fs.mkdir(path.join(tmpDir, 'subdir'));

      const tool = new DirectoryListTool();
      const result = await tool.execute({ dirPath: tmpDir }, mockContext);

      const names = result.entries.map((e) => e.name).sort();
      expect(names).toContain('file1.txt');
      expect(names).toContain('subdir');
    });

    it('should skip hidden files by default', async () => {
      await fs.writeFile(path.join(tmpDir, '.hidden'), 'a', 'utf-8');
      await fs.writeFile(path.join(tmpDir, 'visible.txt'), 'b', 'utf-8');

      const tool = new DirectoryListTool();
      const result = await tool.execute({ dirPath: tmpDir }, mockContext);

      const names = result.entries.map((e) => e.name);
      expect(names).toContain('visible.txt');
      expect(names).not.toContain('.hidden');
    });

    it('should include hidden files when requested', async () => {
      await fs.writeFile(path.join(tmpDir, '.hidden'), 'a', 'utf-8');
      await fs.writeFile(path.join(tmpDir, 'visible.txt'), 'b', 'utf-8');

      const tool = new DirectoryListTool();
      const result = await tool.execute({ dirPath: tmpDir, includeHidden: true }, mockContext);

      const names = result.entries.map((e) => e.name);
      expect(names).toContain('visible.txt');
      expect(names).toContain('.hidden');
    });

    it('should list recursively when requested', async () => {
      await fs.mkdir(path.join(tmpDir, 'nested'));
      await fs.writeFile(path.join(tmpDir, 'nested', 'deep.txt'), 'a', 'utf-8');

      const tool = new DirectoryListTool();
      const result = await tool.execute({ dirPath: tmpDir, recursive: true }, mockContext);

      const names = result.entries.map((e) => e.name);
      expect(names).toContain('deep.txt');
    });
  });
});
