/**
 * 通知服务
 *
 * 负责发送各类通知（邮件、Webhook、系统消息等）
 */

import type {
  NotificationConfig,
  NotificationLog,
  NotificationEvent,
  NotificationType,
  NotificationStatus,
} from '../types/PatentTypes.js'

/**
 * 通知发送结果
 */
export interface NotificationResult {
  /** 是否成功 */
  success: boolean
  /** 错误信息 */
  error?: string
  /** 日志ID */
  logId?: number
}

/**
 * 邮件发送器接口
 */
export interface EmailSender {
  send(to: string, subject: string, content: string): Promise<void>
}

/**
 * Webhook发送器接口
 */
export interface WebhookSender {
  send(url: string, payload: unknown): Promise<void>
}

/**
 * 短信发送器接口
 */
export interface SmsSender {
  send(to: string, content: string): Promise<void>
}

/**
 * 系统通知发送器接口
 */
export interface SystemNotifier {
  notify(event: NotificationEvent, content: string): Promise<void>
}

/**
 * 通知模板数据
 */
export interface NotificationTemplateData {
  /** 申请号 */
  applicationNumber: string
  /** 专利标题 */
  title: string
  /** 事件类型 */
  event: NotificationEvent
  /** 截止日期（如适用） */
  deadlineDate?: Date
  /** 金额（如适用） */
  amount?: number
  /** 货币（如适用） */
  currency?: string
  /** 额外数据 */
  [key: string]: unknown
}

/**
 * 通知服务配置
 */
export interface NotificationServiceConfig {
  /** 邮件发送器 */
  emailSender?: EmailSender
  /** Webhook发送器 */
  webhookSender?: WebhookSender
  /** 短信发送器 */
  smsSender?: SmsSender
  /** 系统通知器 */
  systemNotifier?: SystemNotifier
  /** 最大重试次数 */
  maxRetries?: number
  /** 重试延迟（毫秒） */
  retryDelay?: number
}

/**
 * 通知服务类
 */
export class NotificationService {
  private config: Required<NotificationServiceConfig>
  // 内存存储的日志（实际应用中应持久化到数据库）
  private logs: NotificationLog[] = []
  private configs: Map<number, NotificationConfig> = new Map()
  private nextLogId = 1

  constructor(config: NotificationServiceConfig = {}) {
    this.config = {
      emailSender: config.emailSender ?? this.defaultEmailSender,
      webhookSender: config.webhookSender ?? this.defaultWebhookSender,
      smsSender: config.smsSender ?? this.defaultSmsSender,
      systemNotifier: config.systemNotifier ?? this.defaultSystemNotifier,
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 1000,
    }
  }

