/**
 * 可观测性类型定义
 */
// 遥测事件类型
export var TelemetryEventType;
(function (TelemetryEventType) {
    // 智能体事件
    TelemetryEventType["AGENT_STARTED"] = "agent.started";
    TelemetryEventType["AGENT_COMPLETED"] = "agent.completed";
    TelemetryEventType["AGENT_FAILED"] = "agent.failed";
    // 阶段事件
    TelemetryEventType["STAGE_STARTED"] = "stage.started";
    TelemetryEventType["STAGE_COMPLETED"] = "stage.completed";
    TelemetryEventType["STAGE_FAILED"] = "stage.failed";
    // 工具事件
    TelemetryEventType["TOOL_CALLED"] = "tool.called";
    TelemetryEventType["TOOL_FAILED"] = "tool.failed";
    // LLM 事件
    TelemetryEventType["LLM_CALLED"] = "llm.called";
    TelemetryEventType["LLM_FAILED"] = "llm.failed";
    TelemetryEventType["LLM_TOKEN_USAGE"] = "llm.token_usage";
    // 记忆事件
    TelemetryEventType["MEMORY_READ"] = "memory.read";
    TelemetryEventType["MEMORY_WRITE"] = "memory.write";
    TelemetryEventType["MEMORY_CHECKPOINT"] = "memory.checkpoint";
})(TelemetryEventType || (TelemetryEventType = {}));
// 事件状态
export var EventStatus;
(function (EventStatus) {
    EventStatus["SUCCESS"] = "success";
    EventStatus["FAILURE"] = "failure";
    EventStatus["PENDING"] = "pending";
})(EventStatus || (EventStatus = {}));
// 告警类型
export var AlertType;
(function (AlertType) {
    AlertType["SLOW_EXECUTION"] = "slow_execution";
    AlertType["HIGH_FAILURE_RATE"] = "high_failure_rate";
    AlertType["ERROR_SPIKE"] = "error_spike";
    AlertType["MEMORY_LEAK"] = "memory_leak";
})(AlertType || (AlertType = {}));
// 告警严重级别
export var AlertSeverity;
(function (AlertSeverity) {
    AlertSeverity["INFO"] = "info";
    AlertSeverity["WARNING"] = "warning";
    AlertSeverity["ERROR"] = "error";
    AlertSeverity["CRITICAL"] = "critical";
})(AlertSeverity || (AlertSeverity = {}));
