/**
 * 自定义错误类层次结构
 *
 * 为审查答复智能体系统提供结构化的错误处理
 */
/**
 * OA 答复系统基础错误类
 */
export class OAResponderError extends Error {
    code;
    context;
    cause;
    constructor(message, code, context, cause) {
        super(message);
        this.code = code;
        this.context = context;
        this.cause = cause;
        this.name = 'OAResponderError';
        // 维护正确的堆栈跟踪（仅在 V8 引擎中可用）
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, OAResponderError);
        }
    }
    /**
     * 获取完整的错误信息
     */
    getFullMessage() {
        let msg = `[${this.code}] ${this.message}`;
        if (this.context) {
            msg += `\n上下文: ${JSON.stringify(this.context, null, 2)}`;
        }
        if (this.cause) {
            msg += `\n原因: ${this.cause.message}`;
        }
        return msg;
    }
    /**
     * 转换为可序列化的对象
     */
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            context: this.context,
            cause: this.cause ? {
                name: this.cause.name,
                message: this.cause.message,
            } : undefined,
            stack: this.stack,
        };
    }
}
/**
 * 审查员模拟器错误
 */
export class ExaminerSimulatorError extends OAResponderError {
    constructor(message, context, cause) {
        super(message, 'EXAMINER_SIMULATOR_ERROR', context, cause);
        this.name = 'ExaminerSimulatorError';
    }
}
/**
 * 成功率预测器错误
 */
export class SuccessPredictorError extends OAResponderError {
    constructor(message, context, cause) {
        super(message, 'SUCCESS_PREDICTOR_ERROR', context, cause);
        this.name = 'SuccessPredictorError';
    }
}
/**
 * 赫布学习优化器错误
 */
export class HebbianOptimizerError extends OAResponderError {
    constructor(message, context, cause) {
        super(message, 'HEBBIAN_OPTIMIZER_ERROR', context, cause);
        this.name = 'HebbianOptimizerError';
    }
}
/**
 * 交互式工作流错误
 */
export class WorkflowError extends OAResponderError {
    constructor(message, context, cause) {
        super(message, 'WORKFLOW_ERROR', context, cause);
        this.name = 'WorkflowError';
    }
}
/**
 * 验证错误
 */
export class ValidationError extends OAResponderError {
    fieldName;
    fieldValue;
    constructor(message, fieldName, fieldValue, context) {
        super(message, 'VALIDATION_ERROR', {
            ...context,
            fieldName,
            fieldValue,
        });
        this.fieldName = fieldName;
        this.fieldValue = fieldValue;
        this.name = 'ValidationError';
    }
}
/**
 * 配置错误
 */
export class ConfigurationError extends OAResponderError {
    constructor(message, context, cause) {
        super(message, 'CONFIGURATION_ERROR', context, cause);
        this.name = 'ConfigurationError';
    }
}
/**
 * LLM 调用错误
 */
export class LLMInvokeError extends OAResponderError {
    llmType;
    prompt;
    constructor(message, llmType, prompt, context, cause) {
        super(message, 'LLM_INVOKE_ERROR', {
            ...context,
            llmType,
            promptLength: prompt.length,
        }, cause);
        this.llmType = llmType;
        this.prompt = prompt;
        this.name = 'LLMInvokeError';
    }
}
/**
 * 数据存储错误
 */
export class StorageError extends OAResponderError {
    operation;
    path;
    constructor(message, operation, path, context, cause) {
        super(message, 'STORAGE_ERROR', {
            ...context,
            operation,
            path,
        }, cause);
        this.operation = operation;
        this.path = path;
        this.name = 'StorageError';
    }
}
/**
 * 错误码枚举
 */
