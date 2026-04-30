/**
 * 交互层 (Gateway / Interface)
 *
 * 负责 Agent 与外部世界的接口
 * - 多模态输入：文本、语音、图像、视频、文件
 * - 人机协同 (HITL)：审批节点、反馈回路、人工接管
 * - 安全网关：身份认证、权限控制、审计日志
 */

/**
 * 输入源类型
 */
export enum InputSourceType {
  /** 文本 */
  TEXT = 'text',

  /** 语音 */
  VOICE = 'voice',

  /** 图像 */
  IMAGE = 'image',

  /** 视频 */
  VIDEO = 'video',

  /** 文件 */
  FILE = 'file',

  /** API 调用 */
  API = 'api',

  /** 命令行 */
  CLI = 'cli',

  /** WebSocket */
  WEBSOCKET = 'websocket',
}

/**
 * 多模态输入
 */
export interface MultimodalInput {
  /** 输入源类型 */
  sourceType: InputSourceType;

  /** 主内容（文本） */
  text?: string;

  /** 语音数据 */
  audio?: {
    data: ArrayBuffer;
    format: 'mp3' | 'wav' | 'ogg';
    duration?: number;
  };

  /** 图像数据 */
  image?: {
    data: ArrayBuffer;
    format: 'png' | 'jpg' | 'webp';
    width?: number;
    height?: number;
  };

  /** 视频数据 */
  video?: {
    data: ArrayBuffer;
    format: 'mp4' | 'webm';
    duration?: number;
  };

  /** 文件数据 */
  file?: {
    name: string;
    data: ArrayBuffer;
    mimeType: string;
    size: number;
  };

  /** 元数据 */
  metadata?: {
    timestamp: Date;
    userId?: string;
    sessionId?: string;
    tags?: string[];
  };
}

/**
 * 输出目标类型 */
export enum OutputTargetType {
  /** 终端输出 */
  TERMINAL = 'terminal',

  /** HTTP 响应 */
  HTTP = 'http',

  /** WebSocket */
  WEBSOCKET = 'websocket',

  /** 文件 */
  FILE = 'file',

  /** 数据库 */
  DATABASE = 'database',
}

/**
 * 多模态输出
 */
export interface MultimodalOutput {
  /** 输出目标类型 */
  targetType: OutputTargetType;

  /** 文本内容 */
  text?: string;

  /** 是否流式输出 */
  stream?: boolean;

  /** 附加数据 */
  attachments?: Array<{
    type: 'image' | 'file' | 'audio';
    data: ArrayBuffer;
    metadata?: Record<string, unknown>;
  }>;

  /** 元数据 */
  metadata?: {
    timestamp: Date;
    contentType: string;
    tokens?: number;
    cost?: number;
  };
}

/**
 * 人机协同审批结果
 */
export interface HumanApproval {
  /** 是否批准 */
  approved: boolean;

  /** 审批意见 */
  feedback?: string;

  /** 修改建议 */
  suggestions?: string[];

  /** 审批时间 */
  timestamp: Date;

  /** 审批人 */
  userId: string;
}

/**
 * 审批请求
 */
export interface ApprovalRequest {
  /** 请求 ID */
  requestId: string;

  /** 智能体名称 */
  agentName: string;

  /** 需要审批的内容 */
  content: {
    type: 'action' | 'output' | 'plan';
    data: unknown;
  };

  /** 上下文信息 */
  context: {
    goal: string;
    reasoning: string;
    alternatives?: string[];
  };

  /** 超时时间（毫秒） */
  timeout?: number;

  /** 审批级别 */
  level: 'info' | 'warning' | 'critical';
}

/**
 * 身份认证结果
 */
export interface AuthResult {
  /** 是否认证成功 */
  success: boolean;

  /** 用户 ID */
  userId?: string;

  /** 用户角色 */
  roles?: string[];

  /** 权限列表 */
  permissions?: string[];

  /** Token */
  token?: string;

  /** 过期时间 */
  expiresAt?: Date;

  /** 错误信息 */
  error?: string;
}

/**
 * 凭证
 */
export interface Credentials {
  /** 认证类型 */
  type: 'apikey' | 'jwt' | 'oauth' | 'basic';

  /** 凭证数据 */
  data: {
    apiKey?: string;
    token?: string;
    username?: string;
    password?: string;
  };
}

/**
 * 权限
 */
export interface Permission {
  /** 资源 */
  resource: string;

  /** 操作 */
  action: 'read' | 'write' | 'execute' | 'admin';

  /** 作用域 */
  scope?: string[];
}

/**
 * 动作
 */
export interface Action {
  /** 动作类型 */
  type: string;

  /** 目标资源 */
  resource?: string;

  /** 参数 */
  params?: Record<string, unknown>;
}

/**
 * 安全网关配置
 */
export interface SecurityGatewayConfig {
  /** 是否启用认证 */
  enableAuth: boolean;

  /** 是否启用权限控制 */
  enableAuthorization: boolean;

  /** 是否启用内容过滤 */
  enableContentFilter: boolean;

  /** 是否启用审计日志 */
  enableAudit: boolean;

  /** 内容过滤规则 */
  contentFilterRules?: ContentFilterRule[];

  /** 审计日志存储 */
  auditLogStore?: AuditLogStore;
}

/**
 * 内容过滤规则
 */
export interface ContentFilterRule {
  /** 规则名称 */
  name: string;

  /** 规则类型 */
  type: 'keyword' | 'pattern' | 'ml';

  /** 规则内容 */
  content: string | RegExp;

  /** 动作 */
  action: 'block' | 'flag' | 'sanitize';

  /** 严重程度 */
  severity: 'low' | 'medium' | 'high';
}

/**
 * 审计日志
 */
