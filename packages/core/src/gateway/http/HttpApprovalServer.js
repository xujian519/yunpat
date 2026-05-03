/**
 * HTTP 审批服务器
 *
 * 提供 HTTP API 端点用于审批流程
 */
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Mutex } from 'async-mutex';
/**
 * HTTP 审批服务器
 */
export class HttpApprovalServer {
    app;
    server = null;
    config;
    pendingApprovals = new Map();
    completedApprovals = new Map();
    approvalMutexes = new Map();
    constructor(config) {
        this.config = {
            host: '0.0.0.0',
            apiPrefix: '/api/v1',
            ...config,
        };
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();
    }
    /**
     * 设置中间件
     */
    setupMiddleware() {
        // JSON 解析
        this.app.use(express.json());
        // CORS（如果配置了）
        if (this.config.corsOrigin) {
            this.app.use((req, res, next) => {
                const origin = this.config.corsOrigin;
                res.setHeader('Access-Control-Allow-Origin', Array.isArray(origin) ? '*' : origin);
                res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
                res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
                if (req.method === 'OPTIONS') {
                    res.sendStatus(200);
                }
                else {
                    next();
                }
            });
        }
        // API Key 认证（如果配置了）
        if (this.config.apiKey) {
            this.app.use((req, res, next) => {
                const apiKey = req.headers['x-api-key'];
                if (!apiKey || apiKey !== this.config.apiKey) {
                    return res.status(401).json({ error: 'Unauthorized' });
                }
                next();
            });
        }
        // 请求日志
        this.app.use((req, res, next) => {
            console.log(`[HTTP Approval] ${req.method} ${req.path}`);
            next();
        });
    }
    /**
     * 设置路由
     */
    setupRoutes() {
        const prefix = this.config.apiPrefix;
        // 健康检查
        this.app.get(`${prefix}/health`, (req, res) => {
            res.json({ status: 'ok', timestamp: new Date().toISOString() });
        });
        // 获取待审批列表
        this.app.get(`${prefix}/approvals`, (req, res) => {
            const approvals = Array.from(this.pendingApprovals.values())
                .filter((a) => a.status === 'pending')
                .map((a) => ({
                requestId: a.requestId,
                agentName: a.request.agentName,
                contentType: a.request.content.type,
                level: a.request.level,
                createdAt: a.createdAt,
                expiresAt: a.expiresAt,
            }));
            res.json({ approvals });
        });
        // 获取特定审批请求
        this.app.get(`${prefix}/approvals/:requestId`, (req, res) => {
            const { requestId } = req.params;
            const approval = this.pendingApprovals.get(requestId);
            if (!approval) {
                return res.status(404).json({ error: 'Approval request not found' });
            }
            res.json({
                requestId: approval.requestId,
                request: approval.request,
                status: approval.status,
                createdAt: approval.createdAt,
                expiresAt: approval.expiresAt,
            });
        });
        // 处理审批（长轮询）
        this.app.post(`${prefix}/approvals/:requestId/approve`, async (req, res) => {
            const { requestId } = req.params;
            const { approved, feedback, suggestions } = req.body;
            try {
                const response = await this.processApproval(requestId, approved, feedback);
                res.json(response);
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                res.status(400).json({ error: message });
            }
        });
        // 修正审批
        this.app.post(`${prefix}/approvals/:requestId/correct`, async (req, res) => {
            const { requestId } = req.params;
            const { corrections, feedback } = req.body;
            try {
                const response = await this.processApproval(requestId, false, feedback, corrections);
                res.json(response);
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                res.status(400).json({ error: message });
            }
        });
        // 补充审批
        this.app.post(`${prefix}/approvals/:requestId/supplement`, async (req, res) => {
            const { requestId } = req.params;
            const { supplements, feedback } = req.body;
            try {
                const response = await this.processApproval(requestId, true, feedback, undefined, supplements);
                res.json(response);
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                res.status(400).json({ error: message });
            }
        });
        // 长轮询等待审批
        this.app.get(`${prefix}/approvals/:requestId/wait`, async (req, res) => {
            const { requestId } = req.params;
            const timeout = parseInt(req.query.timeout) || 30000; // 默认 30 秒
            const approval = this.pendingApprovals.get(requestId);
            if (!approval) {
                return res.status(404).json({ error: 'Approval request not found' });
            }
            // 如果已经有结果，立即返回
            if (approval.status !== 'pending' && approval.response) {
                return res.json(approval.response);
            }
            // 监听客户端断开
            let completed = false;
            req.on('close', () => {
                completed = true;
            });
            const cleanup = () => {
                clearTimeout(timer);
                clearInterval(checkInterval);
            };
            // 超时定时器
            const timer = setTimeout(() => {
                if (!completed && approval.status === 'pending') {
                    approval.status = 'timeout';
                    cleanup();
                    if (!res.headersSent) {
                        res.status(408).json({ error: 'Approval timeout' });
                    }
                }
            }, timeout);
            // 检查间隔
            const checkInterval = setInterval(() => {
                if (completed) {
                    cleanup();
                    return;
                }
                if (approval.status !== 'pending' && approval.response) {
                    cleanup();
                    if (!res.headersSent) {
                        res.json(approval.response);
                    }
                }
            }, 500); // 每 500ms 检查一次
        });
        // 错误处理
        this.app.use((err, req, res, next) => {
            console.error('[HTTP Approval] Error:', err);
            res.status(500).json({ error: 'Internal server error' });
        });
    }
    /**
     * 处理审批（使用互斥锁防止竞态条件）
     */
    async processApproval(requestId, approved, feedback, corrections, supplements) {
        // 获取或创建该请求的互斥锁
        let mutex = this.approvalMutexes.get(requestId);
        if (!mutex) {
            mutex = new Mutex();
            this.approvalMutexes.set(requestId, mutex);
        }
        // 使用 mutex.acquire/release 而不是 run
        const release = await mutex.acquire();
        try {
            const approval = this.pendingApprovals.get(requestId);
            if (!approval) {
                throw new Error('Approval request not found');
            }
            if (approval.status !== 'pending') {
                throw new Error('Approval already processed');
            }
            // 创建响应
            const response = {
                approvalId: requestId,
                approved,
                timestamp: new Date(),
            };
            if (approved) {
                response.feedback = {
                    type: supplements ? 'supplement' : 'approve',
                    content: feedback || 'Approved',
                    timestamp: new Date(),
                };
                if (supplements) {
                    response.feedback.supplements = supplements;
                }
                approval.status = 'approved';
            }
            else {
                if (corrections) {
                    response.feedback = {
                        type: 'correct',
                        content: feedback || 'Corrected',
                        corrections,
                        timestamp: new Date(),
                    };
                    approval.status = 'corrected';
                }
                else {
                    response.feedback = {
                        type: 'reject',
                        content: feedback || 'Rejected',
                        rejectionReason: feedback || 'No reason provided',
                        timestamp: new Date(),
                    };
                    approval.status = 'rejected';
                }
            }
            approval.response = response;
            return response;
        }
        finally {
            release();
        }
    }
    /**
     * 请求审批
     */
    async requestApproval(request, context, timeout = 30000) {
        const requestId = uuidv4();
        const now = new Date();
        const internalRequest = {
            requestId,
            request,
            context,
            status: 'pending',
            createdAt: now,
            expiresAt: new Date(now.getTime() + timeout),
        };
        // 保存到待审批列表
        this.pendingApprovals.set(requestId, internalRequest);
        console.log(`[HTTP Approval] Created approval request: ${requestId}`);
        // 等待审批完成或超时
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pendingApprovals.delete(requestId);
                reject(new Error(`Approval timeout: ${requestId}`));
            }, timeout);
            const checkInterval = setInterval(() => {
                const approval = this.pendingApprovals.get(requestId);
                if (!approval) {
                    clearTimeout(timer);
                    clearInterval(checkInterval);
                    reject(new Error('Approval request not found'));
                    return;
                }
                if (approval.status !== 'pending' && approval.response) {
                    clearTimeout(timer);
                    clearInterval(checkInterval);
                    // 将已完成的审批移到完成列表
                    this.pendingApprovals.delete(requestId);
                    this.completedApprovals.set(requestId, approval);
                    // 定期清理过期的已完成审批（保留最近 100 个）
                    if (this.completedApprovals.size > 100) {
                        const oldestKey = Array.from(this.completedApprovals.keys())[0];
                        this.completedApprovals.delete(oldestKey);
                    }
                    resolve(approval.response);
                }
            }, 500); // 每 500ms 检查一次
        });
    }
    /**
     * 启动服务器
     */
    start() {
        return new Promise((resolve) => {
            const host = this.config.host || '0.0.0.0';
            this.server = this.app.listen(this.config.port, host, () => {
                console.log(`[HTTP Approval] Server started on http://${host}:${this.config.port}`);
                resolve();
            });
        });
    }
    /**
     * 停止服务器
     */
    stop() {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    console.log('[HTTP Approval] Server stopped');
                    resolve();
                });
            }
            else {
                resolve();
            }
        });
    }
    /**
     * 获取已完成的审批
     *
     * @param requestId 审批请求 ID
     * @returns 已完成的审批请求，如果不存在则返回 null
     */
    getCompletedApproval(requestId) {
        return this.completedApprovals.get(requestId) || null;
    }
    /**
     * 获取所有已完成的审批
     *
     * @returns 已完成的审批请求列表
     */
    getAllCompletedApprovals() {
        return Array.from(this.completedApprovals.values());
    }
    /**
     * 清理过期的审批请求
     */
    cleanupExpired() {
        const now = new Date();
        let cleaned = 0;
        for (const [requestId, approval] of this.pendingApprovals.entries()) {
            if (approval.expiresAt < now) {
                approval.status = 'timeout';
                this.pendingApprovals.delete(requestId);
                cleaned++;
            }
        }
        return cleaned;
    }
}
