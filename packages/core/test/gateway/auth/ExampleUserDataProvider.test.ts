import { describe, it, expect } from 'vitest';
import {
  InMemoryUserDataProvider,
  createExampleUserDataProvider,
} from '../../../src/gateway/auth/ExampleUserDataProvider.js';

describe('ExampleUserDataProvider', () => {
  it('应该创建空提供者', () => {
    const provider = new InMemoryUserDataProvider();
    expect(provider).toBeDefined();
  });

  it('应该创建带初始用户的提供者', () => {
    const provider = new InMemoryUserDataProvider([
      { userId: '1', roles: ['user'], permissions: ['read'] },
    ]);
    expect(provider).toBeDefined();
  });

  it('应该设置用户数据', () => {
    const provider = new InMemoryUserDataProvider();
    provider.setUserData({ userId: '1', roles: ['user'], permissions: ['read'] });
    expect(provider).toBeDefined();
  });

  it('应该删除用户数据', () => {
    const provider = new InMemoryUserDataProvider([
      { userId: '1', roles: ['user'], permissions: ['read'] },
    ]);
    provider.deleteUserData('1');
    expect(provider).toBeDefined();
  });

  it('应该获取用户数据', async () => {
    const provider = new InMemoryUserDataProvider([
      { userId: '1', roles: ['user'], permissions: ['read'] },
    ]);
    const user = await provider.getUserData('1');
    expect(user).not.toBeNull();
    expect(user!.userId).toBe('1');
  });

  it('应该返回null（不存在的用户）', async () => {
    const provider = new InMemoryUserDataProvider();
    const user = await provider.getUserData('non-existent');
    expect(user).toBeNull();
  });

  it('应该创建示例提供者', () => {
    const provider = createExampleUserDataProvider();
    expect(provider).toBeDefined();
  });
});
