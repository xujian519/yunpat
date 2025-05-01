#!/usr/bin/env node
/**
 * @file CLI 入口
 * @description 启动 TUI 应用，支持 standalone 和 gateway 两种模式
 */

import React from 'react'
import { render } from 'ink'
import { App, DialogProvider } from './components/index.js'
import { registerBuiltinCommands } from './commands/builtin.js'
import { registerBusinessCommands } from './commands/business.js'

function showHelp(): never {
  console.log(`
Usage: yunpat [options]

Options:
  --standalone        使用本地 LLM 模式（默认）
  --gateway <url>     使用 gateway 模式，连接指定网关地址
  --user <id>         设置用户 ID（默认: cli-user）
  -h, --help          显示帮助信息

Examples:
  yunpat                        # 默认 standalone 模式
  yunpat --standalone           # 显式指定 standalone 模式
  yunpat --gateway http://localhost:8081   # 连接本地网关
`)
  process.exit(0)
}

function parseArgs(args: string[]): {
  mode: 'standalone' | 'gateway'
  gatewayUrl?: string
  userId: string
} {
  const userId =
    args.find((arg) => arg.startsWith('--user='))?.split('=')[1] ??
    process.env.YUNPAT_USER_ID ??
    'cli-user'

  if (args.includes('-h') || args.includes('--help')) {
    showHelp()
  }

  // --standalone 标志
  const standalone = args.includes('--standalone')

  // --gateway <url> 或 --gateway=<url>
  let gatewayUrl: string | undefined
  const gatewayEqIdx = args.findIndex((arg) => arg.startsWith('--gateway='))
  if (gatewayEqIdx !== -1) {
    gatewayUrl = args[gatewayEqIdx]!.split('=').slice(1).join('=')
  } else {
    const gatewayIdx = args.indexOf('--gateway')
    if (gatewayIdx !== -1 && args[gatewayIdx + 1]) {
      gatewayUrl = args[gatewayIdx + 1]
    }
  }

  // 如果同时指定了 --standalone 和 --gateway，--gateway 优先
  if (gatewayUrl) {
    return { mode: 'gateway', gatewayUrl, userId }
  }

  // 环境变量 fallback
  const envGateway = process.env.YUNPAT_GATEWAY_URL ?? process.env.GATEWAY_URL
  if (!standalone && envGateway) {
    return { mode: 'gateway', gatewayUrl: envGateway, userId }
  }

  // 默认 standalone
  return { mode: 'standalone', userId }
}

async function main() {
  // 注册所有命令
  registerBuiltinCommands()
  registerBusinessCommands()

  const args = process.argv.slice(2)
  const { mode, gatewayUrl, userId } = parseArgs(args)

  // gateway 模式下确定最终 URL
  const resolvedGatewayUrl =
    mode === 'gateway'
      ? (gatewayUrl ?? `http://localhost:${process.env.GATEWAY_PORT ?? 8081}`)
      : undefined

  // 渲染 TUI
  const { waitUntilExit } = render(
    React.createElement(
      DialogProvider,
      null,
      React.createElement(App, {
        gatewayUrl: resolvedGatewayUrl ?? '',
        userId,
        standalone: mode === 'standalone',
      })
    )
  )

  await waitUntilExit()
}

main().catch((error) => {
  console.error('Failed to start TUI:', error)
  process.exit(1)
})
