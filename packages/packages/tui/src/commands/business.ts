/**
 * @file 业务命令定义
 * @description 专利撰写、OA答复、检索等业务斜杠命令
 */

import type { Command, CommandContext } from './types.js'
import type { IntentType } from '../types/index.js'
import { commandRegistry } from './CommandRegistry.js'
import { readDisclosureFile, scanWorkspace } from '../services/file-io.js'

/**
 * /draft - 启动完整专利撰写工作流
 */
const draftCommand: Command = {
  name: 'draft',
  description: '启动完整专利撰写工作流',
  help: `启动完整专利撰写工作流（发明理解 → 检索 → 说明书 → 权利要求 → 摘要 → 质量检查）。

示例:
  /draft 一种燃气管道紧急切断阀
  /draft --title 智能控制器 --field 电子技术
  /draft --file ./交底书.md 一种新型密封结构
  /draft 然后附上技术交底书

系统将自动执行 6 步流程，关键节点会暂停等待确认。`,
  category: 'business',
  args: [
    {
      name: 'description',
      description: '发明名称或描述',
      required: false,
      variadic: true,
    },
  ],
  options: [
    {
      name: 'title',
      description: '发明名称',
    },
    {
      name: 'field',
      description: '技术领域',
    },
    {
      name: 'file',
      description: '技术交底书文件路径（支持 .txt, .md）',
    },
  ],
  execute: async (_ctx, args, options) => {
    const title = (options?.title as string) || args.join(' ') || ''
    const field = (options?.field as string) || ''
    const filePath = options?.file as string | undefined

    let disclosure = ''
    if (filePath) {
      try {
        disclosure = await readDisclosureFile(filePath)
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : '无法读取交底书文件',
          code: 'FILE_READ_ERROR',
        }
      }
    }

    let message = title
    if (field) {
      message += `\n技术领域: ${field}`
    }
    if (disclosure) {
      message += `\n\n${disclosure}`
    }

    return {
      success: true,
      message: message || undefined,
      intentOverride: 'DRAFT_FULL' as IntentType,
    }
  },
}

/**
 * /claims - 仅撰写/修改权利要求
 */
const claimsCommand: Command = {
  name: 'claims',
  description: '撰写或修改权利要求',
  help: `仅撰写或修改权利要求书。

示例:
  /claims 基于以下技术方案撰写权利要求
  /claims 修改权利要求1，增加从属权利要求`,
  category: 'business',
  args: [
    {
      name: 'instruction',
      description: '撰写/修改指令',
      required: false,
      variadic: true,
    },
  ],
  execute: (_ctx, args) => {
    return {
      success: true,
      message: args.join(' ') || '请提供技术方案或权利要求修改指令',
      intentOverride: 'DRAFT_CLAIMS' as IntentType,
    }
  },
}

/**
 * /spec - 仅撰写说明书
 */
const specCommand: Command = {
  name: 'spec',
  description: '撰写说明书',
  help: `仅撰写专利说明书。

示例:
  /spec 基于以下交底书撰写说明书
  /spec --chapter 具体实施方式`,
  category: 'business',
  args: [
    {
      name: 'instruction',
      description: '撰写指令',
      required: false,
      variadic: true,
    },
  ],
  execute: (_ctx, args) => {
    return {
      success: true,
      message: args.join(' ') || '请提供技术交底书内容',
      intentOverride: 'DRAFT_SPEC' as IntentType,
    }
  },
}

/**
 * /oa - 启动OA答复工作流
 */
const oaCommand: Command = {
  name: 'oa',
  description: '启动审查意见答复工作流',
  help: `启动审查意见答复工作流（官文解析 → 意见分析 → 策略生成 → 答复撰写 → 质量检查）。

示例:
  /oa 答复202310964091.X的第一次审查意见
  /oa --file ./审查意见.pdf
  /oa 我收到了一份关于创造性的审查意见

系统将解析审查意见并生成答复策略。`,
  category: 'business',
  args: [
    {
      name: 'instruction',
      description: '答复指令或申请号',
      required: false,
      variadic: true,
    },
  ],
  options: [
    {
      name: 'file',
      description: '审查意见 PDF 文件路径',
    },
  ],
  execute: (_ctx, args, options) => {
    const file = options?.file as string | undefined
    const instruction = args.join(' ')

    let message = instruction || '请帮我答复审查意见'
    if (file) {
      message += `\n审查意见文件: ${file}`
    }

    return {
      success: true,
      message,
      intentOverride: 'RESPOND_OA' as IntentType,
    }
  },
}

/**
 * /search - 现有技术检索
 */
