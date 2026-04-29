import { AgentServer } from './services/AgentServer.js';

const AGENT_SERVICE_PORT = parseInt(process.env.AGENT_SERVICE_PORT || '50051', 10);
const VECTOR_SERVICE_URL = process.env.VECTOR_SERVICE_URL || 'localhost:50051';
const SCHEDULER_SERVICE_URL = process.env.SCHEDULER_SERVICE_URL || 'localhost:50051';
const PYTHON_TOOLS_URL = process.env.PYTHON_TOOLS_URL || 'localhost:50052';

/**
 * YunPat gRPC Server 主入口
 */
async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  YunPat gRPC Server (TypeScript)       ║');
  console.log('╚════════════════════════════════════════╝\n');

  // 创建 Agent Server
  const agentServer = new AgentServer({
    vectorServiceUrl: VECTOR_SERVICE_URL,
    schedulerServiceUrl: SCHEDULER_SERVICE_URL,
    pythonToolsUrl: PYTHON_TOOLS_URL,
  });

  // 启动 Agent Server
  await agentServer.start(AGENT_SERVICE_PORT);

  console.log(`✅ Agent gRPC Server started on port ${AGENT_SERVICE_PORT}`);
  console.log(`🔗 Connected to Vector Service: ${VECTOR_SERVICE_URL}`);
  console.log(`🔗 Connected to Scheduler Service: ${SCHEDULER_SERVICE_URL}`);
  console.log(`🔗 Connected to Python Tools: ${PYTHON_TOOLS_URL}`);
  console.log('\n🚀 Server is ready to accept requests\n');

  // 优雅关闭
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down gracefully...');
    agentServer.shutdown();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});
