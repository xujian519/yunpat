/**
 * YunPat gRPC Server
 *
 * TypeScript 实现的 Agent gRPC 服务
 * 作为编排层，协调 Rust 核心引擎和 Python 工具
 */

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { v4 as uuidv4 } from 'uuid';
import type { ServerCredentials, ServerUnaryCall, requestCallback } from '@grpc/grpc-js';

interface AgentServerConfig {
  vectorServiceUrl: string;
  schedulerServiceUrl: string;
  pythonToolsUrl: string;
}

export class AgentServer {
  private server: grpc.Server;
  private config: AgentServerConfig;
  private agentState: Map<string, any>;

  constructor(config: AgentServerConfig) {
    this.config = config;
    this.server = new grpc.Server();
    this.agentState = new Map();
  }

  /**
   * 启动 gRPC Server
   */
  start(port: number): void {
    // 加载 Protobuf 定义
    const protoDefinition = this.loadProtoDefinition();
    const agentProto = grpc.loadPackageDefinition(protoDefinition).yunpat.agent;

    // 添加 AgentService
    this.server.addService(agentProto.AgentService.service, {
      executeAgent: this.executeAgent.bind(this),
      streamExecuteAgent: this.streamExecuteAgent.bind(this),
      getAgentStatus: this.getAgentStatus.bind(this),
      cancelAgent: this.cancelAgent.bind(this),
      listAgents: this.listAgents.bind(this),
    });

    // 绑定端口
    this.server.bindAsync(
      `0.0.0.0:${port}`,
      grpc.ServerCredentials.createInsecure(),
      (error, port) => {
        if (error) {
          console.error('❌ Failed to start server:', error);
          throw error;
        }
        console.log(`✅ Server bound to port ${port}`);
      }
    );
  }

  /**
   * 执行 Agent 任务
   */
  private async executeAgent(
    call: ServerUnaryCall<any, any>,
    callback: requestCallback<any>
  ): Promise<void> {
    const request = call.request;
    const agentId = request.agent_id || uuidv4();

    console.log(`\n📝 [${agentId}] ExecuteAgent:`, request.agent_name);
    console.log(`   Input:`, request.input);

    try {
      // 模拟 Agent 执行
      const result = await this.runAgent(request);

      callback(null, {
        status: 'SUCCESS',
        output: result.output,
        metrics: result.metrics,
        error_message: '',
      });
    } catch (error: any) {
      console.error(`❌ [${agentId}] Execution failed:`, error.message);

      callback({
        code: grpc.status.INTERNAL,
        details: error.message,
      });
    }
  }

  /**
   * 流式执行 Agent（实时反馈）
   */
  private async streamExecuteAgent(
    call: any
  ): Promise<void> {
    const request = call.request;
    const agentId = request.agent_id || uuidv4();

    console.log(`\n📝 [${agentId}] StreamExecuteAgent:`, request.agent_name);

    try {
      // 模拟流式执行
      const stages = ['plan', 'act', 'reflect', 'complete'];

      for (const [index, stage] of stages.entries()) {
        const progress = Math.floor(((index + 1) / stages.length) * 100);

        call.write({
          stage,
          progress,
          message: `Executing ${stage} stage...`,
          data: {},
          timestamp: Date.now(),
        });

        // 模拟处理时间
        await this.sleep(500);
      }

      call.end();
    } catch (error: any) {
      call.emit('error', {
        code: grpc.status.INTERNAL,
        details: error.message,
      });
    }
  }

  /**
   * 获取 Agent 状态
   */
  private async getAgentStatus(
    call: ServerUnaryCall<any, any>,
    callback: requestCallback<any>
  ): Promise<void> {
    const request = call.request;
    const agentId = request.agent_id;

    const state = this.agentState.get(agentId) || {
      status: 'not_found',
      uptime_ms: 0,
      metrics: {},
    };

    callback(null, {
      agent_id: agentId,
      status: state.status,
      uptime_ms: state.uptime_ms,
      metrics: state.metrics,
    });
  }

  /**
   * 取消 Agent 执行
   */
  private async cancelAgent(
    call: ServerUnaryCall<any, any>,
    callback: requestCallback<any>
  ): Promise<void> {
    const request = call.request;

    // 取消逻辑
    this.agentState.delete(request.agent_id);

    callback(null, {
      success: true,
      message: `Agent ${request.agent_id} cancelled`,
    });
  }

  /**
   * 列出所有 Agent
   */
  private async listAgents(
    call: ServerUnaryCall<any, any>,
    callback: requestCallback<any>
  ): Promise<void> {
    // 返回示例 Agent 列表
    callback(null, {
      agents: [
        {
          name: 'writer',
          id: 'writer-001',
          description: '技术写作助手',
          status: 'idle',
          metadata: {},
        },
        {
          name: 'researcher',
          id: 'researcher-001',
          description: '研究分析师',
          status: 'idle',
          metadata: {},
        },
      ],
      page: {
        total: 2,
        page: 1,
        page_size: 10,
        total_pages: 1,
      },
    });
  }

  /**
   * 运行 Agent（内部方法）
   */
  private async runAgent(request: any): Promise<any> {
    const startTime = Date.now();

    // 模拟 Agent 执行
    await this.sleep(1000);

    const duration = Date.now() - startTime;

    return {
      output: {
        result: `Agent ${request.agent_name} completed successfully`,
        task: request.input.task || 'N/A',
      },
      metrics: {
        duration_ms: duration,
        total_tokens: 100,
        llm_calls: 1,
        tool_calls: 0,
        cache_hits: 0,
        cache_misses: 0,
      },
    };
  }

  /**
   * 关闭 Server
   */
  shutdown(): void {
    this.server.tryShutdown((error) => {
      if (error) {
        console.error('❌ Failed to shutdown server:', error);
      } else {
        console.log('✅ Server shutdown successfully');
      }
    });
  }

  /**
   * 加载 Protobuf 定义
   */
  private loadProtoDefinition(): any {
    const PROTO_PATH = process.cwd() + '/../../protos/agent.proto';

    return protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
