# YunPat TUI 设置与使用指南

> 本文档适用于 YunPat TUI v0.8.15，一个基于 Rust 的终端智能体，支持 DeepSeek V4 等多种 LLM 后端。

## 目录

- [安装](#安装)
- [首次配置](#首次配置)
- [API 提供商配置](#api-提供商配置)
- [启动与基本使用](#启动与基本使用)
- [CLI 子命令参考](#cli-子命令参考)
- [安全模式](#安全模式)
- [MCP 集成](#mcp-集成)
- [Skills 技能系统](#skills-技能系统)
- [会话管理](#会话管理)
- [TUI 快捷键](#tui-快捷键)
- [配置文件详解](#配置文件详解)
- [环境变量参考](#环境变量参考)
- [沙箱机制](#沙箱机制)
- [LSP 集成](#lsp-集成)
- [常见问题](#常见问题)

---

## 安装

### 从源码构建（推荐）

需要 Rust 1.88+（使用 `let_chains` 和 Edition 2024）。

```bash
git clone https://github.com/Hmbown/DeepSeek-TUI.git
cd DeepSeek-TUI

# 安装两个二进制（必须同时安装，运行时互相依赖）
cargo install --path crates/cli --locked    # 安装 yunpat（CLI dispatcher）
cargo install --path crates/tui --locked    # 安装 yunpat-tui（TUI runtime）
```

安装后二进制位于 `~/.cargo/bin/`：

```
~/.cargo/bin/yunpat       # CLI 入口，自动调用 yunpat-tui
~/.cargo/bin/yunpat-tui   # TUI 运行时
```

### 通过 Cargo 安装

```bash
cargo install yunpat-cli yunpat-tui --locked
```

### 通过 npm 安装

```bash
npm install -g yunpat-tui
```

npm 包装器会自动从 GitHub Release 下载对应平台的二进制。

### 系统依赖

Linux 上需要额外安装：

```bash
# Debian/Ubuntu
sudo apt-get install -y libdbus-1-dev pkg-config

# 可选：OCR 功能需要
sudo apt-get install -y libleptonica-dev libtesseract-dev
```

macOS 和 Windows 无需额外系统依赖。

---

## 首次配置

### 1. 设置 API Key

最简单的方式：

```bash
yunpat login
```

交互式输入 API Key。Key 存储在 `~/.deepseek/config.toml` 或系统钥匙串中。

也可以通过环境变量：

```bash
export DEEPSEEK_API_KEY="sk-xxxxxxxxxxxxxxxx"
```

### 2. 验证配置

```bash
yunpat doctor
```

运行系统诊断，检查配置、API 连通性、模型可用性等。

### 3. 初始化工作目录（可选）

```bash
yunpat init        # 在当前目录创建 AGENTS.md
yunpat setup --all # 初始化 MCP 配置、skills、tools、plugins 目录
```

---

## API 提供商配置

YunPat TUI 支持 12 种 LLM 后端。在 `~/.deepseek/config.toml` 中配置：

### DeepSeek（默认）

```toml
provider = "deepseek"
api_key = "sk-xxxxxxxxxxxxxxxx"
# base_url 默认 https://api.deepseek.com/beta
# model 默认 deepseek-v4-pro
```

### OpenAI

```toml
provider = "openai"
api_key = "sk-xxxxxxxxxxxxxxxx"
# base_url 默认 https://api.openai.com/v1
# model 默认 gpt-4.1
```

### 智谱 GLM

```toml
[providers.zhipu]
api_key = "xxxxxxxxxxxxxxxx"
# base_url 默认 https://open.bigmodel.cn/api/paas/v4
# model 默认 glm-4-flash
```

### 豆包（字节跳动）

```toml
[providers.doubao]
api_key = "xxxxxxxxxxxxxxxx"
# base_url 默认 https://ark.cn-beijing.volces.com/api/v3
# model 默认 doubao-1-5-pro-256k
```

### Moonshot（Kimi）

```toml
[providers.moonshot]
api_key = "xxxxxxxxxxxxxxxx"
# base_url 默认 https://api.moonshot.cn/v1
# model 默认 moonshot-v1-128k
```

### Ollama（本地模型）

```toml
provider = "ollama"
# base_url 默认 http://localhost:11434/v1
# model 默认 deepseek-coder:1.3b
```

### 自托管推理引擎

```toml
# SGLang
provider = "sglang"
# base_url 默认 http://localhost:30000/v1

# vLLM
provider = "vllm"
# base_url 默认 http://localhost:8000/v1
```

### 其他云服务商

```toml
# NVIDIA NIM
[providers.nvidia_nim]
api_key = "nvapi-xxxxxxxx"
# base_url 默认 https://integrate.api.nvidia.com/v1

# OpenRouter
[providers.openrouter]
api_key = "sk-or-xxxxxxxx"

# Novita AI
[providers.novita]
api_key = "xxxxxxxx"

# Fireworks AI
[providers.fireworks]
api_key = "xxxxxxxx"
```

### 环境变量方式

也可以通过环境变量配置各提供商：

| 环境变量 | 说明 |
|---------|------|
| `DEEPSEEK_API_KEY` | DeepSeek API Key |
| `OPENAI_API_KEY` | OpenAI API Key |
| `ZHIPU_API_KEY` | 智谱 API Key |
| `DOUBAO_API_KEY` | 豆包 API Key |

---

## 启动与基本使用

### 交互式 TUI

```bash
yunpat              # 启动 TUI（最常用）
yunpat-tui          # 直接启动 TUI（跳过 dispatcher）
```

### 单次提示（非交互）

```bash
yunpat -p "解释 Rust 的所有权机制"
```

### 指定工作目录

```bash
yunpat -w /path/to/project
```

### 恢复上次会话

```bash
yunpat -c            # 继续最近的会话
yunpat --resume abc  # 恢复指定 ID 的会话
```

### YOLO 模式

```bash
yunpat --yolo        # 启用全部工具 + 自动执行（无审批确认）
```

---

## CLI 子命令参考

### 诊断与配置

| 命令 | 说明 |
|------|------|
| `yunpat doctor` | 系统诊断，检查配置和 API 连通性 |
| `yunpat models` | 列出可用模型 |
| `yunpat login` | 保存 API Key |
| `yunpat logout` | 删除已保存的 API Key |
| `yunpat setup --all` | 初始化 MCP/skills/tools/plugins |
| `yunpat init` | 在当前目录创建 AGENTS.md |

### 会话管理

| 命令 | 说明 |
|------|------|
| `yunpat sessions` | 列出保存的会话 |
| `yunpat sessions --search 关键词` | 搜索会话 |
| `yunpat resume --last` | 恢复最近的会话 |
| `yunpat resume <ID>` | 恢复指定会话 |
| `yunpat fork --last` | 分叉最近的会话为新会话 |
| `yunpat fork <ID>` | 分叉指定会话 |

### 一次性执行

```bash
yunpat exec "你的提示词"            # 非交互执行
yunpat exec --auto "修复这个 bug"   # 自动模式（工具 + 自动审批）
yunpat exec --json "提示词"         # JSON 机器可读输出
yunpat exec --model deepseek-v4-flash "快速提问"
```

### 代码审查

```bash
yunpat review                      # 审查工作区变更
yunpat review --staged             # 审查暂存区变更
yunpat review --base origin/main   # 与指定分支比较
yunpat review --path src/          # 限制审查范围
```

### PR 集成

```bash
yunpat pr 42                       # 加载 PR #42 的标题、正文和 diff
yunpat pr 42 --checkout            # 同时 checkout PR 分支
yunpat pr 42 -R owner/repo         # 指定仓库
```

### 补丁应用

```bash
yunpat apply patch.diff            # 应用补丁文件
git diff | yunpat apply            # 从 stdin 读取
```

### MCP 管理

```bash
yunpat mcp list                    # 列出 MCP 服务器
yunpat mcp init                    # 创建模板配置
yunpat mcp add <名称> --command <命令>   # 添加 stdio 服务器
yunpat mcp add <名称> --url <URL>        # 添加 HTTP/SSE 服务器
yunpat mcp connect [服务器名]             # 测试连接
yunpat mcp tools [服务器名]               # 列出可用工具
yunpat mcp remove <名称>                  # 移除服务器
yunpat mcp enable <名称>                  # 启用
yunpat mcp disable <名称>                 # 禁用
yunpat mcp add-self                       # 将自身注册为 MCP 服务器
```

### 服务模式

```bash
yunpat serve --mcp                 # MCP stdio 服务器
yunpat serve --http                # HTTP/SSE API 服务器
yunpat serve --http --port 8080    # 指定端口
yunpat serve --http --auth-token secret  # Bearer token 认证
yunpat serve --acp                 # ACP 服务器（编辑器集成）
```

### 其他工具

```bash
yunpat eval                        # 运行离线评估（无需网络）
yunpat sandbox run -- echo hello   # 在沙箱中运行命令
yunpat completions zsh             # 生成 shell 补全
yunpat features list               # 列出特性标志
```

---

## 安全模式

YunPat TUI 有三种执行模式，控制工具使用的审批严格程度：

### Plan 模式（默认，最安全）

- 模型只能**读取**文件和搜索代码
- 不允许执行 shell 命令
- 不允许修改文件
- 适合代码审查和理解

### Agent 模式

- 允许文件读写和 shell 执行
- **破坏性操作**（删除文件、危险命令）需要用户确认
- 日常开发推荐模式

### YOLO 模式（`--yolo`）

- 全部工具可用，**自动审批**所有操作
- 无需人工确认
- 适合自动化流程和可信环境
- **谨慎使用**

在 TUI 中可以通过快捷键切换模式。

---

## MCP 集成

[Model Context Protocol](https://modelcontextprotocol.io/) 允许 YunPat 调用外部工具服务器。

### 配置文件

`~/.deepseek/mcp.json`：

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"],
      "enabled": true
    },
    "remote-server": {
      "url": "https://mcp.example.com/sse",
      "enabled": true
    }
  }
}
```

### 管理命令

```bash
yunpat setup --mcp           # 生成模板配置
yunpat mcp add my-server --command "python server.py"
yunpat mcp add my-server --arg "--port" --arg "8080"
yunpat mcp connect           # 测试所有服务器连接
yunpat mcp tools             # 列出所有可用工具
```

---

## Skills 技能系统

Skills 是可扩展的提示模板，存放于 `~/.deepseek/skills/` 目录。

### 初始化

```bash
yunpat setup --skills         # 用户级 skills 目录
yunpat setup --skills --local # 当前项目级 skills 目录（./skills）
```

### 技能文件格式

每个 skill 是一个 Markdown 文件，包含触发规则和指令：

```markdown
---
name: my-skill
trigger: "当用户说 X 时触发"
---

你的指令内容...
```

### 使用

在 TUI 对话中直接输入指令，系统会根据触发规则自动匹配技能。

---

## 会话管理

### 会话存储

所有会话自动保存在 `~/.deepseek/sessions/` 目录。

### 常用操作

```bash
# 列出会话
yunpat sessions
yunpat sessions --limit 50
yunpat sessions --search "重构"

# 恢复会话
yunpat -c                      # 继续最近会话
yunpat resume <ID>             # 恢复指定会话
yunpat resume --last           # 恢复最近的

# 分叉会话（从历史节点创建新分支）
yunpat fork <ID>               # 分叉指定会话
yunpat fork --last             # 分叉最近的

# 清理检查点
yunpat setup --clean           # 清理可再生的会话检查点
```

### 快照

编辑文件前自动创建 Git 快照，存放于 `~/.deepseek/snapshots/`，支持回滚。

可在 `config.toml` 中控制：

```toml
[snapshots]
enabled = true
```

---

## TUI 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Enter` | 提交输入 |
| `Enter` | 换行 |
| `Ctrl+C` | 取消/中断当前 turn |
| `Ctrl+K` | 命令面板 |
| `Ctrl+B` | 切换侧边栏 |

快捷键可在 `~/.deepseek/tui.toml` 中自定义：

```toml
theme = "dark"

[keybinds]
submit = "ctrl+enter"
new_line = "enter"
command_palette = "ctrl+k"
cancel = "ctrl+c"
toggle_sidebar = "ctrl+b"
```

---

## 配置文件详解

### 目录结构

```
~/.deepseek/
├── config.toml          # 主配置文件
├── tui.toml             # TUI 界面偏好
├── mcp.json             # MCP 服务器配置
├── sessions/            # 会话历史
├── snapshots/           # 编辑快照（独立 Git 仓库）
├── skills/              # 用户技能
├── tools/               # 自定义工具
└── plugins/             # 插件
```

### 主配置文件（config.toml）

```toml
# 全局设置
provider = "deepseek"              # API 提供商
api_key = "sk-xxx"                 # API Key（也可用 keyring）
base_url = "https://api.deepseek.com/beta"  # API 端点
model = "deepseek-v4-pro"          # 默认模型
default_text_model = "deepseek-v4-pro"
approval_policy = "normal"         # 审批策略
sandbox_mode = "workspace-write"   # 沙箱策略
output_mode = "streaming"          # 输出模式
log_level = "warn"                 # 日志级别
telemetry = false                  # 遥测

# 多提供商配置
[providers.deepseek]
api_key = "sk-xxx"
base_url = "https://api.deepseek.com/beta"

[providers.openai]
api_key = "sk-xxx"

[providers.zhipu]
api_key = "xxxxxxxx"

# Skills 配置
[skills]
registry_url = "https://skills.example.com"
max_install_size_bytes = 10485760

# 快照配置
[snapshots]
enabled = true

# LSP 配置
[lsp]
# 语言服务器设置
```

### 配置优先级（从高到低）

1. CLI 参数（`--model`、`--provider`、`--yolo` 等）
2. 环境变量（`DEEPSEEK_API_KEY` 等）
3. 项目级配置（`$WORKSPACE/.deepseek/config.toml`）
4. 用户级配置（`~/.deepseek/config.toml`）
5. 默认值

跳过项目级配置：`yunpat --no-project-config`

---

## 环境变量参考

| 变量 | 说明 |
|------|------|
| `DEEPSEEK_API_KEY` | DeepSeek API Key |
| `OPENAI_API_KEY` | OpenAI API Key |
| `ZHIPU_API_KEY` | 智谱 API Key |
| `DOUBAO_API_KEY` | 豆包 API Key |
| `DEEPSEEK_CONFIG_PATH` | 自定义配置文件路径 |
| `DEEPSEEK_CORS_ORIGINS` | HTTP 服务 CORS 来源（逗号分隔） |
| `DEEPSEEK_RUNTIME_TOKEN` | HTTP API Bearer Token |

---

## 沙箱机制

文件操作在沙箱中执行，防止意外修改系统文件。

### 沙箱策略

| 策略 | 说明 |
|------|------|
| `workspace-write` | 只允许写入工作区（默认） |
| `read-only` | 只读 |
| `danger-full-access` | 完全访问（不推荐） |
| `external-sandbox` | 使用外部沙箱工具 |

macOS 使用 Seatbelt（系统自带沙箱），Linux 使用 Landlock。

### 手动使用沙箱

```bash
yunpat sandbox run --policy workspace-write -- echo hello
yunpat sandbox run --network -- curl https://example.com
yunpat sandbox run --writable-root /tmp/data -- ./script.sh
```

---

## LSP 集成

编辑文件后自动收集 LSP 诊断信息并注入到下一轮模型上下文中。

### 支持的语言服务器

- **rust-analyzer** — Rust
- **pyright** — Python
- **gopls** — Go
- **clangd** — C/C++
- **typescript-language-server** — TypeScript/JavaScript

LSP 需要项目中已有对应语言服务器的配置（如 `Cargo.toml`、`pyproject.toml` 等）。

---

## 常见问题

### 启动报 `MISSING_COMPANION_BINARY`

两个二进制必须在同一目录下。确保同时安装了 `yunpat` 和 `yunpat-tui`：

```bash
cargo install --path crates/cli --locked
cargo install --path crates/tui --locked
```

### API Key 不生效

检查优先级：

```bash
yunpat doctor    # 诊断
yunpat models    # 查看是否连接成功
```

### TUI 鼠标选择文本被拦截

```bash
yunpat --no-mouse-capture    # 禁用鼠标捕获，恢复终端原生选择
```

### 切换提供商

```bash
yunpat -p "测试" --model gpt-4.1          # 单次切换模型
# 或在 config.toml 中修改 provider 字段
```

### 更新到最新版本

```bash
git pull
cargo install --path crates/cli --locked
cargo install --path crates/tui --locked
```

### 查看详细日志

```bash
yunpat --verbose   # 启用详细日志
```
