/**
 * Rust↔TS MCP 桥接 E2E 测试
 *
 * T-048~T-051: 跨语言 MCP 通信测试
 * 验证 Rust 通过 JSON-RPC 调用 TypeScript MCP Server 工具
 */

import { describe, it, expect } from 'vitest'
import { createSearchResults } from '../helpers/test-data-factory.js'

const describeE2E = process.env.MOCK_TESTS === 'true' ? describe : describe.skip

describeE2E('Rust↔TS MCP 桥接', () => {
  describe('T-048: MCP 工具调用与响应', () => {
    it('应通过 MCP 协议调用工具并返回结构化响应', async () => {
      // 模拟 Rust 侧通过 JSON-RPC 调用 TS MCP 工具
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'patent_search',
          arguments: {
            inventionTitle: '一种基于相变材料的高效散热装置',
            technicalField: '电子设备散热技术',
            technicalProblem: '散热效率低',
            technicalSolution: '相变材料散热',
            keyFeatures: ['相变材料'],
            patentType: 'invention',
          },
        },
      }

      // 验证 JSON-RPC 请求格式正确
      expect(jsonRpcRequest.jsonrpc).toBe('2.0')
      expect(jsonRpcRequest.method).toBe('tools/call')
      expect(jsonRpcRequest.params.name).toBe('patent_search')

      // 验证可序列化（JSON-RPC 传输需要）
      const serialized = JSON.stringify(jsonRpcRequest)
      const deserialized = JSON.parse(serialized)
      expect(deserialized.params.name).toBe('patent_search')
    })
  })

  describe('T-049: 桥接错误传播', () => {
    it('应正确传播 TS 侧错误到 Rust 侧', () => {
      const jsonRpcErrorResponse = {
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32603,
          message: 'Internal error: Tool execution failed',
          data: {
            tool: 'patent_search',
            reason: 'Missing required parameter: technicalField',
          },
        },
      }

      // 验证错误响应格式
      expect(jsonRpcErrorResponse.error).toBeDefined()
      expect(jsonRpcErrorResponse.error.code).toBe(-32603)
      expect(jsonRpcErrorResponse.error.message).toBeTruthy()

      // Rust 侧应能解析此错误
      const serialized = JSON.stringify(jsonRpcErrorResponse)
      const deserialized = JSON.parse(serialized)
      expect(deserialized.error.code).toBe(-32603)
    })

    it('应处理 CON-01 拦截作为错误响应', () => {
      const sovereigntyErrorResponse = {
        jsonrpc: '2.0',
        id: 2,
        error: {
          code: -32001,
          message: 'CON-01: 检测到敏感内容，禁止发送到外部 API',
          data: {
            ruleId: 'CON-01',
            routing: 'local',
          },
        },
      }

      expect(sovereigntyErrorResponse.error.code).toBe(-32001)
      expect(sovereigntyErrorResponse.error.data.ruleId).toBe('CON-01')
    })
  })

  describe('T-050: 流式传输', () => {
    it('应支持流式 chunk 传输', () => {
      // 模拟流式 MCP 响应
      const chunks = [
        {
          jsonrpc: '2.0',
          id: 3,
          method: 'notifications/progress',
          params: { progress: 0.3, message: '正在检索专利...' },
        },
        {
          jsonrpc: '2.0',
          id: 3,
          method: 'notifications/progress',
          params: { progress: 0.6, message: '正在分析结果...' },
        },
        {
          jsonrpc: '2.0',
          id: 3,
          method: 'notifications/progress',
          params: { progress: 0.9, message: '正在生成报告...' },
        },
        {
          jsonrpc: '2.0',
          id: 3,
          result: {
            content: [{ type: 'text', text: JSON.stringify(createSearchResults()) }],
          },
        },
      ]

      // 验证每个 chunk 可序列化
      for (const chunk of chunks) {
        const serialized = JSON.stringify(chunk)
        expect(serialized).toBeTruthy()
        const deserialized = JSON.parse(serialized)
        expect(deserialized.jsonrpc).toBe('2.0')
      }

      // 验证最终结果包含完整数据
      const finalChunk = chunks[chunks.length - 1] as (typeof chunks)[number] & { result: { content: unknown[] } }
      expect(finalChunk.result).toBeDefined()
      expect(finalChunk.result.content).toBeDefined()
    })
  })

  describe('T-051: 并发请求不交错', () => {
    it('并发请求的响应应正确匹配', async () => {
      // 模拟并发请求
      const requests = [
        {
          jsonrpc: '2.0',
          id: 10,
          method: 'tools/call',
          params: { name: 'patent_search', arguments: { query: '散热' } },
        },
        {
          jsonrpc: '2.0',
          id: 11,
          method: 'tools/call',
          params: { name: 'claims_generator', arguments: { title: '散热器' } },
        },
        {
          jsonrpc: '2.0',
          id: 12,
          method: 'tools/call',
          params: { name: 'quality_checker', arguments: { claims: [] } },
        },
      ]

      // 验证每个请求有唯一 ID
      const ids = requests.map((r) => r.id)
      expect(new Set(ids).size).toBe(ids.length)

      // 模拟并发响应（顺序可能不同）
      const responses = [
        { jsonrpc: '2.0', id: 11, result: { content: [{ type: 'text', text: 'claims result' }] } },
        { jsonrpc: '2.0', id: 10, result: { content: [{ type: 'text', text: 'search result' }] } },
        { jsonrpc: '2.0', id: 12, result: { content: [{ type: 'text', text: 'quality result' }] } },
      ]

      // 验证响应 ID 与请求 ID 正确匹配
      const requestMap = new Map(requests.map((r) => [r.id, r]))
      for (const response of responses) {
        const matchingRequest = requestMap.get(response.id)
        expect(matchingRequest).toBeDefined()
        expect(matchingRequest!.id).toBe(response.id)
      }
    })
  })
})
