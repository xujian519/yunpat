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

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import {
  YunPatConfig,
  ConfigFile,
  ConfigManagerOptions,
  ResolvedConfig,
  Environment,
  LLMConfig,
} from './types.js';

/**
 * 配置管理器
 */
export class ConfigManager {
  private configPath: string;
  private environment: Environment;
  private enableEnvVar: boolean;
  private strict: boolean;
  private resolvedConfig: ResolvedConfig | null = null;

  constructor(options: ConfigManagerOptions = {}) {
    this.configPath = options.configPath ?? path.join(os.homedir(), '.yunpat', 'config.yaml');
    this.environment = options.environment ?? this.detectEnvironment();
    this.enableEnvVar = options.enableEnvVar ?? true;
    this.strict = options.strict ?? false;
  }

  /**
   * 检测当前环境
   */
  private detectEnvironment(): Environment {
    const env = process.env.NODE_ENV || process.env.ENV || 'development';

    if (env === 'production' || env === 'prod') {
      return 'production';
    }
    if (env === 'test' || env === 'testing') {
      return 'test';
    }
    return 'development';
  }

  /**
   * 加载配置文件
   */
  load(): ResolvedConfig {
    if (this.resolvedConfig) {
      return this.resolvedConfig;
    }

    // 1. 检查配置文件是否存在
    if (!fs.existsSync(this.configPath)) {
      console.warn(`配置文件不存在: ${this.configPath}，使用默认配置`);
      this.resolvedConfig = this.getDefaultConfig();
      return this.resolvedConfig;
    }

    // 2. 读取并解析 YAML 文件
    const content = fs.readFileSync(this.configPath, 'utf-8');
    let configFile: ConfigFile;

    try {
      const parsed = yaml.parse(content);

      // 判断是旧格式还是新格式
      if (parsed && typeof parsed === 'object' && 'default' in parsed) {
        // 新格式：包含 default 环境配置
        configFile = parsed as ConfigFile;
      } else {
        // 旧格式：直接是配置对象
        configFile = {
          default: parsed as YunPatConfig,
        };
      }
    } catch (error) {
      throw new Error(
        `配置文件解析失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // 3. 验证配置结构
    this.validateConfigFile(configFile);

    // 4. 合并配置（default -> environment）
    const mergedConfig = this.mergeConfig(configFile);

    // 5. 替换环境变量
    const finalConfig = this.enableEnvVar ? this.replaceEnvVars(mergedConfig) : mergedConfig;

    // 6. 应用默认值
    this.resolvedConfig = this.applyDefaults(finalConfig);

    console.log(`✓ 配置已加载 [环境: ${this.environment}]`);
    return this.resolvedConfig;
  }

  /**
   * 重新加载配置
   */
  reload(): ResolvedConfig {
    this.resolvedConfig = null;
    return this.load();
  }

  /**
   * 获取 LLM 配置
   */
  getLLMConfig(): LLMConfig {
    const config = this.load();
    return config.llm;
  }

  /**
   * 获取主 LLM 配置
   */
  getPrimaryLLMConfig() {
    const llmConfig = this.getLLMConfig();
    return llmConfig.primary;
  }

  /**
   * 获取备用 LLM 配置
   */
  getFallbackLLMConfig() {
    const llmConfig = this.getLLMConfig();
    return llmConfig.fallback;
  }

  /**
   * 获取特定配置值
   */
  get<T = any>(key: string): T | undefined {
    const config = this.load();
    const keys = key.split('.');
    let value: any = config;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return undefined;
      }
    }

    return value as T;
  }

  /**
   * 设置配置值（仅内存）
   */
  set(key: string, value: any): void {
    if (!this.resolvedConfig) {
      this.load();
    }

    const keys = key.split('.');
    let target: any = this.resolvedConfig;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in target) || typeof target[k] !== 'object') {
        target[k] = {};
      }
      target = target[k];
    }

    target[keys[keys.length - 1]] = value;
  }

  /**
   * 验证配置文件结构
   */
  private validateConfigFile(configFile: ConfigFile): void {
    if (!configFile.default || typeof configFile.default !== 'object') {
      throw new Error('配置文件必须包含 default 字段');
    }

    if (!configFile.default.llm) {
      throw new Error('配置文件必须包含 llm 配置');
    }

    if (!configFile.default.llm.primary) {
      throw new Error('LLM 配置必须包含 primary 字段');
    }
  }

  /**
   * 合并配置（default -> environment）
   */
  private mergeConfig(configFile: ConfigFile): YunPatConfig {
    const baseConfig = configFile.default;
    const envConfig = configFile[this.environment] || {};

    // 深度合并
    return this.deepMerge(baseConfig, envConfig);
  }

  /**
   * 深度合并对象
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key of Object.keys(source)) {
      if (
        source[key] &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key]) &&
        target[key] &&
        typeof target[key] === 'object' &&
        !Array.isArray(target[key])
      ) {
        result[key] = this.deepMerge(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  /**
   * 替换环境变量占位符
   *
   * 支持格式：
   * - ${VAR_NAME}
   * - ${VAR_NAME:default_value}
   */
  private replaceEnvVars(config: any): any {
    if (typeof config === 'string') {
      return config.replace(/\$\{([^}:]+)(?::([^}]*))?\}/g, (_, name, defaultValue) => {
        return process.env[name] ?? defaultValue ?? '';
      });
    }

    if (Array.isArray(config)) {
      return config.map((item) => this.replaceEnvVars(item));
    }

    if (config && typeof config === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(config)) {
        result[key] = this.replaceEnvVars(value);
      }
      return result;
    }

    return config;
  }

  /**
   * 应用默认配置
   */
  private applyDefaults(config: YunPatConfig): ResolvedConfig {
    return {
      environment: this.environment,
      logLevel: config.logLevel ?? 'info',
      llm: config.llm,
      memory: {
        type: config.memory?.type ?? 'memory',
        checkpointInterval: config.memory?.checkpointInterval ?? 5,
        maxCheckpoints: config.memory?.maxCheckpoints ?? 10,
        enableTimeTravel: config.memory?.enableTimeTravel ?? true,
      },
      tools: config.tools ?? [],
      gateway: {
        enableHumanApproval: config.gateway?.enableHumanApproval ?? false,
        enableSecurity: config.gateway?.enableSecurity ?? true,
      },
      reasoning: {
        strategy: config.reasoning?.strategy ?? 'react',
        maxIterations: config.reasoning?.maxIterations ?? 10,
        enableReflection: config.reasoning?.enableReflection ?? true,
      },
    };
  }

  /**
   * 获取默认配置
   */
  private getDefaultConfig(): ResolvedConfig {
    return {
      environment: this.environment,
      logLevel: 'info',
      llm: {
        primary: {
          provider: 'deepseek',
          apiKey: '${DEEPSEEK_API_KEY}',
          model: 'deepseek-chat',
          temperature: 0.7,
          maxTokens: 4096,
        },
      },
      memory: {
        type: 'memory',
        checkpointInterval: 5,
        maxCheckpoints: 10,
        enableTimeTravel: true,
      },
      tools: [],
      gateway: {
        enableHumanApproval: false,
        enableSecurity: true,
      },
      reasoning: {
        strategy: 'react',
        maxIterations: 10,
        enableReflection: true,
      },
    };
  }

  /**
   * 创建配置目录和示例文件
   */
  static createExampleConfig(outputPath?: string): void {
    const configPath = outputPath ?? path.join(os.homedir(), '.yunpat', 'config.yaml');

    // 创建目录
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // 示例配置
    const exampleConfig: ConfigFile = {
      default: {
        logLevel: 'info',
        llm: {
          primary: {
            provider: 'deepseek',
            apiKey: '${DEEPSEEK_API_KEY}',
            model: 'deepseek-chat',
            temperature: 0.7,
            maxTokens: 4096,
          },
          fallback: {
            provider: 'omxl',
            baseURL: 'http://localhost:8009/v1',
            apiKey: '${OMXL_API_KEY}',
            model: 'gpt-4o',
          },
        },
        memory: {
          type: 'memory',
          checkpointInterval: 5,
          maxCheckpoints: 10,
          enableTimeTravel: true,
        },
        gateway: {
          enableHumanApproval: false,
          enableSecurity: true,
        },
        reasoning: {
          strategy: 'react',
          maxIterations: 10,
          enableReflection: true,
        },
      },
      development: {
        logLevel: 'debug',
      },
      test: {
        logLevel: 'warn',
      },
      production: {
        logLevel: 'error',
      },
    };

    // 写入文件
    fs.writeFileSync(configPath, yaml.stringify(exampleConfig));
    console.log(`✓ 示例配置已创建: ${configPath}`);
  }

  /**
   * 获取配置文件路径
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * 获取当前环境
   */
  getEnvironment(): Environment {
    return this.environment;
  }
}

/**
 * 全局配置管理器实例
 */
let globalConfigManager: ConfigManager | null = null;

/**
 * 获取全局配置管理器
 */
export function getConfigManager(options?: ConfigManagerOptions): ConfigManager {
  if (!globalConfigManager) {
    globalConfigManager = new ConfigManager(options);
  }
  return globalConfigManager;
}

/**
 * 重置全局配置管理器（主要用于测试）
 */
export function resetConfigManager(): void {
  globalConfigManager = null;
}
