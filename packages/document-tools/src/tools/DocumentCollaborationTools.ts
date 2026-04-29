/**
 * 文档协作工具
 *
 * 支持专利文档的协作撰写、版本管理、审阅等
 */

import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { EnhancedBaseTool, ToolCategory, ToolContext } from '@yunpat/core';

/**
 * 文档变更记录
 */
export interface DocumentChange {
  /** 变更类型 */
  type: 'insert' | 'delete' | 'replace';
  /** 位置 */
  position: {
    line: number;
    column: number;
  };
  /** 原内容（删除或替换时） */
  originalContent?: string;
  /** 新内容（插入或替换时） */
  newContent?: string;
  /** 变更原因 */
  reason?: string;
  /** 变更作者 */
  author?: string;
  /** 变更时间 */
  timestamp?: string;
}

/**
 * 文档版本信息
 */
export interface DocumentVersion {
  /** 版本号 */
  version: string;
  /** 版本描述 */
  description: string;
  /** 变更记录 */
  changes: DocumentChange[];
  /** 创建时间 */
  createdAt: string;
  /** 创建者 */
  createdBy: string;
}

/**
 * 文档协作会话
 */
export interface DocumentCollaborationSession {
  /** 文档路径 */
  documentPath: string;
  /** 会话ID */
  sessionId: string;
  /** 参与者 */
  participants: string[];
  /** 当前版本 */
  currentVersion: string;
  /** 版本历史 */
  versions: DocumentVersion[];
  /** 待处理变更 */
  pendingChanges: DocumentChange[];
}

/**
 * 文档协作工具
 */
export class DocumentCollaborationTool extends EnhancedBaseTool<
  {
    action: 'start' | 'propose' | 'review' | 'merge' | 'history';
    documentPath: string;
    sessionId?: string;
    change?: DocumentChange;
    reviewer?: string;
  },
  any
