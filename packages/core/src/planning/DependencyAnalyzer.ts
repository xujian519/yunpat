/**
 * 依赖分析器
 *
 * 分析任务和子目标之间的依赖关系，构建依赖图，检测循环依赖
 */

import type { Dependency, DependencyGraph, SubGoal, DependencyAnalyzerConfig } from './types.js';
import { DependencyType, TaskType } from './types.js';

/**
 * 依赖分析器
 */
export class DependencyAnalyzer {
  private config: Required<DependencyAnalyzerConfig>;

  constructor(config: DependencyAnalyzerConfig = {}) {
    this.config = {
      detectCycles: config.detectCycles ?? true,
      autoFixCycles: config.autoFixCycles ?? false,
      defaultDependencyType: config.defaultDependencyType ?? DependencyType.STRONG,
      minDependencyStrength: config.minDependencyStrength ?? 0.3,
    };
  }

  /**
   * 分析子目标之间的依赖关系
   */
  analyzeDependencies(subGoals: SubGoal[], existingDependencies?: Dependency[]): DependencyGraph {
    const nodes = new Map<string, SubGoal>();
    const edges: Dependency[] = [...(existingDependencies || [])];

    // 构建节点映射
    subGoals.forEach((goal) => {
      nodes.set(goal.id, goal);
    });

    // 分析隐式依赖（基于任务描述、关键词等）
    const implicitDependencies = this.detectImplicitDependencies(subGoals);
    edges.push(...implicitDependencies);

    // 检测循环依赖
    let hasCycles = false;
    if (this.config.detectCycles) {
      hasCycles = this.detectCycles(nodes, edges);

      // 如果配置了自动修复且存在循环依赖
      if (hasCycles && this.config.autoFixCycles) {
        const fixedEdges = this.fixCycles(nodes, edges);
        edges.splice(0, edges.length, ...fixedEdges);
        hasCycles = false;
      }
    }

    // 计算拓扑排序（如果无循环依赖）
    let topologicalOrder: string[] | undefined;
    if (!hasCycles) {
      topologicalOrder = this.topologicalSort(nodes, edges);
    }

    return {
      nodes,
      edges,
      hasCycles,
      topologicalOrder,
    };
  }

  /**
   * 检测隐式依赖关系
   */
  private detectImplicitDependencies(subGoals: SubGoal[]): Dependency[] {
    const dependencies: Dependency[] = [];

    for (let i = 0; i < subGoals.length; i++) {
      for (let j = i + 1; j < subGoals.length; j++) {
        const goalA = subGoals[i];
        const goalB = subGoals[j];

        // 检查是否存在依赖关系
        const dep = this.checkDependency(goalA, goalB);
        if (dep) {
          dependencies.push(dep);
        }

        // 反向检查
        const depReverse = this.checkDependency(goalB, goalA);
        if (depReverse) {
          dependencies.push(depReverse);
        }
      }
    }

    // 过滤掉低强度的依赖
    return dependencies.filter((dep) => dep.strength >= this.config.minDependencyStrength);
  }

  /**
   * 检查两个子目标之间是否存在依赖关系
   */
  private checkDependency(fromGoal: SubGoal, toGoal: SubGoal): Dependency | null {
    let strength = 0;
    const reasons: string[] = [];

    // 检查显式依赖声明
    if (toGoal.dependencies.includes(fromGoal.id)) {
      strength = Math.max(strength, 1.0);
      reasons.push('显式声明');
    }

    // 检查关键词依赖
    const fromKeywords = this.extractKeywords(fromGoal);
    const toKeywords = this.extractKeywords(toGoal);
    const keywordOverlap = this.calculateKeywordOverlap(fromKeywords, toKeywords);

    // 降低阈值以检测关键词重叠（与配置的minDependencyStrength一致）
    if (keywordOverlap > 0.2) {
      strength = Math.max(strength, keywordOverlap * 0.8); // 提高权重
      reasons.push(`关键词重叠: ${keywordOverlap.toFixed(2)}`);
    }

    // 检查任务类型依赖（某些类型任务有先后顺序）
    const typeDepStrength = this.checkTaskTypeDependency(fromGoal, toGoal);
    if (typeDepStrength > 0) {
      strength = Math.max(strength, typeDepStrength);
      reasons.push('任务类型依赖');
    }

    // 检查优先级依赖（高优先级可能依赖低优先级的某些前置任务）
    if (fromGoal.priority === 'critical' && toGoal.priority === 'low') {
      strength = Math.max(strength, 0.2);
      reasons.push('优先级差异');
    }

    if (strength > 0 && strength >= this.config.minDependencyStrength) {
      return {
        from: fromGoal.id,
        to: toGoal.id,
        type: this.inferDependencyType(strength),
        strength,
        description: reasons.join('; '),
      };
    }

    return null;
  }