const searchCommand: Command = {
  name: 'search',
  description: '现有技术检索',
  help: `检索现有技术/相关专利。

示例:
  /search 电磁阀门快速切断
  /search 智能控制器的现有技术
  /search --field 机械 --keywords 阀门,密封`,
  category: 'business',
  args: [
    {
      name: 'query',
      description: '检索查询',
      required: false,
      variadic: true,
    },
  ],
  execute: (_ctx, args) => {
    return {
      success: true,
      message: args.join(' ') || '请提供检索关键词',
      intentOverride: 'SEARCH' as IntentType,
    }
  },
}

/**
 * /analyze - 专利组合分析
 */
const analyzeCommand: Command = {
  name: 'analyze',
  description: '专利组合分析',
  help: `分析专利组合情况，生成技术布局和价值评估报告。

示例:
  /analyze 分析我们公司的专利组合
  /analyze --company 华为 --field 5G通信
  /analyze 专利技术布局和竞争态势

系统将自动收集专利数据并生成分析报告。`,
  category: 'business',
  args: [
    {
      name: 'instruction',
      description: '分析指令',
      required: false,
      variadic: true,
    },
  ],
  options: [
    {
      name: 'company',
      description: '目标公司/申请人',
    },
    {
      name: 'field',
      description: '技术领域',
    },
  ],
  execute: (_ctx, args, options) => {
    const company = (options?.company as string) || ''
    const field = (options?.field as string) || ''
    const instruction = args.join(' ')

    let message = instruction || '请帮我分析专利组合'
    if (company) {
      message += `\n目标公司: ${company}`
    }
    if (field) {
      message += `\n技术领域: ${field}`
    }

    return {
      success: true,
      message,
      intentOverride: 'ANALYZE_PORTFOLIO' as IntentType,
    }
  },
}

/**
 * /code - 编程任务
 */
const codeCommand: Command = {
  name: 'code',
  description: '编程开发任务',
  help: `启动编程开发任务。

示例:
  /code 写一个 PDF 解析函数
  /code 实现 OCR 识别接口
  /code 帮我调试这个 Rust 编译错误

注意：如果 YunPat 框架本身没有对应功能，系统会建议您自行编程实现。`,
  category: 'business',
  args: [
    {
      name: 'task',
      description: '编程任务描述',
      required: false,
      variadic: true,
    },
  ],
  execute: (_ctx, args) => {
    return {
      success: true,
      message: args.join(' ') || '请描述您的编程需求',
      intentOverride: 'CODING' as IntentType,
    }
  },
}

/**
 * /init - 扫描工作区目录并检测 API 密钥
 */