  /**
   * 添加通知配置
   */
  addConfig(config: Omit<NotificationConfig, 'id' | 'createdAt' | 'updatedAt'>): number {
    const id = this.configs.size + 1
    const newConfig: NotificationConfig = {
      ...config,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.configs.set(id, newConfig)
    return id
  }

  /**
   * 获取通知配置
   */
  getConfig(id: number): NotificationConfig | undefined {
    return this.configs.get(id)
  }

  /**
   * 获取所有启用的配置
   */
  getEnabledConfigs(): NotificationConfig[] {
    return Array.from(this.configs.values()).filter((c) => c.enabled)
  }

  /**
   * 根据事件类型获取配置
   */
  getConfigsByEvent(event: NotificationEvent): NotificationConfig[] {
    return this.getEnabledConfigs().filter((c) => c.events.includes(event))
  }

  /**
   * 更新配置
   */
  updateConfig(
    id: number,
    updates: Partial<Omit<NotificationConfig, 'id' | 'createdAt'>>
  ): boolean {
    const config = this.configs.get(id)
    if (!config) return false

    this.configs.set(id, {
      ...config,
      ...updates,
      id: config.id,
      createdAt: config.createdAt,
      updatedAt: new Date(),
    })
    return true
  }

  /**
   * 删除配置
   */
  removeConfig(id: number): boolean {
    return this.configs.delete(id)
  }

  /**
   * 发送通知
   */
  async sendNotification(
    event: NotificationEvent,
    data: NotificationTemplateData
  ): Promise<NotificationResult[]> {
    const configs = this.getConfigsByEvent(event)
    const results: NotificationResult[] = []

    for (const config of configs) {
      const result = await this.sendToConfig(config, event, data)
      results.push(result)
    }

    return results
  }

  /**
   * 发送到特定配置
   */
  private async sendToConfig(
    config: NotificationConfig,
    event: NotificationEvent,
    data: NotificationTemplateData
  ): Promise<NotificationResult> {
    const { subject, content } = this.renderTemplate(event, data)

    // 创建日志
    const log: NotificationLog = {
      id: this.nextLogId++,
      configId: config.id,
      type: config.type,
      event,
      recipient: this.getRecipient(config),
      subject,
      content,
      status: 'pending',
      retryCount: 0,
      createdAt: new Date(),
    }

    this.logs.push(log)

    // 尝试发送
    return this.sendWithRetry(log, config)
  }

  /**
   * 带重试的发送
   */
  private async sendWithRetry(
    log: NotificationLog,
    config: NotificationConfig
  ): Promise<NotificationResult> {
    let lastError: string | undefined

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        await this.doSend(log, config)

        // 更新日志状态
        log.status = 'sent'
        log.sentAt = new Date()

        return {
          success: true,
          logId: log.id,
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
        log.retryCount = attempt + 1

        // 如果不是最后一次尝试，等待后重试
        if (attempt < this.config.maxRetries) {
          await this.delay(this.config.retryDelay * (attempt + 1))
        }
      }
    }

    // 所有尝试都失败
    log.status = 'failed'
    log.errorMessage = lastError

    return {
      success: false,
      error: lastError,
      logId: log.id,
    }
  }

  /**
   * 实际发送逻辑
   */
  private async doSend(log: NotificationLog, config: NotificationConfig): Promise<void> {
    switch (log.type) {
      case 'email':
        await this.config.emailSender.send(log.recipient, log.subject || '通知', log.content)
        break

      case 'webhook': {
        const payload = {
          event: log.event,
          subject: log.subject,
          content: log.content,
          timestamp: new Date().toISOString(),
        }
        const url = this.extractWebhookUrl(config)
        await this.config.webhookSender.send(url, payload)
        break
      }

      case 'sms':
        await this.config.smsSender.send(log.recipient, log.content)
        break

      case 'system':
        await this.config.systemNotifier.notify(log.event, log.content)
        break

      default:
        throw new Error(`不支持的通知类型: ${log.type}`)
    }
  }

  /**
   * 渲染通知模板
   */
  private renderTemplate(
    event: NotificationEvent,
    data: NotificationTemplateData
  ): {
    subject: string
    content: string
  } {
    const templates = this.getTemplates()
    const template = templates[event] || templates.default

    const subject = this.interpolate(template.subject, data)
    const content = this.interpolate(template.content, data)

    return { subject, content }
  }

