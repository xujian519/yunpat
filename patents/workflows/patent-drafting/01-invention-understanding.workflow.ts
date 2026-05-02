import { v4 as uuidv4 } from 'uuid';
import type { WorkflowDefinition } from '@yunpat/core';
import { InventionUnderstandingAgent, HumanReadableRenderer } from '@yunpat/agent-invention';

export function createInventionUnderstandingWorkflow(): WorkflowDefinition {
  return {
    id: 'invention-understanding',
    name: '发明理解工作流',
    description: '分析技术交底书，提取发明要点',
    steps: [
      {
        id: 'parse-disclosure',
        name: '解析技术交底书',
        agentName: 'invention-understanding',
        description: '使用patent-core解析交底书结构',
        inputMapping: {
          technicalDisclosure: 'input.technicalDisclosure',
          title: 'input.title',
          field: 'input.field',
        },
      },
      {
        id: 'analyze-invention',
        name: '分析发明内容',
        agentName: 'invention-understanding',
        description: 'LLM深入分析技术方案',
        inputMapping: {
          technicalDisclosure: 'steps.parse-disclosure.output',
          title: 'input.title',
          field: 'input.field',
        },
        requiresApproval: true,
        approvalPrompt: '请审核发明理解结果是否准确完整',
      },
      {
        id: 'render-report',
        name: '生成可读报告',
        agentName: 'human-readable-renderer',
        description: '将分析结果渲染为人类可读格式',
        inputMapping: {
          analysisResult: 'steps.analyze-invention.output',
        },
      },
    ],
    enableCheckpoints: true,
  };
}
