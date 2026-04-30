/**
 * 任务依赖图可视化模块
 *
 * 提供文本渲染、TUI渲染和导出功能
 */

export {
  TextRenderer
} from './TextRenderer.js';

export {
  TUIRenderer
} from './TUIRenderer.js';

export {
  DependencyVisualizer
} from './DependencyVisualizer.js';

export type {
  // 核心类型
  VisualizationOptions,
  TextRenderOptions,
  TUIRenderOptions,
  ExportOptions,
  ExportFormat,

  // 渲染相关
  RenderResult,
  NodeStyle,
  EdgeStyle,

  // 布局相关
  GraphLayout,
  LayoutNode,
  LayoutEdge,

  // 统计相关
  ProgressInfo,
  GraphStats,

  // 重导出核心类型
  HierarchicalPlan,
  DependencyGraph,
} from './types.js';

export { ExportFormat } from './types.js';
