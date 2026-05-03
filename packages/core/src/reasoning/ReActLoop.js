/**
 * 推理层 (Brain / Reasoning)
 *
 * Agent 的"大脑"，执行推理循环
 * - ReAct 循环：观察 (Observe) → 思考 (Think) → 行动 (Act)
 * - 任务规划：目标分解、子任务生成、依赖排序
 * - 推理策略：Plan-and-Solve、Tree-of-Thoughts、Reflexion
 * - 安全对齐：Constitutional AI、Guardrails
 */
/**
 * 推理策略类型
 */
export var ReasoningStrategy;
(function (ReasoningStrategy) {
    /** ReAct (默认) - 推理+行动 */
    ReasoningStrategy["REACT"] = "react";
    /** Plan-and-Solve - 先规划再解决 */
    ReasoningStrategy["PLAN_AND_SOLVE"] = "plan_and_solve";
    /** Tree-of-Thoughts - 思维树 */
    ReasoningStrategy["TREE_OF_THOUGHTS"] = "tree_of_thoughts";
    /** Reflexion - 反思式推理 */
    ReasoningStrategy["REFLEXION"] = "reflexion";
})(ReasoningStrategy || (ReasoningStrategy = {}));
/**
 * ReAct 循环实现
 *
 * 观察 → 思考 → 行动 → 重复
 */
