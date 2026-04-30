/**
 * ConfigManager 测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ConfigManager,
  getConfigManager,
  resetConfigManager,
} from '../../src/config/ConfigManager.js';

describe('ConfigManager', () => {
  beforeEach(() => {
    resetConfigManager();
  });

  afterEach(() => {
    resetConfigManager();
  });

  describe('单例管理', () => {
    it('getConfigManager 应返回单例实例', () => {
      const a = getConfigManager();
      const b = getConfigManager();
      expect(a).toBe(b);
    });

    it('resetConfigManager 应重置单例', () => {
      const first = getConfigManager();
      resetConfigManager();
      const second = getConfigManager();
      expect(first).not.toBe(second);
    });
  });

  describe('构造函数', () => {
    it('应使用默认配置路径', () => {
      const mgr = new ConfigManager();
      expect(mgr.getConfigPath()).toContain('.yunpat');
    });

    it('应使用自定义配置路径', () => {
      const mgr = new ConfigManager({ configPath: '/tmp/test-config.yaml' });
      expect(mgr.getConfigPath()).toBe('/tmp/test-config.yaml');
    });

    it('应检测默认环境为 development', () => {
      const originalEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;
      delete process.env.ENV;

      const mgr = new ConfigManager();
      expect(mgr.getEnvironment()).toBe('development');

      if (originalEnv) process.env.NODE_ENV = originalEnv;
    });

    it('应检测 test 环境', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const mgr = new ConfigManager();
      expect(mgr.getEnvironment()).toBe('test');

      process.env.NODE_ENV = originalEnv;
    });

    it('应检测 production 环境', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const mgr = new ConfigManager();
      expect(mgr.getEnvironment()).toBe('production');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('load（无配置文件）', () => {
    it('应返回默认配置', () => {
      const mgr = new ConfigManager({
        configPath: '/tmp/nonexistent-config.yaml',
        environment: 'development',
      });
      const config = mgr.load();

      expect(config.environment).toBe('development');
      expect(config.llm).toBeDefined();
      expect(config.llm.primary.provider).toBe('deepseek');
      expect(config.memory?.type).toBe('memory');
      expect(config.reasoning?.strategy).toBe('react');
    });

    it('应缓存已加载的配置', () => {
      const mgr = new ConfigManager({ configPath: '/tmp/nonexistent-config.yaml' });
      const first = mgr.load();
      const second = mgr.load();
      expect(first).toBe(second);
    });
  });

  describe('reload', () => {
    it('应重新加载配置', () => {
      const mgr = new ConfigManager({ configPath: '/tmp/nonexistent-config.yaml' });
      const first = mgr.load();
      const reloaded = mgr.reload();
      expect(first).not.toBe(reloaded);
    });
  });

  describe('get', () => {
    it('应通过点号路径获取配置值', () => {
      const mgr = new ConfigManager({ configPath: '/tmp/nonexistent-config.yaml' });
      expect(mgr.get('llm.primary.provider')).toBe('deepseek');
    });

    it('不存在的路径应返回 undefined', () => {
      const mgr = new ConfigManager({ configPath: '/tmp/nonexistent-config.yaml' });
      expect(mgr.get('nonexistent.path')).toBeUndefined();
    });
  });

  describe('set', () => {
    it('应设置配置值', () => {
      const mgr = new ConfigManager({ configPath: '/tmp/nonexistent-config.yaml' });
      mgr.load();
      mgr.set('logLevel', 'debug');

      expect(mgr.get('logLevel')).toBe('debug');
    });

    it('应支持嵌套路径设置', () => {
      const mgr = new ConfigManager({ configPath: '/tmp/nonexistent-config.yaml' });
      mgr.load();
      mgr.set('memory.checkpointInterval', 20);

      expect(mgr.get('memory.checkpointInterval')).toBe(20);
    });
  });

  describe('getLLMConfig', () => {
    it('应返回 LLM 配置', () => {
      const mgr = new ConfigManager({ configPath: '/tmp/nonexistent-config.yaml' });
      const llmConfig = mgr.getLLMConfig();

      expect(llmConfig.primary).toBeDefined();
      expect(llmConfig.primary.model).toBe('deepseek-chat');
    });
  });

  describe('getPrimaryLLMConfig', () => {
    it('应返回主 LLM 配置', () => {
      const mgr = new ConfigManager({ configPath: '/tmp/nonexistent-config.yaml' });
      const primary = mgr.getPrimaryLLMConfig();

      expect(primary.provider).toBe('deepseek');
      expect(primary.temperature).toBe(0.7);
    });
  });
});