  /**
   * 提取关键词
   */
  private extractKeywords(goal: SubGoal): Set<string> {
    const keywords = new Set<string>();

    // 辅助函数：从文本中提取关键词
    const extractFromText = (text: string): void => {
      if (!text) return;

      // 匹配英文单词（2个字母或以上）
      const englishMatches = text.toLowerCase().match(/[a-z]{2,}/g) || [];
      englishMatches.forEach((word) => keywords.add(word));

      // 对于中文，提取2个字的词
      // 例如："深度学习训练" -> ["深度", "学习", "训练"]
      const chineseMatches = text.match(/[一-龥]/g) || [];
      for (let i = 0; i < chineseMatches.length - 1; i++) {
        const twoCharWord = chineseMatches[i] + chineseMatches[i + 1];
        keywords.add(twoCharWord);
      }

      // 同时也提取3个字的词（更精确的术语）
      for (let i = 0; i < chineseMatches.length - 2; i++) {
        const threeCharWord = chineseMatches[i] + chineseMatches[i + 1] + chineseMatches[i + 2];
        keywords.add(threeCharWord);
      }
    };

    // 从标题提取
    extractFromText(goal.title);

    // 从描述提取
    extractFromText(goal.description);

    // 从任务标题提取
    goal.tasks.forEach((task) => {
      extractFromText(task.title);
      extractFromText(task.description);
    });

    return keywords;
  }

  /**
   * 计算关键词重叠度
   */
  private calculateKeywordOverlap(keywordsA: Set<string>, keywordsB: Set<string>): number {
    if (keywordsA.size === 0 || keywordsB.size === 0) {
      return 0;
    }

    const intersection = new Set<string>();
    keywordsA.forEach((word) => {
      if (keywordsB.has(word)) {
        intersection.add(word);
      }
    });

    const union = new Set([...keywordsA, ...keywordsB]);
    return intersection.size / union.size;
  }

  /**
   * 检查任务类型依赖
   */
  private checkTaskTypeDependency(fromGoal: SubGoal, toGoal: SubGoal): number {
    const fromTypes = new Set(fromGoal.tasks.map((t) => t.type));
    const toTypes = new Set(toGoal.tasks.map((t) => t.type));

    // 研究任务应该在分析任务之前
    if (fromTypes.has(TaskType.RESEARCH) && toTypes.has(TaskType.ANALYSIS)) {
      return 0.6;
    }

    // 分析任务应该在撰写任务之前
    if (fromTypes.has(TaskType.ANALYSIS) && toTypes.has(TaskType.WRITING)) {
      return 0.7;
    }

    // 撰写任务应该在审查任务之前
    if (fromTypes.has(TaskType.WRITING) && toTypes.has(TaskType.REVIEW)) {
      return 0.8;
    }

    // 生成任务应该在验证任务之前
    if (fromTypes.has(TaskType.GENERATION) && toTypes.has(TaskType.VALIDATION)) {
      return 0.9;
    }

    return 0;
  }

  /**
   * 推断依赖类型
   */
  private inferDependencyType(strength: number): DependencyType {
    if (strength >= 0.8) {
      return DependencyType.STRONG;
    } else if (strength >= 0.5) {
      return DependencyType.WEAK;
    } else {
      return DependencyType.ORDERING;
    }
  }

  /**
   * 检测循环依赖（使用DFS）
   */
  private detectCycles(nodes: Map<string, SubGoal>, edges: Dependency[]): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      if (recursionStack.has(nodeId)) {
        return true; // 找到循环
      }
      if (visited.has(nodeId)) {
        return false;
      }

      visited.add(nodeId);
      recursionStack.add(nodeId);

