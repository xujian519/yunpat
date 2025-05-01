#!/bin/bash
# HITL 流程手动测试脚本
# 测试 TUI → Rust Gateway → Orchestrator Adapter 完整流程

set -e

echo "========================================="
echo "YunPat HITL 流程集成测试"
echo "========================================="
echo ""

# 端口配置
GATEWAY_PORT=8888
ADAPTER_PORT=3001

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查依赖
echo "1. 检查依赖..."
command -v cargo >/dev/null 2>&1 || { echo -e "${RED}错误: 未找到 cargo${NC}" >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo -e "${RED}错误: 未找到 node${NC}" >&2; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo -e "${RED}错误: 未找到 pnpm${NC}" >&2; exit 1; }
echo -e "${GREEN}✓ 依赖检查通过${NC}"
echo ""

# 构建项目
echo "2. 构建项目..."
echo "   - 构建 Rust Gateway..."
cd packages/rust-gateway
cargo build --release --quiet 2>/dev/null
cd ../..
echo "   - 构建 Node.js 包..."
pnpm --filter "@yunpat/orchestrator-adapter" build >/dev/null 2>&1
pnpm --filter "@yunpat/tui" build >/dev/null 2>&1
echo -e "${GREEN}✓ 构建完成${NC}"
echo ""

# 清理函数
cleanup() {
    echo ""
    echo "清理进程..."
    kill $GATEWAY_PID 2>/dev/null || true
    kill $ADAPTER_PID 2>/dev/null || true
    wait 2>/dev/null || true
}

trap cleanup EXIT INT TERM

# 启动服务
echo "3. 启动服务..."
echo "   - 启动 Orchestrator Adapter (端口 ${ADAPTER_PORT})..."
cd "$(dirname "$0")/../.."
# 确保使用项目根目录作为工作目录
ORCHESTRATOR_URL="http://localhost:${ADAPTER_PORT}" \
NODE_OPTIONS="--max-old-space-size=512" \
node packages/orchestrator-adapter/dist/index.js > /tmp/adapter.log 2>&1 &
ADAPTER_PID=$!
echo "     PID: $ADAPTER_PID"

sleep 3

echo "   - 启动 Rust Gateway (端口 ${GATEWAY_PORT})..."
cd "$(dirname "$0")/../../packages/rust-gateway"
RUST_LOG=info \
ORCHESTRATOR_URL="http://localhost:${ADAPTER_PORT}" \
BIND_ADDRESS="0.0.0.0:${GATEWAY_PORT}" \
./target/release/yunpat-gateway > /tmp/gateway.log 2>&1 &
GATEWAY_PID=$!
echo "     PID: $GATEWAY_PID"

# 等待服务启动
sleep 3

# 检查服务是否启动
echo ""
echo "4. 检查服务状态..."
if ! curl -s http://localhost:3001/internal/health > /dev/null; then
    echo -e "${RED}✗ Orchestrator Adapter 启动失败${NC}"
    cat /tmp/adapter.log
    exit 1
fi
echo -e "${GREEN}✓ Orchestrator Adapter 运行正常${NC}"

if ! curl -s http://localhost:${GATEWAY_PORT}/internal/health > /dev/null; then
    echo -e "${RED}✗ Rust Gateway 启动失败${NC}"
    cat /tmp/gateway.log
    exit 1
fi
echo -e "${GREEN}✓ Rust Gateway 运行正常${NC}"
echo ""

# 运行测试
echo "5. 运行集成测试..."
echo ""

# 测试 1: 创建会话
echo -e "${YELLOW}测试 1: 创建会话${NC}"
SESSION_RESPONSE=$(curl -s -X POST http://localhost:${GATEWAY_PORT}/api/v1/sessions \
    -H "Content-Type: application/json" \
    -d '{"user_id": "test-user"}')
# 支持 snake_case 和 camelCase
SESSION_ID=$(echo "$SESSION_RESPONSE" | grep -oE '"(id|session_id)":"[^"]*"' | cut -d'"' -f4 | head -1)
if [ -n "$SESSION_ID" ]; then
    echo -e "${GREEN}✓ 会话创建成功: $SESSION_ID${NC}"
else
    echo -e "${RED}✗ 会话创建失败${NC}"
    echo "$SESSION_RESPONSE"
    exit 1
fi
echo ""

