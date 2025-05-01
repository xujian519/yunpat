# YunPat Docker部署

## 快速开始

```bash
# 1. 配置环境变量
cp .env.example .env
# 编辑.env，设置ANTHROPIC_API_KEY

# 2. 一键部署
make deploy

# 3. 访问服务
# Grafana监控: http://localhost:3001 (admin/admin)
# Prometheus: http://localhost:9090
```

## 服务列表

| 服务              | 端口 | 说明         |
| ----------------- | ---- | ------------ |
| OrchestratorAgent | 3000 | 核心编排服务 |
| Redis             | 6379 | 缓存         |
| PostgreSQL        | 5432 | 数据库       |
| Prometheus        | 9090 | 监控         |
| Grafana           | 3001 | 监控面板     |

## 常用命令

```bash
make deploy     # 完整部署
make start      # 启动服务
make stop       # 停止服务
make restart    # 重启服务
make logs       # 查看日志
make status     # 查看状态
make health     # 健康检查
make clean      # 清理
```

## 详细文档

完整部署指南请参考: [docs/deployment/DOCKER_DEPLOYMENT.md](docs/deployment/DOCKER_DEPLOYMENT.md)

## 故障排查

```bash
# 查看服务状态
make status

# 查看日志
make logs [service-name]

# 重启服务
make restart

# 健康检查
make health
```

## 生产部署

生产环境部署前请：

1. ✅ 修改默认密码（.env文件）
2. ✅ 配置TLS/SSL
3. ✅ 设置资源限制
4. ✅ 配置日志轮转
5. ✅ 启用监控告警
6. ✅ 备份数据

详细生产部署指南请参考完整文档。
