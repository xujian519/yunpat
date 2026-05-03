/**
 * 专利撰写原则集
 *
 * 定义专利撰写领域的合规原则，用于Constitutional AI检查
 */
import { PrincipleCategory, ViolationSeverity, } from './types.js';
/**
 * 专利撰写原则集
 */
export const PATENT_PRINCIPLES = [
    {
        id: 'clarity',
        name: '清楚性原则',
        description: '权利要求应当清楚、简要地限定保护范围，不得使用模糊不清的表达',
        category: PrincipleCategory.CLARITY,
        priority: 10,
        legalBasis: '《专利法》第二十六条第四款',
        checkFunction: checkClarity,
        examples: {
            compliant: ['一种数据处理装置，包括：处理器，用于执行指令；存储器，耦合到所述处理器。'],
            nonCompliant: ['一种数据处理装置，包括：一些处理部件，用于做一些相关操作。'],
        },
    },
    {
        id: 'brevity',
        name: '简要性原则',
        description: '避免不必要的重复和冗长描述，使用精炼的语言表达技术方案',
        category: PrincipleCategory.BREVITY,
        priority: 7,
        legalBasis: '《专利法》第二十六条第四款',
        checkFunction: checkBrevity,
        examples: {
            compliant: ['所述处理器耦合到所述存储器。'],
            nonCompliant: [
                '所述处理器通过连接线耦合到所述存储器，所述存储器又连接到所述处理器，这种耦合关系使得处理器能够访问存储器。',
            ],
        },
    },
    {
        id: 'support',
        name: '支持性原则',
        description: '权利要求应当得到说明书的支持，不能超出说明书公开的范围',
        category: PrincipleCategory.SUPPORT,
        priority: 10,
        legalBasis: '《专利法》第二十六条第四款',
        checkFunction: checkSupport,
        examples: {
            compliant: ['根据权利要求1所述的装置，其中所述处理器为ARM架构处理器。'],
            nonCompliant: [
                '根据权利要求1所述的装置，其中所述处理器为任意类型的处理器。', // 过于宽泛
            ],
        },
    },
    {
        id: 'completeness',
        name: '完整性原则',
        description: '技术方案应当完整，包含所有必要技术特征，能够解决技术问题',
        category: PrincipleCategory.COMPLETENESS,
        priority: 9,
        legalBasis: '《专利法》第二十六条第三款',
        checkFunction: checkCompleteness,
        examples: {
            compliant: [
                '一种图像处理方法，包括：获取图像数据；对所述图像数据执行滤波操作；输出处理后的图像数据。',
            ],
            nonCompliant: [
                '一种图像处理方法，包括：处理图像。', // 缺少必要技术特征
            ],
        },
    },
    {
        id: 'enablement',
        name: '充分公开原则',
        description: '说明书应当对技术方案作出清楚、完整的说明，使本领域技术人员能够实现',
        category: PrincipleCategory.ENABLEMENT,
        priority: 10,
        legalBasis: '《专利法》第二十六条第三款',
        checkFunction: checkEnablement,
        examples: {
            compliant: ['所述滤波器采用3x3卷积核，卷积核参数为[1,2,1;2,4,2;1,2,1]，步长为1像素。'],
            nonCompliant: [
                '所述滤波器采用适当的参数进行配置。', // 参数不明确
            ],
        },
    },
    {
        id: 'definiteness',
        name: '确定性原则',
        description: '技术特征应当确定，避免使用模糊词汇如"大约"、"左右"、"可能"等',
        category: PrincipleCategory.DEFINITENESS,
        priority: 8,
        legalBasis: '《专利法》第二十六条第四款',
        checkFunction: checkDefiniteness,
        examples: {
            compliant: ['所述处理器的时钟频率为1.5GHz。'],
            nonCompliant: ['所述处理器的时钟频率大约为1.5GHz左右。'],
        },
    },
    {
        id: 'novelty',
        name: '创造性原则',
        description: '技术方案应当具有创造性，与现有技术有区别和突出的实质性特点',
        category: PrincipleCategory.NOVELTY,
        priority: 6,
        legalBasis: '《专利法》第二十二条第三款',
        checkFunction: checkNovelty,
        examples: {
            compliant: ['所述滤波器采用自适应卷积核，根据图像内容动态调整卷积核参数。'],
            nonCompliant: [
                '所述滤波器采用3x3卷积核。', // 常规技术，缺乏创造性
            ],
        },
    },
    {
        id: 'best_mode',
        name: '最佳实施例原则',
        description: '说明书中应当描述发明的最佳实施例，提供最优的技术方案',
        category: PrincipleCategory.BEST_MODE,
        priority: 5,
        legalBasis: '《专利法》第二十六条第三款',
        checkFunction: checkBestMode,
        examples: {
            compliant: [
                '在本发明的优选实施例中，所述滤波器采用双边滤波算法，能够同时保留边缘和降低噪声。',
            ],
            nonCompliant: [
                '所述滤波器可以采用任意滤波算法。', // 没有提供最佳实施例
            ],
        },
    },
];
/**
 * 辅助函数：创建标准违规对象
 */