# 测试 2: 获取会话状态
echo -e "${YELLOW}测试 2: 获取会话状态${NC}"
STATUS_RESPONSE=$(curl -s http://localhost:${GATEWAY_PORT}/api/v1/sessions/$SESSION_ID)
if echo "$STATUS_RESPONSE" | grep -q '"status"'; then
    echo -e "${GREEN}✓ 会话状态获取成功${NC}"
else
    echo -e "${RED}✗ 会话状态获取失败${NC}"
fi
echo ""

# 测试 3: 发送消息
echo -e "${YELLOW}测试 3: 发送消息${NC}"
MESSAGE_RESPONSE=$(curl -s -X POST http://localhost:${GATEWAY_PORT}/api/v1/sessions/$SESSION_ID/message \
    -H "Content-Type: application/json" \
    -d '{"content": "测试消息"}')
if echo "$MESSAGE_RESPONSE" | grep -q 'success\|received'; then
    echo -e "${GREEN}✓ 消息发送成功${NC}"
else
    echo -e "${YELLOW}⚠ 消息响应: $MESSAGE_RESPONSE${NC}"
fi
echo ""

# 测试 4: 模拟 HITL 流程
echo -e "${YELLOW}测试 4: HITL 流程${NC}"
# 发送 HITL 事件
curl -s -X POST http://localhost:${GATEWAY_PORT}/internal/events \
    -H "Content-Type: application/json" \
    -d "{
        \"session_id\": \"$SESSION_ID\",
        \"event_type\": \"hitl\",
        \"payload\": {
            \"request_id\": \"test-hitl-1\",
            \"checkpoint_id\": \"checkpoint-1\",
            \"content\": {
                \"type\": \"confirmation\",
                \"message\": \"是否继续？\"
            },
            \"options\": [
                {\"id\": \"opt-1\", \"label\": \"继续\", \"action\": \"approve\"},
                {\"id\": \"opt-2\", \"label\": \"取消\", \"action\": \"reject\"}
            ],
            \"timeout\": 60000
        }
    }" > /dev/null

sleep 1

# 获取 HITL 请求
HITL_RESPONSE=$(curl -s http://localhost:${GATEWAY_PORT}/api/v1/sessions/$SESSION_ID/hitl)
if echo "$HITL_RESPONSE" | grep -q '"request_id"'; then
    echo -e "${GREEN}✓ HITL 请求创建成功${NC}"
    echo "   $HITL_RESPONSE"

    # 提交 HITL 响应
    SUBMIT_RESPONSE=$(curl -s -X POST http://localhost:${GATEWAY_PORT}/api/v1/sessions/$SESSION_ID/hitl \
        -H "Content-Type: application/json" \
        -d '{"request_id": "test-hitl-1", "action": "approve"}')
    if echo "$SUBMIT_RESPONSE" | grep -q 'success\|received'; then
        echo -e "${GREEN}✓ HITL 响应提交成功${NC}"
    else
        echo -e "${YELLOW}⚠ HITL 响应: $SUBMIT_RESPONSE${NC}"
    fi
else
    echo -e "${RED}✗ HITL 请求失败${NC}"
fi
echo ""

# 测试 5: 健康检查
echo -e "${YELLOW}测试 5: 健康检查${NC}"
GATEWAY_HEALTH=$(curl -s http://localhost:${GATEWAY_PORT}/internal/health)
ADAPTER_HEALTH=$(curl -s http://localhost:3001/internal/health)
if echo "$GATEWAY_HEALTH" | grep -q 'healthy' && echo "$ADAPTER_HEALTH" | grep -q 'healthy'; then
    echo -e "${GREEN}✓ 所有服务健康${NC}"
else
    echo -e "${RED}✗ 健康检查失败${NC}"
fi
echo ""

# 删除会话
echo -e "${YELLOW}清理: 删除测试会话${NC}"
curl -s -X DELETE http://localhost:${GATEWAY_PORT}/api/v1/sessions/$SESSION_ID > /dev/null
echo -e "${GREEN}✓ 会话已删除${NC}"
echo ""

# 总结
echo "========================================="
echo -e "${GREEN}集成测试完成！${NC}"
echo "========================================="
echo ""
echo "查看日志："
echo "  Gateway: tail -f /tmp/gateway.log"
echo "  Adapter: tail -f /tmp/adapter.log"
echo ""
echo "手动测试 TUI："
echo "  cd packages/tui && pnpm dev"
echo ""