      // 获取所有出边
      const outgoingEdges = edges.filter((e) => e.from === nodeId);
      for (const edge of outgoingEdges) {
        if (dfs(edge.to)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const nodeId of nodes.keys()) {
      if (dfs(nodeId)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 修复循环依赖（移除强度最低的边）
   */
  private fixCycles(nodes: Map<string, SubGoal>, edges: Dependency[]): Dependency[] {
    const fixedEdges = [...edges];
    let hasCycles = true;

    while (hasCycles) {
      // 检测循环
      const cycle = this.findCycle(nodes, fixedEdges);
      if (!cycle) {
        hasCycles = false;
        break;
      }

      // 在循环中找到强度最低的边
      let minStrength = 1.0;
      let edgeToRemove: Dependency | null = null;

      for (let i = 0; i < cycle.length; i++) {
        const from = cycle[i];
        const to = cycle[(i + 1) % cycle.length];
        const edge = fixedEdges.find((e) => e.from === from && e.to === to);
        if (edge && edge.strength < minStrength) {
          minStrength = edge.strength;
          edgeToRemove = edge;
        }
      }

      // 移除该边
      if (edgeToRemove) {
        const index = fixedEdges.indexOf(edgeToRemove);
        if (index > -1) {
          fixedEdges.splice(index, 1);
        }
      } else {
        // 如果找不到边，强制退出
        hasCycles = false;
      }
    }

    return fixedEdges;
  }

  /**
   * 查找循环路径
   */
  private findCycle(nodes: Map<string, SubGoal>, edges: Dependency[]): string[] | null {
    const _parent = new Map<string, string | null>(); // 保留用于未来实现路径追踪
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string, path: string[]): string[] | null => {
      if (recursionStack.has(nodeId)) {
        // 找到循环，返回循环路径
        const cycleStart = path.indexOf(nodeId);
        return path.slice(cycleStart);
      }
      if (visited.has(nodeId)) {
        return null;
      }

      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      // 获取所有出边
      const outgoingEdges = edges.filter((e) => e.from === nodeId);
      for (const edge of outgoingEdges) {
        const result = dfs(edge.to, [...path]);
        if (result) {
          return result;
        }
      }

      recursionStack.delete(nodeId);
      return null;
    };

    for (const nodeId of nodes.keys()) {
      const cycle = dfs(nodeId, []);
      if (cycle) {
        return cycle;
      }
    }

    return null;
  }

  /**
   * 拓扑排序（Kahn算法）
   */
  private topologicalSort(nodes: Map<string, SubGoal>, edges: Dependency[]): string[] {
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();

    // 初始化
    nodes.forEach((_, id) => {
      inDegree.set(id, 0);
      adjList.set(id, []);
    });

    // 构建邻接表和入度
    edges.forEach((edge) => {
      adjList.get(edge.from)?.push(edge.to);
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
    });

    // 找到所有入度为0的节点
    const queue: string[] = [];
    inDegree.forEach((degree, id) => {
      if (degree === 0) {
        queue.push(id);
      }
    });

    const result: string[] = [];
    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);

      // 减少邻居的入度
      const neighbors = adjList.get(node) || [];
      for (const neighbor of neighbors) {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    return result;
  }

  /**
   * 计算关键路径
   */
  findCriticalPath(graph: DependencyGraph): string[] {
    if (graph.hasCycles || !graph.topologicalOrder) {
      return [];
    }

    const earliestStart = new Map<string, number>();
    const latestStart = new Map<string, number>();

    // 初始化
    graph.nodes.forEach((node, id) => {
      earliestStart.set(id, 0);
      latestStart.set(id, Infinity);
    });

    // 计算最早开始时间
    const order = graph.topologicalOrder;
    for (const nodeId of order) {
      const incomingEdges = graph.edges.filter((e) => e.to === nodeId);
      for (const edge of incomingEdges) {
        const fromDuration = graph.nodes.get(edge.from)?.estimatedDuration || 0;
        const newStart = (earliestStart.get(edge.from) || 0) + fromDuration;
        earliestStart.set(nodeId, Math.max(earliestStart.get(nodeId) || 0, newStart));
      }
    }

    // 计算最晚开始时间（从后往前）
    for (let i = order.length - 1; i >= 0; i--) {
      const nodeId = order[i];
      const outgoingEdges = graph.edges.filter((e) => e.from === nodeId);
      const currentNode = graph.nodes.get(nodeId);

      if (outgoingEdges.length === 0) {
        // 终点节点：最晚开始时间 = 最早开始时间
        latestStart.set(nodeId, earliestStart.get(nodeId) || 0);
      } else {
        // 非终点节点：最晚开始时间 = min(后继节点的最晚开始时间) - 当前节点持续时间
        let minLatest = Infinity;
        for (const edge of outgoingEdges) {
          const toLatest = latestStart.get(edge.to) || 0;
          minLatest = Math.min(minLatest, toLatest);
        }
        // 减去当前节点的持续时间
        const currentDuration = currentNode?.estimatedDuration || 0;
        latestStart.set(nodeId, Math.max(0, minLatest - currentDuration));
      }
    }

    // 找出所有在关键路径上的节点（最早开始 = 最晚开始）
    const criticalPath: string[] = [];
    for (const nodeId of order) {
      if (Math.abs((earliestStart.get(nodeId) || 0) - (latestStart.get(nodeId) || 0)) < 0.01) {
        criticalPath.push(nodeId);
      }
    }

    return criticalPath;
  }

  /**
   * 计算统计信息
   */
  getStats(graph: DependencyGraph): {
    totalNodes: number;
    totalEdges: number;
    avgDegree: number;
    maxDegree: number;
    hasCycles: boolean;
    criticalPathLength: number;
  } {
    const degrees = new Map<string, number>();

    graph.edges.forEach((edge) => {
      degrees.set(edge.from, (degrees.get(edge.from) || 0) + 1);
      degrees.set(edge.to, (degrees.get(edge.to) || 0) + 1);
    });

    const degreeValues = Array.from(degrees.values());
    const avgDegree =
      degreeValues.length > 0
        ? degreeValues.reduce((sum, d) => sum + d, 0) / degreeValues.length
        : 0;
    const maxDegree = degreeValues.length > 0 ? Math.max(...degreeValues) : 0;

    return {
      totalNodes: graph.nodes.size,
      totalEdges: graph.edges.length,
      avgDegree,
      maxDegree,
      hasCycles: graph.hasCycles,
      criticalPathLength: this.findCriticalPath(graph).length,
    };
  }
}
