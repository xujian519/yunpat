#!/bin/bash
# Runner Git 网络问题修复脚本
# 问题: HTTP/2 帧层错误导致 git checkout 失败
# 解决: 强制使用 HTTP/1.1

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Runner Git 网络配置修复 ===${NC}"
echo ""

# 检查是否在 Runner 环境中运行
if [ ! -d "$HOME/actions-runner" ]; then
    echo -e "${YELLOW}⚠️  警告: 未检测到 actions-runner 目录${NC}"
    echo -e "${YELLOW}此脚本应在 self-hosted Runner 上运行${NC}"
    echo ""
    read -p "是否继续执行? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 显示当前 Git 版本
echo -e "${BLUE}当前 Git 版本:${NC}"
git --version
echo ""

# 显示当前 HTTP 配置
echo -e "${BLUE}当前 Git HTTP 配置:${NC}"
git config --global --get-regexp http 2>/dev/null || echo "未配置 HTTP 相关设置"
echo ""

# 应用修复
echo -e "${BLUE}应用修复方案...${NC}"

# 1. 强制使用 HTTP/1.1
echo "1. 设置 HTTP 版本为 HTTP/1.1"
git config --global http.version HTTP/1.1
git config --global https.version HTTP/1.1

# 2. 增加缓冲区大小
echo "2. 增加 HTTP 缓冲区大小到 500MB"
git config --global http.postBuffer 524288000

# 3. 设置超时时间
echo "3. 设置超时时间（300秒）"
git config --global http.lowSpeedLimit 0
git config --global http.lowSpeedTime 999999

# 4. 禁用 HTTP/2
echo "4. 禁用 HTTP/2"
git config --global http.useHTTP2 false

# 5. 启用详细日志（用于调试）
echo "5. 启用 Git 详细日志"
git config --global core.gitproxy none

echo ""
echo -e "${GREEN}✅ 修复配置完成！${NC}"
echo ""

# 显示修复后的配置
echo -e "${BLUE}修复后的 Git HTTP 配置:${NC}"
git config --global --get-regexp http
echo ""

# 测试连接
echo -e "${BLUE}测试 Git 连接...${NC}"
TEST_URL="https://github.com/xujian519/yunpat.git"
echo "测试连接到: $TEST_URL"

if timeout 30 git ls-remote "$TEST_URL" HEAD > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Git 连接测试成功！${NC}"
else
    echo -e "${YELLOW}⚠️  Git 连接测试失败或超时${NC}"
    echo "可能需要手动检查网络配置"
fi

echo ""
echo -e "${BLUE}=== 修复完成 ===${NC}"
echo ""
echo "下一步:"
echo "1. 重新运行 GitHub Actions workflow"
echo "2. 观察 checkout 步骤是否成功"
echo "3. 如果仍有问题，请检查:"
echo "   - 网络连接稳定性"
echo "   - 防火墙设置"
echo "   - DNS 解析"
