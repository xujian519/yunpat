/**
 * Agent Service 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { AgentServer } from '../AgentServer.js'

describe('AgentServer', () => {
  let agentServer: AgentServer

  beforeEach(() => {
    agentServer = new AgentServer({
      vectorServiceUrl: 'localhost:50051',
      schedulerServiceUrl: 'localhost:50051',
      pythonToolsUrl: 'localhost:50052',
    })
  })

  afterEach(() => {
    agentServer.shutdown()
  })

  it('should create agent instance', () => {
    expect(agentServer).toBeDefined()
  })

  it('should have state management', () => {
    expect(agentServer).toHaveProperty('agentState')
  })
})
