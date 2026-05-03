import chalk from 'chalk'

export class CLIError extends Error {
  constructor(
    message: string,
    public code: string,
    public suggestions?: string[]
  ) {
    super(message)
    this.name = 'CLIError'
  }
}

export function handleError(error: unknown, context?: string): never {
  console.error(chalk.red('\n❌ 错误'))

  if (error instanceof CLIError) {
    console.error(chalk.red(`   ${error.message}`))

    if (error.suggestions && error.suggestions.length > 0) {
      console.error(chalk.yellow('\n💡 建议:'))
      error.suggestions.forEach((suggestion, index) => {
        console.error(chalk.yellow(`   ${index + 1}. ${suggestion}`))
      })
    }

    if (error.code) {
      console.error(chalk.gray(`\n   错误代码: ${error.code}`))
    }
  } else if (error instanceof Error) {
    console.error(chalk.red(`   ${error.message}`))

    if (error.message.includes('API 密钥')) {
      console.error(chalk.yellow('\n💡 建议:'))
      console.error(chalk.yellow('   1. 设置环境变量: export DEEPSEEK_API_KEY=your_key'))
      console.error(chalk.yellow('   2. 或使用参数: yunpat init --api-key your_key'))
    }
  } else {
    console.error(chalk.red(`   未知错误: ${String(error)}`))
  }

  if (context) {
    console.error(chalk.gray(`\n   上下文: ${context}`))
  }

  process.exit(1)
}

export function createErrorHandler(context: string) {
  return (error: unknown) => handleError(error, context)
}