  /**
   * 字符串插值
   */
  private interpolate(template: string, data: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const value = data[key]
      if (value === undefined) return `{{${key}}}`
      if (value instanceof Date) return value.toLocaleString('zh-CN')
      return String(value)
    })
  }

  /**
   * 获取通知模板
   */
  private getTemplates(): Record<
    NotificationEvent | 'default',
    { subject: string; content: string }
  > {
    return {
      deadline_approaching: {
        subject: '【重要】专利截止日期即将到期',
        content: `您的专利 {{applicationNumber}} ({{title}}) 有一项截止日期即将到期。

截止日期: {{deadlineDate}}

请及时处理以避免专利失效。`,
      },
      deadline_overdue: {
        subject: '【紧急】专利截止日期已逾期',
        content: `您的专利 {{applicationNumber}} ({{title}}) 有一项截止日期已逾期！

截止日期: {{deadlineDate}}

请立即处理！`,
      },
      fee_due: {
        subject: '【提醒】专利费用待支付',
        content: `您的专利 {{applicationNumber}} ({{title}}) 有一笔费用待支付。

金额: {{amount}} {{currency}}
到期日: {{deadlineDate}}

请及时支付。`,
      },
      fee_overdue: {
        subject: '【紧急】专利费用已逾期',
        content: `您的专利 {{applicationNumber}} ({{title}}) 有一笔费用已逾期！

金额: {{amount}} {{currency}}
到期日: {{deadlineDate}}

请立即支付！`,
      },
      status_changed: {
        subject: '专利状态变更通知',
        content: `您的专利 {{applicationNumber}} ({{title}}) 状态已变更。

新状态: {{newStatus}}

详情请登录系统查看。`,
      },
      oa_issued: {
        subject: '【重要】审查意见已发出',
        content: `您的专利 {{applicationNumber}} ({{title}}) 已收到审查意见。

请在规定期限内答复。

答复期限: {{deadlineDate}}`,
      },
      patent_granted: {
        subject: '【恭喜】专利已授权',
        content: `恭喜！您的专利 {{applicationNumber}} ({{title}}) 已获得授权。

授权公告日: {{grantDate}}`,
      },
      patent_rejected: {
        subject: '【遗憾】专利申请被驳回',
        content: `很遗憾，您的专利 {{applicationNumber}} ({{title}}) 申请已被驳回。

您可以在规定期限内提出复审请求。

复审期限: {{deadlineDate}}`,
      },
      default: {
        subject: '专利系统通知',
        content: `专利 {{applicationNumber}} 有新动态：{{event}}`,
      },
    }
  }

  /**
   * 获取接收者
   */
  private getRecipient(config: NotificationConfig): string {
    switch (config.type) {
      case 'email':
        return String(config.config.email || '')
      case 'sms':
        return String(config.config.phone || '')
      case 'webhook':
        return String(config.config.url || '')
      case 'system':
        return 'system'
      default:
        return ''
    }
  }

  /**
   * 提取 Webhook URL
   */
  private extractWebhookUrl(config: NotificationConfig): string {
    return String(config.config.url || '')
  }

  /**
   * 获取通知日志
   */
  getLogs(filters?: {
    event?: NotificationEvent
    status?: NotificationStatus
    recipient?: string
    limit?: number
  }): NotificationLog[] {
    let logs = [...this.logs]

    if (filters?.event) {
      logs = logs.filter((l) => l.event === filters.event)
    }

    if (filters?.status) {
      logs = logs.filter((l) => l.status === filters.status)
    }

    if (filters?.recipient) {
      logs = logs.filter((l) => l.recipient === filters.recipient)
    }

    // 按时间倒序
    logs.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))

    if (filters?.limit) {
      logs = logs.slice(0, filters.limit)
    }

    return logs
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  // ==================== 默认发送器实现 ====================

  private defaultEmailSender: EmailSender = {
    async send(to: string, subject: string, content: string) {
      console.log(`[Email] To: ${to}, Subject: ${subject}`)
      console.log(`[Email] Content: ${content}`)
      // 实际应用中应该调用邮件服务 API
    },
  }

  private defaultWebhookSender: WebhookSender = {
    async send(url: string, payload: unknown) {
      console.log(`[Webhook] URL: ${url}`)
      console.log(`[Webhook] Payload: ${JSON.stringify(payload, null, 2)}`)
      // 实际应用中应该发送 HTTP 请求
      // const response = await fetch(url, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(payload),
      // })
    },
  }

  private defaultSmsSender: SmsSender = {
    async send(to: string, content: string) {
      console.log(`[SMS] To: ${to}`)
      console.log(`[SMS] Content: ${content}`)
      // 实际应用中应该调用短信服务 API
    },
  }

  private defaultSystemNotifier: SystemNotifier = {
    async notify(event: NotificationEvent, content: string) {
      console.log(`[System] Event: ${event}`)
      console.log(`[System] Content: ${content}`)
      // 实际应用中应该写入系统通知表或推送
    },
  }
}

/**
 * 默认通知服务实例
 */
export const defaultNotificationService = new NotificationService()
