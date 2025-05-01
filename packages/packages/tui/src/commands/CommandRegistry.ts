/**
 * @file 命令注册表
 * @description 管理所有可用的斜杠命令
 */

import type { Command, CommandCategory, CommandSuggestion, ParsedCommand } from './types.js'

export class CommandRegistry {
  private commands = new Map<string, Command>()
  private aliases = new Map<string, string>()

  /**
   * 注册命令
   */
  register(command: Command): void {
    this.commands.set(command.name, command)

    // 注册别名
    if (command.options) {
      for (const opt of command.options) {
        if (opt.short) {
          this.aliases.set(opt.short, opt.name)
        }
      }
    }
  }

  /**
   * 批量注册命令
   */
  registerAll(commands: Command[]): void {
    for (const cmd of commands) {
      this.register(cmd)
    }
  }

  /**
   * 获取命令
   */
  get(name: string): Command | undefined {
    return this.commands.get(name)
  }

  /**
   * 检查命令是否存在
   */
  has(name: string): boolean {
    return this.commands.has(name)
  }

  /**
   * 获取所有命令
   */
  getAll(): Command[] {
    return Array.from(this.commands.values())
  }

  /**
   * 按分类获取命令
   */
  getByCategory(category: CommandCategory): Command[] {
    return this.getAll().filter((cmd) => cmd.category === category)
  }

  /**
   * 获取命令建议（用于自动补全）
   */
  getSuggestions(prefix: string): CommandSuggestion[] {
    const all = this.getAll()
    if (!prefix) {
      return all.map((cmd) => ({
        command: cmd.name,
        description: cmd.description,
        category: cmd.category,
      }))
    }

    const search = prefix.toLowerCase()
    return all
      .filter((cmd) => cmd.name.toLowerCase().startsWith(search))
      .map((cmd) => ({
        command: cmd.name,
        description: cmd.description,
        category: cmd.category,
      }))
  }

  /**
   * 解析命令字符串
   */
  parse(input: string): ParsedCommand | null {
    const trimmed = input.trim()
    if (!trimmed.startsWith('/')) {
      return null
    }

    // 移除斜杠并分割
    const parts = trimmed.slice(1).trim().split(/\s+/)
    if (parts.length === 0 || parts[0] === '') {
      return null
    }

    const command = parts[0]
    const args: string[] = []
    const options: Record<string, string> = {}

    // 解析参数和选项
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i]

      // 选项 (--option 或 -o)
      if (part.startsWith('--')) {
        const optName = part.slice(2)
        const nextPart = parts[i + 1]

        if (nextPart && !nextPart.startsWith('-')) {
          options[optName] = nextPart
          i++ // 跳过下一个部分
        } else {
          options[optName] = 'true'
        }
      } else if (part.startsWith('-') && part.length === 2) {
        const optName = part.slice(1)
        const nextPart = parts[i + 1]

        if (nextPart && !nextPart.startsWith('-')) {
          options[optName] = nextPart
          i++
        } else {
          options[optName] = 'true'
        }
      } else {
        args.push(part)
      }
    }

    return {
      command,
      args,
      options,
      raw: trimmed,
    }
  }

  /**
   * 获取命令帮助文本
   */
  getHelp(commandName?: string): string {
    if (!commandName) {
      return this.generateGeneralHelp()
    }

    const cmd = this.get(commandName)
    if (!cmd) {
      return `未知命令: ${commandName}`
    }

    return this.generateCommandHelp(cmd)
  }

  private generateGeneralHelp(): string {
    const lines = ['可用命令:', '']

    const byCategory: Record<CommandCategory, Command[]> = {
      business: [],
      general: [],
      session: [],
      ui: [],
      debug: [],
      config: [],
    }

    for (const cmd of this.getAll()) {
      byCategory[cmd.category].push(cmd)
    }

    const categoryLabels: Record<CommandCategory, string> = {
      general: '通用',
      session: '会话',
      ui: '界面',
      debug: '调试',
      config: '配置',
      business: '业务',
    }

    for (const [category, commands] of Object.entries(byCategory)) {
      if (commands.length === 0) continue

      lines.push(`\n${categoryLabels[category as CommandCategory]}:`)
      for (const cmd of commands) {
        lines.push(`  /${cmd.name.padEnd(12)} - ${cmd.description}`)
      }
    }

    lines.push('\n使用 /help <命令> 查看详细帮助')
    return lines.join('\n')
  }

  private generateCommandHelp(cmd: Command): string {
    const lines = [`/${cmd.name}`, '', cmd.description, '']

    if (cmd.args && cmd.args.length > 0) {
      lines.push('参数:')
      for (const arg of cmd.args) {
        const required = arg.required ? '(必需)' : '(可选)'
        lines.push(`  ${arg.name} ${required}`)
        lines.push(`    ${arg.description}`)
      }
      lines.push('')
    }

    if (cmd.options && cmd.options.length > 0) {
      lines.push('选项:')
      for (const opt of cmd.options) {
        const short = opt.short ? `-${opt.short}, ` : ''
        lines.push(`  ${short}--${opt.name}`)
        lines.push(`    ${opt.description}`)
      }
      lines.push('')
    }

    lines.push(cmd.help)
    return lines.join('\n')
  }
}

// 全局命令注册表实例
export const commandRegistry = new CommandRegistry()
