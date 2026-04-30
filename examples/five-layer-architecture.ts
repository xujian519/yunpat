/**
 * YunPat 五层架构完整示例
 *
 * 演示如何使用完整的五层架构：
 * ① 交互层 (Gateway)
 * ② 推理层 (Reasoning)
 * ③ 核心推理引擎 (LLM)
 * ④ 记忆层 (Memory)
 * ⑤ 编排层 (Orchestration)
 */

import {
  // 交互层
  BaseGateway,
  InputSourceType,
  OutputTargetType,
  Credentials,
} from '../packages/core/src/gateway/Gateway.js';

import {
  // 推理层
  ReActLoop,
  PlanAndSolveStrategy,
  TreeOfThoughtsStrategy,
} from '../packages/core/src/reasoning/ReActLoop.js';

import {
  // 国产大模型
  NativeLLMAdapter,
  NativeModel,
  createDeepSeekModel,
  createQwenModel,
  createOllamaModel,
} from '../packages/core/src/llm/NativeLLMAdapter.js';

import {
  // 记忆层
  EnhancedMemoryStore,
  CheckpointManager,
  TimeMachine,
} from '../packages/core/src/memory/CheckpointManager.js';

import {
  // 工具层
  ToolRegistry,
  BaseTool,
} from '../packages/core/src/tools/ToolRegistry.js';

/**
 * 完整的五层架构使用示例
 */
async function fiveLayerExample() {
  console.log('=== YunPat 五层架构示例 ===\n');

  // ============================================================
  // ① 交互层 (Gateway) - 多模态输入、人机协同、安全网关
  // ============================================================
  console.log('① 初始化交互层...');

  const gateway = new BaseGateway({
    enableAuth: true,
    enableAuthorization: true,
    enableContentFilter: true,
    enableAudit: true,
    contentFilterRules: [
      {
        name: '敏感词过滤',
        type: 'keyword',
        content: '暴力',
        action: 'block',
        severity: 'high',
      },
    ],
  });

  // 身份认证
  const authResult = await gateway.authenticate({
    type: 'apikey',
    data: { apiKey: 'demo-key-12345' },
  });

  console.log(`认证结果: ${authResult.success ? '成功' : '失败'}`);
  console.log(`用户权限: ${authResult.permissions?.join(', ')}`);

  // 接收输入
  const input = await gateway.receiveInput(InputSourceType.TEXT);
  input.text = '分析 DeepSeek 和通义千问的差异';

  // 内容过滤
  const filterResult = await gateway.filterContent(input.text || '');
  if (filterResult.filtered) {
    console.log(`内容被过滤: ${filterResult.reason}`);
    return;
  }

  console.log(`输入内容: ${input.text}\n`);

  // ============================================================
  // ③ 核心推理引擎 (LLM) - 国产大模型 + 本地模型
  // ============================================================
  console.log('② 初始化核心推理引擎...');

  // 使用 DeepSeek (默认)
  const deepseekModel = createDeepSeekModel(process.env.DEEPSEEK_API_KEY || 'demo-key');

  // 或使用通义千问
  const qwenModel = createQwenModel(process.env.DASHSCOPE_API_KEY || 'demo-key');

  // 或使用本地 Ollama
  const ollamaModel = createOllamaModel('llama3');

  console.log(`已加载模型: DeepSeek, 通义千问, Ollama/Llama3`);
  console.log(`当前模型: ${deepseekModel.getModel()}\n`);

  // ============================================================
  // ② 推理层 (Reasoning) - ReAct 循环、多种推理策略
  // ============================================================
  console.log('③ 初始化推理层...');

  // ReAct 循环
  const reactLoop = new ReActLoop(deepseekModel, {
    maxIterations: 5,
    verbose: true,
    reflectAfterStep: true,
  });

  // Plan-and-Solve 策略
  const planAndSolve = new PlanAndSolveStrategy(deepseekModel);

  // Tree-of-Thoughts 策略
  const treeOfThoughts = new TreeOfThoughtsStrategy(deepseekModel);

  console.log('推理策略: ReAct, Plan-and-Solve, Tree-of-Thoughts\n');

  // ============================================================
  // ④ 记忆层 (Memory) - 检查点、时间旅行、断点续传
  // ============================================================
  console.log('④ 初始化记忆层...');

  const checkpointManager = new CheckpointManager({
    autoSave: true,
    autoSaveInterval: 1,
    maxCheckpoints: 100,
  });

  const memoryStore = new EnhancedMemoryStore(checkpointManager);

  // 获取时间机器
  const timeMachine = memoryStore.getTimeMachine();

  console.log('记忆功能: 短期记忆、检查点、时间旅行、断点续传\n');

  // ============================================================
  // ⑤ 工具层 (Tools) - 工具注册、MCP 协议
  // ============================================================
  console.log('⑤ 初始化工具层...');

  const toolRegistry = new ToolRegistry(
    new (class EventBus {
      // 简化的 EventBus
      publish() {}
      subscribe() {}
      unsubscribe() {}
      request() {}
    })()
  );

  // 注册示例工具
  class WebSearchTool extends BaseTool {
    name = 'web-search';
    description = '网页搜索工具';

    async execute(input: { query: string }) {
      return {
        results: [
          { title: `关于 "${input.query}" 的搜索结果 1`, url: 'https://example.com/1' },
          { title: `关于 "${input.query}" 的搜索结果 2`, url: 'https://example.com/2' },
        ],
      };
    }
  }

  toolRegistry.register(new WebSearchTool());

  console.log(
    `已注册工具: ${toolRegistry
      .list()
      .map((t) => t.name)
      .join(', ')}\n`
  );

  // ============================================================
  // 完整执行流程
  // ============================================================
  console.log('=== 开始执行任务 ===\n');

  const goal = input.text || '分析 AI 框架趋势';
  const executionId = `exec-${Date.now()}`;
  const agentName = 'demo-agent';

  // 使用 ReAct 循环执行
  for await (const iteration of reactLoop.execute(goal, { executionId, agentName })) {
    console.log(`\n[迭代 ${iteration.iteration}]`);
    console.log(`思考: ${iteration.thought.reasoning.substring(0, 100)}...`);

    if (iteration.action) {
      console.log(`行动: ${iteration.action.type}`);
    }

    // 保存检查点
    if (iteration.iteration % 2 === 0) {
      const checkpoint = await memoryStore.createCheckpoint(
        agentName,
        executionId,
        iteration.iteration,
        ['auto-save'],
        `迭代 ${iteration.iteration} 的自动检查点`
      );

      console.log(`[检查点] 已保存: ${checkpoint.id}`);
    }

    // 存储到记忆
    await memoryStore.set(`iteration-${iteration.iteration}`, {
      thought: iteration.thought,
      action: iteration.action,
      result: iteration.actionResult,
    });

    if (iteration.done) {
      console.log('\n任务完成！');
      break;
    }
  }

  // ============================================================
  // 时间旅行演示
  // ============================================================
  console.log('\n=== 时间旅行演示 ===\n');

  const checkpoints = await memoryStore.listCheckpoints({ executionId });
  console.log(`找到 ${checkpoints.length} 个检查点`);

  if (checkpoints.length > 0) {
    // 回到第一个检查点
    const firstCheckpoint = checkpoints[0];
    console.log(`\n回到检查点: ${firstCheckpoint.id}`);

    await memoryStore.restoreCheckpoint(firstCheckpoint.id);

    // 查看时间线
    const timeline = await timeMachine.listTimeline(executionId);
    console.log(`\n时间线: ${timeline.length} 个检查点`);
    timeline.forEach((c) => {
      console.log(`  - 迭代 ${c.iteration}: ${c.timestamp.toISOString()}`);
    });
  }

  // ============================================================
  // 记忆统计
  // ============================================================
  console.log('\n=== 记忆统计 ===\n');

  const stats = memoryStore.getStats();
  console.log(`短期记忆: ${stats.shortTermSize} 条`);
  console.log(`历史记录: ${stats.historySize} 条`);
  console.log(`检查点: ${stats.checkpointCount} 个`);

  // ============================================================
  // 输出结果
  // ============================================================
  console.log('\n=== 输出结果 ===\n');

  const output = {
    targetType: OutputTargetType.TERMINAL,
    text: `已完成任务: ${goal}`,
    metadata: {
      timestamp: new Date(),
      contentType: 'text/plain',
    },
  };

  await gateway.sendOutput(output, OutputTargetType.TERMINAL);

  console.log('\n=== 执行完成 ===');
}

