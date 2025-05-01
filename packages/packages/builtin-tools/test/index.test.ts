import { describe, it, expect } from 'vitest'
import {
  FileReadTool,
  FileWriteTool,
  FileAppendTool,
  FileDeleteTool,
  DirectoryListTool,
  GrepTool,
  GlobTool,
  WebFetchTool,
  WebSearchTool,
  WebNavigateTool,
  WebFindTabTool,
  WebSnapshotTool,
  WebClickTool,
  WebFillTool,
  WebEvaluateTool,
  WebScreenshotTool,
  WebWaitTool,
  WebExtractTextTool,
  WebScrollTool,
  KnowledgeSearchTool,
  KnowledgeIndexBuilderTool,
  CardMetadata,
  KnowledgeIndex,
  SearchResult,
} from '../src/index.js'

describe('index exports', () => {
  it('should export all file tools', () => {
    expect(FileReadTool).toBeDefined()
    expect(FileWriteTool).toBeDefined()
    expect(FileAppendTool).toBeDefined()
    expect(FileDeleteTool).toBeDefined()
    expect(DirectoryListTool).toBeDefined()
  })

  it('should export all search tools', () => {
    expect(GrepTool).toBeDefined()
    expect(GlobTool).toBeDefined()
  })

  it('should export all network tools', () => {
    expect(WebFetchTool).toBeDefined()
    expect(WebSearchTool).toBeDefined()
  })

  it('should export all browser tools', () => {
    expect(WebNavigateTool).toBeDefined()
    expect(WebFindTabTool).toBeDefined()
    expect(WebSnapshotTool).toBeDefined()
    expect(WebClickTool).toBeDefined()
    expect(WebFillTool).toBeDefined()
    expect(WebEvaluateTool).toBeDefined()
    expect(WebScreenshotTool).toBeDefined()
    expect(WebWaitTool).toBeDefined()
    expect(WebExtractTextTool).toBeDefined()
    expect(WebScrollTool).toBeDefined()
  })

  it('should export all knowledge tools and types', () => {
    expect(KnowledgeSearchTool).toBeDefined()
    expect(KnowledgeIndexBuilderTool).toBeDefined()
    expect(typeof CardMetadata).toBe('undefined') // interface only
    expect(typeof KnowledgeIndex).toBe('undefined') // interface only
    expect(typeof SearchResult).toBe('undefined') // interface only
  })
})
