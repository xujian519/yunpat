/**
 * 日志系统
 *
 * 为审查答复智能体系统提供结构化的日志记录功能
 */
import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
/**
 * 日志级别
 */
export var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel || (LogLevel = {}));
/**
 * 日志器类
 */
export class Logger {
    static instance;
    config;
    logBuffer = [];
    flushInterval = null;
    sanitizationConfig = {
        sensitiveFields: [
            'password',
            'passwd',
            'pwd',
            'token',
            'apiKey',
            'api_key',
            'apikey',
            'secret',
            'authorization',
            'auth',
            'sessionId',
            'session_id',
            'cookie',
            'creditCard',
            'ssn',
            'privateKey',
            'private_key',
        ],
        replacementText: '***REDACTED***',
        enableDeepSanitization: false,
    };
    constructor(config = {}) {
        this.config = {
            minLevel: config.minLevel ?? LogLevel.INFO,
            console: config.console ?? true,
            file: config.file ?? false,
            logFilePath: config.logFilePath ?? './logs/app.log',
            colors: config.colors ?? true,
            timestamp: config.timestamp ?? true,
            formatter: config.formatter ?? this.defaultFormatter.bind(this),
        };
        // 创建日志目录
        if (this.config.file) {
            const logDir = join(process.cwd(), 'logs');
            if (!existsSync(logDir)) {
                mkdirSync(logDir, { recursive: true });
            }
        }
        // 定期刷新日志到文件
        if (this.config.file) {
            this.flushInterval = setInterval(() => {
                this.flushToFile();
            }, 5000); // 每5秒刷新一次
        }
    }
    /**
     * 获取单例实例
     */
    static getInstance(config) {
        if (!Logger.instance) {
            Logger.instance = new Logger(config);
        }
        return Logger.instance;
    }
    /**
     * 记录 DEBUG 级别日志
     */
    debug(message, metadata) {
        this.log(LogLevel.DEBUG, message, metadata);
    }
    /**
     * 记录 INFO 级别日志
     */
    info(message, metadata) {
        this.log(LogLevel.INFO, message, metadata);
    }
    /**
     * 记录 WARN 级别日志
     */
    warn(message, metadata) {
        this.log(LogLevel.WARN, message, metadata);
    }
    /**
     * 记录 ERROR 级别日志
     */
    error(message, error, metadata) {
        const entry = this.createLogEntry(LogLevel.ERROR, message, metadata);
        if (error) {
            entry.error = {
                name: error.name,
                message: error.message,
                stack: error.stack,
                code: error.code,
            };
        }
        this.writeLog(entry);
    }
    /**
     * 记录日志
     */
    log(level, message, metadata) {
        if (level < this.config.minLevel) {
            return;
        }
        const entry = this.createLogEntry(level, message, metadata);
        this.writeLog(entry);
    }
    /**
     * 脱敏敏感信息
     */
    sanitize(metadata) {
        if (!metadata || typeof metadata !== 'object') {
            return metadata;
        }
        const sanitized = { ...metadata };
        for (const key of Object.keys(sanitized)) {
            const lowerKey = key.toLowerCase();
            // 检查是否为敏感字段（字段名包含敏感词 或 敏感词包含字段名）
            const isSensitive = this.sanitizationConfig.sensitiveFields.some((field) => {
                const lowerField = field.toLowerCase();
                return lowerKey.includes(lowerField) || lowerField.includes(lowerKey);
            });
            if (isSensitive) {
                if (this.sanitizationConfig.enableDeepSanitization) {
                    // 深度脱敏：使用哈希值（保留长度用于调试）
                    const originalValue = String(sanitized[key]);
                    sanitized[key] = `HASH:${this.hashCode(originalValue).toString(36)}`;
                }
                else {
                    // 标准脱敏：替换为占位符
                    sanitized[key] = this.sanitizationConfig.replacementText;
                }
                continue;
            }
            // 递归处理嵌套对象
            if (sanitized[key] && typeof sanitized[key] === 'object' && !Array.isArray(sanitized[key])) {
                sanitized[key] = this.sanitize(sanitized[key]);
            }
            // 处理数组中的对象
            if (Array.isArray(sanitized[key])) {
                sanitized[key] = sanitized[key].map((item) => typeof item === 'object' && item !== null ? this.sanitize(item) : item);
            }
        }
        return sanitized;
    }
    /**
     * 计算字符串哈希值
     */
    hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }
    /**
     * 配置脱敏设置
     */
    configureSanitization(config) {
        if (config.sensitiveFields) {
            this.sanitizationConfig.sensitiveFields = config.sensitiveFields;
        }
        if (config.replacementText !== undefined) {
            this.sanitizationConfig.replacementText = config.replacementText;
        }
        if (config.enableDeepSanitization !== undefined) {
            this.sanitizationConfig.enableDeepSanitization = config.enableDeepSanitization;
        }
    }
    /**
     * 创建日志条目
     */
    createLogEntry(level, message, metadata) {
        return {
            timestamp: new Date().toISOString(),
            level,
            message,
            metadata: this.sanitize(metadata),
        };
    }
    /**
     * 写入日志
     */
    writeLog(entry) {
        // 格式化日志
        const formatted = this.config.formatter(entry);
        // 输出到控制台
        if (this.config.console) {
            const colorized = this.config.colors ? this.colorize(formatted, entry.level) : formatted;
            console.log(colorized);
        }
        // 添加到缓冲区（稍后写入文件）
        if (this.config.file) {
            this.logBuffer.push(entry);
            // 如果缓冲区太大，立即刷新
            if (this.logBuffer.length >= 100) {
                this.flushToFile();
            }
        }
    }
    /**
     * 刷新缓冲区到文件
     */
    flushToFile() {
        if (this.logBuffer.length === 0) {
            return;
        }
        try {
            const logs = this.logBuffer.map((entry) => this.config.formatter(entry)).join('\n');
            appendFileSync(this.config.logFilePath, logs + '\n');
            this.logBuffer = [];
        }
        catch (error) {
            console.error('[Logger] 写入日志文件失败:', error);
        }
    }
    /**
     * 默认格式化器
     */
    defaultFormatter(entry) {
        const parts = [];
        if (this.config.timestamp) {
            parts.push(`[${entry.timestamp}]`);
        }
        const levelName = LogLevel[entry.level];
        parts.push(`[${levelName}]`);
        if (entry.metadata?.module) {
            parts.push(`[${entry.metadata.module}]`);
        }
        parts.push(entry.message);
        if (entry.metadata) {
            const metaStr = Object.entries(entry.metadata)
                .filter(([key]) => key !== 'module')
                .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
                .join(' ');
            if (metaStr) {
                parts.push(`| ${metaStr}`);
            }
        }
        if (entry.error) {
            parts.push(`| Error: ${entry.error.name}: ${entry.error.message}`);
        }
        return parts.join(' ');
    }
    /**
     * 颜色化日志
     */
    colorize(text, level) {
        const colors = {
            [LogLevel.DEBUG]: '\x1b[36m', // 青色
            [LogLevel.INFO]: '\x1b[32m', // 绿色
            [LogLevel.WARN]: '\x1b[33m', // 黄色
            [LogLevel.ERROR]: '\x1b[31m', // 红色
        };
        const reset = '\x1b[0m';
        const color = colors[level];
        return `${color}${text}${reset}`;
    }
    /**
     * 设置日志级别
     */
    setLevel(level) {
        this.config.minLevel = level;
    }
    /**
     * 关闭日志器
     */
    close() {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
            this.flushInterval = null;
        }
        this.flushToFile();
    }
    /**
     * 创建子日志器（带默认元数据）
     */
    createChild(defaultMetadata) {
        return new ChildLogger(this, defaultMetadata);
    }
}
/**
 * 子日志器类（带默认元数据）
 */
