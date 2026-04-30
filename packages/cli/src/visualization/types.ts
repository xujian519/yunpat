/**
 * 任务依赖图可视化 - 类型定义
 *
 * 定义文本渲染、TUI渲染、导出功能的核心类型
 */

import type { HierarchicalPlan, DependencyGraph } from '@yunpat/core';

// 重新导出类型
export type { HierarchicalPlan, DependencyGraph };

/**
 * 可视化选项
 */
export interface VisualizationOptions {
  format: 'text' | 'tree' | 'graph';
  showProgress?: boolean;
  showMetrics?: boolean;
  interactive?: boolean;
  compact?: boolean;
  colors?: boolean;
}

/**
 * 文本渲染选项
 */
export interface TextRenderOptions extends VisualizationOptions {
  includeDetails?: boolean;
  maxDepth?: number;
  showTimestamps?: boolean;
}

/**
 * TUI渲染选项
 */
export interface TUIRenderOptions extends VisualizationOptions {
  refreshRate?: number; // 刷新频率（毫秒）
  enableKeyboardNav?: boolean;
  showHelp?: boolean;
}

/**
 * 导出格式
 */
export enum ExportFormat {
  DOT = 'dot',           // Graphviz DOT格式
  PNG = 'png',           // PNG图片
  SVG = 'svg',           // SVG矢量图
  JSON = 'json',         // JSON格式
  MERMAID = 'mermaid',   // Mermaid图表
}

/**
 * 导出选项
 */
export interface ExportOptions {
  format: ExportFormat;
  outputPath: string;
  width?: number;
  height?: number;
  dpi?: number;
  backgroundColor?: string;
  fontName?: string;
}

/**
 * 节点样式
 */
export interface NodeStyle {
  shape: 'box' | 'ellipse' | 'diamond' | 'circle';
  color: string;
  fillColor: string;
  borderColor: string;
  borderWidth: number;
  fontSize: number;
  fontColor: string;
}

/**
 * 边样式
 */
export interface EdgeStyle {
  color: string;
  style: 'solid' | 'dashed' | 'dotted';
  thickness: number;
  label?: string;
}

/**
 * 渲染结果
 */
export interface RenderResult {
  content: string; // 渲染后的文本内容
  metadata: {
    renderTime: number;
    nodeCount: number;
    edgeCount: number;
    format: string;
  };
}

/**
 * 图布局信息
 */
export interface GraphLayout {
  nodes: Map<string, LayoutNode>;
  edges: LayoutEdge[];
  bounds: {
    width: number;
    height: number;
  };
}

/**
 * 布局节点
 */
export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  status: string;
}

/**
 * 布局边
 */
export interface LayoutEdge {
  from: string;
  to: string;
  path: Array<{ x: number; y: number }>;
  label?: string;
}

/**
 * 进度信息
 */
export interface ProgressInfo {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  percentage: number;
}

/**
 * 图统计
 */
export interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  criticalPathLength: number;
  maxDepth: number;
  estimatedTime: number;
}
