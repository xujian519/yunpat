import { createHash, timingSafeEqual } from 'crypto'
import type { UserDataProvider, UserData } from './JwtManager.js'

export interface BasicAuthUser extends UserData {
  passwordHash: string
  salt: string
}

export interface BasicAuthProviderConfig {
  bcryptRounds?: number
}

export class BasicAuthProvider implements UserDataProvider {
  private users = new Map<string, BasicAuthUser>()

  constructor(
    initialUsers?: Array<Omit<BasicAuthUser, 'passwordHash' | 'salt'> & { password?: string }>
  ) {
    if (initialUsers) {
      for (const user of initialUsers) {
        if (user.password) {
          const { hash, salt } = this.hashPassword(user.password)
          this.users.set(user.userId, {
            ...user,
            passwordHash: hash,
            salt,
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
    const { hash, salt } = this.hashPassword(password)
    this.users.set(userId, {
      userId,
      roles,
      permissions,
      passwordHash: hash,
      salt,
    })
  }

  async verifyCredentials(username: string, password: string): Promise<UserData | null> {
    const userId = `basic:${username}`
    const user = this.users.get(userId)
    if (!user) return null

    const { hash } = this.hashPassword(password, user.salt)
    const hashBuffer = Buffer.from(hash, 'hex')
    const storedBuffer = Buffer.from(user.passwordHash, 'hex')

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

  private hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
    const salt =
      existingSalt || createHash('sha256').update(Date.now().toString()).digest('hex').slice(0, 16)
    const hash = createHash('sha256')
      .update(salt + password)
      .digest('hex')
    return { hash, salt }
  }
}

export function createBasicAuthProvider(): BasicAuthProvider {
  return new BasicAuthProvider([
    {
      userId: 'basic:admin',
      password: 'admin123',
      roles: ['admin', 'user'],
      permissions: ['read', 'write', 'delete', 'admin'],
    },
    {
      userId: 'basic:user',
      password: 'user123',
      roles: ['user'],
      permissions: ['read', 'write'],
    },
  ])
}
