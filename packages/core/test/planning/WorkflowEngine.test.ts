import { describe, it, expect, vi } from 'vitest'
import { WorkflowEngine } from '../../src/planning/WorkflowEngine.js'
import type { Agent } from '../../src/agent/Agent.js'

describe('WorkflowEngine', () => {
  function createMockAgent(name: string, output?: unknown): Agent {
    return {
      name,
      execute: vi.fn().mockResolvedValue(output ?? { result: 'ok' }),
      getTools: vi.fn().mockReturnValue([]),
      getLlm: vi.fn().mockReturnValue({}),
    } as unknown as Agent
  }

  function createMockConfig(agents: Map<string, Agent>) {
    return {
      eventBus: { emit: vi.fn() } as any,
      memory: { get: vi.fn(), set: vi.fn() } as any,
      agents,
    }
  }

  describe('execute', () => {
    it('应该成功执行简单工作流', async () => {
      const agent = createMockAgent('agent1')
      const engine = new WorkflowEngine(createMockConfig(new Map([['agent1', agent]])))

      const result = await engine.execute({
        id: 'wf-1',
        name: '测试工作流',
        steps: [{ id: 's1', name: '步骤1', agentName: 'agent1' }],
      })

      expect(result.success).toBe(true)
      expect(result.stepResults).toHaveLength(1)
    })

    it('应该处理空ID', async () => {
      const engine = new WorkflowEngine(createMockConfig(new Map()))
      await expect(engine.execute({ id: '', name: '测试', steps: [] } as any)).rejects.toThrow(
        '工作流ID不能为空'
      )
    })

    it('应该处理空名称', async () => {
      const engine = new WorkflowEngine(createMockConfig(new Map()))
      await expect(engine.execute({ id: 'wf-1', name: '', steps: [] } as any)).rejects.toThrow(
        '工作流名称不能为空'
      )
    })

    it('应该处理空步骤', async () => {
      const engine = new WorkflowEngine(createMockConfig(new Map()))
      await expect(engine.execute({ id: 'wf-1', name: '测试', steps: [] })).rejects.toThrow(
        '工作流必须包含至少一个步骤'
      )
    })

    it('应该处理Agent不存在', async () => {
      const engine = new WorkflowEngine(createMockConfig(new Map()))
      const result = await engine.execute({
        id: 'wf-1',
        name: '测试工作流',
        steps: [{ id: 's1', name: '步骤1', agentName: 'agent1' }],
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('Agent不存在')
    })

    it('应该处理步骤失败', async () => {
      const agent = createMockAgent('agent1')
      vi.spyOn(agent, 'execute').mockRejectedValue(new Error('执行错误'))
      const engine = new WorkflowEngine(createMockConfig(new Map([['agent1', agent]])))

      const result = await engine.execute({
        id: 'wf-1',
        name: '测试工作流',
        steps: [{ id: 's1', name: '步骤1', agentName: 'agent1' }],
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('执行错误')
    })

    it('应该传递initialInput', async () => {
      const agent = createMockAgent('agent1')
      const engine = new WorkflowEngine(createMockConfig(new Map([['agent1', agent]])))

      await engine.execute(
        {
          id: 'wf-1',
          name: '测试工作流',
          steps: [{ id: 's1', name: '步骤1', agentName: 'agent1' }],
        },
        { data: 'test' }
      )

      expect(agent.execute).toHaveBeenCalledWith({ data: 'test' })
    })

    it('应该处理多步骤', async () => {
      const agent1 = createMockAgent('agent1', { output1: 'data1' })
      const agent2 = createMockAgent('agent2')
      const engine = new WorkflowEngine(
        createMockConfig(
          new Map([
            ['agent1', agent1],
            ['agent2', agent2],
          ])
        )
      )

      const result = await engine.execute({
        id: 'wf-1',
        name: '测试工作流',
        steps: [
          { id: 's1', name: '步骤1', agentName: 'agent1' },
          { id: 's2', name: '步骤2', agentName: 'agent2' },
        ],
      })

      expect(result.success).toBe(true)
      expect(result.stepResults).toHaveLength(2)
    })

    it('应该处理依赖', async () => {
      const agent = createMockAgent('agent1')
      const engine = new WorkflowEngine(createMockConfig(new Map([['agent1', agent]])))

      const result = await engine.execute({
        id: 'wf-1',
        name: '测试工作流',
        steps: [
          { id: 's1', name: '步骤1', agentName: 'agent1' },
          { id: 's2', name: '步骤2', agentName: 'agent1' },
        ],
        dependencies: [{ from: 's1', to: 's2' }],
      })

      expect(result.success).toBe(true)
    })

    it('应该处理审批', async () => {
      const agent = createMockAgent('agent1')
      const approvalFlow = {
        requestApproval: vi.fn().mockResolvedValue({ approved: true, feedback: { content: 'ok' } }),
      }
      const engine = new WorkflowEngine({
        ...createMockConfig(new Map([['agent1', agent]])),
        approvalFlow: approvalFlow as any,
      })

      const result = await engine.execute({
        id: 'wf-1',
        name: '测试工作流',
        steps: [{ id: 's1', name: '步骤1', agentName: 'agent1', requiresApproval: true }],
      })

      expect(result.success).toBe(true)
      expect(approvalFlow.requestApproval).toHaveBeenCalled()
    })

    it('应该处理审批拒绝', async () => {
      const agent = createMockAgent('agent1')
      const approvalFlow = {
        requestApproval: vi.fn().mockResolvedValue({
          approved: false,
          feedback: { content: '拒绝', corrections: { output: '修正输出' } },
        }),
      }
      const engine = new WorkflowEngine({
        ...createMockConfig(new Map([['agent1', agent]])),
        approvalFlow: approvalFlow as any,
      })

      const result = await engine.execute({
        id: 'wf-1',
        name: '测试工作流',
        steps: [{ id: 's1', name: '步骤1', agentName: 'agent1', requiresApproval: true }],
      })

      expect(result.success).toBe(false)
    })

    it('应该处理inputMapping', async () => {
      const agent = createMockAgent('agent1')
      const engine = new WorkflowEngine(createMockConfig(new Map([['agent1', agent]])))

      await engine.execute(
        {
          id: 'wf-1',
          name: '测试工作流',
          steps: [
            { id: 's1', name: '步骤1', agentName: 'agent1' },
            {
              id: 's2',
              name: '步骤2',
              agentName: 'agent1',
              inputMapping: { data: 'input.data' },
            },
          ],
        },
        { data: 'mapped' }
      )
    })

    it('应该处理步骤超时', async () => {
      const agent = createMockAgent('agent1')
      vi.spyOn(agent, 'execute').mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      )

      const engine = new WorkflowEngine(createMockConfig(new Map([['agent1', agent]])))

      await engine.execute({
        id: 'wf-1',
        name: '测试工作流',
        steps: [{ id: 's1', name: '步骤1', agentName: 'agent1', timeout: 50 }],
      })
    })

    it('应该清理旧工作流', async () => {
      const agent = createMockAgent('agent1')
      const engine = new WorkflowEngine(createMockConfig(new Map([['agent1', agent]])))

      for (let i = 0; i < 105; i++) {
        await engine.execute({
          id: `wf-${i}`,
          name: '测试工作流',
          steps: [{ id: 's1', name: '步骤1', agentName: 'agent1' }],
        })
      }
    })

    it('应该处理依赖失败', async () => {
      const agent = createMockAgent('agent1')
      vi.spyOn(agent, 'execute').mockResolvedValue({ result: 'failed' })
      const engine = new WorkflowEngine(createMockConfig(new Map([['agent1', agent]])))

      const result = await engine.execute({
        id: 'wf-1',
        name: '测试工作流',
        steps: [
          { id: 's1', name: '步骤1', agentName: 'agent1' },
          { id: 's2', name: '步骤2', agentName: 'agent1' },
        ],
        dependencies: [{ from: 's1', to: 's2' }],
      })

      expect(result.success).toBe(true)
    })

    it('应该处理全局超时', async () => {
      const agent = createMockAgent('agent1')
      const engine = new WorkflowEngine(createMockConfig(new Map([['agent1', agent]])))

      const result = await engine.execute({
        id: 'wf-1',
        name: '测试工作流',
        steps: [{ id: 's1', name: '步骤1', agentName: 'agent1' }],
        timeout: 1000,
      })

      expect(result.success).toBe(true)
    })

    it('应该处理检查点', async () => {
      const agent = createMockAgent('agent1')
      const checkpointManager = {
        saveCheckpoint: vi.fn().mockResolvedValue(undefined),
      }
      const engine = new WorkflowEngine({
        ...createMockConfig(new Map([['agent1', agent]])),
        checkpointManager: checkpointManager as any,
      })

      await engine.execute({
        id: 'wf-1',
        name: '测试工作流',
        steps: [{ id: 's1', name: '步骤1', agentName: 'agent1' }],
        enableCheckpoints: true,
      })

      expect(checkpointManager.saveCheckpoint).toHaveBeenCalled()
    })

    it('应该处理工作流暂停', async () => {
      const agent = createMockAgent('agent1')
      const checkpointManager = {
        saveCheckpoint: vi.fn().mockResolvedValue(undefined),
      }
      const engine = new WorkflowEngine({
        ...createMockConfig(new Map([['agent1', agent]])),
        checkpointManager: checkpointManager as any,
      })

      await expect(engine.pause('nonexistent-id')).rejects.toThrow('执行不存在')
    })

    it('应该处理inputMapping steps', async () => {
      const agent = createMockAgent('agent1')
      const engine = new WorkflowEngine(createMockConfig(new Map([['agent1', agent]])))

      await engine.execute({
        id: 'wf-1',
        name: '测试工作流',
        steps: [
          { id: 's1', name: '步骤1', agentName: 'agent1' },
          {
            id: 's2',
            name: '步骤2',
            agentName: 'agent1',
            inputMapping: { data: 'steps.s1.output' },
          },
        ],
      })
    })

    it('应该处理重复步骤ID', async () => {
      const engine = new WorkflowEngine(createMockConfig(new Map()))
      await expect(
        engine.execute({
          id: 'wf-1',
          name: '测试工作流',
          steps: [
            { id: 's1', name: '步骤1', agentName: 'agent1' },
            { id: 's1', name: '步骤2', agentName: 'agent1' },
          ],
        } as any)
      ).rejects.toThrow('步骤ID重复: s1')
    })

    it('应该处理空步骤名称', async () => {
      const engine = new WorkflowEngine(createMockConfig(new Map()))
      await expect(
        engine.execute({
          id: 'wf-1',
          name: '测试工作流',
          steps: [{ id: 's1', name: '', agentName: 'agent1' }],
        } as any)
      ).rejects.toThrow('步骤 s1 的名称不能为空')
    })

    it('应该处理空agentName', async () => {
      const engine = new WorkflowEngine(createMockConfig(new Map()))
      await expect(
        engine.execute({
          id: 'wf-1',
          name: '测试工作流',
          steps: [{ id: 's1', name: '步骤1', agentName: '' }],
        } as any)
      ).rejects.toThrow('步骤 s1 的agentName不能为空')
    })

    it('应该处理无效的步骤超时（非正数）', async () => {
      const engine = new WorkflowEngine(createMockConfig(new Map()))
      await expect(
        engine.execute({
          id: 'wf-1',
          name: '测试工作流',
          steps: [{ id: 's1', name: '步骤1', agentName: 'agent1', timeout: -100 }],
        } as any)
      ).rejects.toThrow('步骤 s1 的超时时间必须是正数')
    })

    it('应该处理无效的步骤超时（零）', async () => {
      const engine = new WorkflowEngine(createMockConfig(new Map()))
      await expect(
        engine.execute({
          id: 'wf-1',
          name: '测试工作流',
          steps: [{ id: 's1', name: '步骤1', agentName: 'agent1', timeout: 0 }],
        } as any)
      ).rejects.toThrow('步骤 s1 的超时时间必须是正数')
    })

    it('应该处理依赖关系不是数组', async () => {
      const engine = new WorkflowEngine(createMockConfig(new Map()))
      await expect(
        engine.execute({
          id: 'wf-1',
          name: '测试工作流',
          steps: [{ id: 's1', name: '步骤1', agentName: 'agent1' }],
          dependencies: 'not-an-array' as any,
        })
      ).rejects.toThrow('依赖关系必须是数组')
    })

    it('应该处理依赖关系缺少from字段', async () => {
      const engine = new WorkflowEngine(createMockConfig(new Map()))
      await expect(
        engine.execute({
          id: 'wf-1',
          name: '测试工作流',
          steps: [{ id: 's1', name: '步骤1', agentName: 'agent1' }],
          dependencies: [{ to: 's1' }] as any,
        })
      ).rejects.toThrow('依赖关系 0 缺少from或to字段')
    })

    it('应该处理依赖关系缺少to字段', async () => {
      const engine = new WorkflowEngine(createMockConfig(new Map()))
      await expect(
        engine.execute({
          id: 'wf-1',
          name: '测试工作流',
          steps: [{ id: 's1', name: '步骤1', agentName: 'agent1' }],
          dependencies: [{ from: 's1' }] as any,
        })
      ).rejects.toThrow('依赖关系 0 缺少from或to字段')
    })

    it('应该处理依赖关系引用不存在的步骤（from）', async () => {
      const engine = new WorkflowEngine(createMockConfig(new Map()))
      await expect(
        engine.execute({
          id: 'wf-1',
          name: '测试工作流',
          steps: [{ id: 's1', name: '步骤1', agentName: 'agent1' }],
          dependencies: [{ from: 'nonexistent', to: 's1' }],
        })
      ).rejects.toThrow('依赖关系引用了不存在的步骤: nonexistent')
    })

    it('应该处理依赖关系引用不存在的步骤（to）', async () => {
      const engine = new WorkflowEngine(createMockConfig(new Map()))
      await expect(
        engine.execute({
          id: 'wf-1',
          name: '测试工作流',
          steps: [{ id: 's1', name: '步骤1', agentName: 'agent1' }],
          dependencies: [{ from: 's1', to: 'nonexistent' }],
        })
      ).rejects.toThrow('依赖关系引用了不存在的步骤: nonexistent')
    })

    it('应该处理自引用依赖', async () => {
      const engine = new WorkflowEngine(createMockConfig(new Map()))
      await expect(
        engine.execute({
          id: 'wf-1',
          name: '测试工作流',
          steps: [{ id: 's1', name: '步骤1', agentName: 'agent1' }],
          dependencies: [{ from: 's1', to: 's1' }],
        })
      ).rejects.toThrow('步骤不能依赖自己: s1')
    })

    it('应该处理无效的全局超时（非正数）', async () => {
      const engine = new WorkflowEngine(createMockConfig(new Map()))
      await expect(
        engine.execute({
          id: 'wf-1',
          name: '测试工作流',
          steps: [{ id: 's1', name: '步骤1', agentName: 'agent1' }],
          timeout: -1000,
        })
      ).rejects.toThrow('全局超时时间必须是正数')
    })

    it('应该处理无效的全局超时（零）', async () => {
      const engine = new WorkflowEngine(createMockConfig(new Map()))
      await expect(
        engine.execute({
          id: 'wf-1',
          name: '测试工作流',
          steps: [{ id: 's1', name: '步骤1', agentName: 'agent1' }],
          timeout: 0,
        })
      ).rejects.toThrow('全局超时时间必须是正数')
    })

    it('应该处理工作流暂停（在执行过程中）', async () => {
      const agent = createMockAgent('agent1')
      vi.spyOn(agent, 'execute').mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ result: 'ok' }), 100)
          })
      )

      const engine = new WorkflowEngine(createMockConfig(new Map([['agent1', agent]])))

      const executionPromise = engine.execute({
        id: 'wf-1',
        name: '测试工作流',
        steps: [
          { id: 's1', name: '步骤1', agentName: 'agent1' },
          { id: 's2', name: '步骤2', agentName: 'agent1' },
        ],
      })

      await new Promise((resolve) => setTimeout(resolve, 10))

      await expect(engine.pause('nonexistent-execution-id')).rejects.toThrow('执行不存在')
    })

    it('应该处理审批拒绝（有修正）', async () => {
      const agent = createMockAgent('agent1', { output: '原始输出' })
      const approvalFlow = {
        requestApproval: vi.fn().mockResolvedValue({
          approved: false,
          feedback: {
            content: '需要修改',
            corrections: { output: '修正后的输出', reason: '原因' },
          },
        }),
      }
      const engine = new WorkflowEngine({
        ...createMockConfig(new Map([['agent1', agent]])),
        approvalFlow: approvalFlow as any,
      })

      const result = await engine.execute({
        id: 'wf-1',
        name: '测试工作流',
        steps: [{ id: 's1', name: '步骤1', agentName: 'agent1', requiresApproval: true }],
      })

      expect(result.success).toBe(false)
      expect(result.stepResults[0].output).toBe('修正后的输出')
    })

    it('应该处理审批拒绝（无修正）', async () => {
      const agent = createMockAgent('agent1', { output: '原始输出' })
      const approvalFlow = {
        requestApproval: vi.fn().mockResolvedValue({
          approved: false,
          feedback: { content: '拒绝' },
        }),
      }
      const engine = new WorkflowEngine({
        ...createMockConfig(new Map([['agent1', agent]])),
        approvalFlow: approvalFlow as any,
      })

      const result = await engine.execute({
        id: 'wf-1',
        name: '测试工作流',
        steps: [{ id: 's1', name: '步骤1', agentName: 'agent1', requiresApproval: true }],
      })

      expect(result.success).toBe(false)
      expect(result.stepResults[0].output).toEqual({ output: '原始输出' })
    })

    it('应该处理parseStartTime为Date对象', async () => {
      const agent = createMockAgent('agent1')
      const checkpointManager = {
        listCheckpoints: vi.fn().mockResolvedValue([
          {
            contextSnapshot: {
              workflowId: 'wf-1',
              currentStepIndex: 0,
              stepResults: [],
              startTime: new Date('2025-01-01'),
            },
            stateSnapshot: {
              workflow: {
                id: 'wf-1',
                name: '测试工作流',
                steps: [{ id: 's1', name: '步骤1', agentName: 'agent1' }],
              },
            },
            memorySnapshot: {},
          },
        ]),
      }
      const engine = new WorkflowEngine({
        ...createMockConfig(new Map([['agent1', agent]])),
        checkpointManager: checkpointManager as any,
      })

      const result = await engine.resume('test-execution-id')
      expect(result.workflowId).toBe('wf-1')
    })

    it('应该处理parseStartTime为字符串', async () => {
      const agent = createMockAgent('agent1')
      const checkpointManager = {
        listCheckpoints: vi.fn().mockResolvedValue([
          {
            contextSnapshot: {
              workflowId: 'wf-1',
              currentStepIndex: 0,
              stepResults: [],
              startTime: '2025-01-01T00:00:00.000Z',
            },
            stateSnapshot: {
              workflow: {
                id: 'wf-1',
                name: '测试工作流',
                steps: [{ id: 's1', name: '步骤1', agentName: 'agent1' }],
              },
            },
            memorySnapshot: {},
          },
        ]),
      }
      const engine = new WorkflowEngine({
        ...createMockConfig(new Map([['agent1', agent]])),
        checkpointManager: checkpointManager as any,
      })

      const result = await engine.resume('test-execution-id')
      expect(result.workflowId).toBe('wf-1')
    })

    it('应该处理parseStartTime为数字', async () => {
      const agent = createMockAgent('agent1')
      const checkpointManager = {
        listCheckpoints: vi.fn().mockResolvedValue([
          {
            contextSnapshot: {
              workflowId: 'wf-1',
              currentStepIndex: 0,
              stepResults: [],
              startTime: 1735689600000,
            },
            stateSnapshot: {
              workflow: {
                id: 'wf-1',
                name: '测试工作流',
                steps: [{ id: 's1', name: '步骤1', agentName: 'agent1' }],
              },
            },
            memorySnapshot: {},
          },
        ]),
      }
      const engine = new WorkflowEngine({
        ...createMockConfig(new Map([['agent1', agent]])),
        checkpointManager: checkpointManager as any,
      })

      const result = await engine.resume('test-execution-id')
      expect(result.workflowId).toBe('wf-1')
    })

    it('应该处理parseStartTime无效值（使用当前时间）', async () => {
      const agent = createMockAgent('agent1')
      const checkpointManager = {
        listCheckpoints: vi.fn().mockResolvedValue([
          {
            contextSnapshot: {
              workflowId: 'wf-1',
              currentStepIndex: 0,
              stepResults: [],
              startTime: 'invalid-date',
            },
            stateSnapshot: {
              workflow: {
                id: 'wf-1',
                name: '测试工作流',
                steps: [{ id: 's1', name: '步骤1', agentName: 'agent1' }],
              },
            },
            memorySnapshot: {},
          },
        ]),
      }
      const engine = new WorkflowEngine({
        ...createMockConfig(new Map([['agent1', agent]])),
        checkpointManager: checkpointManager as any,
      })

      const result = await engine.resume('test-execution-id')
      expect(result.workflowId).toBe('wf-1')
    })

    it('应该从检查点恢复执行', async () => {
      const agent = createMockAgent('agent1')
      const checkpointManager = {
        listCheckpoints: vi.fn().mockResolvedValue([
          {
            contextSnapshot: {
              workflowId: 'wf-1',
              currentStepIndex: 1,
              stepResults: [
                {
                  stepId: 's1',
                  stepName: '步骤1',
                  agentName: 'agent1',
                  output: { result: 'ok' },
                  success: true,
                  startTime: new Date(),
                  endTime: new Date(),
                  duration: 100,
                },
              ],
              startTime: new Date(),
              initialInput: { data: 'test' },
            },
            stateSnapshot: {
              workflow: {
                id: 'wf-1',
                name: '测试工作流',
                steps: [
                  { id: 's1', name: '步骤1', agentName: 'agent1' },
                  { id: 's2', name: '步骤2', agentName: 'agent1' },
                ],
              },
            },
            memorySnapshot: { s1: { result: 'ok' } },
          },
        ]),
      }
      const engine = new WorkflowEngine({
        ...createMockConfig(new Map([['agent1', agent]])),
        checkpointManager: checkpointManager as any,
      })

      const result = await engine.resume('test-execution-id')
      expect(result.success).toBe(true)
      expect(result.stepResults).toHaveLength(2)
    })

    it('应该在没有检查点时恢复失败', async () => {
      const agent = createMockAgent('agent1')
      const engine = new WorkflowEngine(createMockConfig(new Map([['agent1', agent]])))

      await expect(engine.resume('nonexistent-execution-id')).rejects.toThrow(
        '无法恢复执行: nonexistent-execution-id，未找到执行记录或检查点'
      )
    })

    it('应该处理检查点上下文无效', async () => {
      const agent = createMockAgent('agent1')
      const checkpointManager = {
        listCheckpoints: vi.fn().mockResolvedValue([
          {
            contextSnapshot: null,
            stateSnapshot: {
              workflow: {
                id: 'wf-1',
                name: '测试工作流',
                steps: [{ id: 's1', name: '步骤1', agentName: 'agent1' }],
              },
            },
            memorySnapshot: {},
          },
        ]),
      }
      const engine = new WorkflowEngine({
        ...createMockConfig(new Map([['agent1', agent]])),
        checkpointManager: checkpointManager as any,
      })

      await expect(engine.resume('test-execution-id')).rejects.toThrow(
        '检查点上下文无效: test-execution-id'
      )
    })

    it('应该处理检查点中未找到工作流定义', async () => {
      const agent = createMockAgent('agent1')
      const checkpointManager = {
        listCheckpoints: vi.fn().mockResolvedValue([
          {
            contextSnapshot: {
              workflowId: 'wf-1',
              currentStepIndex: 0,
              stepResults: [],
              startTime: new Date(),
            },
            stateSnapshot: {
              workflow: null,
            },
            memorySnapshot: {},
          },
        ]),
      }
      const engine = new WorkflowEngine({
        ...createMockConfig(new Map([['agent1', agent]])),
        checkpointManager: checkpointManager as any,
      })

      await expect(engine.resume('test-execution-id')).rejects.toThrow(
        '检查点中未找到工作流定义: test-execution-id'
      )
    })
  })
})
