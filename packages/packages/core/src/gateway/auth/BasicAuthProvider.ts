import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import type { UserDataProvider, UserData } from './JwtManager.js'

export interface BasicAuthUser extends UserData {
  /** scrypt 密码哈希，格式: $scrypt$<salt_base64>$<hash_base64> */
  passwordHash: string
}

export interface BasicAuthProviderConfig {
  bcryptRounds?: number
}

export class BasicAuthProvider implements UserDataProvider {
  private users = new Map<string, BasicAuthUser>()

  constructor(initialUsers?: Array<Omit<BasicAuthUser, 'passwordHash'> & { password?: string }>) {
    if (initialUsers) {
      for (const user of initialUsers) {
        if (user.password) {
          const hash = this.hashPassword(user.password)
          this.users.set(user.userId, {
            ...user,
            passwordHash: hash,
          })
        } else {
          this.users.set(user.userId, user as BasicAuthUser)
        }
      }
    }
  }

  async registerUser(
    userId: string,
    password: string,
    roles: string[] = ['user'],
    permissions: string[] = ['read', 'write']
  ): Promise<void> {
    const hash = this.hashPassword(password)
    this.users.set(userId, {
      userId,
      roles,
      permissions,
      passwordHash: hash,
    })
  }

  async verifyCredentials(username: string, password: string): Promise<UserData | null> {
    const userId = `basic:${username}`
    const user = this.users.get(userId)
    if (!user) return null

    const hash = this.hashPassword(password, user.passwordHash)
    const hashBuffer = Buffer.from(hash, 'base64')
    const storedHash = user.passwordHash.split('$').pop() || ''
    const storedBuffer = Buffer.from(storedHash, 'base64')

    if (hashBuffer.length !== storedBuffer.length) return null

    if (!timingSafeEqual(hashBuffer, storedBuffer)) return null

    return {
      userId: user.userId,
      roles: user.roles,
      permissions: user.permissions,
    }
  }

  async getUserData(userId: string): Promise<UserData | null> {
    const user = this.users.get(userId)
    if (!user) return null

    return {
      userId: user.userId,
      roles: user.roles,
      permissions: user.permissions,
    }
  }

  /**
   * 使用 scrypt (N=16384, r=8, p=1) 进行密码哈希。
   * 如果提供 existingHash，则从中提取 salt 重新计算（用于验证）。
   * 否则生成新的随机 salt（用于注册）。
   */
  private hashPassword(password: string, existingHash?: string): string {
    let salt: Buffer
    if (existingHash && existingHash.startsWith('$scrypt$')) {
      const parts = existingHash.split('$')
      salt = Buffer.from(parts[2], 'base64')
    } else {
      salt = randomBytes(32)
    }
    const hash = scryptSync(password, salt, 64)
    return `$scrypt$${salt.toString('base64')}$${hash.toString('base64')}`
  }
}

export function createBasicAuthProvider(): BasicAuthProvider {
  // 安全提醒：不再提供默认用户，请通过 registerUser() 或传入 initialUsers 注册
  return new BasicAuthProvider()
}