export interface AuditLog {
  /** 时间戳 */
  timestamp: Date;

  /** 用户 ID */
  userId?: string;

  /** 智能体名称 */
  agentName?: string;

  /** 动作 */
  action: string;

  /** 资源 */
  resource?: string;

  /** 结果 */
  result: 'success' | 'failure' | 'blocked';

  /** 详情 */
  details?: Record<string, unknown>;

  /** IP 地址 */
  ipAddress?: string;
}

/**
 * 审计日志存储接口
 */
export interface AuditLogStore {
  /** 写入日志 */
  write(log: AuditLog): Promise<void>;

  /** 查询日志 */
  query(filter: AuditLogFilter): Promise<AuditLog[]>;

  /** 统计 */
  stats(metrics: AuditMetrics): Promise<Record<string, number>>;
}

/**
 * 审计日志过滤器
 */
export interface AuditLogFilter {
  /** 时间范围 */
  timeRange?: {
    start: Date;
    end: Date;
  };

  /** 用户 ID */
  userId?: string;

  /** 智能体名称 */
  agentName?: string;

  /** 动作 */
  action?: string;

  /** 结果 */
  result?: 'success' | 'failure' | 'blocked';
}

/**
 * 审计指标
 */
export interface AuditMetrics {
  /** 按动作统计 */
  byAction?: boolean;

  /** 按用户统计 */
  byUser?: boolean;

  /** 按智能体统计 */
  byAgent?: boolean;

  /** 按结果统计 */
  byResult?: boolean;
}

/**
 * Gateway 接口
 */
export interface Gateway {
  /**
   * 接收输入
   */
  receiveInput(source: InputSourceType): Promise<MultimodalInput>;

  /**
   * 发送输出
   */
  sendOutput(output: MultimodalOutput, target: OutputTargetType): Promise<void>;

  /**
   * 请求人工审批
   */
  requestHumanApproval(request: ApprovalRequest): Promise<HumanApproval>;

  /**
   * 身份认证
   */
  authenticate(credentials: Credentials): Promise<AuthResult>;

  /**
   * 权限检查
   */
  authorize(action: Action, permissions: Permission[]): Promise<boolean>;

  /**
   * 内容过滤
   */
  filterContent(content: string): Promise<{ filtered: boolean; reason?: string }>;

  /**
   * 写入审计日志
   */
  writeAuditLog(log: AuditLog): Promise<void>;
}

/**
 * 基础 Gateway 实现
 */
export class BaseGateway implements Gateway {
  private config: SecurityGatewayConfig;
  private auditStore?: AuditLogStore;

  constructor(config: SecurityGatewayConfig) {
    this.config = config;
    this.auditStore = config.auditLogStore;
  }

  async receiveInput(source: InputSourceType): Promise<MultimodalInput> {
    // 默认实现：返回文本输入
    return {
      sourceType: source,
      text: '',
      metadata: {
        timestamp: new Date(),
      },
    };
  }

  async sendOutput(output: MultimodalOutput, target: OutputTargetType): Promise<void> {
    if (target === OutputTargetType.TERMINAL && output.text) {
      console.log(output.text);
    }

    // 写入审计日志
    if (this.config.enableAudit && this.auditStore) {
      await this.writeAuditLog({
        timestamp: new Date(),
        action: 'send_output',
        result: 'success',
        details: {
          targetType: target,
          contentLength: output.text?.length || 0,
        },
      });
    }
  }

  async requestHumanApproval(request: ApprovalRequest): Promise<HumanApproval> {
    // 默认实现：自动批准
    // 实际应用中应该实现审批流程（WebSocket、邮件、Slack 等）
    console.log(`[审批请求] ${request.agentName}: ${request.content.type}`);
    console.log(`[上下文] ${request.context.goal}`);

    return {
      approved: true,
      timestamp: new Date(),
      userId: 'system',
    };
  }

  async authenticate(credentials: Credentials): Promise<AuthResult> {
    if (!this.config.enableAuth) {
      return {
        success: true,
        userId: 'anonymous',
        roles: ['guest'],
        permissions: ['read'],
      };
    }

    // 简化实现：API Key 认证
    if (credentials.type === 'apikey') {
      // TODO: 实际应该验证 API Key
      return {
        success: true,
        userId: 'user',
        roles: ['user'],
        permissions: ['read', 'write', 'execute'],
        token: 'mock-token',
        expiresAt: new Date(Date.now() + 3600000), // 1小时后过期
      };
    }

    return {
      success: false,
      error: '不支持的认证类型',
    };
  }

  async authorize(action: Action, permissions: Permission[]): Promise<boolean> {
    if (!this.config.enableAuthorization) {
      return true;
    }

    // 简化实现：检查权限
    const requiredPermission = permissions.find((p) => p.resource === action.resource);
    if (!requiredPermission) {
      return false;
    }

    return permissions.some((p) => p.action === requiredPermission.action);
  }

  async filterContent(content: string): Promise<{ filtered: boolean; reason?: string }> {
    if (!this.config.enableContentFilter || !this.config.contentFilterRules) {
      return { filtered: false };
    }

    // 简化实现：关键词过滤
    for (const rule of this.config.contentFilterRules) {
      if (rule.type === 'keyword' && typeof rule.content === 'string') {
        if (content.includes(rule.content)) {
          return {
            filtered: rule.action === 'block',
            reason: `触发规则: ${rule.name}`,
          };
        }
      }
    }

    return { filtered: false };
  }

  async writeAuditLog(log: AuditLog): Promise<void> {
    if (this.auditStore) {
      await this.auditStore.write(log);
    } else {
      // 默认实现：输出到控制台
      console.log('[审计日志]', JSON.stringify(log));
    }
  }
}
