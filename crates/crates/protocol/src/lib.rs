use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Application mode controls the agent's autonomy level.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AppMode {
    /// Fully autonomous agent mode
    Agent,
    /// YOLO mode — maximum autonomy
    Yolo,
    /// Plan mode — step-by-step execution
    Plan,
}

/// Approval policy for tool execution.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ApprovalMode {
    /// Auto-approve all tools (YOLO mode / --yolo flag)
    Auto,
    /// Suggest approval for non-safe tools (non-YOLO modes)
    #[default]
    Suggest,
    /// Never execute tools requiring approval
    Never,
}

impl ApprovalMode {
    /// Human-readable label for the approval mode.
    pub fn label(self) -> &'static str {
        match self {
            ApprovalMode::Auto => "AUTO",
            ApprovalMode::Suggest => "SUGGEST",
            ApprovalMode::Never => "NEVER",
        }
    }

    /// Parse from a config string value.
    pub fn from_config_value(value: &str) -> Option<Self> {
        match value.trim().to_ascii_lowercase().as_str() {
            "auto" => Some(ApprovalMode::Auto),
            "suggest" => Some(ApprovalMode::Suggest),
            "never" => Some(ApprovalMode::Never),
            _ => None,
        }
    }
}

impl AppMode {
    /// Parse from a config string value.
    #[must_use]
    pub fn from_setting(value: &str) -> Self {
        match value.trim().to_ascii_lowercase().as_str() {
            "plan" => Self::Plan,
            "yolo" => Self::Yolo,
            _ => Self::Agent,
        }
    }

