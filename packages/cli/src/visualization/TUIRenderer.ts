/**
 * TUI渲染器
 *
 * 在终端中提供交互式的任务依赖图浏览界面
 */

import type {
  HierarchicalPlan,
  TUIRenderOptions,
  RenderResult,
} from './types.js';
import { TaskStatus } from '@yunpat/core';

/**
 * TUI渲染器
 */
export class TUIRenderer {
  private currentNode: string | null;
  private selectedNodes: Set<string>;
  private filterStatus: Set<TaskStatus>;

  constructor() {
    this.currentNode = null;
    this.selectedNodes = new Set();
    this.filterStatus = new Set([
      TaskStatus.PENDING,
      TaskStatus.IN_PROGRESS,
      TaskStatus.COMPLETED,
      TaskStatus.FAILED,
    ]);
  }

  /**
   * 渲染TUI界面
   */
  render(
    plan: HierarchicalPlan,
    options: any = {}
  ): RenderResult {
    const startTime = Date.now();

    const content = this.renderInteractiveView(plan, options);

    const renderTime = Date.now() - startTime;

    return {
      content,
      metadata: {
        renderTime,
        nodeCount: plan.subGoals.length,
        edgeCount: plan.dependencies.edges.length,
        format: 'tui',
      },
    };
  }

  /**
   * 渲染交互式视图
   */
  private renderInteractiveView(
    plan: HierarchicalPlan,
    options: any
  ): string {
    const lines: string[] = [];

    // 标题栏
    lines.push(this.renderTitleBar(plan));

    // 菜单栏
    lines.push(this.renderMenuBar(options));

    // 主内容区
    lines.push(this.renderMainContent(plan, options));

    // 状态栏
    lines.push(this.renderStatusBar(plan));

    // 帮助信息
    if (options.showHelp) {
      lines.push('');
      lines.push(this.renderHelp());
    }

    return lines.join('\n');
  }

  /**
   * 渲染标题栏
   */
  private renderTitleBar(plan: HierarchicalPlan): string {
    const progress = this.calculateProgress(plan);
    const progressBar = this.createProgressBar(progress.percentage, 30);

    return `┌─ 📋 ${plan.goal} ${progressBar} ${progress.completed}/${progress.total} ─┐`;
  }

  /**
   * 渲染菜单栏
   */
  private renderMenuBar(options: TUIRenderOptions): string {
    const items = [
      '[F1] 帮助',
      '[F2] 过滤',
      '[F3] 排序',
      '[F4] 导出',
      '[Q] 退出',
    ];

    return `│ ${items.join('  ')} │`;
  }

  /**
   * 渲染主内容区
   */
  private renderMainContent(
    plan: HierarchicalPlan,
    options: TUIRenderOptions
  ): string {
    const lines: string[] = [];

    lines.push('│');
    lines.push('│ ┌─ 任务列表 ─────────────────────────────────┐');

    // 显示任务列表
    const order = plan.dependencies.topologicalOrder || plan.subGoals.map(g => g.id);

    for (const nodeId of order) {
      const node = plan.subGoals.find(g => g.id === nodeId);
      if (!node) continue;

      // 应用状态过滤
      if (!this.filterStatus.has(node.status)) continue;

      const isSelected = this.selectedNodes.has(nodeId);
      const isCurrent = this.currentNode === nodeId;

      lines.push(this.renderTaskLine(node, isSelected, isCurrent));
    }

    lines.push('│ └────────────────────────────────────────────┘');
    lines.push('│');

    // 如果有选中的任务，显示详细信息
    if (this.currentNode) {
      const node = plan.subGoals.find(g => g.id === this.currentNode);
      if (node) {
        lines.push('│ ┌─ 任务详情 ─────────────────────────────────┐');
        lines.push(this.renderTaskDetail(node, plan));
        lines.push('│ └────────────────────────────────────────────┘');
      }
    }

    return lines.join('\n');
  }

  /**
   * 渲染任务行
   */
  private renderTaskLine(
    node: any,
    isSelected: boolean,
    isCurrent: boolean
  ): string {
    const icon = this.getStatusIcon(node.status);
    const priorityIcon = this.getPriorityIcon(node.priority);
    const marker = isCurrent ? '►' : ' ';
    const selection = isSelected ? '[x]' : '[ ]';

    return `│ │ ${marker} ${selection} ${icon} ${node.title} ${priorityIcon}`;
  }

  /**
   * 渲染任务详情
   */
  private renderTaskDetail(node: any, plan: HierarchicalPlan): string {
    const lines: string[] = [];

    lines.push(`│ │ ID: ${node.id}`);
    lines.push(`│ │ 状态: ${this.getStatusText(node.status)}`);
    lines.push(`│ │ 优先级: ${node.priority}`);
    lines.push(`│ │ 描述: ${node.description}`);
    lines.push(`│ │ 任务数: ${node.tasks.length}`);
    lines.push(`│ │ 预估时间: ${node.estimatedDuration}s`);
    lines.push(`│ │ 预估Token: ${node.estimatedTokens}`);

    // 依赖关系
    if (node.dependencies.length > 0) {
      const depNames = node.dependencies
        .map((d: string) => {
          const depNode = plan.subGoals.find((g: any) => g.id === d);
          return depNode ? depNode.title : d;
        })
        .join(', ');
      lines.push(`│ │ 依赖: ${depNames}`);
    }

    // 被依赖关系
    const dependents = plan.subGoals.filter((g: any) =>
      g.dependencies.includes(node.id)
    );
    if (dependents.length > 0) {
      const depNames = dependents.map((g: any) => g.title).join(', ');
      lines.push(`│ │ 被依赖: ${depNames}`);
    }

    return lines.join('\n');
  }

