import { describe, it, expect } from 'vitest';
import { GoogleOAuth } from '../../../src/gateway/auth/providers/GoogleOAuth.js';

describe('GoogleOAuth', () => {
  it('应该创建实例', () => {
    const oauth = new GoogleOAuth({ clientId: 'id', clientSecret: 'secret' });
    expect(oauth).toBeDefined();
    expect(oauth.getName()).toBe('google');
  });

  it('应该验证托管域名', () => {
    const result = GoogleOAuth.verifyHostedDomain(
      { id: '1', raw: { hd: 'example.com' } } as any,
      ['example.com']
    );
    expect(result).toBe(true);
  });

  it('应该拒绝无托管域名的用户', () => {
    const result = GoogleOAuth.verifyHostedDomain(
      { id: '1', raw: {} } as any,
      ['example.com']
    );
    expect(result).toBe(false);
  });
});
