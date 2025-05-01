# PR保护规则配置指南

## 步骤1：访问分支保护设置页面

在浏览器中打开以下链接：

```
https://github.com/xujian519/yunpat/settings/branches
```

## 步骤2：添加main分支保护规则

1. 点击 **"Add branch protection rule"** 按钮

2. 配置以下选项：

### 分支名称模式

```
Branch name pattern: main
```

### ✅ 勾选以下选项

#### 1. 保护匹配的分支

- ✅ **Require a pull request before merging**
  - **Required approvals**: 1
  - ✅ **Dismiss stale reviews when new commits are pushed**

#### 2. 保护匹配的分支 - 状态检查

- ✅ **Require status checks to pass before merging**
  - 搜索并勾选：`ci`
  - 搜索并勾选：`code-quality`
  - ✅ **Require branches to be up to date before merging**

#### 3. 保护匹配的分支 - 其他规则

- ✅ **Do not allow bypassing the above settings**

3. 点击 **"Create"** 或 **"Save changes"** 保存配置

---

## 配置效果

配置完成后，所有PR必须满足以下条件才能合并：

1. ✅ 至少1个审查批准
2. ✅ CI检查通过（`ci`）
3. ✅ 代码质量检查通过（`code-quality`）
4. ✅ 分支必须最新
5. ✅ 不能绕过设置

---

## 使用GitHub CLI配置（备选）

如果您有GitHub CLI和相应权限，可以运行以下命令：

```bash
gh api \
  repos/xujian519/yunpat/branches/main/protection \
  -X PUT \
  -F required_pull_request_reviews='{"required_approving_review_count":1}' \
  -F enforce_admins=false \
  -F required_status_checks='{"strict":true,"checks":[{"context":"ci"},{"context":"code-quality"}]}' \
  -F allow_force_pushes=false \
  -F allow_deletions=false
```

---

## 验证配置

配置完成后，您可以验证：

1. 访问：https://github.com/xujian519/yunpat/settings/branches
2. 查看main分支的保护规则
3. 确认所有设置已正确应用
