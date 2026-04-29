FROM python:3.11-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY requirements.txt .

# 安装 Python 依赖
RUN pip install --no-cache-dir -r requirements.txt

# 复制代码
COPY yunpat_python /app/yunpat_python

# 只暴露 gRPC 端口
EXPOSE 50052

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python -c "import grpc; channel = grpc.insecure_channel('localhost:50052'); stub = channel; grpc.channel_ready_future(stub).result(timeout=5)" || exit 1

# 启动 gRPC 服务
CMD ["python", "-m", "yunpat_python.tools_server"]
