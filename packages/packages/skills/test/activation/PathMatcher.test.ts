/**
 * PathMatcher 测试
 *
 * @package @yunpat/skills
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { PathMatcher } from '../../src/activation/PathMatcher.js'

// TODO: 修复测试后移除 skip
describe.skip('PathMatcher', () => {
  let matcher: PathMatcher

  beforeEach(() => {
    matcher = new PathMatcher({ caseSensitive: false })
  })

  describe('match', () => {
    describe('Glob 模式匹配', () => {
      it('should match exact file paths', () => {
        expect(matcher.match('/path/to/file.md', '/path/to/file.md')).toBe(true)
        expect(matcher.match('/path/to/file.md', '/path/to/other.md')).toBe(false)
      })

      it('should match with wildcards', () => {
        expect(matcher.match('/path/to/file.md', '/path/to/*.md')).toBe(true)
        expect(matcher.match('/path/to/file.txt', '/path/to/*.md')).toBe(false)
      })

      it('should match with double star (deep matching)', () => {
        expect(matcher.match('/path/to/deeply/nested/file.md', '**/file.md')).toBe(true)
        expect(matcher.match('/path/to/file.md', '**/*.md')).toBe(true)
        expect(matcher.match('/path/to/file.txt', '**/*.md')).toBe(false)
      })

      it('should match complex patterns', () => {
        expect(matcher.match('/src/components/Button.tsx', 'src/**/*.tsx')).toBe(true)
        expect(matcher.match('/src/utils/helper.ts', 'src/**/*.ts')).toBe(true)
        expect(matcher.match('/test/components/Button.test.tsx', 'test/**/*.tsx')).toBe(true)
      })
    })

    describe('文件扩展名匹配', () => {
      it('should match file extensions', () => {
        expect(matcher.match('/path/to/file.pdf', '.pdf')).toBe(true)
        expect(matcher.match('/path/to/file.md', '.md')).toBe(true)
        expect(matcher.match('/path/to/file.pdf', '.md')).toBe(false)
      })

      it('should be case insensitive by default', () => {
        expect(matcher.match('/path/to/file.PDF', '.pdf')).toBe(true)
        expect(matcher.match('/path/to/file.MD', '.md')).toBe(true)
      })

      it('should be case sensitive when configured', () => {
        const caseSensitiveMatcher = new PathMatcher({ caseSensitive: true })
        expect(caseSensitiveMatcher.match('/path/to/file.PDF', '.pdf')).toBe(false)
        expect(caseSensitiveMatcher.match('/path/to/file.pdf', '.pdf')).toBe(true)
      })
    })

    describe('路径标准化', () => {
      it('should handle backslashes (Windows paths)', () => {
        expect(matcher.match('C:\\Users\\file.pdf', '**/*.pdf')).toBe(true)
        expect(matcher.match('/path/to/file.md', '**/*.md')).toBe(true)
      })

      it('should handle mixed slashes', () => {
        expect(matcher.match('/path\\to/file.pdf', '**/*.pdf')).toBe(true)
      })
    })
  })

  describe('matchAny', () => {
    it('should match if any pattern matches', () => {
      const patterns = ['*.pdf', '*.md', '*.txt']
      expect(matcher.matchAny('/path/to/file.pdf', patterns)).toBe(true)
      expect(matcher.matchAny('/path/to/file.md', patterns)).toBe(true)
      expect(matcher.matchAny('/path/to/file.doc', patterns)).toBe(false)
    })

    it('should handle empty pattern array', () => {
      expect(matcher.matchAny('/path/to/file.pdf', [])).toBe(false)
    })
  })

  describe('filter', () => {
    it('should filter matching paths', () => {
      const paths = ['/a/file.pdf', '/b/file.md', '/c/file.pdf', '/d/file.txt']
      const filtered = matcher.filter(paths, '*.pdf')
      expect(filtered).toEqual(['/a/file.pdf', '/c/file.pdf'])
    })

    it('should return empty array if no matches', () => {
      const paths = ['/a/file.md', '/b/file.txt']
      const filtered = matcher.filter(paths, '*.pdf')
      expect(filtered).toEqual([])
    })
  })

  describe('matchBatch', () => {
    it('should match multiple paths', () => {
      const paths = ['/a/file.pdf', '/b/file.md', '/c/file.pdf']
      const results = matcher.matchBatch(paths, '*.pdf')
      expect(results).toEqual([true, false, true])
    })
  })

  describe('缓存功能', () => {
    it('should cache match results', () => {
      const cacheEnabledMatcher = new PathMatcher({ cacheEnabled: true })

      // 第一次匹配
      cacheEnabledMatcher.match('/path/to/file.pdf', '*.pdf')

      // 检查缓存
      const stats = cacheEnabledMatcher.getCacheStats()
      expect(stats.matchCacheSize).toBeGreaterThan(0)
    })

    it('should clear cache', () => {
      const cacheEnabledMatcher = new PathMatcher({ cacheEnabled: true })

      cacheEnabledMatcher.match('/path/to/file.pdf', '*.pdf')
      expect(cacheEnabledMatcher.getCacheStats().matchCacheSize).toBeGreaterThan(0)

      cacheEnabledMatcher.clearCache()
      expect(cacheEnabledMatcher.getCacheStats().matchCacheSize).toBe(0)
    })

    it('should limit cache size', () => {
      const smallCacheMatcher = new PathMatcher({
        cacheEnabled: true,
        cacheMaxSize: 5,
      })

      // 添加超过限制的缓存
      for (let i = 0; i < 10; i++) {
        smallCacheMatcher.match(`/path/to/file${i}.pdf`, '*.pdf')
      }

      const stats = smallCacheMatcher.getCacheStats()
      expect(stats.matchCacheSize).toBeLessThanOrEqual(5)
    })
  })

  describe('边界情况', () => {
    it('should handle empty paths', () => {
      expect(matcher.match('', '*.pdf')).toBe(false)
    })

    it('should handle empty patterns', () => {
      expect(matcher.match('/path/to/file.pdf', '')).toBe(false)
    })

    it('should handle special characters in paths', () => {
      expect(matcher.match('/path/to/file (1).pdf', '**/* (1).pdf')).toBe(true)
      expect(matcher.match('/path/to/file [copy].md', '**/* [copy].md')).toBe(true)
    })
  })
})
