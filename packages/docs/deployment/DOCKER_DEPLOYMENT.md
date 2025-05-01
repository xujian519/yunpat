# Docker 部署指南

**更新时间**: 2026-05-04
**状态**: ✅ 生产就绪

---

## 📋 前置要求

### 系统要求

- **操作系统**: Linux/macOS/Windows
- **Docker**: 20.10+
- **Docker Compose**: 2.0+
- **内存**: 至少 4GB RAM
- **磁盘空间**: 至少 10GB 可用空间

### 依赖检查

```bash
# 检查Docker版本
docker --version

# 检查Docker Compose版本
docker-compose --version
```

---

## 🚀 快速开始

### 一键部署

```bash
# 1. 克隆仓库
git clone https://github.com/xujian519/yunpat.git
cd yunpat

# 2. 配置环境变量
cp .env.example .env
# 编辑.env文件，设置API密钥

# 3. 一键部署
make deploy
```

### 使用部署脚本

```bash
# 完整部署（推荐）
./scripts/deploy.sh deploy

# 仅构建镜像
./scripts/deploy.sh build

# 仅启动服务
./scripts/deploy.sh start

# 查看服务状态
./scripts/deploy.sh status

# 查看日志
./scripts/deploy.sh logs

# 停止服务
./scripts/deploy.sh stop
```

---

## 🔧 配置说明

### 环境变量

创建 `.env` 文件：

```bash
# LLM配置
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=your_api_key_here
DEEPSEEK_API_KEY=your_deepseek_key
QWEN_API_KEY=your_qwen_key

# 数据库配置
POSTGRES_PASSWORD=yunpat_password

# Grafana配置
GRAFANA_PASSWORD=admin
```

### 支持的LLM提供商

| 提供商    | 环境变量                 | 说明 |
| --------- | ------------------------ | ---- |
| Anthropic | `LLM_PROVIDER=anthropic` | 推荐 |
| DeepSeek  | `LLM_PROVIDER=deepseek`  | 备选 |
| 通义千问  | `LLM_PROVIDER=qwen`      | 备选 |

---

## 📊 服务架构

### 服务列表

| 服务                 | 端口 | 说明           |
| -------------------- | ---- | -------------- |
| OrchestratorAgent    | 3000 | 核心编排服务   |
| PatentWriterAgent    | -    | 专利撰写服务   |
| PatentResponderAgent | -    | 审查答复服务   |
| PatentAnalyzerAgent  | -    | 专利分析服务   |
| PatentSearchAgent    | -    | 专利检索服务   |
| Redis                | 6379 | 缓存和消息队列 |
| PostgreSQL           | 5432 | 数据库         |
| Prometheus           | 9090 | 监控指标收集   |
| Grafana              | 3001 | 监控面板       |

### 网络架构

```
┌─────────────────────────────────────────┐
│         yunpat-network (bridge)          │
├─────────────────────────────────────────┤
│  orchestrator (3000)                    │
│  patent-writer                          │
│  patent-responder                        │
│  patent-analyzer                         │
│  patent-search                           │
│  redis (6379)                           │
│  postgres (5432)                         │
│  prometheus (9090)                       │
│  grafana (3001)                          │
└─────────────────────────────────────────┘
```

---

## 🏥 健康检查

### 手动健康检查

```bash
# 执行健康检查
make health

# 或使用部署脚本
./scripts/deploy.sh health
```

### 自动健康检查

Docker会自动执行健康检查：

- **间隔**: 30秒
- **超时**: 10秒
- **启动等待**: 40秒
- **重试次数**: 3次

### 健康检查端点

```bash
# 检查OrchestratorAgent
curl http://localhost:3000/health

# 检查Redis
docker-compose exec redis redis-cli ping

# 检查PostgreSQL
docker-compose exec postgres pg_isready -U yunpat
```

---

## 📈 监控

### Prometheus监控

访问地址: http://localhost:9090

**监控指标**:

- LLM调用性能
- Agent执行时间
- 系统资源使用
- 业务指标

### Grafana面板

访问地址: http://localhost:3001

**默认凭据**:

- 用户名: `admin`
- 密码: `admin` (请在.env中修改)

**预置面板**:

- 系统性能监控
- LLM调用监控
- Agent执行监控
- 资源使用监控

---

## 📝 日志管理

### 查看日志

```bash
# 查看所有服务日志
make logs

# 查看特定服务日志
./scripts/deploy.sh logs orchestrator
./scripts/deploy.sh logs redis

# 实时跟踪日志
docker-compose logs -f [service-name]
```

### 日志存储

日志文件存储在 `./logs` 目录下：

```
logs/
├── orchestrator.log
├── patent-writer.log
├── patent-responder.log
└── ...
```

---

## 🔄 更新部署

### 滚动更新

```bash
# 1. 拉取最新代码
git pull

# 2. 重新构建镜像
make docker-build

# 3. 重启服务
make restart
```

### 零停机部署

使用Docker的多阶段构建和健康检查，实现零停机部署：

```bash
# 1. 构建新镜像
docker-compose build

# 2. 启动新容器（旧容器继续运行）
docker-compose up -d --no-deps --build

# 3. 验证新容器健康
make health

# 4. 停止旧容器
docker-compose down
```

---

## 🛠️ 故障排查

### 常见问题

#### 1. 端口冲突

**问题**: 端口已被占用

**解决**:

```bash
# 查看端口占用
lsof -i :3000

# 修改docker-compose.yml中的端口映射
ports:
  - "3001:3000"  # 使用3001端口
```

#### 2. 内存不足

**问题**: 容器因内存不足退出

**解决**:

```bash
# 增加Docker内存限制
# 在docker-compose.yml中添加：
services:
  orchestrator:
    deploy:
      resources:
        limits:
          memory: 2G
```

#### 3. API密钥无效

**问题**: LLM调用失败

**解决**:

```bash
# 检查.env文件中的API密钥
cat .env | grep API_KEY

# 验证API密钥
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY"
```

#### 4. 服务无法启动

**问题**: 容器启动失败

**解决**:

```bash
# 查看详细日志
docker-compose logs [service-name]

# 检查容器状态
docker-compose ps

# 重启服务
make restart
```

---

## 🔒 安全建议

### 生产环境配置

1. **修改默认密码**

   ```bash
   # 修改.env中的密码
   POSTGRES_PASSWORD=strong_password_here
   GRAFANA_PASSWORD=strong_grafana_password
   ```

2. **使用密钥管理**

   ```bash
   # 使用Docker Secrets
   echo "your_api_key" | docker secret create anthropic_api_key -
   ```

3. **启用TLS**

   ```bash
   # 在nginx前启用HTTPS
   # 参考docs/deployment/nginx-ssl.md
   ```

4. **限制网络访问**
   ```bash
   # 只暴露必要的端口
   # 在docker-compose.yml中配置networks
   ```

---

## 📦 生产部署建议

### 资源配置

**小型部署** (100并发):

- CPU: 2核
- 内存: 4GB
- 磁盘: 20GB

**中型部署** (1000并发):

- CPU: 4核
- 内存: 8GB
- 磁盘: 50GB

**大型部署** (10000并发):

- CPU: 8核+
- 内存: 16GB+
- 磁盘: 100GB+

### 扩展策略

1. **水平扩展**: 增加容器实例
2. **垂直扩展**: 增加单容器资源
3. **数据库优化**: 读写分离、主从复制
4. **缓存优化**: Redis集群

---

## 🎯 性能优化

### 建议优化

1. **启用缓存**
   - Redis缓存LLM响应
   - 缓存常见查询结果

2. **批量处理**
   - 批量LLM调用
   - 异步任务处理

3. **连接池**
   - 数据库连接池
   - LLM连接池

4. **CDN加速**
   - 静态资源CDN
   - API响应缓存

---

## 📚 相关文档

- [开发指南](../guides/development.md)
- [API文档](../guides/api.md)
- [安全指南](../SECURITY_GUIDELINES.md)
- [故障排查](../troubleshooting.md)

---

**文档维护**: YunPat开发团队
**最后更新**: 2026-05-04
