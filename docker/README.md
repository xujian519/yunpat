# 云熙知识产权智能体 - Docker配置

## 快速开始

```bash
# 1. 构建并启动所有服务
docker-compose up -d

# 2. 查看服务状态
docker-compose ps

# 3. 查看日志
docker-compose logs -f yunpat-agent

# 4. 停止服务
docker-compose down
```

## 服务列表

| 服务 | 端口 | 说明 |
|------|------|------|
| yunpat-agent | 8080 | 主服务（TUI/API） |
| postgres | 5432 | PostgreSQL数据库 |
| redis | 6379 | Redis缓存 |
| prometheus | 9090 | 监控指标收集 |
| grafana | 3001 | 监控仪表盘 |

## 访问地址

- **主服务API**: http://localhost:8080
- **Grafana**: http://localhost:3001 (admin/admin)
- **Prometheus**: http://localhost:9090

## 数据持久化

数据库数据存储在Docker Volume中：

```bash
# 查看数据卷
docker volume ls | grep yunpat

# 备份数据
docker exec yunpat-postgres pg_dump -U postgres patent_db > backup.sql

# 恢复数据
docker exec -i yunpat-postgres psql -U postgres patent_db < backup.sql
```

## 环境变量

Docker Compose会自动读取`.env`文件中的环境变量。

确保在启动前配置：
```bash
cp .env.example .env
# 编辑 .env 填入你的API密钥
```

## 故障排查

### 服务无法启动

```bash
# 查看详细日志
docker-compose logs yunpat-agent

# 检查端口冲突
lsof -i :8080
lsof -i :5432
```

### 数据库连接失败

```bash
# 检查PostgreSQL是否运行
docker-compose ps postgres

# 进入数据库容器
docker-compose exec postgres psql -U postgres -d patent_db
```

### 重建服务

```bash
# 完全重建（清除数据）
docker-compose down -v
docker-compose up -d --build

# 仅重建应用（保留数据）
docker-compose up -d --build yunpat-agent
```