function createViolation(principleId, principleName, severity, start, end, text, description, suggestedCorrection, confidence, content) {
    const violation = {
        principleId,
        principleName,
        severity,
        location: {
            start,
            end,
            text,
        },
        description,
        suggestedCorrection,
        confidence,
    };
    // 如果提供了内容，添加上下文
    if (content) {
        ;
        violation.location.context = content.substring(Math.max(0, start - 20), Math.min(content.length, end + 20));
    }
    return violation;
}
/**
 * 检查清楚性原则
 */
async function checkClarity(content) {
    const violations = [];
    const warnings = [];
    // 模糊词汇列表
    const vagueTerms = [
        '一些',
        '某些',
        '相关',
        '适当',
        '相应的',
        '一些相关',
        '多个',
        '若干',
        '等',
        '等等',
    ];
    // 检查模糊词汇
    for (const term of vagueTerms) {
        const regex = new RegExp(term, 'g');
        let match;
        while ((match = regex.exec(content)) !== null) {
            violations.push(createViolation('clarity', '清楚性原则', ViolationSeverity.MAJOR, match.index, match.index + term.length, term, `使用了模糊词汇"${term}"，导致保护范围不明确`, '使用具体的技术特征描述替代模糊词汇', 0.8, content));
        }
    }
    // 检查过长的句子（超过100字）
    const sentences = content.split(/[。；！]/);
    for (const sentence of sentences) {
        if (sentence.length > 100) {
            warnings.push({
                principleId: 'clarity',
                principleName: '清楚性原则',
                description: `句子过长（${sentence.length}字），可能影响理解`,
                location: {
                    start: content.indexOf(sentence),
                    end: content.indexOf(sentence) + sentence.length,
                    text: sentence.substring(0, 50) + '...',
                },
                suggestion: '建议将长句拆分为多个短句，提高可读性',
            });
        }
    }
    const score = 1 - (violations.length * 0.15 + warnings.length * 0.05);
    return {
        compliant: violations.length === 0,
        score: Math.max(0, score),
        violations,
        warnings,
    };
}
/**
 * 检查简要性原则
 */
async function checkBrevity(content) {
    const violations = [];
    const warnings = [];
    // 检查重复的词语模式（如"所述处理器...所述处理器...所述处理器"）
    const repeatedPattern = /(\S+)\s+\1+/g;
    let match;
    while ((match = repeatedPattern.exec(content)) !== null) {
        violations.push({
            principleId: 'brevity',
            principleName: '简要性原则',
            severity: ViolationSeverity.MINOR,
            location: {
                start: match.index,
                end: match.index + match[0].length,
                text: match[0],
            },
            description: '存在重复表述',
            suggestedCorrection: '使用代词或省略重复的表述',
            confidence: 0.7,
        });
    }
    // 检查冗余描述（如"通过连接线连接" -> "连接"）
    const redundantPatterns = [
        { pattern: /通过连接线连接/g, suggestion: '连接' },
        { pattern: /进行配置/g, suggestion: '配置' },
        { pattern: /执行操作/g, suggestion: '执行' },
    ];
    for (const { pattern, suggestion } of redundantPatterns) {
        while ((match = pattern.exec(content)) !== null) {
            warnings.push({
                principleId: 'brevity',
                principleName: '简要性原则',
                description: '存在冗余描述',
                location: {
                    start: match.index,
                    end: match.index + match[0].length,
                    text: match[0],
                },
                suggestion: `建议简化为"${suggestion}"`,
            });
        }
    }
    const score = 1 - (violations.length * 0.1 + warnings.length * 0.05);
    return {
        compliant: violations.length === 0,
        score: Math.max(0, score),
        violations,
        warnings,
    };
}
/**
 * 检查支持性原则
 */
