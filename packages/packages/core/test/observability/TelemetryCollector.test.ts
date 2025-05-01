import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TelemetryCollector } from '../../src/observability/TelemetryCollector.js'
import { TelemetryEventType, EventStatus, AlertType } from '../../src/observability/types.js'

describe('TelemetryCollector', () => {
  let collector: TelemetryCollector

  beforeEach(() => {
    collector = new TelemetryCollector()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  describe('record', () => {
    it('应该记录成功事件', () => {
      collector.record({
        type: TelemetryEventType.AGENT_EXECUTION,
        agentName: 'test-agent',
        status: EventStatus.SUCCESS,
        duration: 100,
      })

      const report = collector.getReport()
      expect(report.summary.totalEvents).toBe(1)
      expect(report.summary.successEvents).toBe(1)
      expect(report.summary.failedEvents).toBe(0)
    })

    it('应该记录失败事件并追踪错误', () => {
      collector.record({
        type: TelemetryEventType.AGENT_EXECUTION,
        agentName: 'test-agent',
        status: EventStatus.FAILURE,
        error: new Error('测试错误'),
        duration: 200,
      })

      const report = collector.getReport()
      expect(report.summary.totalEvents).toBe(1)
      expect(report.summary.failedEvents).toBe(1)
      expect(report.topErrors.length).toBeGreaterThan(0)
      expect(report.topErrors[0].error).toBe('测试错误')
    })

    it('应该限制事件数量', () => {
      const smallCollector = new TelemetryCollector({ maxEvents: 3 })

      for (let i = 0; i < 5; i++) {
        smallCollector.record({
          type: TelemetryEventType.AGENT_EXECUTION,
          status: EventStatus.SUCCESS,
        })
      }

      const report = smallCollector.getReport()
      expect(report.summary.totalEvents).toBe(3)
    })
  })

  describe('getReport', () => {
    it('应该返回正确的汇总数据', () => {
      collector.record({
        type: TelemetryEventType.AGENT_EXECUTION,
        agentName: 'agent-1',
        status: EventStatus.SUCCESS,
        duration: 100,
      })
      collector.record({
        type: TelemetryEventType.AGENT_EXECUTION,
        agentName: 'agent-1',
        status: EventStatus.FAILURE,
        duration: 200,
        error: new Error('err'),
      })

      const report = collector.getReport()
      expect(report.summary.successRate).toBe(0.5)
      expect(report.summary.avgDuration).toBe(150)
    })

    it('空报告应该返回0', () => {
      const report = collector.getReport()
      expect(report.summary.totalEvents).toBe(0)
      expect(report.summary.successRate).toBe(0)
      expect(report.summary.avgDuration).toBe(0)
    })
  })

  describe('agent metrics', () => {
    it('应该按智能体聚合指标', () => {
      collector.record({
        type: TelemetryEventType.AGENT_EXECUTION,
        agentName: 'writer',
        status: EventStatus.SUCCESS,
        duration: 100,
      })
      collector.record({
        type: TelemetryEventType.AGENT_EXECUTION,
        agentName: 'writer',
        status: EventStatus.SUCCESS,
        duration: 200,
      })

      const report = collector.getReport()
      const writerMetrics = report.byAgent.get('writer')
      expect(writerMetrics).toBeDefined()
      expect(writerMetrics?.totalExecutions).toBe(2)
      expect(writerMetrics?.successRate).toBe(1)
      expect(writerMetrics?.avgDuration).toBe(150)
      expect(writerMetrics?.minDuration).toBe(100)
      expect(writerMetrics?.maxDuration).toBe(200)
    })
  })

  describe('stage metrics', () => {
    it('应该按阶段聚合指标', () => {
      collector.record({
        type: TelemetryEventType.AGENT_EXECUTION,
        agentName: 'writer',
        stage: 'drafting',
        status: EventStatus.SUCCESS,
        duration: 100,
      })

      const report = collector.getReport()
      const stageMetrics = report.byStage.get('drafting')
      expect(stageMetrics).toBeDefined()
      expect(stageMetrics?.totalExecutions).toBe(1)
    })
  })

  describe('alerts', () => {
    it('应该触发慢执行告警', () => {
      collector.record({
        type: TelemetryEventType.AGENT_EXECUTION,
        agentName: 'writer',
        status: EventStatus.SUCCESS,
        duration: 10000,
      })

      const report = collector.getReport()
      expect(report.alerts.length).toBeGreaterThan(0)
      expect(report.alerts[0].type).toBe(AlertType.SLOW_EXECUTION)
    })

    it('应该触发高失败率告警', () => {
      for (let i = 0; i < 10; i++) {
        collector.record({
          type: TelemetryEventType.AGENT_EXECUTION,
          agentName: 'writer',
          status: EventStatus.FAILURE,
          error: new Error('fail'),
        })
      }

      const report = collector.getReport()
      const failureAlerts = report.alerts.filter((a) => a.type === AlertType.HIGH_FAILURE_RATE)
      expect(failureAlerts.length).toBeGreaterThan(0)
    })

    it('应该限制告警数量', () => {
      for (let i = 0; i < 110; i++) {
        collector.record({
          type: TelemetryEventType.AGENT_EXECUTION,
          agentName: 'writer',
          status: EventStatus.SUCCESS,
          duration: 10000,
        })
      }

      const report = collector.getReport()
      expect(report.alerts.length).toBeLessThanOrEqual(100)
    })
  })

  describe('query methods', () => {
    it('应该按智能体筛选事件', () => {
      collector.record({
        type: TelemetryEventType.AGENT_EXECUTION,
        agentName: 'writer',
        status: EventStatus.SUCCESS,
      })
      collector.record({
        type: TelemetryEventType.AGENT_EXECUTION,
        agentName: 'analyzer',
        status: EventStatus.SUCCESS,
      })

      const writerEvents = collector.getEventsByAgent('writer')
      expect(writerEvents.length).toBe(1)
    })

    it('应该按类型筛选事件', () => {
      collector.record({
        type: TelemetryEventType.AGENT_EXECUTION,
        status: EventStatus.SUCCESS,
      })
      collector.record({
        type: TelemetryEventType.LLM_CALLED,
        status: EventStatus.SUCCESS,
      })

      const execEvents = collector.getEventsByType(TelemetryEventType.AGENT_EXECUTION)
      expect(execEvents.length).toBe(1)
    })

    it('应该返回最近的失败事件', () => {
      collector.record({
        type: TelemetryEventType.AGENT_EXECUTION,
        status: EventStatus.FAILURE,
        error: new Error('err1'),
      })
      collector.record({
        type: TelemetryEventType.AGENT_EXECUTION,
        status: EventStatus.SUCCESS,
      })

      const failures = collector.getRecentFailures(10)
      expect(failures.length).toBe(1)
    })
  })

  describe('clear', () => {
    it('应该清除所有数据', () => {
      collector.record({
        type: TelemetryEventType.AGENT_EXECUTION,
        status: EventStatus.SUCCESS,
      })

      collector.clear()
      const report = collector.getReport()
      expect(report.summary.totalEvents).toBe(0)
      expect(report.alerts.length).toBe(0)
    })
  })

  describe('printReport', () => {
    it('应该打印报告不抛出错误', () => {
      collector.record({
        type: TelemetryEventType.AGENT_EXECUTION,
        agentName: 'writer',
        status: EventStatus.SUCCESS,
        duration: 100,
      })

      expect(() => collector.printReport()).not.toThrow()
    })
  })

  describe('alert severity', () => {
    it('应该为不同告警类型分配正确的严重级别', () => {
      const config = { alertConfig: { enableAlerts: true } }
      const tc = new TelemetryCollector(config)

      tc.record({
        type: TelemetryEventType.AGENT_EXECUTION,
        agentName: 'writer',
        status: EventStatus.SUCCESS,
        duration: 10000,
      })

      const report = tc.getReport()
      expect(report.alerts[0].severity).toBe('warning')
    })
  })
})
