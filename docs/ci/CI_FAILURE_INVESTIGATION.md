# CI/CD 失败调查报告

## 📊 失败运行分析

### 失败时间线

| 运行 ID     | Workflow        | 时间                 | 失败原因            |
| ----------- | --------------- | -------------------- | ------------------- |
| 25188259794 | CI (Simplified) | 2026-04-30T20:42:16Z | canvas 依赖安装失败 |
| 25188259780 | CI (Optimized)  | 2026-04-30T20:42:28Z | canvas 依赖安装失败 |
| 25184642794 | CI (Simplified) | 2026-04-30T19:18:47Z | canvas 依赖安装失败 |
| 25184642833 | CI (Optimized)  | 2026-04-30T19:18:41Z | canvas 依赖安装失败 |

## 🔍 根本原因分析

### 问题根源

**失败原因**: `canvas@2.11.2` 原生模块编译失败

**错误信息**:

```
Package 'pixman-1', required by 'virtual:world', not found
gyp ERR! configure error
node-pre-gyp ERR! build error
```

### 依赖链分析

```
@yunpat/document-tools
└── pdfjs-dist (3.11.174)
    └── canvas (2.11.2) ← 问题所在
        └── 需要编译原生模块
            └── 需要 pixman-1 系统库
```

### 为什么会失败？

1. **缺少系统依赖**: canvas 需要 pixman-1、cairo 等系统图形库
2. **网络问题**: canvas 预编译二进制文件下载失败 (404)
3. **编译环境**: Node.js 22 与 canvas 2.11.2 不兼容

## 💡 解决方案

### 方案 1: 使用纯 JavaScript canvas (推荐) ✅

**优势**:

- 无需系统依赖
- 跨平台兼容
- 安装快速稳定

**实施**:

```yaml
# 在 workflow 中添加环境变量
env:
  CANVAS_USE_NATIVE: '0'
```

### 方案 2: 跳过可选依赖安装

**优势**:

- 简单直接
- 不影响核心功能

**实施**:

```yaml
- name: 安装依赖
  run: pnpm install --no-frozen-lockfile --ignore-scripts
  env:
  PUPPETEET_SKIP_DOWNLOAD: 'true'
```

### 方案 3: 使用 Docker 容器 (长期方案)

**优势**:

- 完整的系统依赖
- 可复现的构建环境

**劣势**:

- 增加维护复杂度
- 延长构建时间

## 🎯 推荐实施方案

### 立即实施 ✅

1. **添加环境变量跳过原生编译**
2. **优化依赖安装策略**
3. **添加超时和重试机制**

### 长期优化 📈

1. **考虑替代方案**: 使用无原生依赖的 PDF 库
2. **Docker 化**: 统一构建环境
3. **依赖审查**: 定期检查和更新依赖

## 📋 实施清单

- [ ] 更新 CI workflow 添加环境变量
- [ ] 优化 pnpm 安装参数
- [ ] 添加构建超时配置
- [ ] 测试验证修复效果
- [ ] 更新文档和监控

## 🔧 技术细节

### canvas 替代方案

**当前**: pdfjs-dist + canvas (原生)  
**替代**:

1. pdfjs-dist + canvas-napi (预编译)
2. pdfjs-dist + @napi-rs/canvas (纯 JS)
3. pdf-lib (无 canvas 依赖)

### 环境变量配置

```bash
# 跳过原生模块编译
CANVAS_USE_NATIVE=0

# 使用纯 JS 实现
CANVAS_USE_JS=1

# 跳过可选依赖
PUPPETEET_SKIP_DOWNLOAD=true
```

---

**生成时间**: 2026-05-01  
**严重程度**: 高 (影响 CI 成功率)  
**优先级**: P0 (立即修复)