export class ReActLoop {
    llm;
    config;
    constructor(llm, config) {
        this.llm = llm;
        this.config = {
            maxIterations: 10,
            verbose: false,
            reflectAfterStep: true,
            ...config,
        };
    }
    /**
     * 执行 ReAct 循环
     *
     * @param goal 目标
     * @param context 上下文信息
     * @returns 迭代结果生成器
     */
    async *execute(goal, context) {
        let iteration = 0;
        let done = false;
        let observation = {
            content: `目标: ${goal}`,
            timestamp: new Date(),
        };
        if (context) {
            observation.data = context;
        }
        while (!done && iteration < this.config.maxIterations) {
            iteration++;
            if (this.config.verbose) {
                console.log(`\n[迭代 ${iteration}]`);
            }
            // 1. 思考
            const thought = await this.think(observation, goal);
            if (this.config.verbose) {
                console.log(`[思考] ${thought.reasoning}`);
            }
            // 检查是否完成
            if (thought.state === 'done') {
                yield {
                    iteration,
                    observation,
                    thought,
                    done: true,
                };
                break;
            }
            // 2. 决定行动
            const action = this.decideAction(thought);
            if (this.config.verbose) {
                console.log(`[行动] ${action.type}`, action.params || '');
            }
            // 3. 执行行动
            const actionResult = await this.executeAction(action);
            if (this.config.verbose) {
                console.log(`[结果] ${actionResult.success ? '成功' : '失败'}`, actionResult.data || actionResult.error || '');
            }
            // 4. 更新观察
            observation = this.updateObservation(observation, actionResult);
            // 5. 反思（如果启用）
            if (this.config.reflectAfterStep) {
                const shouldContinue = await this.reflect(observation, thought, actionResult);
                if (!shouldContinue) {
                    done = true;
                }
            }
            // 6. 检查停止条件
            if (this.config.stopConditions) {
                const currentIteration = {
                    iteration,
                    observation,
                    thought,
                    action,
                    actionResult,
                    done,
                };
                for (const stopCondition of this.config.stopConditions) {
                    if (stopCondition(currentIteration)) {
                        done = true;
                        break;
                    }
                }
            }
            // 7. 产生迭代结果
            yield {
                iteration,
                observation,
                thought,
                action,
                actionResult,
                done,
            };
        }
    }
    /**
     * 思考阶段
     */
    async think(observation, goal) {
        const prompt = this.buildThinkPrompt(observation, goal);
        const response = await this.llm.chat({
            messages: [
                {
                    role: 'system',
                    content: `你是一个推理专家。请分析当前情况并给出思考过程。
返回格式：
思考：[你的推理过程]
状态：[thinking/planning/acting/done]
下一步：[下一步行动建议，如果状态为 done 则不返回]`,
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            temperature: 0.7,
        });
        return this.parseThought(response.message.content);
    }
    /**
     * 决定行动
     */
    decideAction(thought) {
        if (!thought.nextAction) {
            return {
                type: 'complete',
                expectedOutcome: '任务完成',
            };
        }
        // 简化实现：直接使用 nextAction
        // 实际应用中应该解析并结构化
        return {
            type: thought.nextAction.includes('search') ? 'search' : 'tool',
            params: {
                query: thought.nextAction,
            },
        };
    }
    /**
     * 执行行动
     */
    async executeAction(action) {
        // 简化实现：模拟行动执行
        // 实际应用中应该调用真实的工具或 API
        if (action.type === 'complete') {
            return {
                success: true,
                data: { message: '任务已完成' },
            };
        }
        if (action.type === 'search') {
            // 模拟搜索
            return {
                success: true,
                data: {
                    results: [
                        { title: '模拟搜索结果 1', url: 'https://example.com/1' },
                        { title: '模拟搜索结果 2', url: 'https://example.com/2' },
                    ],
                },
                toolUsed: 'search',
            };
        }
        return {
            success: true,
            data: { message: '行动已执行' },
            toolUsed: action.type,
        };
    }
    /**
     * 更新观察
     */
    updateObservation(previous, actionResult) {
        return {
            content: actionResult.error
                ? `错误: ${actionResult.error}`
                : `成功: ${JSON.stringify(actionResult.data)}`,
            data: {
                ...previous.data,
                lastActionResult: actionResult,
            },
            timestamp: new Date(),
            confidence: actionResult.success ? 1.0 : 0.0,
        };
    }
    /**
     * 反思
     */
    async reflect(observation, thought, actionResult) {
        if (!actionResult.success) {
            // 行动失败，继续尝试
            return true;
        }
        const prompt = `基于以下信息，判断任务是否完成：

观察：${observation.content}
思考：${thought.reasoning}
行动结果：${JSON.stringify(actionResult.data)}

返回 "继续" 或 "完成"。`;
        const response = await this.llm.chat({
            messages: [
                {
                    role: 'system',
                    content: '你是一个任务评估专家。',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            temperature: 0.3,
        });
        const shouldContinue = response.message.content.includes('继续');
        return shouldContinue;
    }
    /**
     * 构建思考提示
     */
    buildThinkPrompt(observation, goal) {
        let prompt = `目标：${goal}\n\n`;
        prompt += `当前情况：\n${observation.content}\n\n`;
        if (observation.data) {
            prompt += `可用信息：\n${JSON.stringify(observation.data, null, 2)}\n\n`;
        }
        prompt += `请分析当前情况，给出你的思考过程和下一步建议。`;
        return prompt;
    }
    /**
     * 解析思考结果
     */
    parseThought(content) {
        // 简化实现：解析 LLM 返回的结构化内容
        // 实际应用中应该使用更robust的解析方法
        const thought = {
            reasoning: content,
            state: 'thinking',
        };
        if (content.includes('状态：done') || content.includes('完成')) {
            thought.state = 'done';
        }
        else if (content.includes('下一步：')) {
            const match = content.match(/下一步：(.+)/);
            if (match) {
                thought.nextAction = match[1].trim();
            }
            thought.state = 'acting';
        }
        return thought;
    }
}
/**
 * Plan-and-Solve 策略
 *
 * 先规划再解决，适合复杂任务
 */
export class PlanAndSolveStrategy {
    llm;
    constructor(llm) {
        this.llm = llm;
    }
    /**
     * 生成计划
     */
    async makePlan(goal, context) {
        let prompt = `请为以下目标制定详细的执行计划。

**要求**：
1. 将目标分解为清晰的步骤
2. 每个步骤应该是可执行的
3. 步骤之间要有逻辑顺序
4. 格式：1. [步骤描述]

**目标**：${goal}`;
        if (context && Object.keys(context).length > 0) {
            prompt += `\n\n**上下文**：\n${JSON.stringify(context, null, 2)}`;
        }
        prompt += `\n\n请列出执行计划：`;
        const response = await this.llm.chat({
            messages: [
                {
                    role: 'system',
                    content: '你是一个规划专家，擅长将复杂目标分解为可执行的步骤。',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            temperature: 0.5,
        });
        // 解析计划步骤
        const steps = this.parsePlanSteps(response.message.content);
        if (steps.length === 0) {
            throw new Error('未能生成有效的执行计划');
        }
        return steps;
    }
    /**
     * 执行计划（增强版）
     */
    async *executePlan(plan, context) {
        let executionContext = context || {};
        for (let i = 0; i < plan.length; i++) {
            const step = plan[i];
            const stepNumber = i + 1;
            try {
                // 执行当前步骤
                const result = await this.executeStep(step, stepNumber, plan.length, executionContext);
                // 更新执行上下文
                if (result.result) {
                    executionContext = {
                        ...executionContext,
                        [`step${stepNumber}Result`]: result.result,
                    };
                }
                yield {
                    step: stepNumber,
                    content: step,
                    result: result.result,
                    success: true,
                    done: i === plan.length - 1,
                    tokensUsed: result.tokensUsed,
                };
            }
            catch (error) {
                // 步骤执行失败
                yield {
                    step: stepNumber,
                    content: step,
                    success: false,
                    error: error.message,
                    done: false,
                };
                // 失败后停止执行
                break;
            }
        }
    }
    /**
     * 执行单个步骤
     */
    async executeStep(step, stepNumber, totalSteps, context) {
        let prompt = `请执行以下步骤：

**当前步骤** (${stepNumber}/${totalSteps}): ${step}`;
        if (Object.keys(context).length > 0) {
            prompt += `\n\n**前序步骤结果**：\n${JSON.stringify(context, null, 2)}`;
        }
        prompt += `\n\n请执行该步骤并返回结果。`;
        const response = await this.llm.chat({
            messages: [
                {
                    role: 'system',
                    content: '你是一个执行专家，严格按照要求完成任务。',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            temperature: 0.3,
        });
        return {
            result: response.message.content,
            tokensUsed: response.usage?.totalTokens || 0,
        };
    }
    /**
     * 验证计划质量
     */
    async validatePlan(goal, plan) {
        const prompt = `请验证以下执行计划的质量：

**目标**：${goal}

**计划**：
${plan.map((step, i) => `${i + 1}. ${step}`).join('\n')}

**评估维度**：
1. 完整性：是否覆盖目标的所有方面
2. 可行性：步骤是否可执行
3. 逻辑性：步骤顺序是否合理
4. 清晰性：步骤描述是否清楚

请给出评分（1-10）和改进建议。`;
        const response = await this.llm.chat({
            messages: [
                {
                    role: 'system',
                    content: '你是一个质量评估专家。',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            temperature: 0.3,
        });
        // 解析评分
        const scoreMatch = response.message.content.match(/(\d+)\/?10?/);
        const score = scoreMatch ? parseInt(scoreMatch[1]) / 10 : 0.5;
        return {
            isValid: score >= 0.6,
            score,
            feedback: response.message.content,
        };
    }
    /**
     * 完整执行：规划 → 验证 → 执行
     */
    async *planAndSolve(goal, context) {
        // 步骤1：生成计划
        const plan = await this.makePlan(goal, context);
        // 步骤2：验证计划
        const validation = await this.validatePlan(goal, plan);
        yield {
            step: 0,
            content: '计划生成和验证',
            result: `计划包含 ${plan.length} 个步骤，质量评分: ${(validation.score * 10).toFixed(1)}/10`,
            success: validation.isValid,
            done: false,
            plan,
            validation,
        };
        if (!validation.isValid) {
            yield {
                step: 0,
                content: '计划验证失败',
                success: false,
                error: '计划质量不足，请重新规划',
                done: true,
            };
            return;
        }
        // 步骤3：执行计划
        for await (const result of this.executePlan(plan, context)) {
            yield result;
        }
    }
    /**
     * 解析计划步骤
     */
    parsePlanSteps(content) {
        const steps = [];
        // 尝试多种格式
        const patterns = [
            /^\d+[\.\)]\s*(.+)$/gm, // "1. 步骤" 或 "1) 步骤"
            /^[-•]\s*(.+)$/gm, // "- 步骤" 或 "• 步骤"
        ];
        for (const pattern of patterns) {
            const matches = Array.from(content.matchAll(pattern));
            if (matches.length > 0) {
                for (const match of matches) {
                    const step = match[1]?.trim();
                    if (step && !steps.includes(step)) {
                        steps.push(step);
                    }
                }
                if (steps.length > 0)
                    break;
            }
        }
        // 如果没有匹配到，按段落分割
        if (steps.length === 0) {
            const paragraphs = content.split(/\n\n+/).filter((p) => p.trim());
            for (const para of paragraphs) {
                const step = para.trim();
                if (step && !steps.includes(step)) {
                    steps.push(step);
                }
            }
        }
        return steps;
    }
}
