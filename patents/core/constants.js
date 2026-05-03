/**
 * 审查答复智能体系统常量
 *
 * 集中管理所有魔法值，提高可维护性
 */
// ============================================
// LLM 相关常量
// ============================================
export const LLM_CONSTANTS = {
    /** 默认温度 */
    DEFAULT_TEMPERATURE: 0.3,
    /** 最大提示词长度 */
    MAX_PROMPT_LENGTH: 8000,
    /** 最大重试次数 */
    MAX_RETRY_ATTEMPTS: 3,
    /** 初始重试延迟（毫秒） */
    INITIAL_RETRY_DELAY: 1000,
    /** 最大重试延迟（毫秒） */
    MAX_RETRY_DELAY: 10000,
    /** 重试退避倍数 */
    RETRY_BACKOFF_MULTIPLIER: 2,
    /** 默认超时时间（毫秒） */
    DEFAULT_TIMEOUT: 30000,
};
// ============================================
// 审查员模拟器常量
// ============================================
export const EXAMINER_CONSTANTS = {
    /** 基础接受概率 */
    BASE_ACCEPT_PROBABILITY: 50,
    /** 策略有效性权重 */
    STRATEGY_EFFECTIVENESS_WEIGHT: 0.4,
    /** 修改质量权重 */
    AMENDMENT_QUALITY_WEIGHT: 0.3,
    /** 潜在问题扣分权重 */
    REJECTION_PENALTY_WEIGHT: 0.3,
    /** 高严重程度驳回扣分 */
    HIGH_SEVERITY_PENALTY: 15,
    /** 中严重程度驳回扣分 */
    MEDIUM_SEVERITY_PENALTY: 8,
    /** 默认策略有效性评分 */
    DEFAULT_EFFECTIVENESS_SCORE: 70,
    /** 默认修改质量评分 */
    DEFAULT_QUALITY_SCORE: 75,
    /** 默认接受概率 */
    DEFAULT_ACCEPT_PROBABILITY: 60,
    /** 最大接受概率 */
    MAX_ACCEPT_PROBABILITY: 95,
    /** 最小接受概率 */
    MIN_ACCEPT_PROBABILITY: 10,
    /** 严格程度调整系数 */
    STRICTNESS_ADJUSTMENT: 10,
    /** 保守模式扣分 */
    CONSERVATIVE_MODE_PENALTY: 5,
    /** 最多返回的驳回理由数量 */
    MAX_REJECTIONS: 5,
    /** 最多返回的建议数量 */
    MAX_SUGGESTIONS: 8,
};
// ============================================
// 成功率预测器常量
// ============================================
export const PREDICTOR_CONSTANTS = {
    /** 基准成功率（来自行业数据） */
    BASELINE_SUCCESS_RATES: {
        NOVELTY: 45, // 新颖性问题
        INVENTIVE_STEP: 35, // 创造性问题
        CLARITY: 65, // 清楚性问题
        SUPPORT: 55, // 支持性问题
        FORMALITY: 85, // 形式问题
    },
    /** 规则预测权重 */
    RULE_WEIGHT: 0.3,
    /** 案例预测权重 */
    CASE_WEIGHT: 0.4,
    /** LLM 预测权重 */
    LLM_WEIGHT: 0.3,
    /** 基础概率 */
    BASE_PROBABILITY: 50,
    /** 最小概率 */
    MIN_PROBABILITY: 10,
    /** 最大概率 */
    MAX_PROBABILITY: 95,
    /** 默认保守程度 */
    DEFAULT_CONSERVATISM: 0.5,
    /** 基础方差（置信区间） */
    BASE_VARIANCE: 15,
    /** 最小方差 */
    MIN_VARIANCE: 5,
    /** 最大方差 */
    MAX_VARIANCE: 25,
    /** 默认参数数量 */
    DEFAULT_ARGUMENTS_COUNT: 3,
    /** 默认修改数量 */
    DEFAULT_AMENDMENT_COUNT: 5,
    /** 高成功率阈值 */
    HIGH_SUCCESS_THRESHOLD: 70,
    /** 中等成功率阈值 */
    MEDIUM_SUCCESS_THRESHOLD: 50,
    /** 高质量分数阈值 */
    HIGH_QUALITY_THRESHOLD: 80,
    /** 低质量分数阈值 */
    LOW_QUALITY_THRESHOLD: 60,
    /** 高置信度阈值 */
    HIGH_CONFIDENCE_THRESHOLD: 0.6,
    /** 最大相似案例数量 */
    MAX_SIMILAR_CASES: 5,
    /** 特征重叠最小比例 */
    MIN_FEATURE_OVERLAP_RATIO: 0.5,
};
// ============================================
// 赫布学习优化器常量
// ============================================
export const HEBBIAN_CONSTANTS = {
    /** 默认学习率 */
    DEFAULT_LEARNING_RATE: 0.1,
    /** 默认遗忘因子 */
    DEFAULT_FORGETTING_FACTOR: 0.05,
    /** 默认激活阈值 */
    DEFAULT_ACTIVATION_THRESHOLD: 0.3,
    /** 初始激活水平 */
    INITIAL_ACTIVATION_LEVEL: 0.5,
    /** 突触权重初始最大值 */
    INITIAL_SYNAPSE_WEIGHT_MAX: 0.2,
    /** 成功激活增强系数 */
    SUCCESS_ACTIVATION_BOOST: 0.3,
    /** 失败激活减弱系数 */
    FAILURE_ACTIVATION_REDUCTION: 0.2,
    /** 突触权重调整系数 */
    SYNAPSE_WEIGHT_ADJUSTMENT: 0.5,
    /** 基线激活水平 */
    BASELINE_ACTIVATION: 0.5,
    /** 最大激活水平 */
    MAX_ACTIVATION: 1.0,
    /** 最小激活水平 */
    MIN_ACTIVATION: 0.0,
    /** 最大学习案例数量（防止内存泄漏） */
    MAX_LEARNING_CASES: 10000,
    /** 清理触发频率 */
    CLEANUP_FREQUENCY: 1000,
    /** 特征激活缓存大小 */
    FEATURE_ACTIVATION_CACHE_SIZE: 1000,
    /** 特征激活缓存TTL（毫秒） */
    FEATURE_ACTIVATION_CACHE_TTL: 60000, // 1分钟
    /** 批量处理大小 */
    BATCH_PROCESSING_SIZE: 10,
    /** 突触权重计算优化：预计算标志 */
    ENABLE_PRECOMPUTED_WEIGHTS: true,
    /** 内存清理阈值（当案例数超过此值的80%时触发清理） */
    MEMORY_CLEANUP_THRESHOLD: 0.8,
    /** 低价值案例保留时间（毫秒） */
    LOW_VALUE_CASE_RETENTION_TIME: 30 * 24 * 60 * 60 * 1000, // 30天
    /** 常见特征列表 */
    COMMON_FEATURES: [
        'Novelty-low',
        'Novelty-medium',
        'Novelty-high',
        'InventiveStep-low',
        'InventiveStep-medium',
        'InventiveStep-high',
        'Clarity-low',
        'Clarity-medium',
        'Clarity-high',
    ],
    /** 策略类型列表 */
    STRATEGY_TYPES: [
        'AmendClaims',
        'Argue',
        'Hybrid',
        'Withdraw',
    ],
};
// ============================================
// 交互式工作流常量
// ============================================
export const WORKFLOW_CONSTANTS = {
    /** 默认最大反馈轮数 */
    DEFAULT_MAX_FEEDBACK_ROUNDS: 3,
    /** 默认超时时间（毫秒） */
    DEFAULT_TIMEOUT: 300000, // 5分钟
    /** 最小超时时间（毫秒） */
    MIN_TIMEOUT: 60000, // 1分钟
    /** 最大超时时间（毫秒） */
    MAX_TIMEOUT: 600000, // 10分钟
    /** 总步骤数 */
    TOTAL_STEPS: 5,
    /** 进度更新间隔（毫秒） */
    PROGRESS_UPDATE_INTERVAL: 1000,
    /** 默认短消息最大长度 */
    SHORT_MESSAGE_MAX_LENGTH: 300,
};
// ============================================
// 验证常量
// ============================================
export const VALIDATION_CONSTANTS = {
    /** 分数最小值 */
    SCORE_MIN: 0,
    /** 分数最大值 */
    SCORE_MAX: 100,
    /** 置信度最小值 */
    CONFIDENCE_MIN: 0.0,
    /** 置信度最大值 */
    CONFIDENCE_MAX: 1.0,
    /** 概率最小值 */
    PROBABILITY_MIN: 0,
    /** 概率最大值 */
    PROBABILITY_MAX: 100,
    /** 字符串最大长度（防止超长输入） */
    MAX_STRING_LENGTH: 100000,
    /** 数组最大长度（防止内存溢出） */
    MAX_ARRAY_LENGTH: 1000,
    /** 申请号格式（正则表达式） */
    APPLICATION_NUMBER_PATTERN: /^[A-Z]{2}\d{12,13}[A-Z]?$/,
    /** 专利名称最大长度 */
    PATENT_TITLE_MAX_LENGTH: 500,
    /** 权利要求最大数量 */
    MAX_CLAIMS_COUNT: 50,
    /** 最小权利要求数量 */
    MIN_CLAIMS_COUNT: 1,
};
// ============================================
// 性能常量
// ============================================
export const PERFORMANCE_CONSTANTS = {
    /** 批量处理最大数量 */
    MAX_BATCH_SIZE: 100,
    /** 并发 LLM 调用最大数量 */
    MAX_CONCURRENT_LLM_CALLS: 5,
    /** 缓存大小限制 */
    CACHE_SIZE_LIMIT: 1000,
    /** 缓存过期时间（毫秒） */
    CACHE_EXPIRY_TIME: 3600000, // 1小时
    /** 性能监控采样率 */
    PERFORMANCE_SAMPLING_RATE: 0.1, // 10%
};
// ============================================
// 存储常量
// ============================================
export const STORAGE_CONSTANTS = {
    /** 默认案例存储路径 */
    DEFAULT_CASE_STORAGE_PATH: './data/hebbian-cases.json',
    /** 日志文件最大大小（字节） */
    MAX_LOG_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    /** 日志文件保留数量 */
    MAX_LOG_FILES: 10,
    /** 备份保留天数 */
    BACKUP_RETENTION_DAYS: 30,
};
// ============================================
// 驳回严重程度评估常量
// ============================================
export const SEVERITY_CONSTANTS = {
    /** 驳回类型基础分 */
    OA_TYPE_BASE_SCORES: {
        NOVELTY: 30,
        INVENTIVE_STEP: 35,
        CLARITY: 15,
        SUPPORT: 20,
        FORMALITY: 10,
    },
    /** 低严重程度阈值 */
    LOW_SEVERITY_THRESHOLD: 30,
    /** 中严重程度阈值 */
    MEDIUM_SEVERITY_THRESHOLD: 50,
    /** 受影响权利要求最大加分 */
    AFFECTED_CLAIMS_MAX_SCORE: 20,
    /** 单个权利要求加分 */
    PER_CLAIM_SCORE: 5,
    /** 引用文献最大加分 */
    CITATIONS_MAX_SCORE: 15,
    /** 单个引用文献加分 */
    PER_CITATION_SCORE: 3,
    /** 审查员论点最大加分 */
    ARGUMENT_MAX_SCORE: 15,
    /** 审查员论点长度除数 */
    ARGUMENT_LENGTH_DIVISOR: 100,
};
// ============================================
// 辅助函数
// ============================================
/**
 * 检查值是否在范围内
 */
export function isInRange(value, min, max) {
    return value >= min && value <= max;
}
/**
 * 将值限制在范围内
 */
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
/**
 * 计算百分比
 */
export function calculatePercentage(value, total) {
    if (total === 0) {
        return 0;
    }
    return (value / total) * 100;
}
/**
 * 格式化百分比
 */
export function formatPercentage(value, decimals = 2) {
    return `${value.toFixed(decimals)}%`;
}
/**
 * 深度冻结对象（防止修改）
 */
export function deepFreeze(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    // 冻结属性
    Object.getOwnPropertyNames(obj).forEach(name => {
        const value = obj[name];
        if (value && typeof value === 'object' && !Object.isFrozen(value)) {
            deepFreeze(value);
        }
    });
    return Object.freeze(obj);
}
/**
 * 从对象中选择特定键
 */
export function pick(obj, keys) {
    const result = {};
    keys.forEach(key => {
        if (key in obj) {
            result[key] = obj[key];
        }
    });
    return result;
}
/**
 * 从对象中排除特定键
 */
export function omit(obj, keys) {
    const result = { ...obj };
    keys.forEach(key => {
        delete result[key];
    });
    return result;
}