export var ErrorCode;
(function (ErrorCode) {
    // 通用错误 (1000-1999)
    ErrorCode["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
    ErrorCode["INTERNAL_ERROR"] = "INTERNAL_ERROR";
    ErrorCode["NOT_IMPLEMENTED"] = "NOT_IMPLEMENTED";
    // 验证错误 (2000-2999)
    ErrorCode["INVALID_INPUT"] = "INVALID_INPUT";
    ErrorCode["MISSING_REQUIRED_FIELD"] = "MISSING_REQUIRED_FIELD";
    ErrorCode["INVALID_TYPE"] = "INVALID_TYPE";
    ErrorCode["OUT_OF_RANGE"] = "OUT_OF_RANGE";
    ErrorCode["EMPTY_VALUE"] = "EMPTY_VALUE";
    // LLM 相关错误 (3000-3999)
    ErrorCode["LLM_CALL_FAILED"] = "LLM_CALL_FAILED";
    ErrorCode["LLM_PARSE_ERROR"] = "LLM_PARSE_ERROR";
    ErrorCode["LLM_TIMEOUT"] = "LLM_TIMEOUT";
    ErrorCode["LLM_RATE_LIMIT"] = "LLM_RATE_LIMIT";
    ErrorCode["LLM_TOKEN_LIMIT"] = "LLM_TOKEN_LIMIT";
    // 数据错误 (4000-4999)
    ErrorCode["DATA_NOT_FOUND"] = "DATA_NOT_FOUND";
    ErrorCode["DATA_CORRUPTED"] = "DATA_CORRUPTED";
    ErrorCode["STORAGE_ERROR"] = "STORAGE_ERROR";
    // 业务逻辑错误 (5000-5999)
    ErrorCode["INVALID_STATE"] = "INVALID_STATE";
    ErrorCode["OPERATION_FAILED"] = "OPERATION_FAILED";
    ErrorCode["RESOURCE_EXHAUSTED"] = "RESOURCE_EXHAUSTED";
})(ErrorCode || (ErrorCode = {}));
/**
 * 错误工具函数
 */
/**
 * 检查是否为 OA 答复系统错误
 */
export function isOAResponderError(error) {
    return error instanceof OAResponderError;
}
/**
 * 检查是否为验证错误
 */
export function isValidationError(error) {
    return error instanceof ValidationError;
}
/**
 * 检查是否为 LLM 调用错误
 */
export function isLLMInvokeError(error) {
    return error instanceof LLMInvokeError;
}
/**
 * 格式化错误信息用于日志
 */
export function formatErrorForLogging(error) {
    if (isOAResponderError(error)) {
        return error.getFullMessage();
    }
    return `${error.name}: ${error.message}\n${error.stack}`;
}
/**
 * 包装异步函数以捕获和转换错误
 */
export function wrapError(fn, errorClass, context) {
    return (async (...args) => {
        try {
            return await fn(...args);
        }
        catch (error) {
            if (isOAResponderError(error)) {
                throw error;
            }
            throw new errorClass(error.message, context, error);
        }
    });
}
/**
 * 创建错误恢复器
 */
export class ErrorRecovery {
    recoveryStrategies = new Map();
    /**
     * 注册恢复策略
     */
    register(errorCode, strategy) {
        this.recoveryStrategies.set(errorCode, strategy);
    }
    /**
     * 尝试恢复
     */
    async tryRecover(error) {
        if (isOAResponderError(error)) {
            const strategy = this.recoveryStrategies.get(error.code);
            if (strategy) {
                console.log(`[ErrorRecovery] 尝试从错误 ${error.code} 恢复...`);
                return strategy(error);
            }
        }
        // 默认：重新抛出错误
        throw error;
    }
    /**
     * 执行带恢复的操作
     */
    async execute(fn, fallback) {
        try {
            return await fn();
        }
        catch (error) {
            if (fallback) {
                console.warn('[ErrorRecovery] 执行 fallback...');
                return fallback(error);
            }
            // 尝试恢复
            return await this.tryRecover(error);
        }
    }
}
/**
 * 错误上下文收集器
 */
export class ErrorContextCollector {
    context = {};
    /**
     * 添加上下文信息
     */
    add(key, value) {
        this.context[key] = value;
    }
    /**
     * 批量添加上下文
     */
    addMultiple(data) {
        Object.assign(this.context, data);
    }
    /**
     * 获取上下文
     */
    getContext() {
        return { ...this.context };
    }
    /**
     * 清空上下文
     */
    clear() {
        this.context = {};
    }
    /**
     * 使用上下文创建错误
     */
    createError(ErrorClass, message) {
        return new ErrorClass(message, this.getContext());
    }
}
/**
 * 全局错误处理器
 */
export class GlobalErrorHandler {
    static instance;
    errorHandlers = [];
    constructor() { }
    static getInstance() {
        if (!GlobalErrorHandler.instance) {
            GlobalErrorHandler.instance = new GlobalErrorHandler();
        }
        return GlobalErrorHandler.instance;
    }
    /**
     * 注册错误处理器
     */
    registerHandler(handler) {
        this.errorHandlers.push(handler);
    }
    /**
     * 处理错误
     */
    handle(error) {
        console.error('[GlobalErrorHandler] 捕获到错误:', formatErrorForLogging(error));
        // 通知所有处理器
        this.errorHandlers.forEach(handler => {
            try {
                handler(error);
            }
            catch (handlerError) {
                console.error('[GlobalErrorHandler] 处理器执行失败:', handlerError);
            }
        });
    }
    /**
     * 设置全局未捕获异常处理器
     */
    setupGlobalHandlers() {
        if (typeof process !== 'undefined') {
            // Node.js 环境
            process.on('uncaughtException', (error) => {
                this.handle(error);
            });
            process.on('unhandledRejection', (reason, promise) => {
                this.handle(new Error(`Unhandled Promise Rejection: ${reason}`));
            });
        }
        else if (typeof window !== 'undefined') {
            // 浏览器环境
            window.addEventListener('error', (event) => {
                this.handle(event.error);
            });
            window.addEventListener('unhandledrejection', (event) => {
                this.handle(new Error(`Unhandled Promise Rejection: ${event.reason}`));
            });
        }
    }
}
