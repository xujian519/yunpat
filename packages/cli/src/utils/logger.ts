import chalk from 'chalk'
import ora from 'ora'
import { handleError } from './errors.js'

export enum LogLevel {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
}

class Logger {
  private context: string

  constructor(context: string) {
    this.context = context
  }

  info(message: string): void {
    console.log(chalk.blue(`[${this.context}] ${message}`))
  }

  success(message: string): void {
    console.log(chalk.green(`[${this.context}] ✓ ${message}`))
  }

  warning(message: string): void {
    console.log(chalk.yellow(`[${this.context}] ⚠ ${message}`))
  }

  error(message: string, error?: unknown): void {
    console.log(chalk.red(`[${this.context}] ✗ ${message}`))
    if (error) {
      handleError(error, this.context)
    }
  }

  data(key: string, value: string): void {
    console.log(chalk.gray(`[${this.context}]   ${key}: ${value}`))
  }

  startSpinner(message: string): ora.Ora {
    return ora(message).start()
  }
}

export function createLogger(context: string): Logger {
  return new Logger(context)
}