export class ChildLogger {
    parent;
    defaultMetadata;
    constructor(parent, defaultMetadata) {
        this.parent = parent;
        this.defaultMetadata = defaultMetadata;
    }
    debug(message, metadata) {
        this.parent.debug(message, { ...this.defaultMetadata, ...metadata });
    }
    info(message, metadata) {
        this.parent.info(message, { ...this.defaultMetadata, ...metadata });
    }
    warn(message, metadata) {
        this.parent.warn(message, { ...this.defaultMetadata, ...metadata });
    }
    error(message, error, metadata) {
        this.parent.error(message, error, { ...this.defaultMetadata, ...metadata });
    }
    /**
     * 创建带有操作 ID 的日志器
     */
    withOperation(operation) {
        return new ChildLogger(this.parent, {
            ...this.defaultMetadata,
            operation,
        });
    }
    /**
     * 创建带有关联 ID 的日志器
     */
    withCorrelationId(correlationId) {
        return new ChildLogger(this.parent, {
            ...this.defaultMetadata,
            correlationId,
        });
    }
}
/**
 * 性能日志器
 */
export class PerformanceLogger {
    logger;
    timers = new Map();
    constructor(logger) {
        this.logger = logger ?? Logger.getInstance();
    }
    /**
     * 开始计时
     */
    startTimer(key) {
        this.timers.set(key, Date.now());
    }
    /**
     * 结束计时并记录
     */
    endTimer(key, metadata) {
        const startTime = this.timers.get(key);
        if (!startTime) {
            this.logger.warn(`计时器 ${key} 未启动`, metadata);
            return 0;
        }
        const duration = Date.now() - startTime;
        this.timers.delete(key);
        this.logger.info(`操作 ${key} 完成`, {
            ...metadata,
            operation: key,
            durationMs: duration,
        });
        return duration;
    }
    /**
     * 测量异步操作
     */
    async measure(key, fn, metadata) {
        this.startTimer(key);
        try {
            return await fn();
        }
        finally {
            this.endTimer(key, metadata);
        }
    }
    /**
     * 测量同步操作
     */
    measureSync(key, fn, metadata) {
        this.startTimer(key);
        try {
            return fn();
        }
        finally {
            this.endTimer(key, metadata);
        }
    }
}
/**
 * 结构化日志器（用于特定模块）
 */