> {
  readonly metadata = {
    name: 'document_collaboration',
    description: '专利文档协作工具（支持多人协作撰写、版本管理、审阅）',
    category: 'utility' as any,
    isConcurrencySafe: true,
    inputSchema: z.object({
      action: z
        .enum(['start', 'propose', 'review', 'merge', 'history'])
        .describe('协作操作类型'),
      documentPath: z.string().describe('文档路径'),
      sessionId: z.string().optional().describe('会话ID'),
      change: z
        .object({
          type: z.enum(['insert', 'delete', 'replace']),
          position: z.object({
            line: z.number(),
            column: z.number(),
          }),
          originalContent: z.string().optional(),
          newContent: z.string().optional(),
          reason: z.string().optional(),
          author: z.string().optional(),
        })
        .optional()
        .describe('变更内容'),
      reviewer: z.string().optional().describe('审阅者'),
    }),
    permissions: ['fs:read', 'fs:write'],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  async execute(
    input: {
      action: 'start' | 'propose' | 'review' | 'merge' | 'history';
      documentPath: string;
      sessionId?: string;
      change?: DocumentChange;
      reviewer?: string;
    },
    _context: ToolContext
  ): Promise<any> {
    switch (input.action) {
      case 'start':
        return this.startSession(input.documentPath);
      case 'propose':
        return this.proposeChange(input.sessionId!, input.change!);
      case 'review':
        return this.reviewChanges(input.sessionId!, input.reviewer!);
      case 'merge':
        return this.mergeChanges(input.sessionId!);
      case 'history':
        return this.getHistory(input.documentPath);
      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  }

  /**
   * 启动协作会话
   */
  private async startSession(documentPath: string): Promise<DocumentCollaborationSession> {
    const sessionId = `session_${Date.now()}`;
    const sessionFile = this.getSessionFilePath(documentPath, sessionId);

    // 读取当前文档内容
    const content = fs.readFileSync(documentPath, 'utf-8');
    const lines = content.split('\n');

    const session: DocumentCollaborationSession = {
      documentPath,
      sessionId,
      participants: [],
      currentVersion: '1.0.0',
      versions: [
        {
          version: '1.0.0',
          description: '初始版本',
          changes: [],
          createdAt: new Date().toISOString(),
          createdBy: 'system',
        },
      ],
      pendingChanges: [],
    };

    // 保存会话
    fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2), 'utf-8');

    return session;
  }

  /**
   * 提议变更
   */
  private async proposeChange(sessionId: string, change: DocumentChange): Promise<any> {
    // 查找会话文件
    const sessionFiles = await this.findSessionFiles();
    const sessionFile = sessionFiles.find((f) => f.includes(sessionId));

    if (!sessionFile) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const session: DocumentCollaborationSession = JSON.parse(
      fs.readFileSync(sessionFile, 'utf-8')
    );

    // 添加到待处理变更
    change.timestamp = new Date().toISOString();
    session.pendingChanges.push(change);

    // 保存会话
    fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2), 'utf-8');

    return {
      success: true,
      changeId: `change_${Date.now()}`,
      pendingChanges: session.pendingChanges.length,
    };
  }

  /**
   * 审阅变更
   */
  private async reviewChanges(sessionId: string, reviewer: string): Promise<any> {
    const sessionFiles = await this.findSessionFiles();
    const sessionFile = sessionFiles.find((f) => f.includes(sessionId));

    if (!sessionFile) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const session: DocumentCollaborationSession = JSON.parse(
      fs.readFileSync(sessionFile, 'utf-8')
    );

    return {
      sessionId,
      reviewer,
      pendingChanges: session.pendingChanges,
      reviewUrl: `file://${sessionFile}`,
    };
  }

  /**
   * 合并变更
   */
  private async mergeChanges(sessionId: string): Promise<any> {
    const sessionFiles = await this.findSessionFiles();
    const sessionFile = sessionFiles.find((f) => f.includes(sessionId));

    if (!sessionFile) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const session: DocumentCollaborationSession = JSON.parse(
      fs.readFileSync(sessionFile, 'utf-8')
    );

    // 读取原始文档
    let content = fs.readFileSync(session.documentPath, 'utf-8');
    const lines = content.split('\n');

    // 应用变更（按位置排序，从后往前应用）
    const sortedChanges = [...session.pendingChanges].sort(
      (a, b) => b.position.line - a.position.line
    );

    for (const change of sortedChanges) {
      const lineIndex = change.position.line - 1;

      if (change.type === 'insert') {
        lines.splice(lineIndex, 0, change.newContent!);
      } else if (change.type === 'delete') {
        lines.splice(lineIndex, 1);
      } else if (change.type === 'replace') {
        lines[lineIndex] = change.newContent!;
      }
    }

    // 保存更新后的文档
    content = lines.join('\n');
    fs.writeFileSync(session.documentPath, content, 'utf-8');

    // 创建新版本
    const newVersion = this.incrementVersion(session.currentVersion);
    session.currentVersion = newVersion;
    session.versions.push({
      version: newVersion,
      description: `合并 ${session.pendingChanges.length} 项变更`,
      changes: session.pendingChanges,
      createdAt: new Date().toISOString(),
      createdBy: 'collaboration',
    });
    session.pendingChanges = [];

    // 保存会话
    fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2), 'utf-8');

    return {
      success: true,
      newVersion,
      mergedChanges: sortedChanges.length,
    };
  }

  /**
   * 获取历史记录
   */
  private async getHistory(documentPath: string): Promise<DocumentVersion[]> {
    const sessionFiles = await this.findSessionFiles();
    const relatedSessions = sessionFiles.filter((f) =>
      JSON.parse(fs.readFileSync(f, 'utf-8')).documentPath === documentPath
    );

    const allVersions: DocumentVersion[] = [];

    for (const sessionFile of relatedSessions) {
      const session: DocumentCollaborationSession = JSON.parse(
        fs.readFileSync(sessionFile, 'utf-8')
      );
      allVersions.push(...session.versions);
    }

    // 按版本号排序
    allVersions.sort((a, b) => a.version.localeCompare(b.version));

    return allVersions;
  }

  /**
   * 查找所有会话文件
   */
  private async findSessionFiles(): Promise<string[]> {
    const sessionDir = path.join(process.cwd(), '.collaboration_sessions');
    if (!fs.existsSync(sessionDir)) {
      return [];
    }

    const files = fs.readdirSync(sessionDir);
    return files
      .filter((f) => f.endsWith('.json'))
      .map((f) => path.join(sessionDir, f));
  }

  /**
   * 获取会话文件路径
   */
  private getSessionFilePath(documentPath: string, sessionId: string): string {
    const sessionDir = path.join(process.cwd(), '.collaboration_sessions');
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    const filename = `${path.basename(documentPath)}_${sessionId}.json`;
    return path.join(sessionDir, filename);
  }

  /**
   * 版本号递增
   */
  private incrementVersion(version: string): string {
    const parts = version.split('.');
    if (parts.length === 2) {
      const major = parseInt(parts[0]);
      const minor = parseInt(parts[1]);
      return `${major}.${minor + 1}.0`;
    } else if (parts.length === 3) {
      const major = parseInt(parts[0]);
      const minor = parseInt(parts[1]);
      const patch = parseInt(parts[2]);
      return `${major}.${minor}.${patch + 1}`;
    }
    return `${version}.1`;
  }
}

