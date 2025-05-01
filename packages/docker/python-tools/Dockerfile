FROM python:3.11-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件（构建上下文为项目根目录）
COPY docker/python-tools/requirements.txt .

# 安装 Python 依赖
RUN pip install --no-cache-dir -r requirements.txt

# 复制代码（构建上下文为项目根目录）
COPY packages/python-tools/*.py .

# 只暴露 gRPC 端口
EXPOSE 50052

# 健康检查：使用 socket 测试端口连通性
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python -c "import socket; s = socket.create_connection(('localhost', 50052), timeout=5); s.close()" || exit 1

# 启动 gRPC 服务
CMD ["python", "tools_server.py"]
