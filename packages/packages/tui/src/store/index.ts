/**
 * @file TUI 状态管理
 * @description 使用 Zustand 管理全局状态
 */

import { create } from 'zustand'
import type {
  Session,
  SessionMessage,
  OrchestratorStatus,
  HITLRequest,
  HITLResponse,
  WorkflowState,
  WorkflowStep,
} from '../types/index.js'
import type { StoreApi } from 'zustand'

interface TUIStoreState {
  // 会话状态
  session: Session | null
  messages: SessionMessage[]

  // 连接状态
  connected: boolean
  gatewayUrl: string

  // 执行状态
  orchestratorStatus: OrchestratorStatus

  // HITL 状态
  pendingHITL: HITLRequest | null

  // 错误状态
  error: string | null

  // 工作流状态（新增）
  workflow: WorkflowState | null
}

interface TUIStoreActions {
  // Actions
  setSession: (session: Session | null) => void
  addMessage: (message: SessionMessage) => void
  setConnected: (connected: boolean) => void
  setGatewayUrl: (url: string) => void
  updateOrchestratorStatus: (status: Partial<OrchestratorStatus>) => void
  setPendingHITL: (request: HITLRequest | null) => void
  setError: (error: string | null) => void
  submitHITLResponse: (response: HITLResponse) => Promise<void>

  // 工作流 Actions（新增）
  setWorkflow: (workflow: WorkflowState | null) => void
  updateWorkflowStep: (stepId: string, updates: Partial<WorkflowStep>) => void
  advanceWorkflowStep: () => void
}

type TUIStore = TUIStoreState & TUIStoreActions

// 创建 store
const useTuiStoreImpl = create<TUIStore>((set) => ({
  // 初始状态
  session: null,
  messages: [],
  connected: false,
  gatewayUrl: `http://localhost:${process.env.GATEWAY_PORT ?? 8081}`,
  orchestratorStatus: {
    stage: 'idle',
    progress: 0,
  },
  pendingHITL: null,
  error: null,
  workflow: null,

  // Actions
  setSession: (session) => set({ session }),

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  setConnected: (connected) => set({ connected }),

  setGatewayUrl: (url) => set({ gatewayUrl: url }),

  updateOrchestratorStatus: (status) =>
    set((state) => ({
      orchestratorStatus: { ...state.orchestratorStatus, ...status },
    })),

  setPendingHITL: (request) => set({ pendingHITL: request }),

  setError: (error) => set({ error }),

  submitHITLResponse: async (_response) => {
    throw new Error(
      'HITL response handler not configured. Please ensure the GatewayClient is properly initialized.'
    )
  },

  // 工作流 Actions
  setWorkflow: (workflow) => set({ workflow }),

  updateWorkflowStep: (stepId, updates) =>
    set((state) => {
      if (!state.workflow) return {}
      return {
        workflow: {
          ...state.workflow,
          steps: state.workflow.steps.map((step) =>
            step.stepId === stepId ? { ...step, ...updates } : step
          ),
        },
      }
    }),

  advanceWorkflowStep: () =>
    set((state) => {
      if (!state.workflow || state.workflow.totalSteps === 0) return {}
      const nextIndex = state.workflow.currentStepIndex + 1
      return {
        workflow: {
          ...state.workflow,
          currentStepIndex: Math.min(nextIndex, state.workflow.totalSteps - 1),
        },
      }
    }),
}))

// 导出 hook
export const useStore = useTuiStoreImpl

// 导出 store API
export const storeApi: StoreApi<TUIStore> = useTuiStoreImpl
