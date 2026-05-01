/**
 * 示例用户数据提供者
 *
 * 这是一个参考实现，展示如何实现 UserDataProvider 接口
 * 实际生产环境应该从数据库、缓存或其他用户管理系统中获取数据
 */

import type { UserDataProvider, UserData } from './JwtManager.js';

/**
 * 内存用户数据提供者（仅用于示例/测试）
 *
 * ⚠️ 警告：这个实现使用内存存储，仅适用于开发和测试环境
 * 生产环境应该实现从数据库或缓存读取用户数据
 */
export class InMemoryUserDataProvider implements UserDataProvider {
  private users = new Map<string, UserData>();

  constructor(initialUsers?: UserData[]) {
    if (initialUsers) {
      for (const user of initialUsers) {
        this.users.set(user.userId, user);
      }
    }
  }

  /**
   * 添加或更新用户
   */
  setUserData(userData: UserData): void {
    this.users.set(userData.userId, userData);
  }

  /**
   * 删除用户
   */
  deleteUserData(userId: string): void {
    this.users.delete(userId);
  }

  /**
   * 获取用户数据
   */
  async getUserData(userId: string): Promise<UserData | null> {
    return this.users.get(userId) || null;
  }
}

/**
 * 创建一个默认的示例用户数据提供者
 * 用于快速启动和测试
 */
export function createExampleUserDataProvider(): InMemoryUserDataProvider {
  const provider = new InMemoryUserDataProvider([
    {
      userId: 'user-1',
      roles: ['user'],
      permissions: ['read', 'write'],
    },
    {
      userId: 'admin-1',
      roles: ['admin', 'user'],
      permissions: ['read', 'write', 'delete', 'admin'],
    },
  ]);

  return provider;
}
