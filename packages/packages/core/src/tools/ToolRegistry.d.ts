import { ToolRegistry as IToolRegistry, Tool } from '../lifecycle/Lifecycle.js'
import { EventBus } from '../eventbus/EventBus.js'
/**
 * 工具注册表实现
 *
 * 提供工具的注册、调用和管理
 */
export declare class ToolRegistry implements IToolRegistry {
  /** 工具存储 */
  private tools
  /** 事件总线 */
  private eventBus
  constructor(eventBus: EventBus)
  /**
   * 注册工具
   *
   * @param tool 工具
   */
  register(tool: Tool): void
  /**
   * 注销工具
   *
   * @param name 工具名称
   */
  unregister(name: string): void
  /**
   * 获取工具
   *
   * @param name 工具名称
   * @returns 工具或 undefined
   */
  get(name: string): Tool | undefined
  /**
   * 调用工具
   *
   * @param name 工具名称
   * @param input 输入参数
   * @returns 输出结果
   */
  call(name: string, input: unknown): Promise<unknown>
  /**
   * 列出所有工具
   *
   * @returns 工具列表
   */
  list(): Tool[]
  /**
   * 检查工具是否存在
   *
   * @param name 工具名称
   * @returns 是否存在
   */
  has(name: string): boolean
  /**
   * 获取工具数量
   *
   * @returns 工具数量
   */
  size(): number
  /**
   * 清空所有工具
   */
  clear(): void
}
/**
 * 基础工具类
 *
 * 提供工具的默认实现
 */
export declare abstract class BaseTool implements Tool {
  abstract readonly name: string
  abstract readonly description: string
  readonly inputSchema?: unknown
  abstract execute(input: unknown): Promise<unknown>
}
/**
 * 工具包装器
 *
 * 将普通函数包装为工具
 */
export declare class ToolWrapper extends BaseTool {
  readonly name: string
  readonly description: string
  readonly inputSchema?: unknown
  private executor
  constructor(
    name: string,
    description: string,
    executor: (input: unknown) => Promise<unknown>,
    inputSchema?: unknown
  )
  execute(input: unknown): Promise<unknown>
}
//# sourceMappingURL=ToolRegistry.d.ts.map
