import { z } from 'zod';
import { EnhancedBaseTool, ToolCategory, ToolContext } from '@yunpat/core';

/**
 * 创建一个value为必需的输出schema
 */
const createEvaluateOutputSchema = () =>
  z.object({
    type: z.string(),
    value: z.any(),
  }) as z.ZodObject<{
    type: z.ZodString;
    value: z.ZodAny;
  }>;

/**
 * Kimi WebBridge API 响应基础类型
 */
interface WebBridgeResponse {
  success: boolean;
  [key: string]: any;
}

/**
 * WebBridge Daemon 配置
 */
const WEBBRIDGE_HOST = '127.0.0.1';
const WEBBRIDGE_PORT = 10086;
const WEBBRIDGE_URL = `http://${WEBBRIDGE_HOST}:${WEBBRIDGE_PORT}/command`;

/**
 * 发送命令到 WebBridge Daemon
 */
async function sendWebBridgeCommand(
  action: string,
  args: Record<string, any>,
  session?: string
): Promise<WebBridgeResponse> {
  const body: any = { action, args };

  if (session) {
    body.session = session;
  }

  const response = await fetch(WEBBRIDGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`WebBridge HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.json() as WebBridgeResponse;
}

/**
 * 导航到 URL 工具
 *
 * 在浏览器中打开指定URL
 */
export class WebNavigateTool extends EnhancedBaseTool<
  {
    url: string;
    newTab?: boolean;
    session?: string;
  },
  {
    success: boolean;
    url: string;
    tabId?: string;
  }
> {
  readonly metadata = {
    name: 'web_navigate',
    description: '在浏览器中导航到指定URL',
    category: ToolCategory.NETWORK,
    isConcurrencySafe: false,
    inputSchema: z.object({
      url: z.string().url().describe('要访问的URL'),
      newTab: z
        .boolean()
        .optional()
        .default(true)
        .describe('是否在新标签页中打开'),
      session: z.string().optional().describe('会话名称（用于隔离不同站点）'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      url: z.string(),
      tabId: z.string().optional(),
    }),
    permissions: [],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  async execute(
    input: { url: string; newTab?: boolean; session?: string },
    _context: ToolContext
  ): Promise<{
    success: boolean;
    url: string;
    tabId?: string;
  }> {
    try {
      const result = await sendWebBridgeCommand('navigate', {
        url: input.url,
        newTab: input.newTab ?? true,
      }, input.session);

      return {
        success: result.success,
        url: input.url,
        tabId: result.tabId,
      };
    } catch (error) {
      throw new Error(
        `Navigation failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}

/**
 * 查找标签页工具
 *
 * 在已打开的标签页中查找匹配的URL
 */
export class WebFindTabTool extends EnhancedBaseTool<
  {
    url: string;
    active?: boolean;
    session?: string;
  },
  {
    success: boolean;
    url: string;
    tabId?: string;
  }
> {
  readonly metadata = {
    name: 'web_find_tab',
    description: '在已打开的标签页中查找匹配的URL',
    category: ToolCategory.NETWORK,
    isConcurrencySafe: true,
    inputSchema: z.object({
      url: z.string().describe('要查找的URL或域名'),
      active: z
        .boolean()
        .optional()
        .default(false)
        .describe('是否选择当前活动的标签页'),
      session: z.string().optional().describe('会话名称'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      url: z.string(),
      tabId: z.string().optional(),
    }),
    permissions: [],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  async execute(
    input: { url: string; active?: boolean; session?: string },
    _context: ToolContext
  ): Promise<{
    success: boolean;
    url: string;
    tabId?: string;
  }> {
    try {
      const result = await sendWebBridgeCommand(
        'find_tab',
        {
          url: input.url,
          active: input.active ?? false,
        },
        input.session
      );

      return {
        success: result.success,
        url: input.url,
        tabId: result.tabId,
      };
    } catch (error) {
      throw new Error(
        `Find tab failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}

/**
 * 快照工具
 *
 * 获取页面的可访问性树（用于定位元素）
 */
export class WebSnapshotTool extends EnhancedBaseTool<
  {
    session?: string;
  },
  {
    url: string;
    title: string;
    tree: Array<{
      name: string;
      role: string;
      tag: string;
      ref: string;
    }>;
  }
> {
  readonly metadata = {
    name: 'web_snapshot',
    description: '获取页面的可访问性树，用于定位页面元素',
    category: ToolCategory.NETWORK,
    isConcurrencySafe: true,
    inputSchema: z.object({
      session: z.string().optional().describe('会话名称'),
    }),
    outputSchema: z.object({
      url: z.string(),
      title: z.string(),
      tree: z.array(
        z.object({
          name: z.string(),
          role: z.string(),
          tag: z.string(),
          ref: z.string(),
        })
      ),
    }),
    permissions: [],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  async execute(
    input: { session?: string },
    _context: ToolContext
  ): Promise<{
    url: string;
    title: string;
    tree: Array<{
      name: string;
      role: string;
      tag: string;
      ref: string;
    }>;
  }> {
    try {
      const result = await sendWebBridgeCommand('snapshot', {}, input.session);

      return {
        url: result.url || '',
        title: result.title || '',
        tree: result.tree || [],
      };
    } catch (error) {
      throw new Error(
        `Snapshot failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}

/**
 * 点击元素工具
 *
 * 点击页面上的元素
 */
export class WebClickTool extends EnhancedBaseTool<
  {
    selector: string;
    session?: string;
  },
  {
    success: boolean;
    tag?: string;
    text?: string;
  }
> {
  readonly metadata = {
    name: 'web_click',
    description: '点击页面上的元素（支持 @e 引用或 CSS 选择器）',
    category: ToolCategory.NETWORK,
    isConcurrencySafe: false,
    inputSchema: z.object({
      selector: z.string().describe('元素选择器（@e 引用或 CSS 选择器）'),
      session: z.string().optional().describe('会话名称'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      tag: z.string().optional(),
      text: z.string().optional(),
    }),
    permissions: [],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  async execute(
    input: { selector: string; session?: string },
    _context: ToolContext
  ): Promise<{
    success: boolean;
    tag?: string;
    text?: string;
  }> {
    try {
      const result = await sendWebBridgeCommand(
        'click',
        {
          selector: input.selector,
        },
        input.session
      );

      return {
        success: result.success,
        tag: result.tag,
        text: result.text,
      };
    } catch (error) {
      throw new Error(
        `Click failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}

/**
 * 填写表单工具
 *
 * 在输入框中填写内容
 */
export class WebFillTool extends EnhancedBaseTool<
  {
    selector: string;
    value: string;
    session?: string;
  },
  {
    success: boolean;
    tag?: string;
  }
> {
  readonly metadata = {
    name: 'web_fill',
    description: '在页面输入框中填写内容',
    category: ToolCategory.NETWORK,
    isConcurrencySafe: false,
    inputSchema: z.object({
      selector: z.string().describe('元素选择器（@e 引用或 CSS 选择器）'),
      value: z.string().describe('要填写的值'),
      session: z.string().optional().describe('会话名称'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      tag: z.string().optional(),
    }),
    permissions: [],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  async execute(
    input: { selector: string; value: string; session?: string },
    _context: ToolContext
  ): Promise<{
    success: boolean;
    tag?: string;
  }> {
    try {
      const result = await sendWebBridgeCommand(
        'fill',
        {
          selector: input.selector,
          value: input.value,
        },
        input.session
      );

      return {
        success: result.success,
        tag: result.tag,
      };
    } catch (error) {
      throw new Error(
        `Fill failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}

/**
 * 执行 JavaScript 工具
 *
 * 在页面中执行 JavaScript 代码
 */
export class WebEvaluateTool extends EnhancedBaseTool<
  {
    code: string;
    session?: string;
  },
  {
    type: string;
    value?: any;
  }
> {
  readonly metadata = {
    name: 'web_evaluate',
    description: '在页面中执行 JavaScript 代码',
    category: ToolCategory.NETWORK,
    isConcurrencySafe: true,
    inputSchema: z.object({
      code: z.string().describe('要执行的 JavaScript 代码'),
      session: z.string().optional().describe('会话名称'),
    }),
    outputSchema: createEvaluateOutputSchema(),
    permissions: [],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  async execute(
    input: { code: string; session?: string },
    _context: ToolContext
  ): Promise<{
    type: string;
    value: any;
  }> {
    try {
      const result = await sendWebBridgeCommand(
        'evaluate',
        {
          code: input.code,
        },
        input.session
      );

      return {
        type: result.type || 'unknown',
        value: result.value,
      };
    } catch (error) {
      throw new Error(
        `Evaluate failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}

/**
 * 截图工具
 *
 * 对当前页面进行截图
 */
export class WebScreenshotTool extends EnhancedBaseTool<
  {
    format?: 'png' | 'jpeg';
    quality?: number;
    session?: string;
  },
  {
    filePath: string;
  }
> {
  readonly metadata = {
    name: 'web_screenshot',
    description: '对当前浏览器页面进行截图',
    category: ToolCategory.NETWORK,
    isConcurrencySafe: true,
    inputSchema: z.object({
      format: z
        .enum(['png', 'jpeg'])
        .optional()
        .default('png')
        .describe('图片格式'),
      quality: z
        .number()
        .min(0)
        .max(100)
        .optional()
        .default(80)
        .describe('图片质量（0-100，仅JPEG）'),
      session: z.string().optional().describe('会话名称'),
    }),
    outputSchema: z.object({
      filePath: z.string().describe('截图文件路径'),
    }),
    permissions: [],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  async execute(
    input: {
      format?: 'png' | 'jpeg';
      quality?: number;
      session?: string;
    },
    _context: ToolContext
  ): Promise<{ filePath: string }> {
    try {
      // 使用截图辅助脚本
      const scriptPath =
        process.env.HOME +
        '/.claude/skills/kimi-webbridge/scripts/screenshot.sh';

      let command = `bash "${scriptPath}"`;

      if (input.format && input.format !== 'png') {
        command += ` -f ${input.format}`;
      }

      if (input.quality !== undefined) {
        command += ` -q ${input.quality}`;
      }

      if (input.session) {
        command += ` -s ${input.session}`;
      }

      // 执行截图脚本
      const result = await this.executeBashCommand(command);

      // 解析输出获取文件路径
      const match = result.match(/Screenshot saved to: (.+)/);
      if (match) {
        return { filePath: match[1].trim() };
      }

      throw new Error('Failed to parse screenshot result');
    } catch (error) {
      throw new Error(
        `Screenshot failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * 执行 bash 命令的辅助方法
   */
  private async executeBashCommand(command: string): Promise<string> {
    // 这里需要使用 Bash 工具，但由于我们可能在浏览器自动化上下文中，
    // 我们使用 Node.js 的 child_process
    const { exec } = require('child_process');

    return new Promise((resolve, reject) => {
      exec(command, (error: Error | null, stdout: string, stderr: string) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }
}

/**
 * 等待工具
 *
 * 等待指定时间（用于页面加载等）
 */
export class WebWaitTool extends EnhancedBaseTool<
  {
    duration: number;
    session?: string;
  },
  {
    success: boolean;
  }
> {
  readonly metadata = {
    name: 'web_wait',
    description: '等待指定时间（用于页面加载、动画等）',
    category: ToolCategory.NETWORK,
    isConcurrencySafe: true,
    inputSchema: z.object({
      duration: z
        .number()
        .min(100)
        .max(60000)
        .describe('等待时长（毫秒）'),
      session: z.string().optional().describe('会话名称'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
    }),
    permissions: [],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  async execute(
    input: { duration: number; session?: string },
    _context: ToolContext
  ): Promise<{ success: boolean }> {
    await new Promise((resolve) => setTimeout(resolve, input.duration));

    // 简单返回成功，实际的等待效果由后续操作验证
    return { success: true };
  }
}

/**
 * 提取文本工具
 *
 * 从页面中提取文本内容
 */
export class WebExtractTextTool extends EnhancedBaseTool<
  {
    selector?: string;
    session?: string;
  },
  {
    text: string;
  }
> {
  readonly metadata = {
    name: 'web_extract_text',
    description: '从页面中提取文本内容',
    category: ToolCategory.NETWORK,
    isConcurrencySafe: true,
    inputSchema: z.object({
      selector: z
        .string()
        .optional()
        .describe('可选的元素选择器'),
      session: z.string().optional().describe('会话名称'),
    }),
    outputSchema: z.object({
      text: z.string().describe('提取的文本内容'),
    }),
    permissions: [],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  async execute(
    input: { selector?: string; session?: string },
    _context: ToolContext
  ): Promise<{ text: string }> {
    try {
      // 先获取快照
      const snapshotResult = await sendWebBridgeCommand(
        'snapshot',
        {},
        input.session
      );

      let text = '';

      if (input.selector) {
        // 如果指定了选择器，使用 evaluate 提取特定元素
        const evaluateResult = await sendWebBridgeCommand(
          'evaluate',
          {
            code: `
              const element = document.querySelector('${input.selector}');
              element ? element.textContent : '';
            `,
          },
          input.session
        );

        text = evaluateResult.value || '';
      } else {
        // 提取所有文本内容
        const tree = snapshotResult.tree || [];
        text = tree
          .filter((item: any) => item.role === 'text' || item.tag === 'p' || item.tag === 'span')
          .map((item: any) => item.name)
          .join('\n');
      }

      return { text: text.trim() };
    } catch (error) {
      throw new Error(
        `Extract text failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}

/**
 * 滚动工具
 *
 * 在页面中滚动
 */
export class WebScrollTool extends EnhancedBaseTool<
  {
    direction?: 'up' | 'down' | 'top' | 'bottom';
    amount?: number;
    session?: string;
  },
  {
    success: boolean;
  }
> {
  readonly metadata = {
    name: 'web_scroll',
    description: '在页面中滚动',
    category: ToolCategory.NETWORK,
    isConcurrencySafe: true,
    inputSchema: z.object({
      direction: z
        .enum(['up', 'down', 'top', 'bottom'])
        .optional()
        .default('down')
        .describe('滚动方向'),
      amount: z
        .number()
        .optional()
        .default(300)
        .describe('滚动距离（像素）'),
      session: z.string().optional().describe('会话名称'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
    }),
    permissions: [],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  async execute(
    input: { direction?: 'up' | 'down' | 'top' | 'bottom'; amount?: number; session?: string },
    _context: ToolContext
  ): Promise<{ success: boolean }> {
    try {
      const scrollCode = this.getScrollCode(input.direction || 'down', input.amount || 300);

      await sendWebBridgeCommand(
        'evaluate',
        {
          code: scrollCode,
        },
        input.session
      );

      return { success: true };
    } catch (error) {
      throw new Error(
        `Scroll failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * 生成滚动代码
   */
  private getScrollCode(direction: string, amount: number): string {
    switch (direction) {
      case 'up':
        return `window.scrollBy(0, -${amount});`;
      case 'down':
        return `window.scrollBy(0, ${amount});`;
      case 'top':
        return `window.scrollTo(0, 0);`;
      case 'bottom':
        return `window.scrollTo(0, document.body.scrollHeight);`;
      default:
        return `window.scrollBy(0, ${amount});`;
    }
  }
}
