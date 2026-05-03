/**
 * PatentCore TypeScript 降级实现
 *
 * 当 Rust CLI 不可用时使用的 TypeScript 实现版本
 * 提供基础的功能，虽然不如 Rust 版本高效和精确，但足够应付 MVP 阶段
 */
/**
 * TypeScript 降级版本：提取技术特征
 * 使用正则表达式和规则提取，不如 Rust 版本精确
 */
export async function extractFeaturesFallback(text) {
    const features = [];
    const problem_feature_effects = [];
    // 简单的正则表达式提取（实际项目中应使用更复杂的NLP）
    const lines = text.split('\n');
    let currentFeature = null;
    for (const line of lines) {
        // 提取特征（简单模式）
        const featureMatch = line.match(/(?:特征|包括|包含|设置有)[：:]\s*(.+)/);
        if (featureMatch) {
            if (currentFeature) {
                features.push({
                    id: `feature-${features.length}`,
                    description: currentFeature.description || '',
                    feature_type: 'Essential',
                    category: 'Other',
                    component: null,
                    function: null,
                });
            }
            currentFeature = {
                description: featureMatch[1],
            };
        }
        // 提取技术问题
        const problemMatch = line.match(/(?:技术问题|现有技术缺陷|不足)[：:]\s*(.+)/);
        if (problemMatch) {
            problem_feature_effects.push({
                id: `pfe-${problem_feature_effects.length}`,
                technical_problem: problemMatch[1],
                technical_features: [],
                technical_effects: [],
            });
        }
        // 提取技术效果
        const effectMatch = line.match(/(?:技术效果|有益效果|优点)[：:]\s*(.+)/);
        if (effectMatch && problem_feature_effects.length > 0) {
            problem_feature_effects[problem_feature_effects.length - 1].technical_effects.push(effectMatch[1]);
        }
    }
    // 添加最后一个特征
    if (currentFeature) {
        features.push({
            id: `feature-${features.length}`,
            description: currentFeature.description || '',
            feature_type: 'Essential',
            category: 'Other',
            component: null,
            function: null,
        });
    }
    return {
        features,
        problem_feature_effects,
        fallback: true,
    };
}
/**
 * TypeScript 降级版本：解析交底书结构
 * 使用规则和正则表达式，不如 Rust 版本精确
 */
export async function parseDisclosureFallback(text) {
    const sections = {};
    let title = '未命名发明';
    const lines = text.split('\n');
    let currentSection = 'introduction';
    let currentContent = [];
    // 提取标题
    const titleMatch = text.match(/(?:发明名称|技术名称|标题)[：:]\s*(.+)/);
    if (titleMatch) {
        title = titleMatch[1].trim();
    }
    else {
        // 使用第一行作为标题
        const firstLine = lines[0]?.trim();
        if (firstLine && firstLine.length < 50) {
            title = firstLine;
        }
    }
    // 解析各个章节
    for (const line of lines) {
        // 检测章节标题（简单模式）
        const sectionMatch = line.match(/^(?:#{1,3}\s+)?(技术领域|背景技术|发明内容|具体实施方式|附图说明)/);
        if (sectionMatch) {
            // 保存上一个章节
            if (currentContent.length > 0) {
                sections[currentSection] = currentContent.join('\n').trim();
            }
            // 开始新章节
            currentSection = sectionMatch[1];
            currentContent = [];
        }
        else {
            currentContent.push(line);
        }
    }
    // 保存最后一个章节
    if (currentContent.length > 0) {
        sections[currentSection] = currentContent.join('\n').trim();
    }
    // 如果没有识别到章节，将整个文本作为introduction
    if (Object.keys(sections).length === 0) {
        sections.introduction = text;
    }
    return {
        title,
        sections,
        confidence: 0.7, // TypeScript 降级版本的置信度较低
        fallback: true,
    };
}
/**
 * TypeScript 降级版本：生成权利要求
 * 使用模板生成，不如 Rust 版本智能
 */
export async function generateClaimsFallback(title, solution, inventionType = 'product') {
    const claims = [];
    // 生成独立权利要求（简化版）
    const independentClaim = {
        id: 'claim-1',
        claim_type: 'Independent',
        preamble: inventionType === 'method' ? '一种' : '一种',
        transitional_phrase: inventionType === 'method' ? '其特征在于，包括以下步骤：' : '其特征在于，包括：',
        elements: [
            // 简单地按句子分割solution
            ...solution
                .split(/[。；;]/)
                .filter((s) => s.trim().length > 0)
                .slice(0, 5),
        ],
        dependent_on: null,
    };
    claims.push(independentClaim);
    // 生成从属权利要求（简化版）
    if (independentClaim.elements.length > 1) {
        claims.push({
            id: 'claim-2',
            claim_type: 'Dependent',
            preamble: '根据权利要求1所述的',
            transitional_phrase: '其特征在于，',
            elements: [independentClaim.elements[0]],
            dependent_on: 'claim-1',
        });
    }
    // 渲染权利要求文本
    const rendered = claims.map((claim, index) => {
        let text = `${index + 1}. ${claim.preamble}`;
        if (claim.claim_type === 'Dependent') {
            text += claim.dependent_on ? ` ${claim.dependent_on}` : '';
        }
        text += `，${claim.transitional_phrase}\n`;
        text += claim.elements
            .map((el, i) => {
            const prefix = claim.claim_type === 'Independent' && i === 0 ? '' : '  ';
            return `${prefix}${i + 1}. ${el}`;
        })
            .join('；\n');
        return text;
    });
    return {
        claims,
        rendered,
        fallback: true,
    };
}
/**
 * 检查 CLI 结果是否为 fallback
 */
export function isFallbackResult(result) {
    return result && typeof result === 'object' && 'fallback' in result && result.fallback === true;
}
/**
 * IPC 分类 Fallback 实现
 * 导出自 IpcClassifierFallback.ts
 */
export { classifyIpcFallback } from './IpcClassifierFallback.js';