async function checkSupport(content) {
    const violations = [];
    const warnings = [];
    // 检查过于宽泛的表述（如"任意类型"、"所有"等）
    const overlyBroadPatterns = [
        { pattern: /任意类型/g, severity: ViolationSeverity.MAJOR },
        { pattern: /所有类型/g, severity: ViolationSeverity.MAJOR },
        { pattern: /任意方式/g, severity: ViolationSeverity.MAJOR },
        { pattern: /等及其组合/g, severity: ViolationSeverity.MINOR },
    ];
    for (const { pattern, severity } of overlyBroadPatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            violations.push(createViolation('support', '支持性原则', severity, match.index, match.index + match[0].length, match[0], '表述过于宽泛，可能得不到说明书支持', '使用具体、明确的技术特征描述', 0.75, content));
        }
    }
    // 检查权利要求引用格式
    const invalidReferencePattern = /根据权利要求\d+/g;
    let match;
    while ((match = invalidReferencePattern.exec(content)) !== null) {
        warnings.push({
            principleId: 'support',
            principleName: '支持性原则',
            description: '权利要求引用格式不规范',
            location: {
                start: match.index,
                end: match.index + match[0].length,
                text: match[0],
            },
            suggestion: '建议使用"根据权利要求1所述的..."格式',
        });
    }
    const score = 1 - (violations.length * 0.15 + warnings.length * 0.05);
    return {
        compliant: violations.length === 0,
        score: Math.max(0, score),
        violations,
        warnings,
    };
}
/**
 * 检查完整性原则
 */
async function checkCompleteness(content) {
    const violations = [];
    const warnings = [];
    // 检查是否包含必要的技术特征
    // 对于方法权利要求，检查是否包含"包括"或"包含"
    const hasMethodClaim = /一种.*方法/i.test(content);
    if (hasMethodClaim) {
        const hasIncluding = /包括|包含/i.test(content);
        if (!hasIncluding) {
            violations.push(createViolation('completeness', '完整性原则', ViolationSeverity.CRITICAL, 0, Math.min(50, content.length), content.substring(0, Math.min(50, content.length)), '方法权利要求缺少步骤描述词"包括"或"包含"', '在技术方案描述中添加"包括："或"包含："', 0.9, content));
        }
    }
    // 检查装置权利要求是否包含"包括"
    const hasDeviceClaim = /一种.*装置|设备|系统/i.test(content);
    if (hasDeviceClaim) {
        const hasIncluding = /包括|包含|由.*组成/i.test(content);
        if (!hasIncluding) {
            violations.push(createViolation('completeness', '完整性原则', ViolationSeverity.CRITICAL, 0, Math.min(50, content.length), content.substring(0, Math.min(50, content.length)), '装置权利要求缺少组件描述词"包括"或"包含"', '在技术方案描述中添加"包括："或"包含："', 0.9, content));
        }
    }
    // 检查步骤/组件数量（过少可能不完整）
    const steps = content.match(/；|；/g);
    if (steps && steps.length < 2) {
        warnings.push({
            principleId: 'completeness',
            principleName: '完整性原则',
            description: '技术方案步骤/组件数量较少，可能不够完整',
            suggestion: '建议补充更多必要的技术特征',
        });
    }
    const score = 1 - (violations.length * 0.2 + warnings.length * 0.05);
    return {
        compliant: violations.length === 0,
        score: Math.max(0, score),
        violations,
        warnings,
    };
}
/**
 * 检查充分公开原则
 */
async function checkEnablement(content) {
    const violations = [];
    const warnings = [];
    // 检查是否有未公开的参数（如"适当参数"、"合适参数"等）
    const undisclosedParams = [/适当参数/g, /合适参数/g, /预定参数/g, /相应的参数/g];
    for (const pattern of undisclosedParams) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            violations.push(createViolation('enablement', '充分公开原则', ViolationSeverity.MAJOR, match.index, match.index + match[0].length, match[0], '技术参数未充分公开', '提供具体的参数值或参数范围', 0.85, content));
        }
    }
    // 检查功能性描述（可能缺乏具体实现）
    const functionalDescriptions = [/能够实现.*功能/g, /用于实现/g, /配置为.*$/g];
    for (const pattern of functionalDescriptions) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            warnings.push({
                principleId: 'enablement',
                principleName: '充分公开原则',
                description: '存在功能性描述，建议补充具体实现方式',
                location: {
                    start: match.index,
                    end: match.index + match[0].length,
                    text: match[0],
                },
                suggestion: '提供具体的实现细节，如算法、参数、结构等',
            });
        }
    }
    const score = 1 - (violations.length * 0.15 + warnings.length * 0.05);
    return {
        compliant: violations.length === 0,
        score: Math.max(0, score),
        violations,
        warnings,
    };
}
/**
 * 检查确定性原则
 */
