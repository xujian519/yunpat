#!/bin/bash

# YunPat 告警测试脚本

echo "╔════════════════════════════════════════════════════════════╗"
echo "║          测试 Prometheus 告警规则                          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

PROMETHEUS_URL="http://localhost:9090"

# 检查 Prometheus 是否运行
echo "1. 检查 Prometheus 连接..."
if ! curl -s "${PROMETHEUS_URL}/-/healthy > /dev/null; then
    echo "❌ Prometheus 未运行"
    echo "   请先启动: docker-compose up -d prometheus"
    exit 1
fi
echo "✅ Prometheus 正在运行"

# 检查告警规则是否加载
echo ""
echo "2. 检查告警规则..."
curl -s "${PROMETHEUS_URL}/api/v1/rules" | python3 -c "
import sys, json
data = json.load(sys.stdin)
rules = data.get('data', {}).get('groups', [])
print(f'✅ 已加载 {len(rules)} 个告警组')
for group in rules:
    print(f'   - {group[\"name\"]}: {len(group[\"rules\"])} 条规则')
" 2>/dev/null || echo "   告警规则尚未加载"

# 测试告警表达式
echo ""
echo "3. 测试关键告警表达式..."

# 测试 API 响应时间
echo "   测试 API 响应时间告警..."
RESPONSE_TIME=$(curl -s "${PROMETHEUS_URL}/api/v1/query?query=histogram_quantile(0.95%2C+rate(http_request_duration_seconds_bucket%5B5m%5D))" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('result', [{}])[0].get('value', [None])[0] if data.get('data', {}).get('result') else 'N/A'")
echo "   当前 95分位响应时间: ${RESPONSE_TIME}s"

# 测试 Agent 成功率
echo "   测试 Agent 成功率告警..."
SUCCESS_RATE=$(curl -s "${PROMETHEUS_URL}/api/v1/query?query=agent_success_rate" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('result', [{}])[0].get('value', [None])[0] if data.get('data', {}).get('result') else 'N/A'"
echo "   当前 Agent 成功率: ${SUCCESS_RATE}"

# 测试 LLM 响应时间
echo "   测试 LLM 响应时间告警..."
LLM_TIME=$(curl -s "${PROMETHEUS_URL}/api/v1/query?query=histogram_quantile(0.95%2C+rate(llm_response_time_seconds_bucket%5B5m%5D))" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('result', [{}])[0].get('value', [None])[0] if data.get('data', {}).get('result') else 'N/A'"
echo "   当前 95分位 LLM 响应时间: ${LLM_TIME}s"

echo ""
echo "4. 查看所有活动告警..."
curl -s "${PROMETHEUS_URL}/api/v1/alerts" | python3 -c "
import sys, json
data = json.load(sys.stdin)
alerts = data.get('data', {}).get('alerts', {})
if alerts:
    print(f'✅ 当前活动告警: {len(alerts)} 个')
    for alert_name, alert in alerts.items():
        state = alert.get('state', 'unknown')
        print(f'   - {alert_name}: {state}')
else:
    print('✅ 当前无活动告警')
" 2>/dev/null || echo "   无告警数据"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║          告警测试完成                                        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "💡 提示:"
echo "   - 查看 Prometheus 告警: http://localhost:9090/alerts"
echo "   - 查看告警规则: http://localhost:9090/rules"
echo "   - 配置告警通知: 编辑 docker/prometheus/rules/alerts.yml"
echo ""
