#!/bin/bash
# Runner 机器诊断脚本
# 用法: 在 Runner 机器上运行此脚本

echo "=== Runner 机器诊断 ==="
echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# 1. 检查主机名
echo "## 1. 主机信息"
echo "主机名: $(hostname)"
echo "操作系统: $(sw_vers -productName) $(sw_vers -productVersion)"
echo "架构: $(uname -m)"
echo ""

# 2. 检查 actions-runner 进程
echo "## 2. Actions Runner 进程"
RUNNER_PROCS=$(ps aux | grep -i "actions.runner" | grep -v grep || true)
if [ -n "$RUNNER_PROCS" ]; then
    echo "发现 Runner 进程:"
    echo "$RUNNER_PROCS"
    echo ""
    echo "进程详情:"
    pgrep -fl "actions.runner" | while read pid cmd; do
        echo "PID: $pid"
        echo "命令: $cmd"
        echo "运行时间: $(ps -p $pid -o etime= | tr -d ' ')"
        echo "CPU: $(ps -p $pid -o %cpu= | tr -d ' ')%"
        echo "内存: $(ps -p $pid -o %mem= | tr -d ' ')%"
        echo ""
    done
else
    echo "❌ 未发现 actions-runner 进程"
fi
echo ""

# 3. 检查 Runner 目录
echo "## 3. Runner 目录检查"
RUNNER_DIRS=(
    "$HOME/actions-runner"
    "/Users/$(whoami)/actions-runner"
    "/opt/actions-runner"
)

for dir in "${RUNNER_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo "✅ 找到 Runner 目录: $dir"
        echo "文件数: $(find "$dir" -type f | wc -l)"
        echo "磁盘使用: $(du -sh "$dir" | cut -f1)"
        echo ""
    fi
done
echo ""

# 4. 检查网络连接
echo "## 4. GitHub Actions 连接"
GITHUB_CONNECTIONS=$(netstat -an | grep "github.com" | grep ESTABLISHED || true)
if [ -n "$GITHUB_CONNECTIONS" ]; then
    echo "GitHub 连接:"
    echo "$GITHUB_CONNECTIONS"
else
    echo "⚠️  未发现到 GitHub 的活跃连接"
fi
echo ""

# 5. 检查系统负载
echo "## 5. 系统负载"
echo "负载平均值: $(uptime | awk -F'load average:' '{print $2}')"
echo "CPU 使用率:"
top -l 1 | grep -E "^CPU" || echo "无法获取 CPU 信息"
echo ""
echo "内存使用:"
vm_stat | perl -ne '/page size of (\d+)/ and $ps=$1; /Pages\s+([^:]+)[^\d]+(\d+)/ and printf("%-16s % 16.2f Mi\n", "$1:", $2 * $ps / 1048576);'
echo ""

# 6. 检查磁盘空间
echo "## 6. 磁盘空间"
df -h | grep -E "Filesystem|/System/Volumes/Data|/$"
echo ""

# 7. 检查卡住的进程
echo "## 7. 可能卡住的进程"
echo "长时间运行的进程 (>1小时):"
ps aux | awk '($10 ~ /([0-9]+):([0-9]{2}):/) && $11 !~ /ps|awk/ {print $2, $3, $10, $11}' | head -10
echo ""

# 8. 检查 Node.js 进程
echo "## 8. Node.js 进程"
NODE_PROCS=$(ps aux | grep node | grep -v grep | wc -l)
echo "Node.js 进程数: $NODE_PROCS"
if [ "$NODE_PROCS" -gt 0 ]; then
    echo "Node.js 进程列表:"
    ps aux | grep node | grep -v grep | head -5
fi
echo ""

# 9. 检查最近的错误日志
echo "## 9. Runner 日志检查"
for dir in "${RUNNER_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        LOG_FILE="$dir/_diag/Runner_*.log"
        if ls $LOG_FILE 2>/dev/null; then
            echo "最新日志 ($LOG_FILE):"
            tail -20 $LOG_FILE 2>/dev/null || echo "无法读取日志"
            echo ""
        fi

        # 检查错误日志
        ERR_FILE="$dir/_diag/Runner_*err*.log"
        if ls $ERR_FILE 2>/dev/null; then
            echo "错误日志 ($ERR_FILE):"
            tail -20 $ERR_FILE 2>/dev/null || echo "无法读取错误日志"
            echo ""
        fi
    fi
done

# 10. 建议操作
echo "## 10. 建议操作"
echo "如果 Runner 卡住，可以尝试以下步骤："
echo ""
echo "1. 停止 Runner 服务:"
echo "   cd ~/actions-runner  # 或其他 Runner 目录"
echo "   ./svc.sh stop"
echo ""
echo "2. 杀死卡住的进程:"
echo "   pkill -9 -f actions.runner"
echo ""
echo "3. 清理临时文件:"
echo "   rm -rf ~/actions-runner/_work/_temp/*"
echo ""
echo "4. 重启 Runner 服务:"
echo "   ./svc.sh start"
echo ""
echo "5. 检查 Runner 状态:"
echo "   ./svc.sh status"
echo ""

echo "=== 诊断完成 ==="
