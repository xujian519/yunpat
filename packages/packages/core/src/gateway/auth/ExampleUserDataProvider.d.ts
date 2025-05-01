/**
 * 示例用户数据提供者
 *
 * 这是一个参考实现，展示如何实现 UserDataProvider 接口
 * 实际生产环境应该从数据库、缓存或其他用户管理系统中获取数据
 */
import type { UserDataProvider, UserData } from './JwtManager.js'
/**
 * 内存用户数据提供者（仅用于示例/测试）
 *
 * ⚠️ 警告：这个实现使用内存存储，仅适用于开发和测试环境
 * 生产环境应该实现从数据库或缓存读取用户数据
 */
export declare class InMemoryUserDataProvider implements UserDataProvider {
  private users
  constructor(initialUsers?: UserData[])
  /**
   * 添加或更新用户
   */
  setUserData(userData: UserData): void
  /**
   * 删除用户
   */
  deleteUserData(userId: string): void
  /**
   * 获取用户数据
   */
  getUserData(userId: string): Promise<UserData | null>
}
/**
 * 创建一个默认的示例用户数据提供者
 * 用于快速启动和测试
 */
export declare function createExampleUserDataProvider(): InMemoryUserDataProvider
//# sourceMappingURL=ExampleUserDataProvider.d.ts.map
