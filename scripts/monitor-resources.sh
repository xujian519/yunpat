#!/bin/bash
# Runner 资源监控脚本（简化版）
# 用法: ./scripts/monitor-resources.sh

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Runner 资源监控报告 ===${NC}"
echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# CPU使用率
echo -e "${BLUE}## CPU 使用率${NC}"
CPU_USAGE=$(top -l 1 | grep "CPU usage" | awk '{print $3}' | sed 's/%//')
echo "CPU使用率: ${CPU_USAGE}%"
echo "物理核心数: $(sysctl -n hw.physicalcpu)"
echo "逻辑核心数: $(sysctl -n hw.ncpu)"
echo ""

# 内存使用
echo -e "${BLUE}## 内存使用${NC}"
VM_STAT=$(vm_stat)
PAGE_SIZE=$(echo "$VM_STAT" | grep "page size" | awk '{print $3}')
FREE_PAGES=$(echo "$VM_STAT" | grep "Pages free" | awk '{print $3}')
ACTIVE_PAGES=$(echo "$VM_STAT" | grep "Pages active" | awk '{print $3}')
WIRED_PAGES=$(echo "$VM_STAT" | grep "Pages wired" | awk '{print $3}')

TOTAL_PAGES=$((FREE_PAGES + ACTIVE_PAGES + WIRED_PAGES))
USED_PAGES=$((ACTIVE_PAGES + WIRED_PAGES))

TOTAL_MB=$((TOTAL_PAGES * PAGE_SIZE / 1024 / 1024))
USED_MB=$((USED_PAGES * PAGE_SIZE / 1024 / 1024))
MEM_USAGE=$((USED_MB * 100 / TOTAL_MB))

echo "内存使用率: ${MEM_USAGE}%"
echo "总内存: ${TOTAL_MB} MB"
echo "已使用: ${USED_MB} MB"
echo "可用: $((TOTAL_MB - USED_MB)) MB"
echo ""

# 磁盘空间
echo -e "${BLUE}## 磁盘空间${NC}"
df -h . | tail -1
echo ""

# Node.js进程
echo -e "${BLUE}## Node.js 进程${NC}"
NODE_COUNT=$(ps aux | grep "[n]ode" | grep -v grep | wc -l | tr -d ' ')
echo "Node.js进程数: $NODE_COUNT"
echo ""

# 临时文件
echo -e "${BLUE}## 临时文件${NC}"
TEMP_DIR="$HOME/actions-runner/_work/_temp"
if [ -d "$TEMP_DIR" ]; then
    TEMP_SIZE=$(du -sh "$TEMP_DIR" 2>/dev/null | awk '{print $1}' || echo "0")
    echo "临时文件大小: $TEMP_SIZE"
else
    echo "临时目录不存在或为空"
fi
echo ""

# 健康评分
echo -e "${BLUE}## 健康评分${NC}"
SCORE=100

if [ "$MEM_USAGE" -ge 90 ]; then
    SCORE=$((SCORE - 30))
elif [ "$MEM_USAGE" -ge 80 ]; then
    SCORE=$((SCORE - 15))
fi

if [ $SCORE -ge 80 ]; then
    echo -e "${GREEN}✅ 健康评分: $SCORE/100 - 优秀${NC}"
elif [ $SCORE -ge 60 ]; then
    echo -e "${YELLOW}🟡 健康评分: $SCORE/100 - 良好${NC}"
else
    echo -e "${RED}🔴 健康评分: $SCORE/100 - 需要关注${NC}"
fi
echo ""

# 建议
echo -e "${BLUE}## 建议${NC}"
if [ $SCORE -lt 80 ]; then
    if [ "$MEM_USAGE" -ge 80 ]; then
        echo -e "${YELLOW}•${NC} 内存使用率较高，考虑增加NODE_OPTIONS限制"
    fi
else
    echo -e "${GREEN}✅ 系统运行良好，无需优化${NC}"
fi