  /**
   * 渲染状态栏
   */
  private renderStatusBar(plan: HierarchicalPlan): string {
    const stats = this.calculateStats(plan);
    const statusText = `任务: ${stats.totalNodes} | ` +
      `完成: ${stats.completedNodes} | ` +
      `失败: ${stats.failedNodes} | ` +
      `进行中: ${stats.inProgressNodes}`;

    return `│ └─ ${statusText} ─┘`;
  }

  /**
   * 渲染帮助信息
   */
  private renderHelp(): string {
    const lines: string[] = [];

    lines.push('┌─ 键盘快捷键 ─────────────────────────────────┐');
    lines.push('│ 导航:                                        │');
    lines.push('│   ↑/↓    上下移动                          │');
    lines.push('│   Enter  查看详情                          │');
    lines.push('│   Esc    返回列表                          │');
    lines.push('│                                              │');
    lines.push('│ 选择:                                        │');
    lines.push('│   Space  选择/取消选择                      │');
    lines.push('│   A      全选                              │');
    lines.push('│   N      取消全选                          │');
    lines.push('│                                              │');
    lines.push('│ 过滤:                                        │');
    lines.push('│   1      显示待完成任务                    │');
    lines.push('│   2      显示进行中任务                    │');
    lines.push('│   3      显示已完成任务                    │');
    lines.push('│   4      显示失败任务                      │');
    lines.push('│   0      显示所有任务                      │');
    lines.push('│                                              │');
    lines.push('│ 操作:                                        │');
    lines.push('│   D      导出为DOT                         │');
    lines.push('│   M      导出为Mermaid                     │');
    lines.push('│   Q      退出                              │');
    lines.push('└──────────────────────────────────────────────┘');

    return lines.join('\n');
  }

  /**
   * 计算进度
   */
  private calculateProgress(plan: HierarchicalPlan): {
    total: number;
    completed: number;
    percentage: number;
  } {
    const total = plan.subGoals.length;
    const completed = plan.subGoals.filter(
      g => g.status === TaskStatus.COMPLETED
    ).length;
    const percentage = total > 0 ? (completed / total) * 100 : 0;

    return { total, completed, percentage };
  }

  /**
   * 计算统计信息
   */
  private calculateStats(plan: HierarchicalPlan): {
    totalNodes: number;
    completedNodes: number;
    failedNodes: number;
    inProgressNodes: number;
  } {
    return {
      totalNodes: plan.subGoals.length,
      completedNodes: plan.subGoals.filter(
        (g: any) => g.status === TaskStatus.COMPLETED
      ).length,
      failedNodes: plan.subGoals.filter(
        (g: any) => g.status === TaskStatus.FAILED
      ).length,
      inProgressNodes: plan.subGoals.filter(
        (g: any) => g.status === TaskStatus.IN_PROGRESS
      ).length,
    };
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
    const icons: { [key: string]: string } = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢',
    };
    return icons[priority] || '⚪';
  }

  /**
   * 选择节点
   */
  selectNode(nodeId: string): void {
    this.selectedNodes.add(nodeId);
  }

  /**
   * 取消选择节点
   */
  deselectNode(nodeId: string): void {
    this.selectedNodes.delete(nodeId);
  }

  /**
   * 切换节点选择状态
   */
  toggleNode(nodeId: string): void {
    if (this.selectedNodes.has(nodeId)) {
      this.deselectNode(nodeId);
    } else {
      this.selectNode(nodeId);
    }
  }

  /**
   * 清空选择
   */
  clearSelection(): void {
    this.selectedNodes.clear();
  }

  /**
   * 全选
   */
  selectAll(plan: HierarchicalPlan): void {
    for (const node of plan.subGoals) {
      this.selectedNodes.add(node.id);
    }
  }

  /**
   * 设置当前节点
   */
  setCurrentNode(nodeId: string | null): void {
    this.currentNode = nodeId;
  }

  /**
   * 获取当前节点
   */
  getCurrentNode(): string | null {
    return this.currentNode;
  }

  /**
   * 获取选中节点
   */
  getSelectedNodes(): Set<string> {
    return new Set(this.selectedNodes);
  }

  /**
   * 设置状态过滤
   */
  setStatusFilter(statuses: TaskStatus[]): void {
    this.filterStatus = new Set(statuses);
  }

  /**
   * 获取状态过滤
   */
  getStatusFilter(): Set<TaskStatus> {
    return new Set(this.filterStatus);
  }
}
