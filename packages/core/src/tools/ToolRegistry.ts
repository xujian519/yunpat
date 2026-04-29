import { ToolRegistry as IToolRegistry, Tool } from '../lifecycle/Lifecycle.js';
import { EventBus } from '../eventbus/EventBus.js';

/**
 * 工具注册表实现
 *
 * 提供工具的注册、调用和管理
 */
export class ToolRegistry implements IToolRegistry {
  /** 工具存储 */
  private tools = new Map<string, Tool>();

  /** 事件总线 */
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  /**
   * 注册工具
   *
   * @param tool 工具
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }

    this.tools.set(tool.name, tool);

    // 发布工具注册事件
    this.eventBus.publish({
      type: 'tool:registered',
      source: 'ToolRegistry',
      data: {
        toolName: tool.name,
        description: tool.description,
      },
      timestamp: new Date(),
    });
  }

  /**
   * 注销工具
   *
   * @param name 工具名称
   */
  unregister(name: string): void {
    if (!this.tools.has(name)) {
      throw new Error(`Tool not found: ${name}`);
    }

    this.tools.delete(name);

    // 发布工具注销事件
    this.eventBus.publish({
      type: 'tool:unregistered',
      source: 'ToolRegistry',
      data: { toolName: name },
      timestamp: new Date(),
    });
  }

  /**
   * 获取工具
   *
   * @param name 工具名称
   * @returns 工具或 undefined
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * 调用工具
   *
   * @param name 工具名称
   * @param input 输入参数
   * @returns 输出结果
   */
  async call(name: string, input: any): Promise<any> {
    const tool = this.tools.get(name);

    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    // 发布工具调用事件
    this.eventBus.publish({
      type: 'tool:called',
      source: 'ToolRegistry',
      data: {
        toolName: name,
        input,
      },
      timestamp: new Date(),
    });

    try {
      // 执行工具
      const result = await tool.execute(input);

      // 发布工具成功事件
      this.eventBus.publish({
        type: 'tool:success',
        source: 'ToolRegistry',
        data: {
          toolName: name,
          result,
        },
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      // 发布工具错误事件
      this.eventBus.publish({
        type: 'tool:error',
        source: 'ToolRegistry',
        data: {
          toolName: name,
          error: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      });

      throw error;
    }
  }

  /**
   * 列出所有工具
   *
   * @returns 工具列表
   */
  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * 检查工具是否存在
   *
   * @param name 工具名称
   * @returns 是否存在
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * 获取工具数量
   *
   * @returns 工具数量
   */
  size(): number {
    return this.tools.size;
  }

  /**
   * 清空所有工具
   */
  clear(): void {
    this.tools.clear();
  }
}

/**
 * 基础工具类
 *
 * 提供工具的默认实现
 */
export abstract class BaseTool implements Tool {
  abstract readonly name: string;
  abstract readonly description: string;
  readonly inputSchema?: any;

  abstract execute(input: any): Promise<any>;
}

/**
 * 工具包装器
 *
 * 将普通函数包装为工具
 */
export class ToolWrapper extends BaseTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema?: any;

  private executor: (input: any) => Promise<any>;

  constructor(
    name: string,
    description: string,
    executor: (input: any) => Promise<any>,
    inputSchema?: any
  ) {
    super();
    this.name = name;
    this.description = description;
    this.executor = executor;
    this.inputSchema = inputSchema;
  }

  async execute(input: any): Promise<any> {
    return this.executor(input);
  }
}
