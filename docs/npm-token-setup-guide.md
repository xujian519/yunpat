# npm Token 配置指南

## 步骤1：创建npm Token

### 1.1 登录npm

访问：https://www.npmjs.com/login
使用您的npm账号登录

### 1.2 创建Access Token

1. 点击右上角头像
2. 选择 **"Access Tokens"**
3. 点击 **"New Access Token"**
4. 配置Token：
   - **Token Name**: `GitHub Actions - YunPat`（或任意名称）
   - **Token Type**: 选择 **"Automation"**
   - **Expiration**: 可选择90天、1年或无过期日期
   - **Scope**: 勾选 **"Automation"** 权限
5. 点击 **"Create Token"**
6. **重要**：复制Token（只显示一次！）

---

## 步骤2：添加到GitHub Secrets

### 2.1 访问Secrets设置页面

在浏览器中打开：

```
https://github.com/xujian519/yunpat/settings/secrets/actions
```

### 2.2 添加新的Secret

1. 点击 **"New repository secret"** 按钮
2. 配置Secret：
   - **Name**: `NPM_TOKEN`
   - **Value**: 粘贴您的npm token（从步骤1.6获取）
3. 点击 **"Add secret"** 保存

---

## 步骤3：验证配置

### 3.1 验证Secret已添加

访问：https://github.com/xujian519/yunpat/settings/secrets/actions
确认 `NPM_TOKEN` 在列表中

### 3.2 测试发布流程（可选）

如果您想测试自动发布是否工作：

1. 创建测试tag：

```bash
git tag v0.1.1-test
git push origin v0.1.1-test
```

2. 查看Actions页面：
   https://github.com/xujian519/yunpat/actions

3. 确认"发布"工作流运行成功

4. 清理测试tag：

```bash
git tag -d v0.1.1-test
git push origin :refs/tags/v0.1.1-test
```

---

## 使用GitHub CLI配置（备选）

如果您有GitHub CLI，可以使用命令行添加Secret：

```bash
# 设置NPM_TOKEN secret
gh secret set NPM_TOKEN "您的npm_token_here" -R xujian519/yunpat

# 验证secret已设置
gh secret list -R xujian519/yunpat
```

---

## 安全建议

1. ✅ Token权限：只授予必需的Automation权限
2. ✅ Token过期：设置合理的过期时间（建议90天）
3. ✅ Token存储：使用GitHub Secrets安全存储
4. ✅ 定期轮换：定期更新token
5. ✅ 监控使用：监控GitHub Actions的使用情况

---

## 故障排除

### 问题1：发布失败

**错误信息**：`npm ERR! 404 Not Found - PUT https://registry.npmjs.org/...`

**解决方案**：

1. 确认token有正确的发布权限
2. 确认package.json中的包名正确
3. 确认您是包的维护者

### 问题2：Token无效

**错误信息**：`401 Unauthorized`

**解决方案**：

1. 检查token是否过期
2. 删除旧token，创建新token
3. 更新GitHub Secrets

### 问题3：包名冲突

**错误信息**：`403 Forbidden - package name already exists`

**解决方案**：

1. 确认您是包的维护者
2. 检查包名是否已被占用
3. 使用不同的包名发布

---

## 配置完成后的工作流

配置完成后，当您推送版本tag时：

```bash
git tag v0.2.0
git push origin v0.2.0
```

GitHub Actions将自动：

1. ✅ 运行测试
2. ✅ 构建项目
3. ✅ 发布到npm
4. ✅ 创建GitHub Release
5. ✅ 生成Release Notes

---

## 相关链接

- npm Tokens: https://www.npmjs.com/settings/tokens
- GitHub Secrets: https://github.com/xujian519/yunpat/settings/secrets/actions
- 发布工作流: https://github.com/xujian519/yunpat/actions/workflows/release-new.yml
