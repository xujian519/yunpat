/**
 * @file 统一对话框管理
 * @description 提供 DialogProvider context 和 useDialog hook，
 * 管理所有弹窗（命令面板、模型选择、Agent 选择）的开关状态。
 *
 * 设计参考：opencode 的 DialogProvider 模式
 *  - activeDialog: 当前打开的对话框类型
 *  - openDialog / closeDialog: 开关方法
 *  - 对话框组件通过 context 获取开关能力
 */

import React, { createContext, useContext, useState, useCallback } from 'react'

// ─── 对话框类型 ──────────────────────────────────
export type DialogType = 'command' | 'model' | 'agent' | null

interface DialogContextValue {
  /** 当前激活的对话框 */
  activeDialog: DialogType
  /** 打开指定对话框 */
  openDialog: (type: DialogType) => void
  /** 关闭对话框 */
  closeDialog: () => void
  /** 切换对话框（开→关, 关→开） */
  toggleDialog: (type: DialogType) => void
}

const DialogContext = createContext<DialogContextValue>({
  activeDialog: null,
  openDialog: () => {},
  closeDialog: () => {},
  toggleDialog: () => {},
})

/** 使用对话框控制的 hook */
export function useDialog(): DialogContextValue {
  return useContext(DialogContext)
}

// ─── Provider ─────────────────────────────────────
export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeDialog, setActiveDialog] = useState<DialogType>(null)

  const openDialog = useCallback((type: DialogType) => {
    setActiveDialog(type)
  }, [])

  const closeDialog = useCallback(() => {
    setActiveDialog(null)
  }, [])

  const toggleDialog = useCallback((type: DialogType) => {
    setActiveDialog((prev) => (prev === type ? null : type))
  }, [])

  return React.createElement(
    DialogContext.Provider,
    { value: { activeDialog, openDialog, closeDialog, toggleDialog } },
    children
  )
}

export * as DialogProvider_ from './DialogProvider'
