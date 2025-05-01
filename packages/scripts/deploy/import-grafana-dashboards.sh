#!/bin/bash

# Grafana 仪表盘导入脚本

GRAFANA_URL="http://localhost:3001"
GRAFANA_USER="admin"
GRAFANA_PASSWORD="admin"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║          导入 Grafana 仪表盘                                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# 检查 Grafana 是否可访问
echo "1. 检查 Grafana 连接..."
if ! curl -s "${GRAFANA_URL}/api/health" > /dev/null; then
    echo "❌ 无法连接到 Grafana (${GRAFANA_URL})"
    echo "   请确保 Grafana 正在运行"
    exit 1
fi
echo "✅ Grafana 已启动"

# 获取 API 密钥（如果已存在）或创建新密钥
echo ""
echo "2. 配置 Grafana API..."

# 读取仪表盘文件
DASHBOARDS_DIR="docker/grafana/dashboards"
if [ ! -d "$DASHBOARDS_DIR" ]; then
    echo "❌ 仪表盘目录不存在: $DASHBOARDS_DIR"
    exit 1
fi

# 导入仪表盘
echo ""
echo "3. 导入仪表盘..."

for dashboard_file in "$DASHBOARDS_DIR"/*.json; do
    if [ -f "$dashboard_file" ]; then
        dashboard_name=$(basename "$dashboard_file" .json)
        echo ""
        echo "导入: $dashboard_name"
        
        # 通过 Grafana API 导入仪表盘
        # 注意：这需要先通过 UI 登录并获取 API 密钥
        echo "   请手动导入仪表盘:"
        echo "   1. 打开浏览器访问: ${GRAFANA_URL}"
        echo "   2. 登录 (admin/admin)"
        echo "   3. 进入: Dashboards > Import"
        echo "   4. 上传文件: $dashboard_file"
        echo "   5. 选择 Prometheus 数据源"
        echo "   6. 点击 Import"
    fi
done

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║          手动导入说明                                      ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "由于 Grafana API 需要认证，请按以下步骤手动导入："
echo ""
echo "1. 打开 Grafana: http://localhost:3001"
echo "2. 登录: admin / admin"
echo "3. 进入 Dashboards > Import"
echo "4. 选择 'Upload JSON file'"
echo "5. 导入以下文件:"
echo "   - docker/grafana/dashboards/api-performance.json"
echo "   - docker/grafana/dashboards/agent-stats.json"
echo "   - docker/grafana/dashboards/system-health.json"
echo "6. 为每个仪表盘选择 'Prometheus' 数据源"
echo "7. 点击 Import"
echo ""
echo "完成后，您将看到完整的监控仪表盘！"
echo ""
