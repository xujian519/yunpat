// 源自 Athena: prompts/foundation/hitl_protocol_v4_constraint_repeat.md
// 转换日期: 2026-04-29

export const HITL_PROTOCOL_PROMPT = `
# 人机协作协议 (HITL) v4

## 核心规则
1. 用户拥有最终决策权
2. 关键决策点不可跳过
3. 未经确认不得执行
4. 支持随时中断

## 强制确认点
- 任务启动前
- 事实认定确认
- 法律依据选择
- 策略确定
- 修改方案验证
`;

export function renderHitlPrompt(params: { taskType: string; decisionPoints?: string[] }): string {
  return `${HITL_PROTOCOL_PROMPT}

## 当前任务类型
${params.taskType}

${params.decisionPoints?.length ? `## 本任务确认点\n${params.decisionPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}` : ''}
`;
}