async function checkDefiniteness(content) {
    const violations = [];
    const warnings = [];
    // 检查不确定词汇（按长度排序，先匹配长的词汇）
    const indefiniteTerms = [
        { term: '大约', severity: ViolationSeverity.MAJOR },
        { term: '左右', severity: ViolationSeverity.MAJOR },
        { term: '大概', severity: ViolationSeverity.MAJOR },
        { term: '可能', severity: ViolationSeverity.MINOR },
        { term: '可以', severity: ViolationSeverity.MINOR },
    ];
    // 记录已覆盖的位置，避免重复检测
    const coveredRanges = new Array(content.length).fill(false);
    for (const { term, severity } of indefiniteTerms) {
        const regex = new RegExp(term, 'g');
        let match;
        while ((match = regex.exec(content)) !== null) {
            // 检查这个范围是否已被覆盖
            const isCovered = coveredRanges
                .slice(match.index, match.index + term.length)
                .some((covered) => covered);
            if (!isCovered) {
                violations.push(createViolation('definiteness', '确定性原则', severity, match.index, match.index + term.length, term, `使用了不确定词汇"${term}"`, '使用确定的数值或范围', 0.8, content));
                // 标记这个范围已覆盖
                for (let i = match.index; i < match.index + term.length; i++) {
                    coveredRanges[i] = true;
                }
            }
        }
    }
    // 检查数值范围是否明确
    const rangePattern = /\d+[-~]\d+/g;
    let match;
    while ((match = rangePattern.exec(content)) !== null) {
        // 检查是否使用了"-"或"~"（不够规范）
        if (match[0].includes('-') || match[0].includes('~')) {
            warnings.push({
                principleId: 'definiteness',
                principleName: '确定性原则',
                description: '数值范围表示不够规范',
                location: {
                    start: match.index,
                    end: match.index + match[0].length,
                    text: match[0],
                },
                suggestion: '建议使用"至"或"～"表示范围，如"10至20"',
            });
        }
    }
    const score = 1 - (violations.length * 0.15 + warnings.length * 0.05);
    return {
        compliant: violations.length === 0,
        score: Math.max(0, score),
        violations,
        warnings,
    };
}
/**
 * 检查创造性原则
 */
async function checkNovelty(content) {
    const violations = [];
    const warnings = [];
    // 检查常规技术描述（如"常规的"、"标准的"等）
    const conventionalTech = [/常规的/g, /标准的/g, /已知的/g, /现有的/g];
    for (const pattern of conventionalTech) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            warnings.push({
                principleId: 'novelty',
                principleName: '创造性原则',
                description: '技术方案包含常规技术描述，建议强调创新点',
                location: {
                    start: match.index,
                    end: match.index + match[0].length,
                    text: match[0],
                },
                suggestion: '明确指出本发明的独特之处和技术贡献',
            });
        }
    }
    // 检查是否有技术效果描述
    const hasTechnicalEffect = /能够实现|有益效果|技术优势|优点|创新/i.test(content);
    if (!hasTechnicalEffect) {
        warnings.push({
            principleId: 'novelty',
            principleName: '创造性原则',
            description: '缺少技术效果描述',
            suggestion: '建议补充本发明的有益效果和技术优势',
        });
    }
    const score = 1 - warnings.length * 0.1;
    return {
        compliant: violations.length === 0,
        score: Math.max(0, score),
        violations,
        warnings,
    };
}
/**
 * 检查最佳实施例原则
 */
async function checkBestMode(content) {
    const violations = [];
    const warnings = [];
    // 检查是否有"优选实施例"或"最佳实施例"描述
    const hasBestMode = /优选实施例|最佳实施例|优选的|在本发明的实施例中/i.test(content);
    if (!hasBestMode) {
        warnings.push({
            principleId: 'best_mode',
            principleName: '最佳实施例原则',
            description: '缺少最佳实施例描述',
            suggestion: '建议在说明书中描述优选实施例，提供最优技术方案',
        });
    }
    // 检查是否有参数优选描述
    const hasPreferredParams = /优选.*范围|优选.*为|最佳.*为/i.test(content);
    if (!hasPreferredParams) {
        warnings.push({
            principleId: 'best_mode',
            principleName: '最佳实施例原则',
            description: '缺少参数优选描述',
            suggestion: '建议提供关键参数的优选范围或最优值',
        });
    }
    const score = 1 - warnings.length * 0.1;
    return {
        compliant: violations.length === 0,
        score: Math.max(0, score),
        violations,
        warnings,
    };
}
