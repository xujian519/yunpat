# 项目维护脚本

这个目录包含用于维护项目文件组织的自动化脚本。

## 📋 可用脚本

### 1. check-file-placement.sh

检查根目录是否有违规的文档文件。

**使用方法：**

```bash
./scripts/check-file-placement.sh
```

**功能：**

- 检查根目录的 markdown 文件是否符合文件处置规则
- 报告违规文件及其建议位置
- 可用于 CI/CD 流程中

**何时运行：**

- 提交代码前
- 合并 PR 时
- 定期维护时

---

### 2. new-doc-template.sh

创建符合文件处置规则的新文档。

**使用方法：**

```bash
# 创建工作报告
./scripts/new-doc-template.sh report work-summary "今日工作总结"

# 创建计划文档
./scripts/new-doc-template.sh plan refactor-features "重构计划"

# 创建开发指南
./scripts/new-doc-template.sh guide testing "测试指南"

# 创建架构文档
./scripts/new-doc-template.sh architecture event-system "事件系统设计"
```

**功能：**

- 根据文档类型自动选择正确的目录
- 生成包含标准元数据的模板
- 自动添加创建日期和文档类型

**何时运行：**

- 需要创建新文档时

---

## 🔄 定期维护任务

### 每周任务

- [ ] 运行 `check-file-placement.sh` 检查文件组织
- [ ] 将新创建的文档添加到 `docs/README.md` 索引

### 每月任务

- [ ] 将 `docs/reports/` 中超过6个月的报告移至 `docs/reports/archive/`
- [ ] 检查 `docs/plans/` 中的计划，将已完成的移至 `docs/history/`
- [ ] 更新文档索引

### 每季度任务

- [ ] 审查所有文档的准确性
- [ ] 删除或归档过时内容
- [ ] 合并重复文档

---

## 📝 开发新脚本

在添加新脚本时，请遵循以下规范：

1. **命名规范**
   - 使用 kebab-case 命名
   - 名称应清晰描述脚本功能
   - 添加 `.sh` 扩展名

2. **脚本结构**

   ```bash
   #!/bin/bash
   set -e  # 遇到错误时退出
   # 添加注释说明脚本用途
   # 使用有意义的变量名
   # 提供使用说明
   ```

3. **添加执行权限**

   ```bash
   chmod +x scripts/your-script.sh
   ```

4. **更新此 README**
   - 添加脚本说明
   - 提供使用示例
   - 说明运行时机

---

## 🔗 相关文档

- [文件处置规则](../docs/FILE_MANAGEMENT_RULES.md) - 详细的文件组织规范
- [项目文档中心](../docs/README.md) - 所有项目文档的索引