export class StructuredLogger {
    logger;
    constructor(moduleName) {
        const parentLogger = Logger.getInstance();
        this.logger = parentLogger.createChild({ module: moduleName });
    }
    /**
     * 记录操作开始
     */
    logOperationStart(operation, details) {
        this.logger.info(`开始操作: ${operation}`, {
            operation,
            phase: 'start',
            ...details,
        });
    }
    /**
     * 记录操作完成
     */
    logOperationEnd(operation, result, duration) {
        this.logger.info(`完成操作: ${operation}`, {
            operation,
            phase: 'end',
            ...result,
            duration,
        });
    }
    /**
     * 记录操作失败
     */
    logOperationFailure(operation, error, details) {
        this.logger.error(`操作失败: ${operation}`, error, {
            operation,
            phase: 'failed',
            ...details,
        });
    }
    /**
     * 记录状态变更
     */
    logStateChange(from, to, details) {
        this.logger.info(`状态变更: ${from} → ${to}`, {
            phase: 'state_change',
            from,
            to,
            ...details,
        });
    }
    /**
     * 记录指标
     */
    logMetric(name, value, unit) {
        this.logger.info(`指标: ${name}`, {
            phase: 'metric',
            metric: name,
            value,
            unit,
        });
    }
    /**
     * 记录 DEBUG 级别日志
     */
    debug(message, metadata) {
        this.logger.debug(message, metadata);
    }
    /**
     * 记录 INFO 级别日志
     */
    info(message, metadata) {
        this.logger.info(message, metadata);
    }
    /**
     * 记录 WARN 级别日志
     */
    warn(message, metadata) {
        this.logger.warn(message, metadata);
    }
    /**
     * 记录 ERROR 级别日志
     */
    error(message, error, metadata) {
        this.logger.error(message, error, metadata);
    }
}
// ============================================
// 全局日志器实例
// ============================================
export const logger = Logger.getInstance({
    minLevel: process.env.LOG_LEVEL
        ? LogLevel[process.env.LOG_LEVEL]
        : LogLevel.INFO,
    console: true,
    file: process.env.NODE_ENV === 'production',
});
export const performanceLogger = new PerformanceLogger(logger);
// ============================================
// 便捷函数
// ============================================
/**
 * 创建模块日志器
 */
export function createModuleLogger(moduleName) {
    return new StructuredLogger(moduleName);
}
/**
 * 设置全局日志级别
 */
export function setLogLevel(level) {
    logger.setLevel(level);
}
/**
 * 刷新日志
 */
export function flushLogs() {
    logger.close();
}