/**
 * 专利文档模板库工具
 */
export class PatentTemplateLibraryTool extends EnhancedBaseTool<
  {
    action: 'list' | 'get' | 'apply';
    templateType?: string;
    templateId?: string;
    outputPath?: string;
    variables?: Record<string, any>;
  },
  any
> {
  readonly metadata = {
    name: 'patent_template_library',
    description: '专利文档模板库（提供各种模板和示例）',
    category: 'utility' as any,
    isConcurrencySafe: true,
    inputSchema: z.object({
      action: z.enum(['list', 'get', 'apply']).describe('操作类型'),
      templateType: z
        .string()
        .optional()
        .describe('模板类型（application/response/analysis等）'),
      templateId: z.string().optional().describe('模板ID'),
      outputPath: z.string().optional().describe('输出路径'),
      variables: z.record(z.any()).optional().describe('模板变量'),
    }),
    permissions: ['fs:read'],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  async execute(
    input: {
      action: 'list' | 'get' | 'apply';
      templateType?: string;
      templateId?: string;
      outputPath?: string;
      variables?: Record<string, any>;
    },
    _context: ToolContext
  ): Promise<any> {
    switch (input.action) {
      case 'list':
        return this.listTemplates(input.templateType);
      case 'get':
        return this.getTemplate(input.templateId!);
      case 'apply':
        return this.applyTemplate(
          input.templateId!,
          input.outputPath!,
          input.variables
        );
      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  }

  /**
   * 列出模板
   */
  private async listTemplates(type?: string): Promise<any> {
    const templates = {
      application: [
        { id: 'app_standard', name: '标准发明专利申请书' },
        { id: 'app_utility', name: '实用新型专利申请书' },
        { id: 'app_design', name: '外观设计专利申请书' },
        { id: 'app_pct', name: 'PCT 国际申请' },
      ],
      response: [
        { id: 'resp_standard', name: '标准审查意见答复' },
        { id: 'resp_rejection', name: '驳回决定答复' },
        { id: 'resp_observation', name: '意见陈述书' },
      ],
      analysis: [
        { id: 'anal_infringement', name: '专利侵权分析报告' },
        { id: 'anal_fto', name: 'FTO 分析报告' },
        { id: 'anal_validity', name: '专利有效性分析' },
      ],
    };

    if (type) {
      return { type, templates: templates[type as keyof typeof templates] || [] };
    }

    return templates;
  }

  /**
   * 获取模板
   */
  private async getTemplate(templateId: string): Promise<any> {
    // 简化实现：返回模板信息
    // 实际应该从文件系统或数据库读取

    const templates: Record<string, any> = {
      app_standard: {
        id: 'app_standard',
        name: '标准发明专利申请书',
        sections: ['说明书', '权利要求书', '摘要', '附图'],
        template: '模板内容...',
      },
      resp_standard: {
        id: 'resp_standard',
        name: '标准审查意见答复',
        sections: ['审查意见概述', '答复理由', '修改说明'],
        template: '模板内容...',
      },
    };

    return templates[templateId] || { error: 'Template not found' };
  }

  /**
   * 应用模板
   */
  private async applyTemplate(
    templateId: string,
    outputPath: string,
    variables?: Record<string, any>
  ): Promise<any> {
    const template = await this.getTemplate(templateId);

    if (!template || template.error) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // 应用变量替换
    let content = template.template;
    if (variables) {
      for (const [key, value] of Object.entries(variables)) {
        content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
      }
    }

    // 保存到文件
    fs.writeFileSync(outputPath, content, 'utf-8');

    return {
      success: true,
      outputPath,
      appliedVariables: Object.keys(variables || {}),
    };
  }
}