/**
 * 演示多模型切换
 */
async function multiModelExample() {
  console.log('=== 多模型切换示例 ===\n');

  // 创建多个模型
  const deepseek = createDeepSeekModel('your-api-key');
  const qwen = createQwenModel('your-api-key');
  const ollama = createOllamaModel('llama3');

  // 根据任务选择模型
  const taskType = 'code'; // 或 'chat', 'analysis'

  let selectedModel;
  switch (taskType) {
    case 'code':
      selectedModel = deepseek; // DeepSeek Coder 最强
      console.log('代码任务: 使用 DeepSeek Coder');
      break;
    case 'chat':
      selectedModel = deepseek;
      console.log('对话任务: 使用 DeepSeek Chat');
      break;
    case 'analysis':
      selectedModel = qwen; // 通义千问 Max 适合分析
      console.log('分析任务: 使用通义千问 Max');
      break;
    default:
      selectedModel = ollama; // 本地模型兜底
      console.log('默认: 使用本地 Ollama');
  }

  // 调用模型
  const response = await selectedModel.chat({
    messages: [
      {
        role: 'user',
        content: '你好，请介绍一下你自己',
      },
    ],
  });

  console.log(`\n模型回复: ${response.message.content}`);
  console.log(`Token 使用: ${JSON.stringify(response.usage)}`);
}

// 运行示例
console.log('╔════════════════════════════════════════════════════════╗');
console.log('║       YunPat 五层架构 - 完整示例                     ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

fiveLayerExample()
  .then(() => {
    console.log('\n✓ 示例执行成功');
  })
  .catch((error) => {
    console.error('\n✗ 执行失败:', error);
  });
