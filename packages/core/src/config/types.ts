/**
 * 配置系统类型定义
 *
 * 支持多层级配置、环境变量替换、多环境配置
 */

/**
 * 环境类型
 */
export type Environment = 'development' | 'test' | 'production';

/**
 * LLM 提供商配置
 */
export interface LLMProviderConfig {
  /** 提供商名称 */
  provider: string;

  /** API 基础 URL */
  baseURL?: string;

  /** API 密钥（支持环境变量占位符，如 ${DEEPSEEK_API_KEY}） */
  apiKey?: string;

  /** 模型名称 */
  model?: string;

  /** 温度 */
  temperature?: number;

  /** 最大 Token 数 */
  maxTokens?: number;

  /** 超时时间（毫秒） */
  timeout?: number;
}

/**
 * LLM 配置
 */
export interface LLMConfig {
  /** 主模型配置 */
  primary: LLMProviderConfig;

  /** 备用模型配置 */
  fallback?: LLMProviderConfig;

  /** 多模型配置 */
  models?: Record<string, LLMProviderConfig>;
}

/**
 * 记忆配置
 */
export interface MemoryConfig {
  /** 存储类型 */
  type: 'memory' | 'file' | 'database';

  /** 存储路径 */
  path?: string;

  /** 检查点间隔（迭代次数） */
  checkpointInterval?: number;

  /** 最大检查点数量 */
  maxCheckpoints?: number;

  /** 启用时间旅行 */
  enableTimeTravel?: boolean;
}

/**
 * 工具配置
 */
export interface ToolConfig {
  /** 工具名称 */
  name: string;

  /** 工具配置 */
  config?: Record<string, any>;
}

/**
 * 网关配置
 */
export interface GatewayConfig {
  /** 启用人机协同 */
  enableHumanApproval?: boolean;

  /** 启用安全网关 */
  enableSecurity?: boolean;

  /** 内容过滤规则 */
  contentFilters?: string[];
}

/**
 * 推理配置
 */
export interface ReasoningConfig {
  /** 推理策略 */
  strategy?: 'react' | 'plan-and-solve' | 'tree-of-thoughts';

  /** 最大迭代次数 */
  maxIterations?: number;

  /** 启用反思 */
  enableReflection?: boolean;
}

/**
 * 主配置文件结构
 */
export interface YunPatConfig {
  /** 当前环境 */
  environment?: Environment;

  /** LLM 配置 */
  llm: LLMConfig;

  /** 记忆配置 */
  memory?: MemoryConfig;

  /** 工具配置 */
  tools?: ToolConfig[];

  /** 网关配置 */
  gateway?: GatewayConfig;

  /** 推理配置 */
  reasoning?: ReasoningConfig;

  /** 日志级别 */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';

  /** 自定义配置 */
  [key: string]: any;
}

/**
 * 配置文件完整结构（支持多环境）
 */
export interface ConfigFile {
  /** 默认配置 */
  default: YunPatConfig;

  /** 开发环境配置 */
  development?: Partial<YunPatConfig>;

  /** 测试环境配置 */
  test?: Partial<YunPatConfig>;

  /** 生产环境配置 */
  production?: Partial<YunPatConfig>;
}

/**
 * 配置管理器选项
 */
export interface ConfigManagerOptions {
  /** 配置文件路径 */
  configPath?: string;

  /** 当前环境 */
  environment?: Environment;

  /** 启用环境变量替换 */
  enableEnvVar?: boolean;

  /** 严格模式（未知字段会抛出错误） */
  strict?: boolean;
}

/**
 * 解析后的配置（已合并默认值和环境变量）
 */
export type ResolvedConfig = YunPatConfig;
