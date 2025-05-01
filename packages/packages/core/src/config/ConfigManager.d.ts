/**
 * 配置管理器
 *
 * 负责加载、合并和解析配置文件
 * 支持：
 * - YAML 配置文件
 * - 环境变量替换
 * - 多环境配置（dev/test/prod）
 * - 默认配置合并
 */
import { ConfigManagerOptions, ResolvedConfig, Environment, LLMConfig } from './types.js'
/**
 * 配置管理器
 */
export declare class ConfigManager {
  private configPath
  private environment
  private enableEnvVar
  private strict
  private resolvedConfig
  constructor(options?: ConfigManagerOptions)
  /**
   * 检测当前环境
   */
  private detectEnvironment
  /**
   * 加载配置文件
   */
  load(): ResolvedConfig
  /**
   * 重新加载配置
   */
  reload(): ResolvedConfig
  /**
   * 获取 LLM 配置
   */
  getLLMConfig(): LLMConfig
  /**
   * 获取主 LLM 配置
   */
  getPrimaryLLMConfig(): import('./types.js').LLMProviderConfig
  /**
   * 获取备用 LLM 配置
   */
  getFallbackLLMConfig(): import('./types.js').LLMProviderConfig | undefined
  /**
   * 获取特定配置值
   */
  get<T = unknown>(key: string): T | undefined
  /**
   * 设置配置值（仅内存）
   */
  set(key: string, value: unknown): void
  /**
   * 验证配置文件结构
   */
  private validateConfigFile
  /**
   * 合并配置（default -> environment）
   */
  private mergeConfig
  /**
   * 深度合并对象
   */
  private deepMerge
  /**
   * 替换环境变量占位符
   *
   * 支持格式：
   * - ${VAR_NAME}
   * - ${VAR_NAME:default_value}
   */
  private replaceEnvVars
  /**
   * 应用默认配置
   */
  private applyDefaults
  /**
   * 获取默认配置
   */
  private getDefaultConfig
  /**
   * 创建配置目录和示例文件
   */
  static createExampleConfig(outputPath?: string): void
  /**
   * 获取配置文件路径
   */
  getConfigPath(): string
  /**
   * 获取当前环境
   */
  getEnvironment(): Environment
}
/**
 * 获取全局配置管理器
 */
export declare function getConfigManager(options?: ConfigManagerOptions): ConfigManager
/**
 * 重置全局配置管理器（主要用于测试）
 */
export declare function resetConfigManager(): void
//# sourceMappingURL=ConfigManager.d.ts.map
