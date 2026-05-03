/**
 * 公共错误处理器
 *
 * 为Agent系统提供统一的错误处理模式
 */
import { OAResponderError } from './errors.js';
/**
 * 带错误处理的异步操作执行器
 *
 * @param operation - 要执行的操作
 * @param context - 操作上下文描述
 * @param logger - 日志记录器
 * @param options - 错误处理选项
 * @returns 操作结果或抛出错误
 *
 * @example
 * ```typescript
 * const result = await withErrorHandling(
 *   () => fetchApiData(),
 *   '获取API数据',
 *   logger,
 *   { throwOnError: true }
 * )
 * ```
 */
export async function withErrorHandling(operation, context, logger, options = {}) {
    const { logError = true, throwOnError = true, defaultErrorMessage = `${context} 失败`, errorTransformer, metadata = {}, } = options;
    try {
        return await operation();
    }
    catch (error) {
        const errorObj = error;
        // 记录错误日志
        if (logError) {
            logger.error(defaultErrorMessage, errorObj, {
                operation: context,
                ...metadata,
            });
        }
        // 转换错误
        const finalError = errorTransformer
            ? errorTransformer(errorObj)
            : new OAResponderError(defaultErrorMessage, 'OPERATION_FAILED', metadata, errorObj);
        // 抛出或返回错误
        if (throwOnError) {
            throw finalError;
        }
        throw errorObj;
    }
}
/**
 * 带错误处理和默认值的异步操作执行器
 *
 * @param operation - 要执行的操作
 * @param defaultValue - 操作失败时的默认值
 * @param context - 操作上下文描述
 * @param logger - 日志记录器
 * @param options - 错误处理选项
 * @returns 操作结果或默认值
 *
 * @example
 * ```typescript
 * const data = await withErrorHandlingOrDefault(
 *   () => fetchApiData(),
 *   null,
 *   '获取API数据',
 *   logger
 * )
 * ```
 */
export async function withErrorHandlingOrDefault(operation, defaultValue, context, logger, options = {}) {
    try {
        return await operation();
    }
    catch (error) {
        const { logError = true, defaultErrorMessage = `${context} 失败，使用默认值`, metadata = {}, } = options;
        if (logError) {
            logger.warn(defaultErrorMessage, {
                operation: context,
                usingDefaultValue: true,
                ...metadata,
            });
        }
        return defaultValue;
    }
}
/**
 * 带错误处理的操作结果返回器
 *
 * 不抛出错误，而是返回一个包含成功/失败状态的结果对象
 *
 * @param operation - 要执行的操作
 * @param context - 操作上下文描述
 * @param logger - 日志记录器
 * @param options - 错误处理选项
 * @returns 操作结果对象
 *
 * @example
 * ```typescript
 * const result = await withErrorHandlingResult(
 *   () => fetchApiData(),
 *   '获取API数据',
 *   logger
 * )
 *
 * if (result.success) {
 *   console.log(result.data)
 * } else {
 *   console.error(result.error)
 * }
 * ```
 */
export async function withErrorHandlingResult(operation, context, logger, options = {}) {
    try {
        const data = await operation();
        return { success: true, data };
    }
    catch (error) {
        const { logError = true, defaultErrorMessage = `${context} 失败`, metadata = {} } = options;
        if (logError) {
            logger.error(defaultErrorMessage, error, {
                operation: context,
                ...metadata,
            });
        }
        return { success: false, error: error };
    }
}
/**
 * 重试执行器
 *
 * 在操作失败时自动重试
 *
 * @param operation - 要执行的操作
 * @param context - 操作上下文描述
 * @param logger - 日志记录器
 * @param options - 重试选项
 * @returns 操作结果
 *
 * @example
 * ```typescript
 * const data = await withRetry(
 *   () => fetchApiData(),
 *   '获取API数据',
 *   logger,
 *   { maxRetries: 3, delayMs: 1000 }
 * )
 * ```
 */
