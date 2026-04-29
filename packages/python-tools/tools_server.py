"""
YunPat Python Tools gRPC Server

Python 工具容器，提供 ML 模型推理和数据分析能力
限制为"工具提供者"角色，不参与核心链路
"""

import grpc
from concurrent import futures
import os
import time
from typing import Dict, Any, Tuple

# 导入生成的 Protobuf 代码（与 tools_server.py 同目录）
import tools_pb2
import tools_pb2_grpc


class PythonToolsServicer(tools_pb2_grpc.PythonToolsServiceServicer):
    """Python 工具服务"""

    def __init__(self):
        self.tools = {
            'embed_text': self.embed_text,
            'classify_text': self.classify_text,
            'analyze_data': self.analyze_data,
        }

    def _execute_tool_impl(self, tool_name: str, args: Dict[str, str]) -> Tuple[bool, Dict[str, Any], str, int]:
        """核心工具执行逻辑，返回 (success, result_dict, error_message, elapsed_ms)"""
        if tool_name not in self.tools:
            return False, {}, f'Tool {tool_name} not found', 0

        start_time = time.time()
        try:
            result = self.tools[tool_name](args)
            elapsed_ms = int((time.time() - start_time) * 1000)
            return True, result, '', elapsed_ms
        except Exception as e:
            elapsed_ms = int((time.time() - start_time) * 1000)
            return False, {}, str(e), elapsed_ms

    def ExecuteTool(self, request, context):
        """执行工具"""
        tool_name = request.tool_name
        args = dict(request.args)

        print(f"📝 Executing tool: {tool_name}")
        print(f"   Args: {args}")

        success, result, error_message, elapsed_ms = self._execute_tool_impl(tool_name, args)

        if not success:
            if 'not found' in error_message:
                context.set_code(grpc.StatusCode.NOT_FOUND)
            else:
                context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(error_message)
            print(f"❌ Tool execution failed: {error_message}")
            return tools_pb2.ExecuteToolResponse(
                success=False,
                result={},
                error_message=error_message,
            )

        # result 在 protobuf 中为 map<string, string>，需将所有值转为字符串
        result_str = {k: str(v) for k, v in result.items()}

        return tools_pb2.ExecuteToolResponse(
            success=True,
            result=result_str,
            error_message='',
            metrics=tools_pb2.ToolMetrics(
                execution_time_ms=elapsed_ms,
                memory_usage_mb=512,
                cpu_usage_percent=20,
            ),
        )

    def ExecuteTools(self, request, context):
        """批量执行工具"""
        responses = []
        start_time = time.time()
        for req in request.requests:
            success, result, error_message, elapsed_ms = self._execute_tool_impl(
                req.tool_name, dict(req.args)
            )
            if success:
                result_str = {k: str(v) for k, v in result.items()}
                responses.append(tools_pb2.ExecuteToolResponse(
                    success=True,
                    result=result_str,
                    error_message='',
                    metrics=tools_pb2.ToolMetrics(
                        execution_time_ms=elapsed_ms,
                        memory_usage_mb=512,
                        cpu_usage_percent=20,
                    ),
                ))
            else:
                responses.append(tools_pb2.ExecuteToolResponse(
                    success=False,
                    result={},
                    error_message=error_message,
                ))
        total_time_ms = int((time.time() - start_time) * 1000)
        return tools_pb2.ExecuteToolsResponse(
            responses=responses,
            total_time_ms=total_time_ms,
        )

    def ListTools(self, request, context):
        """列出可用工具"""
        tools = []
        for name in ['embed_text', 'classify_text', 'analyze_data']:
            tools.append(tools_pb2.ToolInfo(
                name=name,
                category='ml',
                description=f'{name} tool',
                parameters={},
                version='1.0.0',
                available=True,
            ))
        return tools_pb2.ListToolsResponse(tools=tools)

    def GetToolInfo(self, request, context):
        """获取工具信息"""
        tool_name = request.tool_name
        if tool_name in self.tools:
            info = tools_pb2.ToolInfo(
                name=tool_name,
                category='ml',
                description=f'{tool_name} tool',
                parameters={},
                version='1.0.0',
                available=True,
            )
            return tools_pb2.GetToolInfoResponse(tool_info=info)
        else:
            context.set_code(grpc.StatusCode.NOT_FOUND)
            context.set_details(f'Tool {tool_name} not found')
            return tools_pb2.GetToolInfoResponse()

    def HealthCheck(self, request, context):
        """健康检查"""
        return tools_pb2.HealthCheckResponse(
            healthy=True,
            version='1.0.0',
            details={'status': 'ready'},
        )

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
    tools_pb2_grpc.add_PythonToolsServiceServicer_to_server(
        PythonToolsServicer(), server
    )

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
