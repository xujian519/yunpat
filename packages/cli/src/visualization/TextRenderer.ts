/**
 * 文本渲染器
 *
 * 在CLI中渲染任务依赖图的文本表示
 */

import type {
  HierarchicalPlan,
  DependencyGraph,
  TextRenderOptions,
  RenderResult,
  ProgressInfo,
  GraphStats,
  NodeStyle,
  EdgeStyle,
} from './types.js';
import { TaskStatus } from '@yunpat/core';

/**
 * 文本渲染器
 */
export class TextRenderer {
  private nodeStyles: Map<string, NodeStyle>;
  private edgeStyles: Map<string, EdgeStyle>;

  constructor() {
    this.nodeStyles = new Map();
    this.edgeStyles = new Map();
    this.initializeDefaultStyles();
  }

  /**
   * 渲染为文本格式
   */
  render(
    plan: HierarchicalPlan,
    options: TextRenderOptions = { format: 'text' }
  ): RenderResult {
    const startTime = Date.now();

    let content = '';

    switch (options.format) {
      case 'tree':
        content = this.renderTree(plan, options);
        break;
      case 'graph':
        content = this.renderGraph(plan, options);
        break;
      default:
        content = this.renderText(plan, options);
        break;
    }

    const renderTime = Date.now() - startTime;

    return {
      content,
      metadata: {
        renderTime,
        nodeCount: plan.subGoals.length,
        edgeCount: plan.dependencies.edges.length,
        format: options.format,
      },
    };
  }

  /**
   * 渲染为文本格式（默认）
   */
  private renderText(plan: HierarchicalPlan, options: TextRenderOptions): string {
    const lines: string[] = [];

    // 标题
    lines.push('='.repeat(80));
    lines.push(`📋 任务依赖图: ${plan.goal}`);
    lines.push('='.repeat(80));
    lines.push('');

    // 进度信息
    if (options.showProgress) {
      const progress = this.calculateProgress(plan);
      lines.push(this.renderProgress(progress));
      lines.push('');
    }

    // 统计信息
    if (options.showMetrics) {
      const stats = this.calculateStats(plan);
      lines.push(this.renderStats(stats));
      lines.push('');
    }

    // 依赖关系
    lines.push(this.renderDependencies(plan, options));
    lines.push('');

    // 任务列表
    lines.push(this.renderTaskList(plan, options));

    return lines.join('\n');
  }

  /**
   * 渲染为树状格式
   */
  private renderTree(plan: HierarchicalPlan, options: TextRenderOptions): string {
    const lines: string[] = [];

    lines.push('📊 任务依赖树');
    lines.push('');

    // 使用拓扑排序作为树的根节点顺序
    const order = plan.dependencies.topologicalOrder || plan.subGoals.map(g => g.id);

    for (const rootId of order) {
      const subtree = this.renderSubtree(rootId, plan, 0, options.maxDepth || 3);
      lines.push(subtree);
    }

    return lines.join('\n');
  }

  /**
   * 渲染子树
   */
  private renderSubtree(
    nodeId: string,
    plan: HierarchicalPlan,
    depth: number,
    maxDepth: number
  ): string {
    const node = plan.subGoals.find(g => g.id === nodeId);
    if (!node) {
      return '';
    }

    const indent = '  '.repeat(depth);
    const prefix = depth === 0 ? '' : '└─ ';
    const icon = this.getStatusIcon(node.status);
    const statusText = this.getStatusText(node.status);

    let result = `${indent}${prefix}${icon} ${node.title} [${node.id}] ${statusText}\n`;

    // 递归渲染依赖的任务
    if (depth < maxDepth) {
      for (const depId of node.dependencies) {
        const depSubtree = this.renderSubtree(depId, plan, depth + 1, maxDepth);
        result += depSubtree;
      }
    }

    return result;
  }

