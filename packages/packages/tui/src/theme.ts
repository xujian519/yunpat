/**
 * @file 主题定义
 * @description 统一的颜色和样式常量，整个 TUI 引用此文件
 */

/** 品牌主题色 */
export const THEME = {
  /** 品牌色 — 青色 */
  brand: 'cyan',
  /** 用户消息 */
  user: '#6C9EF7',
  /** 助手消息 */
  assistant: '#7CDB8A',
  /** 系统消息 */
  system: '#FFB454',
  /** 成功 */
  success: '#7CDB8A',
  /** 错误 */
  error: '#FF6B6B',
  /** 警告 */
  warning: '#FFB454',
  /** 信息 */
  info: '#6C9EF7',
  /** 进度条 */
  progress: '#6C9EF7',
  /** 辅助灰 */
  dim: 'gray',
  /** 强调 */
  accent: 'magenta',
} as const

/** 图标集 */
export const ICONS = {
  brand: '◆',
  bullet: '●',
  check: '✓',
  cross: '✗',
  warn: '⚠',
  info: 'ℹ',
  empty: '○',
  arrow: '→',
  star: '★',
  gear: '⚙',
  /** 10 帧流畅 spinner */
  spinner: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
} as const

/** 消息角色样式 */
export const ROLE_STYLES = {
  user: { prefix: 'You', color: THEME.user, icon: ICONS.bullet },
  assistant: { prefix: 'YunPat', color: THEME.assistant, icon: ICONS.brand },
  system: { prefix: 'System', color: THEME.system, icon: ICONS.empty },
} as const
