# YunPat 智能体框架 - 五层架构设计

## 架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│                    ① 交互层 (Gateway / Interface)                │
│  多模态输入 · 人机协同 HITL · 安全网关                           │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                  ② 推理层 (Brain / Reasoning)                    │
│  ReAct 循环 · 任务规划 · 推理策略 · 安全对齐                      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│              [ 核心推理引擎 ] Core LLM Engine                     │
│         GPT-5 · Claude · Gemini · DeepSeek · 本地模型            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌───────▼────────┐  ┌──────▼─────────┐
│ ③ 记忆层       │  │ ④ 工具层        │  │ ⑤ 编排层       │
│ Memory/State   │  │ Skills/Tools    │  │ Orchestration  │
│ 短期/长期/检查点│  │ 函数调用/MCP    │  │ 多智能体协作    │
└────────────────┘  └────────────────┘  └────────────────┘
```

## 各层详细设计

### ① 交互层 (Gateway / Interface)

**职责**：Agent 与外部世界的接口

**核心能力**：
- **多模态输入**：文本、语音、图像、视频、文件
- **人机协同 (HITL)**：审批节点、反馈回路、人工接管
- **安全网关**：身份认证、权限控制、内容过滤、审计日志
- **会话管理**：会话状态、上下文窗口、流式输出

**接口定义**：
```typescript
interface Gateway {
  // 多模态输入
  receiveInput(source: InputSource): Promise<MultimodalInput>;

  // 人机协同
  requestHumanApproval(message: string): Promise<Approval>;

  // 安全检查
  authenticate(credentials: Credentials): Promise<AuthResult>;
  authorize(action: Action, permissions: Permission[]): Promise<boolean>;

  // 输出
  sendOutput(output: MultimodalOutput, target: OutputTarget): Promise<void>;
}
```

### ② 推理层 (Brain / Reasoning)

**职责**：Agent 的"大脑"，执行推理循环

**核心能力**：
- **ReAct 循环**：观察 (Observe) → 思考 (Think) → 行动 (Act)
- **任务规划**：目标分解、子任务生成、依赖排序、动态重规划
- **推理策略**：
  - Plan-and-Solve
  - Tree-of-Thoughts
  - Reflexion
  - ReAct (默认)
- **安全对齐**：Constitutional AI、Guardrails、幻觉检测

**接口定义**：
```typescript
interface ReasoningEngine {
  // ReAct 循环
  reactLoop(context: Context): AsyncIterable<ThoughtAction>;

  // 任务规划
  planTask(goal: string, constraints: Constraints): Promise<Plan>;

  // 推理策略
  setStrategy(strategy: ReasoningStrategy): void;

  // 安全对齐
  validateAction(action: Action, constitution: Constitution): Promise<boolean>;
}
```

### [ 核心推理引擎 ] Core LLM Engine

**职责**：驱动整个系统的动力源

**特性**：
- **模型无关架构**：可切换 GPT-5、Claude、Gemini、DeepSeek、本地模型
- **统一接口**：聊天、流式输出、嵌入、函数调用
- **成本优化**：Token 计费、缓存策略、模型路由

**接口定义**：
```typescript
interface LLMEngine {
  // 聊天
  chat(params: ChatParams): Promise<ChatResponse>;
  chatStream(params: ChatParams): AsyncIterable<ChatChunk>;

  // 嵌入
  embed(texts: string[]): Promise<number[][]>;

  // 函数调用
  callFunction(params: FunctionCallParams): Promise<FunctionCallResponse>;

  // 模型切换
  switchModel(model: string): void;
}
```

### ③ 记忆层 (Memory / State)

**职责**：解决 LLM 上下文窗口有限的痛点

**核心能力**：
- **短期记忆**：对话历史、当前上下文、Token 窗口管理
- **长期记忆**：向量数据库、知识图谱、用户画像、经验存储
- **持久化状态**：
  - Checkpoint 检查点机制
  - 时间旅行调试
  - 断点续传
- **记忆检索**：RAG 增强、语义搜索、重要性评分、记忆压缩

**接口定义**：
```typescript
interface MemoryStore {
  // 短期记忆
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;

  // 长期记忆
  search(query: string, topK?: number): Promise<MemoryEntry[]>;
  store(entry: MemoryEntry): Promise<void>;

  // 检查点
  saveCheckpoint(id: string): Promise<Checkpoint>;
  loadCheckpoint(id: string): Promise<Checkpoint>;
  listCheckpoints(): Promise<Checkpoint[]>;

  // 时间旅行
  getTimeMachine(): TimeMachine;
}
```

### ④ 工具层 (Skills / Tools)

**职责**：Agent 与外部世界交互的"手脚"

**核心能力**：
- **函数调用**：API 接口、数据库查询、代码执行
- **MCP 协议**：标准化连接外部系统
- **内置工具**：
  - 搜索引擎
  - 文件操作
  - 代码执行 (Code Interpreter)
  - 浏览器自动化
- **工具生态**：自定义工具、第三方扩展、技能市场

**接口定义**：
```typescript
interface ToolRegistry {
  // 工具注册
  register(tool: Tool): void;
  unregister(name: string): void;

  // 工具调用
  call(name: string, input: any): Promise<any>;

  // MCP 协议
  connectMCP(server: MCPServer): Promise<void>;
  disconnectMCP(server: MCPServer): Promise<void>;

  // 工具发现
  listTools(): Tool[];
  findTools(capability: string): Tool[];
}
```

### ⑤ 编排层 (Orchestration / Multi-Agent)

**职责**：多智能体协作系统的管理

**核心能力**：
- **协作模式**：
  - 角色驱动（CrewAI）：研究员 → 写手 → 审核员
  - 对话式群组讨论（AutoGen）
  - 图状态机（LangGraph）：复杂分支、条件路由
- **可观测性**：
  - LangSmith 追踪
  - 日志审计
  - 性能监控
  - A/B 测试
- **运行时管理**：
  - 并发控制
  - 错误恢复
  - 超时重试
  - 成本优化
  - 限流

**接口定义**：
```typescript
interface OrchestrationLayer {
  // 多智能体协作
  createAgent(config: AgentConfig): Agent;
  createTeam(definition: TeamDefinition): Team;

  // 工作流
  createGraphWorkflow(definition: GraphDefinition): GraphWorkflow;

  // 可观测性
  getTracer(): Tracer;
  getMetrics(): Metrics;

  // 运行时管理
  setConcurrencyLimit(limit: number): void;
  setRetryPolicy(policy: RetryPolicy): void;
}
```

## 层间交互

```
用户 → Gateway → Orchestration → Agent
                                      ↓
                                 Reasoning ← LLM
                                      ↓
                                 Memory & Tools
                                      ↓
                                 输出结果
```

## 设计原则

1. **分层清晰**：每层有明确的职责边界
2. **接口标准**：层间通过标准接口通信
3. **可替换性**：每层的实现可以独立替换
4. **可扩展性**：支持新功能、新协议的扩展
5. **可观测性**：全链路追踪和监控

## 与主流框架对照

| YunPat | LangChain | CrewAI | AutoGen |
|--------|-----------|--------|---------|
| Gateway | Chains | - | - |
| Reasoning | Agents | Agents | Agents |
| Memory | Memory | - | - |
| Tools | Tools | Tools | Tools |
| Orchestration | LangGraph | Crews | GroupChat |