  /**
   * 渲染为图格式（ASCII艺术）
   */
  private renderGraph(plan: HierarchicalPlan, options: TextRenderOptions): string {
    const lines: string[] = [];

    lines.push('📊 任务依赖图');
    lines.push('');

    // 简单的ASCII图表示
    const order = plan.dependencies.topologicalOrder || plan.subGoals.map(g => g.id);

    for (let i = 0; i < order.length; i++) {
      const nodeId = order[i];
      const node = plan.subGoals.find(g => g.id === nodeId);
      if (!node) continue;

      const icon = this.getStatusIcon(node.status);
      const line = `${icon} [${nodeId}] ${node.title}`;

      // 显示依赖关系
      if (node.dependencies.length > 0) {
        const deps = node.dependencies.map(d => {
          const depNode = plan.subGoals.find(g => g.id === d);
          return depNode ? depNode.title : d;
        }).join(', ');
        line += ` ← 依赖: ${deps}`;
      }

      lines.push(line);

      // 绘制连接线
      if (i < order.length - 1) {
        lines.push('  ↓');
      }
    }

    return lines.join('\n');
  }

  /**
   * 渲染依赖关系
   */
  private renderDependencies(plan: HierarchicalPlan, options: TextRenderOptions): string {
    const lines: string[] = [];

    lines.push('🔗 依赖关系:');
    lines.push('');

    if (plan.dependencies.edges.length === 0) {
      lines.push('  (无依赖关系)');
      return lines.join('\n');
    }

    for (const edge of plan.dependencies.edges) {
      const fromNode = plan.subGoals.find(g => g.id === edge.from);
      const toNode = plan.subGoals.find(g => g => g.id === edge.to);

      if (fromNode && toNode) {
        const strengthIcon = this.getStrengthIcon(edge.strength);
        lines.push(
          `  ${strengthIcon} [${edge.from}] ${fromNode.title} → [${edge.to}] ${toNode.title}`
        );

        if (options.includeDetails && edge.description) {
          lines.push(`      描述: ${edge.description}`);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * 渲染任务列表
   */
  private renderTaskList(plan: HierarchicalPlan, options: TextRenderOptions): string {
    const lines: string[] = [];

    lines.push('📝 任务列表:');
    lines.push('');

    const order = plan.dependencies.topologicalOrder || plan.subGoals.map(g => g.id);

    for (const nodeId of order) {
      const node = plan.subGoals.find(g => g.id === nodeId);
      if (!node) continue;

      const icon = this.getStatusIcon(node.status);
      const priorityIcon = this.getPriorityIcon(node.priority);

      lines.push(
        `  ${icon} [${node.id}] ${node.title} ${priorityIcon}`
      );

      if (options.includeDetails) {
        lines.push(`      描述: ${node.description}`);
        lines.push(`      任务: ${node.tasks.length}个`);
        lines.push(`      预估: ${node.estimatedDuration}s, ${node.estimatedTokens} tokens`);

        if (node.dependencies.length > 0) {
          lines.push(`      依赖: ${node.dependencies.join(', ')}`);
        }
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * 渲染进度信息
   */
  private renderProgress(progress: ProgressInfo): string {
    const percentageBar = this.createProgressBar(progress.percentage);

    return `⏳️ 进度: ${progress.completed}/${progress.total} (${progress.percentage.toFixed(1)}%) ${percentageBar}`;
  }

  /**
   * 渲染统计信息
   */
  private renderStats(stats: GraphStats): string {
    const lines: string[] = [];

    lines.push('📊 统计信息:');
    lines.push(`  总任务数: ${stats.totalNodes}`);
    lines.push(`  依赖关系数: ${stats.totalEdges}`);
    lines.push(`  关键路径长度: ${stats.criticalPathLength}`);
    lines.push(`  最大深度: ${stats.maxDepth}`);
    lines.push(`  预计总时间: ${this.formatDuration(stats.estimatedTime)}`);

    return lines.join('\n');
  }

  /**
   * 计算进度
   */
  private calculateProgress(plan: HierarchicalPlan): ProgressInfo {
    let completed = 0;
    let inProgress = 0;
    const pending = plan.subGoals.length;

    for (const goal of plan.subGoals) {
      if (goal.status === TaskStatus.COMPLETED) {
        completed++;
      } else if (goal.status === TaskStatus.IN_PROGRESS) {
        inProgress++;
      }
    }

    const total = pending;
    const percentage = total > 0 ? (completed / total) * 100 : 0;

    return { total, completed, inProgress, pending, percentage };
  }

  /**
   * 计算统计信息
   */
  private calculateStats(plan: HierarchicalPlan): GraphStats {
    const totalNodes = plan.subGoals.length;
    const totalEdges = plan.dependencies.edges.length;

    // 计算关键路径长度
    let criticalPathLength = 0;
    if (plan.dependencies.topologicalOrder) {
      criticalPathLength = plan.dependencies.topologicalOrder.length;
    }

    // 计算最大深度
    const maxDepth = this.calculateMaxDepth(plan);

    // 计算预计总时间
    const estimatedTime = plan.subGoals.reduce(
      (sum, goal) => sum + goal.estimatedDuration,
      0
    );

    return {
      totalNodes,
      totalEdges,
      criticalPathLength,
      maxDepth,
      estimatedTime,
    };
  }

  /**
   * 计算最大深度
   */
  private calculateMaxDepth(plan: HierarchicalPlan): number {
    const visited = new Set<string>();

    const calculateDepth = (nodeId: string, currentDepth: number): number => {
      if (visited.has(nodeId)) {
        return currentDepth;
      }

      visited.add(nodeId);
      let maxChildDepth = currentDepth;

      const node = plan.subGoals.find(g => g.id === nodeId);
      if (node) {
        for (const depId of node.dependencies) {
          const childDepth = calculateDepth(depId, currentDepth + 1);
          maxChildDepth = Math.max(maxChildDepth, childDepth);
        }
      }

      return maxChildDepth;
    };

    let maxDepth = 0;
    for (const nodeId of plan.subGoals.map(g => g.id)) {
      const depth = calculateDepth(nodeId, 0);
      maxDepth = Math.max(maxDepth, depth);
    }

    return maxDepth;
  }

  /**
   * 创建进度条
   */
  private createProgressBar(percentage: number, width = 20): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
  }

  /**
   * 格式化持续时间
   */
  private formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}秒`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes}分${seconds % 60}秒`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}小时${minutes}分`;
    }
  }

  /**
   * 获取状态图标
   */
  private getStatusIcon(status: TaskStatus): string {
    const icons = {
      [TaskStatus.PENDING]: '⏸️',
      [TaskStatus.IN_PROGRESS]: '⏳',
      [TaskStatus.COMPLETED]: '✅',
      [TaskStatus.FAILED]: '❌',
      [TaskStatus.SKIPPED]: '⏭️',
      [TaskStatus.BLOCKED]: '🚫',
    };
    return icons[status] || '⏸️';
  }

  /**
   * 获取状态文本
   */
  private getStatusText(status: TaskStatus): string {
    const texts = {
      [TaskStatus.PENDING]: '等待中',
      [TaskStatus.IN_PROGRESS]: '进行中',
      [TaskStatus.COMPLETED]: '已完成',
      [TaskStatus.FAILED]: '已失败',
      [TaskStatus.SKIPPED]: '已跳过',
      [TaskStatus.BLOCKED]: '被阻塞',
    };
    return texts[status] || '未知';
  }

  /**
   * 获取优先级图标
   */
  private getPriorityIcon(priority: any): string {
    const icons = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢',
    };
    return icons[priority] || '⚪';
  }

  /**
   * 获取强度图标
   */
  private getStrengthIcon(strength: number): string {
    if (strength >= 0.8) {
      return '🔗'; // 强依赖
    } else if (strength >= 0.5) {
      return '🔗'; // 中等依赖
    } else {
      return '📍'; // 弱依赖
    }
  }

  /**
   * 初始化默认样式
   */
  private initializeDefaultStyles(): void {
    // 按状态设置节点样式
    this.nodeStyles.set('pending', {
      shape: 'box',
      color: '#666666',
      fillColor: '#f5f5f5',
      borderColor: '#cccccc',
      borderWidth: 1,
      fontSize: 12,
      fontColor: '#333333',
    });

    this.nodeStyles.set('in_progress', {
      shape: 'box',
      color: '#1976d2',
      fillColor: '#e3f2fd',
      borderColor: '#2196f3',
      borderWidth: 2,
      fontSize: 12,
      fontColor: '#0d47a1',
    });

    this.nodeStyles.set('completed', {
      shape: 'box',
      color: '#388e3c',
      fillColor: '#e8f5e9',
      borderColor: '#4caf50',
      borderWidth: 1,
      fontSize: 12,
      fontColor: '#1b5e20',
    });

    this.nodeStyles.set('failed', {
      shape: 'box',
      color: '#d32f2f',
      fillColor: '#ffebee',
      borderColor: '#f44336',
      borderWidth: 2,
      fontSize: 12,
      fontColor: '#b71c1c',
    });

    // 按强度设置边样式
    this.edgeStyles.set('strong', {
      color: '#333333',
      style: 'solid',
      thickness: 2,
    });

    this.edgeStyles.set('weak', {
      color: '#999999',
      style: 'dashed',
      thickness: 1,
    });

    this.edgeStyles.set('ordering', {
      color: '#666666',
      style: 'dotted',
      thickness: 1,
    });
  }

  /**
   * 导出为DOT格式
   */
  exportToDOT(plan: HierarchicalPlan): string {
    const lines: string[] = [];

    lines.push('digraph TaskDependencies {');
    lines.push('  rankdir=TB;');
    lines.push('  node [shape=box, style=rounded];');
    lines.push('');

    // 添加节点
    for (const node of plan.subGoals) {
      const style = this.nodeStyles.get(node.status) || this.nodeStyles.get('pending');
      const label = this.escapeLabel(node.title);

      lines.push(
        `  "${node.id}" [label="${label}", ` +
        `fillcolor="${style.fillColor}", ` +
        `color="${style.fontColor}", ` +
        `penwidth=${style.borderWidth}];`
      );
    }

    lines.push('');

    // 添加边
    for (const edge of plan.dependencies.edges) {
      const style = this.edgeStyles.get(edge.type) || this.edgeStyles.get('ordering');
      const styleAttr = style.style === 'solid' ? 'solid' : style.style;

      lines.push(
        `  "${edge.from}" -> "${edge.to}" ` +
        `[style=${styleAttr}, ` +
        `color="${style.color}", ` +
        `penwidth=${style.thickness}];`
      );
    }

    lines.push('}');

    return lines.join('\n');
  }

  /**
   * 导出为Mermaid格式
   */
  exportToMermaid(plan: HierarchicalPlan): string {
    const lines: string[] = [];

    lines.push('graph TD');
    lines.push('');

    // 添加节点
    for (const node of plan.subGoals) {
      const statusIcon = this.getStatusIcon(node.status);
      const label = `${statusIcon} ${node.title}\\n[${node.id}]`;

      lines.push(`  ${node.id}["${label}"]`);

      // 设置节点样式
      const style = this.nodeStyles.get(node.status) || this.nodeStyles.get('pending');
      lines.push(`    ${node.id}["fillcolor:${style.fillColor}"]`);
    }

    lines.push('');

    // 添加边
    for (const edge of plan.dependencies.edges) {
      lines.push(`  ${edge.from} --> ${edge.to};`);
    }

    return lines.join('\n');
  }

  /**
   * 转义标签中的特殊字符
   */
  private escapeLabel(label: string): string {
    return label
      .replace(/"/g, '\\/')
      .replace(/"/g, '\\/')
      .replace(/"/g, '\\/')
      .replace(/"/g, '\\/');
  }

  /**
   * 更新节点样式
   */
  setNodeStyle(status: string, style: NodeStyle): void {
    this.nodeStyles.set(status, style);
  }

  /**
   * 更新边样式
   */
  setEdgeStyle(type: string, style: EdgeStyle): void {
    this.edgeStyles.set(type, style);
  }
}
