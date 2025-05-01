#!/bin/bash
# YunPat 开发环境停止脚本
# 停止所有由 dev-start.sh / dev-watch.sh 启动的服务

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_DIR="${PROJECT_ROOT}/.dev-pids"

echo -e "${YELLOW}正在停止 YunPat 开发服务...${NC}"

stopped=0

# 从 PID 文件停止
for pid_file in "${PID_DIR}"/*.pid; do
    if [ -f "$pid_file" ]; then
        local_pid=$(cat "$pid_file")
        local_name=$(basename "$pid_file" .pid)

        if kill -0 "$local_pid" 2>/dev/null; then
            kill "$local_pid" 2>/dev/null
            # 等待最多 3 秒优雅退出
            for i in {1..6}; do
                if ! kill -0 "$local_pid" 2>/dev/null; then
                    break
                fi
                sleep 0.5
            done
            # 强制终止
            if kill -0 "$local_pid" 2>/dev/null; then
                kill -9 "$local_pid" 2>/dev/null
            fi
            echo -e "${GREEN}✓ 已停止 ${local_name} (PID: $local_pid)${NC}"
            stopped=$((stopped + 1))
        fi

        rm -f "$pid_file"
    fi
done

# 兜底：按进程名清理
for proc in "yunpat-gateway" "tsx packages/orchestrator-adapter" "tsx packages/tui" "nodemon"; do
    pids=$(pgrep -f "$proc" 2>/dev/null || true)
    for pid in $pids; do
        if kill -0 "$pid" 2>/dev/null; then
            kill -9 "$pid" 2>/dev/null
            echo -e "${GREEN}✓ 已清理残留进程: ${proc} (PID: $pid)${NC}"
            stopped=$((stopped + 1))
        fi
    done
done

# 清理端口
for port in 8080 3001; do
    pids=$(lsof -i ":$port" -sTCP:LISTEN -t 2>/dev/null || true)
    for pid in $pids; do
        kill -9 "$pid" 2>/dev/null
        echo -e "${GREEN}✓ 已释放端口 ${port} (PID: $pid)${NC}"
        stopped=$((stopped + 1))
    done
done

if [ "$stopped" -gt 0 ]; then
    echo -e "${GREEN}共停止 ${stopped} 个服务${NC}"
else
    echo -e "${YELLOW}没有运行中的服务${NC}"
fi
