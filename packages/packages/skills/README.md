# @yunpat/skills

YunPat Skills 系统 - 模块化提示词管理

## 概述

Skills 系统提供了一种完全解耦的提示词管理方式，支持：

- ✅ Markdown + Frontmatter 格式
- ✅ 变量替换和条件渲染
- ✅ 知识库深度集成
- ✅ 条件自动激活
- ✅ Shell 命令注入

## 快速开始

### 创建 Skill

```bash
mkdir -p .yunpat/skills/my-skill
cat > .yunpat/skills/my-skill/SKILL.md << 'EOF'
---
name: my-skill
description: 我的技能
---

你是一位...
EOF
```

### 调用 Skill

```typescript
import { ProfessionalAgent } from '@yunpat/agent-base'

class MyAgent extends ProfessionalAgent {
  async act(input: any) {
    const result = await this.callSkill('my-skill', {})
    return { success: true, data: result }
  }
}
```

## 目录结构

```
.yunpat/skills/
├── examples/
│   └── hello-world/
│       └── SKILL.md
├── invention-understanding/
│   └── SKILL.md
└── claims-drafting/
    └── SKILL.md
```

## 开发

```bash
# 安装
pnpm install

# 构建
pnpm build

# 测试
pnpm test

# 类型检查
pnpm type-check
```

## 文档

- [Skills 快速开始](../../../../docs/guides/skills-quickstart.md)
- [优化计划](../../../../docs/plans/optimization/prompt-system-optimization-plan.md)
- [目录规范](../../../../.yunpat/skills/SKILLS_DIRECTORY_SPEC.md)
- [Skill 模板](../../../../.yunpat/skills/SKILL_TEMPLATE.md)

## License

MIT