    /// Serialize to a config string value.
    #[must_use]
    pub fn as_setting(self) -> &'static str {
        match self {
            Self::Agent => "agent",
            Self::Yolo => "yolo",
            Self::Plan => "plan",
        }
    }

    /// Short label used in the UI footer.
    pub fn label(self) -> &'static str {
        match self {
            AppMode::Agent => "AGENT",
            AppMode::Yolo => "YOLO",
            AppMode::Plan => "PLAN",
        }
    }

    /// Description shown in help or onboarding text.
    #[allow(dead_code)]
    pub fn description(self) -> &'static str {
        match self {
            AppMode::Agent => "Agent mode - autonomous task execution with tools",
            AppMode::Yolo => "YOLO mode - full tool access without approvals",
            AppMode::Plan => "Plan mode - design before implementing",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ThreadStatus {
    Running,
    Idle,
    Completed,
    Failed,
    Paused,
    Archived,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SessionSource {
    Interactive,
    Resume,
    Fork,
    Api,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Thread {
    pub id: String,
    pub preview: String,
    pub ephemeral: bool,
    pub model_provider: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub status: ThreadStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<PathBuf>,
    pub cwd: PathBuf,
    pub cli_version: String,
    pub source: SessionSource,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreadStartParams {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_provider: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<PathBuf>,
    #[serde(default)]
    pub persist_extended_history: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatentResumeContext {
    pub intent_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub task_plan_summary: Option<String>,
    pub pending_hitl: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skill: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreadResumeParams {
    pub thread_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub history: Option<Vec<Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<PathBuf>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_provider: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<PathBuf>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub approval_policy: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sandbox: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub config: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_instructions: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub developer_instructions: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub personality: Option<String>,
    #[serde(default)]
    pub persist_extended_history: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub patent_context: Option<PatentResumeContext>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreadForkParams {
    pub thread_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<PathBuf>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_provider: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<PathBuf>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub approval_policy: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sandbox: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub config: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_instructions: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub developer_instructions: Option<String>,
    #[serde(default)]
    pub persist_extended_history: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreadListParams {
    #[serde(default)]
    pub include_archived: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreadReadParams {
    pub thread_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreadSetNameParams {
    pub thread_id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ThreadRequest {
    Create {
        #[serde(default)]
        metadata: Value,
    },
    Start(ThreadStartParams),
    Resume(ThreadResumeParams),
    Fork(ThreadForkParams),
    List(ThreadListParams),
    Read(ThreadReadParams),
    SetName(ThreadSetNameParams),
    Archive {
        thread_id: String,
    },
    Unarchive {
        thread_id: String,
    },
    Message {
        thread_id: String,
        input: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreadResponse {
    pub thread_id: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thread: Option<Thread>,
    #[serde(default)]
    pub threads: Vec<Thread>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_provider: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<PathBuf>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub approval_policy: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sandbox: Option<String>,
    #[serde(default)]
    pub events: Vec<EventFrame>,
    #[serde(default)]
    pub data: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum AppRequest {
    Capabilities,
    ConfigGet { key: String },
    ConfigSet { key: String, value: String },
    ConfigUnset { key: String },
    ConfigList,
    Models,
    ThreadLoadedList,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppResponse {
    pub ok: bool,
    pub data: Value,
    #[serde(default)]
    pub events: Vec<EventFrame>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thread_id: Option<String>,
    pub prompt: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptResponse {
    pub output: String,
    pub model: String,
    #[serde(default)]
    pub events: Vec<EventFrame>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ToolKind {
    Function,
    Mcp,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalShellParams {
    pub command: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timeout_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ToolPayload {
    Function {
        arguments: String,
    },
    Custom {
        input: String,
    },
    LocalShell {
        params: LocalShellParams,
    },
    Mcp {
        server: String,
        tool: String,
        raw_arguments: Value,
        #[serde(skip_serializing_if = "Option::is_none")]
        raw_tool_call_id: Option<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ToolOutput {
    Function {
        #[serde(skip_serializing_if = "Option::is_none")]
        body: Option<Value>,
        success: bool,
    },
    Mcp {
        result: Value,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum NetworkPolicyRuleAction {
    Allow,
    Deny,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct NetworkPolicyAmendment {
    pub host: String,
    pub action: NetworkPolicyRuleAction,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ReviewDecision {
    Approved,
    ApprovedExecpolicyAmendment,
    ApprovedForSession,
    NetworkPolicyAmendment {
        host: String,
        action: NetworkPolicyRuleAction,
    },
    Denied,
    Abort,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum McpStartupStatus {
    Starting,
    Ready,
    Failed { error: String },
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpStartupUpdateEvent {
    pub server_name: String,
    pub status: McpStartupStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpStartupFailure {
    pub server_name: String,
    pub error: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpStartupCompleteEvent {
    pub ready: Vec<String>,
    pub failed: Vec<McpStartupFailure>,
    pub cancelled: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkApprovalContext {
    pub host: String,
    pub protocol: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecApprovalRequestEvent {
    pub call_id: String,
    pub approval_id: String,
    pub turn_id: String,
    pub command: String,
    pub cwd: String,
    pub reason: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub network_approval_context: Option<NetworkApprovalContext>,
    #[serde(default)]
    pub proposed_execpolicy_amendment: Vec<String>,
    #[serde(default)]
    pub proposed_network_policy_amendments: Vec<NetworkPolicyAmendment>,
    #[serde(default)]
    pub additional_permissions: Vec<String>,
    #[serde(default)]
    pub available_decisions: Vec<ReviewDecision>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event", rename_all = "snake_case")]
pub enum EventFrame {
    ResponseStart {
        response_id: String,
    },
    ResponseDelta {
        response_id: String,
        delta: String,
    },
    ResponseEnd {
        response_id: String,
    },
    ToolCallStart {
        response_id: String,
        tool_name: String,
        arguments: Value,
    },
    ToolCallResult {
        response_id: String,
        tool_name: String,
        output: Value,
    },
    McpStartupUpdate {
        update: McpStartupUpdateEvent,
    },
    McpStartupComplete {
        summary: McpStartupCompleteEvent,
    },
    McpToolCallBegin {
        server_name: String,
        tool_name: String,
    },
    McpToolCallEnd {
        server_name: String,
        tool_name: String,
        ok: bool,
    },
    ExecApprovalRequest {
        request: ExecApprovalRequestEvent,
    },
    ApplyPatchApprovalRequest {
        request: ExecApprovalRequestEvent,
    },
    ElicitationRequest {
        server_name: String,
        request_id: String,
        prompt: String,
    },
    ExecCommandBegin {
        command: String,
        cwd: String,
    },
    ExecCommandOutputDelta {
        command: String,
        delta: String,
    },
    ExecCommandEnd {
        command: String,
        exit_code: i32,
    },
    PatchApplyBegin {
        path: String,
    },
    PatchApplyEnd {
        path: String,
        ok: bool,
    },
    TurnStarted {
        turn_id: String,
    },
    TurnComplete {
        turn_id: String,
    },
    TurnAborted {
        turn_id: String,
        reason: String,
    },
    Error {
        response_id: String,
        message: String,
    },
}

// ============================================================================
// Tool approval & collaboration gate types (migrated from tui crate to break
// core ↔ tui circular dependency)
// ============================================================================

/// Categorizes tools by cost/risk level.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ToolCategory {
    /// Free, read-only operations (`list_dir`, `read_file`, todo_*)
    Safe,
    /// File modifications (`write_file`, `edit_file`)
    FileWrite,
    /// Shell execution (`exec_shell`)
    Shell,
    /// Network-oriented built-in tools
    Network,
    /// Read-only MCP discovery and resource access
    McpRead,
    /// MCP actions that may change remote state
    McpAction,
    /// Unknown or unclassified tool surface
    Unknown,
}

/// Stakes-based variant for the takeover modal.
///
/// `RiskLevel::Benign` lets a single keystroke commit the approval.
/// `RiskLevel::Destructive` requires an explicit second confirmation
/// keypress so muscle-memory `Enter` never lands on an irreversible op.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RiskLevel {
    Benign,
    Destructive,
}

/// Gate level for a tool execution request.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CollaborationGate {
    /// Auto-execute, no UI needed (read-only tools).
    None,
    /// Toast with summary + ApprovalView (benign file writes, shell queries).
    ConfirmPlan,
    /// Preview panel shows diff + ApprovalView (destructive file writes).
    ReviewDiff,
    /// Sidebar switches to Plan + ApprovalView (destructive shell, unknown).
    RequirePlan,
}

/// Determine the collaboration gate level for a tool.
pub fn determine_gate(category: ToolCategory, risk: RiskLevel) -> CollaborationGate {
    match (category, risk) {
        // Safe / read-only → always auto-execute
        (ToolCategory::Safe | ToolCategory::McpRead, _) => CollaborationGate::None,
        // File writes: benign → confirm, destructive → diff review
        (ToolCategory::FileWrite, RiskLevel::Benign) => CollaborationGate::ConfirmPlan,
        (ToolCategory::FileWrite, RiskLevel::Destructive) => CollaborationGate::ReviewDiff,
        // Shell: destructive → require plan, benign → confirm
        (ToolCategory::Shell, RiskLevel::Destructive) => CollaborationGate::RequirePlan,
        (ToolCategory::Shell, RiskLevel::Benign) => CollaborationGate::ConfirmPlan,
        // Network → confirm with URL info
        (ToolCategory::Network, _) => CollaborationGate::ConfirmPlan,
        // MCP actions: destructive → require plan, benign → confirm
        (ToolCategory::McpAction, RiskLevel::Destructive) => CollaborationGate::RequirePlan,
        (ToolCategory::McpAction, RiskLevel::Benign) => CollaborationGate::ConfirmPlan,
        // Unknown → safest path
        (ToolCategory::Unknown, _) => CollaborationGate::RequirePlan,
    }
}

// ============================================================================
// Capacity & coherence types (migrated from core/ to break core ↔ tui cycle)
// ============================================================================

/// Action recommended by the capacity controller.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GuardrailAction {
    NoIntervention,
    TargetedContextRefresh,
    VerifyWithToolReplay,
    VerifyAndReplan,
}

impl GuardrailAction {
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            GuardrailAction::NoIntervention => "no_intervention",
            GuardrailAction::TargetedContextRefresh => "targeted_context_refresh",
            GuardrailAction::VerifyWithToolReplay => "verify_with_tool_replay",
            GuardrailAction::VerifyAndReplan => "verify_and_replan",
        }
    }
}

/// Coarse failure risk band.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RiskBand {
    Low,
    Medium,
    High,
}

impl RiskBand {
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            RiskBand::Low => "low",
            RiskBand::Medium => "medium",
            RiskBand::High => "high",
        }
    }
}

/// User-facing coherence ladder for session health.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CoherenceState {
    #[default]
    Healthy,
    GettingCrowded,
    RefreshingContext,
    VerifyingRecentWork,
    ResettingPlan,
}

impl CoherenceState {
    #[must_use]
    pub fn label(self) -> &'static str {
        match self {
            Self::Healthy => "healthy",
            Self::GettingCrowded => "getting crowded",
            Self::RefreshingContext => "refreshing context",
            Self::VerifyingRecentWork => "verifying recent work",
            Self::ResettingPlan => "resetting plan",
        }
    }

    #[must_use]
    pub fn description(self) -> &'static str {
        match self {
            Self::Healthy => "The session is stable and focused.",
            Self::GettingCrowded => "The session is approaching context pressure.",
            Self::RefreshingContext => "The engine is refreshing context before continuing.",
            Self::VerifyingRecentWork => {
                "The engine is checking recent tool results before continuing."
            }
            Self::ResettingPlan => {
                "The engine is rebuilding from canonical context and replanning."
            }
        }
    }
}

/// Synthetic input to the coherence reducer.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CoherenceSignal {
    CapacityDecision {
        risk_band: RiskBand,
        action: GuardrailAction,
        cooldown_blocked: bool,
    },
    CapacityIntervention {
        action: GuardrailAction,
    },
    CompactionStarted,
    CompactionCompleted,
    CompactionFailed,
}

/// Pure transition function for the plain-language coherence ladder.
#[must_use]
pub fn next_coherence_state(current: CoherenceState, signal: CoherenceSignal) -> CoherenceState {
    match signal {
        CoherenceSignal::CompactionStarted => CoherenceState::RefreshingContext,
        CoherenceSignal::CompactionCompleted => CoherenceState::Healthy,
        CoherenceSignal::CompactionFailed => CoherenceState::GettingCrowded,
        CoherenceSignal::CapacityIntervention { action }
        | CoherenceSignal::CapacityDecision { action, .. } => match action {
            GuardrailAction::NoIntervention => match signal {
                CoherenceSignal::CapacityDecision {
                    risk_band, cooldown_blocked, ..
                } => {
                    if cooldown_blocked {
                        return current;
                    }
                    match risk_band {
                        RiskBand::Low => CoherenceState::Healthy,
                        RiskBand::Medium | RiskBand::High => CoherenceState::GettingCrowded,
                    }
                }
                _ => current,
            },
            GuardrailAction::TargetedContextRefresh => CoherenceState::RefreshingContext,
            GuardrailAction::VerifyWithToolReplay => CoherenceState::VerifyingRecentWork,
            GuardrailAction::VerifyAndReplan => CoherenceState::ResettingPlan,
        },
    }
}


// ============================================================================
// Tool types (migrated from yunpat-tools to break core ↔ tools cycle)
// ============================================================================

/// Capabilities that a tool may have or require.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ToolCapability {
    /// Tool only reads data, never modifies state.
    ReadOnly,
    /// Tool writes to the filesystem.
    WritesFiles,
    /// Tool executes arbitrary shell commands.
    ExecutesCode,
    /// Tool makes network requests.
    Network,
    /// Tool can be run in a sandbox.
    Sandboxable,
    /// Tool requires user approval before execution.
    RequiresApproval,
}

/// Approval requirement for a tool.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Hash)]
pub enum ApprovalRequirement {
    /// Never needs approval: safe read-only operations.
    #[default]
    Auto,
    /// Suggest approval but allow user to skip.
    Suggest,
    /// Always require explicit user approval.
    Required,
}

/// Errors that can occur during tool execution.
#[derive(Debug, Clone)]
pub enum ToolError {
    InvalidInput { message: String },
    MissingField { field: String },
    PathEscape { path: PathBuf },
    ExecutionFailed { message: String },
    Timeout { seconds: u64 },
    NotAvailable { message: String },
    PermissionDenied { message: String },
}

impl std::fmt::Display for ToolError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidInput { message } => {
                write!(f, "Failed to validate input: {message}")
            }
            Self::MissingField { field } => {
                write!(
                    f,
                    "Failed to validate input: missing required field '{field}'"
                )
            }
            Self::PathEscape { path } => {
                write!(
                    f,
                    "Failed to resolve path '{}': path escapes workspace",
                    path.display()
                )
            }
            Self::ExecutionFailed { message } => {
                write!(f, "Failed to execute tool: {message}")
            }
            Self::Timeout { seconds } => {
                write!(
                    f,
                    "Failed to execute tool: operation timed out after {seconds}s"
                )
            }
            Self::NotAvailable { message } => {
                write!(f, "Failed to locate tool: {message}")
            }
            Self::PermissionDenied { message } => {
                write!(f, "Failed to authorize tool execution: {message}")
            }
        }
    }
}

impl std::error::Error for ToolError {}

impl ToolError {
    #[must_use]
    pub fn invalid_input(msg: impl Into<String>) -> Self {
        Self::InvalidInput { message: msg.into() }
    }

    #[must_use]
    pub fn missing_field(field: impl Into<String>) -> Self {
        Self::MissingField { field: field.into() }
    }

    #[must_use]
    pub fn execution_failed(msg: impl Into<String>) -> Self {
        Self::ExecutionFailed { message: msg.into() }
    }

    #[must_use]
    pub fn path_escape(path: impl Into<PathBuf>) -> Self {
        Self::PathEscape { path: path.into() }
    }

    #[must_use]
    pub fn not_available(msg: impl Into<String>) -> Self {
        Self::NotAvailable { message: msg.into() }
    }

    #[must_use]
    pub fn permission_denied(msg: impl Into<String>) -> Self {
        Self::PermissionDenied { message: msg.into() }
    }
}

/// Result of a tool execution.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResult {
    /// The output content, which may be JSON or plain text.
    pub content: String,
    /// Whether the execution was successful.
    pub success: bool,
    /// Optional structured metadata.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<Value>,
}

impl ToolResult {
    /// Create a successful result with content.
    #[must_use]
    pub fn success(content: impl Into<String>) -> Self {
        Self {
            content: content.into(),
            success: true,
            metadata: None,
        }
    }

    /// Create an error result with message.
    #[must_use]
    pub fn error(message: impl Into<String>) -> Self {
        Self {
            content: message.into(),
            success: false,
            metadata: None,
        }
    }

    /// Create a successful result from JSON.
    pub fn json<T: Serialize>(value: &T) -> std::result::Result<Self, serde_json::Error> {
        Ok(Self {
            content: serde_json::to_string_pretty(value)?,
            success: true,
            metadata: None,
        })
    }

    /// Add metadata to the result.
    #[must_use]
    pub fn with_metadata(mut self, metadata: Value) -> Self {
        self.metadata = Some(metadata);
        self
    }
}