export async function withRetry(operation, context, logger, options = {}) {
    const { maxRetries = 3, delayMs = 1000, backoffMultiplier = 2, shouldRetry = () => true, ...errorOptions } = options;
    let lastError;
    let delay = delayMs;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        }
        catch (error) {
            lastError = error;
            // 最后一次尝试失败，不再重试
            if (attempt === maxRetries) {
                break;
            }
            // 检查是否应该重试
            if (!shouldRetry(lastError)) {
                break;
            }
            // 记录重试信息
            logger.warn(`${context} 失败，${delay}ms后重试 (${attempt + 1}/${maxRetries})`, {
                operation: context,
                attempt: attempt + 1,
                maxRetries,
                error: lastError.message,
            });
            // 等待后重试
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay *= backoffMultiplier;
        }
    }
    // 所有重试都失败
    const defaultErrorMessage = errorOptions.defaultErrorMessage || `${context} 失败（已重试${maxRetries}次）`;
    if (errorOptions.logError !== false) {
        logger.error(defaultErrorMessage, lastError, {
            operation: context,
            totalAttempts: maxRetries + 1,
            ...errorOptions.metadata,
        });
    }
    if (errorOptions.throwOnError !== false) {
        throw lastError || new Error(defaultErrorMessage);
    }
    throw lastError || new Error(defaultErrorMessage);
}
/**
 * 批量操作处理器
 *
 * 并行执行多个操作，收集所有成功和失败的结果
 *
 * @param operations - 操作数组
 * @param context - 操作上下文描述
 * @param logger - 日志记录器
 * @returns 批量操作结果
 *
 * @example
 * ```typescript
 * const results = await withBatchErrorHandling(
 *   [() => fetchItem(1), () => fetchItem(2), () => fetchItem(3)],
 *   '批量获取项目',
 *   logger
 * )
 *
 * console.log(`成功: ${results.successful.length}, 失败: ${results.failed.length}`)
 * ```
 */
export async function withBatchErrorHandling(operations, context, logger, options = {}) {
    const { concurrent = 10, logError = true, defaultErrorMessage = `${context} 失败`, metadata = {}, } = options;
    const successful = [];
    const failed = [];
    // 分批处理操作
    for (let i = 0; i < operations.length; i += concurrent) {
        const batch = operations.slice(i, i + concurrent);
        const results = await Promise.allSettled(batch.map(async (operation, batchIndex) => {
            const index = i + batchIndex;
            try {
                const data = await operation();
                return { index, data };
            }
            catch (error) {
                if (logError) {
                    logger.error(defaultErrorMessage, error, {
                        operation: context,
                        itemIndex: index,
                        ...metadata,
                    });
                }
                return { index, error: error };
            }
        }));
        for (const result of results) {
            if (result.status === 'fulfilled') {
                if ('error' in result.value) {
                    failed.push({ index: result.value.index, error: result.value.error });
                }
                else {
                    successful.push({ index: result.value.index, data: result.value.data });
                }
            }
            else {
                failed.push({ index: 0, error: result.reason });
            }
        }
    }
    return { successful, failed };
}
/**
 * 超时执行器
 *
 * 为操作添加超时限制
 *
 * @param operation - 要执行的操作
 * @param timeoutMs - 超时时间（毫秒）
 * @param context - 操作上下文描述
 * @param logger - 日志记录器
 * @returns 操作结果
 *
 * @example
 * ```typescript
 * const data = await withTimeout(
 *   () => fetchApiData(),
 *   5000,
 *   '获取API数据',
 *   logger
 * )
 * ```
 */
export async function withTimeout(operation, timeoutMs, context, logger, options = {}) {
    return Promise.race([
        operation(),
        new Promise((_, reject) => setTimeout(() => {
            const timeoutError = new Error(`${context} 超时（${timeoutMs}ms）`);
            timeoutError.name = 'TimeoutError';
            if (options.logError !== false) {
                logger.error(timeoutError.message, timeoutError, {
                    operation: context,
                    timeoutMs,
                    ...options.metadata,
                });
            }
            reject(timeoutError);
        }, timeoutMs)),
    ]);
}
/**
 * 创建错误处理装饰器
 *
 * 用于包装类方法，自动添加错误处理
 *
 * @param context - 操作上下文描述
 * @param options - 错误处理选项
 * @returns 装饰器函数
 *
 * @example
 * ```typescript
 * class MyAgent {
 *   @withErrorHandlingDecorator('获取数据', { throwOnError: true })
 *   async fetchData() {
 *     return await fetchApiData()
 *   }
 * }
 * ```
 */
export function withErrorHandlingDecorator(context, options = {}) {
    return function (_target, _propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args) {
            const logger = this.logger;
            if (!logger) {
                console.warn(`[withErrorHandlingDecorator] 方法 ${context} 缺少logger实例`);
                return originalMethod.apply(this, args);
            }
            try {
                return await originalMethod.apply(this, args);
            }
            catch (error) {
                const errorObj = error;
                const { logError = true, throwOnError = true, defaultErrorMessage = `${context} 失败`, metadata = {}, } = options;
                if (logError) {
                    logger.error(defaultErrorMessage, errorObj, {
                        operation: context,
                        ...metadata,
                    });
                }
                if (throwOnError) {
                    throw errorObj;
                }
                throw error;
            }
        };
        return descriptor;
    };
}
