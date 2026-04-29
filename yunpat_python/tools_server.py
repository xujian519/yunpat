"""
YunPat Python Tools gRPC Server

Python 工具容器，提供 ML 模型推理和数据分析能力
限制为"工具提供者"角色，不参与核心链路
"""

import grpc
from concurrent import futures
import os
from typing import Dict, Any

# 导入生成的 Protobuf 代码
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '../../protos'))

# 这些文件将在构建时生成
# import tools_pb2
# import tools_pb2_grpc

class PythonToolsService:
    """Python 工具服务"""

    def __init__(self):
        self.tools = {
            'embed_text': self.embed_text,
            'classify_text': self.classify_text,
            'analyze_data': self.analyze_data,
        }

    def ExecuteTool(self, request, context):
        """执行工具"""
        tool_name = request.tool_name
        args = dict(request.args)

        print(f"📝 Executing tool: {tool_name}")
        print(f"   Args: {args}")

        if tool_name not in self.tools:
            context.set_code(grpc.StatusCode.NOT_FOUND)
            context.set_details(f'Tool {tool_name} not found')
            # return tools_pb2.ToolResponse()

        try:
            result = self.tools[tool_name](args)

            # return tools_pb2.ToolResponse(
            #     success=True,
            #     result=result,
            #     error_message='',
            #     metrics=tools_pb2.ToolMetrics(
            #         execution_time_ms=100,
            #         memory_usage_mb=512,
            #         cpu_usage_percent=20,
            #     ),
            # )
        except Exception as e:
            print(f"❌ Tool execution failed: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            # return tools_pb2.ToolResponse()

    def embed_text(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """文本嵌入（模拟）"""
        text = args.get('text', '')

        # 模拟嵌入向量
        import random
        embedding = [random.random() for _ in range(768)]

        return {
            'embedding': embedding,
            'dimension': 768,
        }

    def classify_text(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """文本分类（模拟）"""
        text = args.get('text', '')

        # 模拟分类结果
        return {
            'label': 'tech',
            'confidence': 0.95,
        }

    def analyze_data(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """数据分析（模拟）"""
        data = args.get('data', [])

        # 模拟分析结果
        return {
            'mean': 42.0,
            'std': 10.5,
            'count': len(data) if isinstance(data, list) else 0,
        }

def serve():
    """启动 gRPC 服务"""
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))

    # 添加服务
    # tools_pb2_grpc.add_PythonToolsServicer_to_server(
    #     PythonToolsService(), server
    # )

    port = os.getenv('PORT', '50052')
    server.add_insecure_port(f'[::]:{port}')

    print("╔════════════════════════════════════════╗")
    print("║  YunPat Python Tools Service           ║")
    print("╚════════════════════════════════════════╝\n")
    print(f"🚀 Python Tools Service starting on port {port}...")
    print(f"📦 Available tools: {', '.join(['embed_text', 'classify_text', 'analyze_data'])}")
    print(f"💾 Memory limit: {os.getenv('MEMORY_LIMIT', '4GB')}")
    print(f"🔢 CPU limit: {os.getenv('CPU_LIMIT', '2')}")
    print('\n✅ Server is ready to accept requests\n')

    server.start()
    server.wait_for_termination()

if __name__ == '__main__':
    serve()
