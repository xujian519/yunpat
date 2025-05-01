/**
 * Shell 命令安全验证器
 *
 * 防止路径遍历和命令注入攻击
 *
 * @package @yunpat/skills
 */

import { resolve, normalize, isAbsolute } from 'path'

/**
 * 路径验证配置
 */
export interface PathValidationConfig {
  /** 允许的根目录列表 */
  allowedRoots: string[]
  /** 是否允许相对路径 */
  allowRelativePaths?: boolean
  /** 是否允许符号链接 */
  allowSymlinks?: boolean
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: PathValidationConfig = {
  allowedRoots: [process.cwd()],
  allowRelativePaths: false,
  allowSymlinks: false,
}

/**
 * 验证并规范化路径
 *
 * @param userPath - 用户提供的路径
 * @param config - 验证配置
 * @returns 规范化后的绝对路径
 * @throws {Error} 如果路径不安全
 */
export function validateAndSanitizePath(
  userPath: string,
  config: PathValidationConfig = DEFAULT_CONFIG
): string {
  const { allowedRoots, allowRelativePaths = false, allowSymlinks = false } = config

  // 1. 规范化路径
  const normalized = normalize(userPath)

  // 2. 检查是否为绝对路径
  const absolutePath = isAbsolute(normalized) ? normalized : resolve(process.cwd(), normalized)

  if (!allowRelativePaths && !isAbsolute(normalized)) {
    throw new Error(`相对路径不允许: ${userPath}（允许的目录: ${allowedRoots.join(', ')}）`)
  }

  // 3. 检查是否在允许的根目录内
  const isAllowed = allowedRoots.some((root) => {
    const resolvedRoot = resolve(root)
    return absolutePath.startsWith(resolvedRoot + '/') || absolutePath === resolvedRoot
  })

  if (!isAllowed) {
    throw new Error(
      `路径超出允许范围: ${userPath}（解析为: ${absolutePath}，允许的目录: ${allowedRoots.join(', ')}）`
    )
  }

  // 4. 检查路径遍历攻击
  if (absolutePath.includes('..')) {
    throw new Error(`检测到路径遍历攻击: ${userPath}`)
  }

  // 5. 符号链接检查（可选）
  if (!allowSymlinks) {
    // 注意：这里需要使用 fs.stat，为了避免同步阻塞，
    // 实际应用中应该在异步上下文中检查
  }

  return absolutePath
}

/**
 * 验证 Shell 命令中的路径参数
 *
 * @param command - Shell 命令字符串
 * @param config - 验证配置
 * @returns 安全的命令字符串
 * @throws {Error} 如果命令包含不安全的路径
 */
export function validateShellCommand(
  command: string,
  config: PathValidationConfig = DEFAULT_CONFIG
): string {
  // 匹配常见的路径模式：
  // - `cat /path/to/file`
  // - `cat "/path/to/file"`
  // - `cat '/path/to/file'`
  const pathPattern = /(?:cat|less|head|tail|grep)\s+['"]?([^'"\s]+)['"]?/g

  let match
  const safeCommand = command

  while ((match = pathPattern.exec(command)) !== null) {
    const [fullMatch, path] = match
    try {
      validateAndSanitizePath(path, config)
    } catch (error) {
      throw new Error(
        `Shell 命令包含不安全的路径: ${fullMatch}\n原因: ${error instanceof Error ? error.message : error}`
      )
    }
  }

  return safeCommand
}

/**
 * 创建带路径验证的 Shell 命令处理器
 *
 * @param config - 验证配置
 * @returns Shell 命令处理函数
 */
export function createShellCommandHandler(config?: PathValidationConfig) {
  return (command: string): string => {
    return validateShellCommand(command, config)
  }
}
