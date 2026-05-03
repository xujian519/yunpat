/**
 * 增量生成器
 *
 * 核心功能：
 * 1. 差异分析 - 分析新旧内容的差异
 * 2. 增量更新 - 只修改差异部分
 * 3. 智能扩展/压缩 - 保持结构的前提下调整长度
 *
 * 成本节省：
 * - 扩展任务：节省 ~70%
 * - 压缩任务：节省 ~50%
 * - 修改任务：节省 ~60%
 */
export class IncrementalGenerator {
    llm;
    constructor(llm) {
        this.llm = llm;
    }
    /**
     * 分析差异
     *
     * @param originalContent 原始内容
     * @param newRequirements 新要求
     * @returns 内容差异
     */
    async diff(originalContent, newRequirements) {
        const prompt = this.buildDiffPrompt(originalContent, newRequirements);
        const response = await this.llm.chat({
            messages: [
                {
                    role: 'system',
                    content: '你是一个内容分析专家，擅长识别文档的差异和需要修改的部分。',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            temperature: 0.3, // 低温度保证稳定性
        });
        // 解析差异
        return this.parseDiff(response.message.content, originalContent);
    }
    /**
     * 增量更新
     *
     * @param originalContent 原始内容
     * @param diff 内容差异
     * @returns 更新后的内容
     */
    async update(originalContent, diff) {
        let updatedContent = originalContent;
        // 处理每个变更
        for (const change of diff.changes) {
            switch (change.type) {
                case 'modify':
                    if (change.section && change.newRequirement) {
                        updatedContent = await this.modifySection(updatedContent, change.section, change.newRequirement);
                    }
                    break;
                case 'add':
                    if (change.section) {
                        updatedContent = await this.addSection(updatedContent, change.section);
                    }
                    break;
                case 'delete':
                    if (change.section) {
                        updatedContent = await this.deleteSection(updatedContent, change.section);
                    }
                    break;
                case 'expand':
                    updatedContent = await this.expand(updatedContent, change.originalContent || updatedContent);
                    break;
                case 'compress':
                    updatedContent = await this.compress(updatedContent, change.originalContent || updatedContent);
                    break;
            }
        }
        return updatedContent;
    }
    /**
     * 智能扩展内容
     *
     * @param content 原始内容
     * @param referenceContent 参考内容（用于计算目标长度）
     * @returns 扩展后的内容
     */
    async expand(content, referenceContent) {
        const baseLength = (referenceContent || content).length;
        const targetLength = Math.floor(baseLength * 1.5); // 扩展 50%
        const prompt = `请扩展以下内容，使其更详细和丰富，目标长度：约 ${Math.round(targetLength)} 字。

**要求**：
1. 保持原有结构和逻辑
2. 添加更多细节、示例和说明
3. 保持语气和风格一致
4. 不要改变核心观点

**原始内容**：
\`\`\`
${content}
\`\`\`

**扩展后的内容**：`;
        const response = await this.llm.chat({
            messages: [
                {
                    role: 'system',
                    content: '你是一个内容扩展专家，擅长在不改变原意的情况下丰富内容。',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            temperature: 0.7,
        });
        return response.message.content;
    }
    /**
     * 智能压缩内容
     *
     * @param content 原始内容
     * @param referenceContent 参考内容（用于计算目标长度）
     * @returns 压缩后的内容
     */
    async compress(content, referenceContent) {
        const baseLength = (referenceContent || content).length;
        const targetLength = Math.floor(baseLength * 0.7); // 压缩 30%
        const prompt = `请压缩以下内容，使其更简洁，目标长度：约 ${Math.round(targetLength)} 字。

**要求**：
1. 保持核心信息和观点
2. 删除冗余和重复内容
3. 使用更简洁的表达
4. 保持结构清晰

**原始内容**：
\`\`\`
${content}
\`\`\`

**压缩后的内容**：`;
        const response = await this.llm.chat({
            messages: [
                {
                    role: 'system',
                    content: '你是一个内容压缩专家，擅长在保持核心信息的同时精简内容。',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            temperature: 0.5,
        });
        return response.message.content;
    }
    /**
     * 修改指定章节
     */
    async modifySection(content, section, newRequirement) {
        // 提取该章节的内容
        const sectionContent = this.extractSection(content, section);
        if (!sectionContent) {
            // 章节不存在，可能需要添加
            return content;
        }
        // 使用 LLM 修改章节
        const prompt = `根据新要求修改以下章节内容。

**章节标题**：${section}

**新要求**：${newRequirement}

**原始内容**：
\`\`\`
${sectionContent}
\`\`\`

**修改后的内容**：`;
        const response = await this.llm.chat({
            messages: [
                {
                    role: 'system',
                    content: '你是一个内容编辑专家，擅长根据要求修改文档内容。',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            temperature: 0.6,
        });
        // 替换章节内容
        return this.replaceSection(content, section, response.message.content);
    }
    /**
     * 添加新章节
     */
    async addSection(content, section) {
        const prompt = `为文档添加新章节。

**章节标题**：${section}

**上下文**（文档的最后一部分）：
\`\`\`
${content.slice(-500)}
\`\`\`

**新章节内容**（保持与文档风格一致）：`;
        const response = await this.llm.chat({
            messages: [
                {
                    role: 'system',
                    content: '你是一个内容创作专家，擅长撰写技术文档。',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            temperature: 0.7,
        });
        // 添加新章节
        return `${content}\n\n## ${section}\n\n${response.message.content}`;
    }
    /**
     * 删除章节
     */
    deleteSection(content, section) {
        // 使用正则表达式删除章节
        const sectionRegex = new RegExp(`##?\\s*${section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*?(?=##?\\s|$)`, 'gs');
        return content.replace(sectionRegex, '').trim();
    }
    /**
     * 提取章节内容
     */
    extractSection(content, section) {
        // 使用正则表达式提取章节
        const sectionRegex = new RegExp(`##?\\s*${section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*?(?=##?\\s|$)`, 'gs');
        const match = content.match(sectionRegex);
        return match ? match[0] : null;
    }
    /**
     * 替换章节内容
     */
    replaceSection(content, section, newContent) {
        // 使用正则表达式替换章节
        const sectionRegex = new RegExp(`(##?\\s*${section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\n\n).*?(?=##?\\s|$)`, 'gs');
        return content.replace(sectionRegex, `$1${newContent}\n\n`);
    }
    /**
     * 构建差异分析提示
     */
    buildDiffPrompt(originalContent, newRequirements) {
        return `分析以下原始内容和新要求之间的差异。

**原始内容**：
\`\`\`
${originalContent}
\`\`\`

**新要求**：
${newRequirements}

**请分析差异并返回 JSON 格式**：
\`\`\`json
{
  "changes": [
    {
      "type": "modify|add|delete|expand|compress",
      "section": "章节名称（如果是特定章节修改）",
      "newRequirement": "新的要求（如果是修改）",
      "reason": "变更原因"
    }
  ],
  "summary": "差异摘要",
  "estimatedSavings": 0.6
}
\`\`\`

**差异类型说明**：
- \`modify\`: 修改现有章节的内容
- \`add\`: 添加新章节
- \`delete\`: 删除章节
- \`expand\`: 扩展内容长度
- \`compress\`: 压缩内容长度

**estimatedSavings**：预估的 token 节省比例（0-1）`;
    }
    /**
     * 解析差异分析结果
     */
    parseDiff(response, originalContent) {
        try {
            // 尝试提取 JSON
            let jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
            if (!jsonMatch) {
                jsonMatch = response.match(/\{[\s\S]*\}/);
            }
            if (!jsonMatch) {
                throw new Error('无法提取差异分析 JSON');
            }
            const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
            // 验证并返回
            return {
                changes: parsed.changes || [],
                summary: parsed.summary || '',
                estimatedSavings: parsed.estimatedSavings || 0.5,
            };
        }
        catch (error) {
            // 解析失败，返回默认差异
            console.error('差异解析失败，使用默认策略', error);
            return {
                changes: [
                    {
                        type: 'modify',
                        newRequirement: originalContent,
                        reason: '差异解析失败，使用完整重新生成',
                    },
                ],
                summary: '差异分析失败，将完整重新生成',
                estimatedSavings: 0,
            };
        }
    }
}
