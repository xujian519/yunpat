#!/bin/bash
# 远程 Runner 状态检查脚本
# 用法: ./scripts/check-runner-remote.sh

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== 远程 Runner 状态检查 ===${NC}"
echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# 1. Runner 基本信息
echo -e "${BLUE}## 1. Runner 基本信息${NC}"
RUNNER_INFO=$(gh api repos/xujian519/yunpat/actions/runners --jq '.runners[0]')
RUNNER_NAME=$(echo "$RUNNER_INFO" | jq -r '.name')
RUNNER_STATUS=$(echo "$RUNNER_INFO" | jq -r '.status')
RUNNER_BUSY=$(echo "$RUNNER_INFO" | jq -r '.busy')
RUNNER_OS=$(echo "$RUNNER_INFO" | jq -r '.os')

echo "名称: $RUNNER_NAME"
echo "状态: $RUNNER_STATUS"
echo "忙碌: $RUNNER_BUSY"
echo "平台: $RUNNER_OS"

if [ "$RUNNER_STATUS" = "online" ]; then
    echo -e "${GREEN}✅ Runner 在线${NC}"
else
    echo -e "${RED}❌ Runner 离线${NC}"
fi

if [ "$RUNNER_BUSY" = "true" ]; then
    echo -e "${YELLOW}⚠️  Runner 忙碌${NC}"
else
    echo -e "${GREEN}✅ Runner 空闲${NC}"
fi
echo ""

# 2. 检查进行中的工作流
echo -e "${BLUE}## 2. 进行中的工作流${NC}"
RUNNING_WORKFLOWS=$(gh api "repos/xujian519/yunpat/actions/runs?status=in_progress&per_page=100" --jq '.workflow_runs | length')

if [ "$RUNNING_WORKFLOWS" -gt 0 ]; then
    echo -e "${YELLOW}发现 $RUNNING_WORKFLOWS 个进行中的工作流:${NC}"
    gh api "repos/xujian519/yunpat/actions/runs?status=in_progress&per_page=10" --jq '.workflow_runs | map({id: .id, name: .name, created: .created_at})'
else
    echo -e "${GREEN}✅ 没有进行中的工作流${NC}"
fi
echo ""

# 3. 检查排队的任务
echo -e "${BLUE}## 3. 排队的任务${NC}"
QUEUED_RUNS=$(gh run list --repo xujian519/yunpat --limit 20 --json databaseId,name,status --jq '[.[] | select(.status == "queued" or .status == "pending")] | length')

if [ "$QUEUED_RUNS" -gt 0 ]; then
    echo -e "${YELLOW}发现 $QUEUED_RUNS 个排队的任务:${NC}"
    gh run list --repo xujian519/yunpat --limit 10 --json databaseId,name,status --jq '.[] | select(.status == "queued" or .status == "pending") | {id: .databaseId, name: .name, status: .status}'
else
    echo -e "${GREEN}✅ 没有排队的任务${NC}"
fi
echo ""

# 4. 最近的任务状态
echo -e "${BLUE}## 4. 最近的任务状态${NC}"
echo "最近 10 次运行:"
gh run list --repo xujian519/yunpat --limit 10 --json databaseId,name,conclusion,status,createdAt --jq '.[:10] | map({id: .databaseId, name: .name, status: .status, conclusion: .conclusion, time: .createdAt})'
echo ""

# 5. 异常检测
echo -e "${BLUE}## 5. 异常检测${NC}"

ISSUES_FOUND=0

# 检查 Runner 状态异常
if [ "$RUNNER_BUSY" = "true" ] && [ "$RUNNING_WORKFLOWS" -eq 0 ]; then
    echo -e "${RED}❌ 异常: Runner 显示忙碌但没有进行中的工作流${NC}"
    echo "   可能原因: Runner 进程卡住或工作流未正确清理"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

# 检查长时间排队的任务
LONG_QUEUED=$(gh run list --repo xujian519/yunpat --limit 50 --json databaseId,name,status,createdAt --jq '[.[] | select(.status == "queued" or .status == "pending")] | map(select(.createdAt < (now | tonumber - 3600000))) | length')
if [ "$LONG_QUEUED" -gt 0 ]; then
    echo -e "${RED}❌ 异常: $LONG_QUEUED 个任务排队超过 1 小时${NC}"
    echo "   可能原因: Runner 无响应或配置错误"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

# 检查最近的成功率
SUCCESS_RATE=$(gh run list --repo xujian519/yunpat --limit 10 --json conclusion | jq '[.[] | select(.conclusion == "success")] | length')
if [ "$SUCCESS_RATE" -lt 5 ]; then
    echo -e "${YELLOW}⚠️  警告: 最近 10 次运行成功率低 (${SUCCESS_RATE}/10)${NC}"
    echo "   可能原因: CI 配置问题或测试失败"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}✅ 未发现异常${NC}"
fi
echo ""

# 6. 建议操作
echo -e "${BLUE}## 6. 建议操作${NC}"

if [ "$RUNNER_BUSY" = "true" ] && [ "$RUNNING_WORKFLOWS" -eq 0 ]; then
    echo -e "${YELLOW}Runner 可能卡住，建议执行以下步骤:${NC}"
    echo ""
    echo "1. SSH 到 Runner 机器 (m4-air)"
    echo "2. 运行诊断脚本:"
    echo "   ./scripts/diagnose-runner.sh"
    echo ""
    echo "3. 如果确认卡住，执行:"
    echo "   cd ~/actions-runner"
    echo "   ./svc.sh stop"
    echo "   pkill -9 -f actions.runner"
    echo "   ./svc.sh start"
    echo ""
    echo "4. 或者在本地执行重置命令:"
    echo "   gh api -X POST repos/xujian519/yunpat/actions/runners/21/force-reset"
else
    echo -e "${GREEN}✅ Runner 状态正常，无需特殊操作${NC}"
fi
echo ""

echo -e "${BLUE}=== 检查完成 ===${NC}"