const initCommand: Command = {
  name: 'init',
  description: '扫描工作区目录，检测专利相关文件和环境配置',
  help: `扫描指定目录或当前工作区，自动检测专利相关文件（审查意见、技术交底书等）和 API 密钥配置。

示例:
  /init
  /init /path/to/project

系统将扫描文件、检测环境配置，并推荐后续操作。`,
  category: 'business',
  args: [
    {
      name: 'path',
      description: '要扫描的目录路径（默认为当前目录）',
      required: false,
    },
  ],
  execute: async (_ctx, args) => {
    const dir = args[0] || '.'

    const lines: string[] = ['=== 工作区初始化 ===', '']

    // 1. 扫描文件系统
    try {
      const { files, directories } = await scanWorkspace(dir)

      lines.push(`扫描目录: ${dir}`)
      lines.push(`子目录数: ${directories.length}`)

      if (files.length > 0) {
        lines.push(`\n检测到专利相关文件 (${files.length} 个):`)
        for (const file of files.slice(0, 20)) {
          lines.push(`  • ${file}`)
        }
        if (files.length > 20) {
          lines.push(`  ... 还有 ${files.length - 20} 个文件`)
        }
      } else {
        lines.push('\n未检测到专利相关文件')
      }
    } catch (error) {
      lines.push(`扫描失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }

    // 2. 检测 API 密钥
    lines.push('\n--- 环境配置 ---')

    const apiKeys: Array<{ name: string; envVar: string; set: boolean }> = [
      { name: 'DeepSeek', envVar: 'DEEPSEEK_API_KEY', set: !!process.env.DEEPSEEK_API_KEY },
      { name: '智谱 GLM', envVar: 'GLM_API_KEY', set: !!process.env.GLM_API_KEY },
      { name: 'OpenAI', envVar: 'OPENAI_API_KEY', set: !!process.env.OPENAI_API_KEY },
      { name: '阿里云', envVar: 'DASHSCOPE_API_KEY', set: !!process.env.DASHSCOPE_API_KEY },
    ]

    for (const key of apiKeys) {
      lines.push(`  ${key.set ? '✓' : '✗'} ${key.name} (${key.envVar})`)
    }

    const hasAnyKey = apiKeys.some((k) => k.set)
    if (!hasAnyKey) {
      lines.push('\n⚠ 未检测到任何 LLM API 密钥，standalone 模式不可用。')
      lines.push('  请设置环境变量: export DEEPSEEK_API_KEY=your_key')
    }

    // 3. 检测 LLM 提供商
    const provider =
      process.env.LLM_PROVIDER ||
      (process.env.GLM_API_KEY
        ? 'zhipu'
        : process.env.DEEPSEEK_API_KEY
          ? 'deepseek'
          : process.env.OPENAI_API_KEY
            ? 'openai'
            : '未配置')
    lines.push(`\n当前 LLM 提供商: ${provider}`)

    // 4. 推荐后续操作
    lines.push('\n--- 推荐操作 ---')
    if (hasAnyKey) {
      lines.push('  1. 使用 /draft 命令开始撰写专利')
      lines.push('  2. 使用 /oa --file 命令答复审查意见')
      lines.push('  3. 使用 /model 查看或切换 LLM 提供商')
    } else {
      lines.push('  1. 设置 API 密钥后重新 /init')
      lines.push('  2. 或使用 --gateway 参数连接网关服务')
    }

    return {
      success: true,
      message: lines.join('\n'),
    }
  },
}

/**
 * /workflow - 查看当前工作流进度
 */
const workflowCommand: Command = {
  name: 'workflow',
  description: '查看当前工作流进度',
  help: `显示当前正在执行的工作流步骤和进度。

示例:
  /workflow`,
  category: 'general',
  execute: (ctx) => {
    const state = ctx.getState() as {
      workflow?: {
        type: string
        steps: Array<{ name: string; status: string }>
        currentStepIndex: number
        totalSteps: number
      } | null
    }
    const workflow = state?.workflow

    if (!workflow || !workflow.type) {
      return { success: true, message: '当前没有活跃的工作流' }
    }

    const lines = [`═══════ 工作流: ${workflow.type} ═══════`, '']

    workflow.steps.forEach((step, i) => {
      const icon =
        step.status === 'completed'
          ? '✓'
          : step.status === 'running'
            ? '●'
            : step.status === 'failed'
              ? '✗'
              : '○'
      const status =
        step.status === 'completed'
          ? ''
          : step.status === 'running'
            ? '（进行中）'
            : step.status === 'failed'
              ? '（失败）'
              : ''
      lines.push(`  ${icon} Step ${i + 1}/${workflow.totalSteps} · ${step.name} ${status}`)
    })

    return { success: true, message: lines.join('\n') }
  },
}

/**
 * /agents - 列出可用智能体
 */
const agentsCommand: Command = {
  name: 'agents',
  description: '列出所有可用的智能体',
  help: `显示所有已加载的智能体包及其能力。

示例:
  /agents`,
  category: 'config',
  execute: () => {
    // 智能体列表（与 CLI framework-commands.ts 保持同步）
    const agents = [
      {
        name: 'invention',
        package: '@yunpat/agent-invention',
        desc: '发明理解智能体',
        caps: ['交底书分析', '技术特征提取', '三元组生成'],
      },
      {
        name: 'prior-art-search',
        package: '@yunpat/agent-prior-art-search',
        desc: '现有技术检索',
        caps: ['检索策略构建', '相关性分析'],
      },
      {
        name: 'search',
        package: '@yunpat/agent-search',
        desc: '专利检索智能体',
        caps: ['检索策略', '多源检索', '相关性排序'],
      },
      {
        name: 'claim-generator',
        package: '@yunpat/agent-claim-generator',
        desc: '权利要求生成',
        caps: ['权利要求撰写', '形式检查', '法26.4检查'],
      },
      {
        name: 'specification-drafter',
        package: '@yunpat/agent-specification-drafter',
        desc: '说明书撰写智能体',
        caps: ['说明书生成', '章节撰写'],
      },
      {
        name: 'abstract-drafter',
        package: '@yunpat/agent-abstract-drafter',
        desc: '摘要撰写智能体',
        caps: ['摘要生成', '字数控制'],
      },
      {
        name: 'quality',
        package: '@yunpat/agent-quality',
        desc: '质量检查智能体',
        caps: ['多维质量评估', '修复建议'],
      },
      {
        name: 'analysis',
        package: '@yunpat/agent-analysis',
        desc: '专利技术分析',
        caps: ['现有技术分析', '对比分析'],
      },
      {
        name: 'patent-analyzer',
        package: '@yunpat/agent-patent-analyzer',
        desc: '对比分析智能体',
        caps: ['现有技术比对', '创造性评估', '风险评估'],
      },
      {
        name: 'patent-responder',
        package: '@yunpat/agent-patent-responder',
        desc: '审查答复智能体',
        caps: ['OA解析', '策略推荐', '答复书生成'],
      },
      {
        name: 'writer',
        package: '@yunpat/agent-writer',
        desc: '技术写作助手',
        caps: ['文档生成', '格式转换', '内容优化'],
      },
      {
        name: 'researcher',
        package: '@yunpat/agent-researcher',
        desc: '研究分析师',
        caps: ['信息搜集', '数据整理', '报告生成'],
      },
    ]

    const lines = [`=== 可用智能体 (${agents.length} 个) ===`, '']

    for (const agent of agents) {
      lines.push(`  ${agent.name.padEnd(24)} ${agent.desc}`)
      for (const cap of agent.caps) {
        lines.push(`  ${' '.repeat(24)} • ${cap}`)
      }
    }

    lines.push('\n使用 /draft /claims /spec 等命令自动调用对应智能体')

    return { success: true, message: lines.join('\n') }
  },
}

/**
 * /model - 查看/切换 LLM 模型
 */
const modelCommand: Command = {
  name: 'model',
  description: '查看当前 LLM 模型信息',
  help: `显示当前使用的 LLM 提供商和模型，支持切换。

示例:
  /model
  /model deepseek
  /model zhipu`,
  category: 'config',
  args: [
    {
      name: 'provider',
      description: '要切换到的提供商 (deepseek | zhipu | aliyun | ollama)',
      required: false,
    },
  ],
  execute: (_ctx, args) => {
    const currentProvider = process.env.LLM_PROVIDER || detectCurrentProvider()
    const availableProviders = detectAvailableProviders()

    // 如果有参数，尝试切换
    if (args[0]) {
      const target = args[0].toLowerCase()
      const validProviders = ['deepseek', 'zhipu', 'aliyun', 'ollama']

      if (!validProviders.includes(target)) {
        return {
          success: false,
          error: `未知的提供商: ${target}\n可选: ${validProviders.join(', ')}`,
          code: 'INVALID_ARGS',
        }
      }

      // 设置环境变量（当前进程生效）
      process.env.LLM_PROVIDER = target
      const newDetected = detectAvailableProviders()

      return {
        success: true,
        message:
          `已切换 LLM 提供商: ${target}\n` +
          `检测到的 API 密钥: ${
            newDetected
              .filter((p) => p.hasKey)
              .map((p) => p.name)
              .join(', ') || '无'
          }\n` +
          `注意: 切换在下次执行工作流时生效`,
      }
    }

    // 无参数时显示当前状态
    const lines = ['=== LLM 模型配置 ===', '']
    lines.push(`当前提供商: ${currentProvider}`)
    lines.push('')
    lines.push('可用提供商:')

    for (const p of availableProviders) {
      const marker = p.name === currentProvider ? ' ← 当前' : ''
      const keyStatus = p.hasKey ? '✓' : '✗'
      lines.push(`  ${keyStatus} ${p.name.padEnd(12)} ${p.model}${marker}`)
    }

    lines.push('')
    lines.push('切换: /model <provider>')
    lines.push('例如: /model deepseek')

    // standalone 模式提示
    if (_ctx.engine?.type === 'local') {
      lines.push('\n当前运行在 standalone 模式，LLM 直接调用本地智能体')
    } else {
      lines.push('\n当前运行在 gateway 模式，模型配置由 Gateway 管理')
      lines.push('环境变量 ROUTER_LLM_MODEL 也可用于 Gateway 模式切换')
    }

    return { success: true, message: lines.join('\n') }
  },
}

/** 检测当前提供商 */
function detectCurrentProvider(): string {
  if (process.env.LLM_PROVIDER) return process.env.LLM_PROVIDER
  if (process.env.GLM_API_KEY) return 'zhipu'
  if (process.env.DEEPSEEK_API_KEY) return 'deepseek'
  if (process.env.OPENAI_API_KEY) return 'openai'
  return '未配置'
}

/** 检测可用的提供商及其 API 密钥状态 */
function detectAvailableProviders(): Array<{ name: string; model: string; hasKey: boolean }> {
  return [
    { name: 'deepseek', model: 'deepseek-v4-pro', hasKey: !!process.env.DEEPSEEK_API_KEY },
    { name: 'zhipu', model: 'glm-4', hasKey: !!process.env.GLM_API_KEY },
    { name: 'aliyun', model: 'qwen-max', hasKey: !!process.env.DASHSCOPE_API_KEY },
    { name: 'ollama', model: 'llama3 (本地)', hasKey: true },
  ]
}

/**
 * 注册所有业务命令
 */
export function registerBusinessCommands(): void {
  commandRegistry.registerAll([
    draftCommand,
    claimsCommand,
    specCommand,
    oaCommand,
    searchCommand,
    analyzeCommand,
    codeCommand,
    initCommand,
    workflowCommand,
    agentsCommand,
    modelCommand,
  ])
}
