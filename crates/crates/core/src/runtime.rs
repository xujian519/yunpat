use std::path::{Path, PathBuf};
use std::sync::Arc;

use anyhow::Result;
use serde_json::{Value, json};
use uuid::Uuid;
use yunpat_agent::ModelRegistry;
use yunpat_config::{CliRuntimeOverrides, ConfigToml, ProviderKind};
use yunpat_execpolicy::{
    AskForApproval, ExecApprovalRequirement, ExecPolicyContext, ExecPolicyDecision,
    ExecPolicyEngine,
};
use yunpat_hooks::{HookDispatcher, HookEvent, HookPipeline};
use yunpat_mcp::{McpManager, McpStartupCompleteEvent, McpStartupUpdateEvent};
use yunpat_protocol::{
    AppResponse, EventFrame, PromptRequest, PromptResponse, ThreadRequest, ThreadResponse,
    ThreadStatus, ToolPayload,
};
use yunpat_state::StateStore;
use yunpat_tools::{ToolCall, ToolRegistry};

use crate::helpers::*;
use crate::job_manager::{
    JobHistoryEntry, JobManager, JobRecord, job_history_to_value, job_retry_to_value,
    job_status_to_str,
};
use crate::thread_manager::ThreadManager;
use crate::{InitialHistory, NewThread};

pub struct Runtime {
    pub config: ConfigToml,
    pub model_registry: ModelRegistry,
    pub thread_manager: ThreadManager,
    pub tool_registry: Arc<ToolRegistry>,
    pub mcp_manager: Arc<McpManager>,
    pub exec_policy: ExecPolicyEngine,
    pub hooks: HookDispatcher,
    pub hook_pipeline: HookPipeline,
    pub jobs: JobManager,
}

impl Runtime {
    pub fn new(
        config: ConfigToml,
        model_registry: ModelRegistry,
        state: StateStore,
        tool_registry: Arc<ToolRegistry>,
        mcp_manager: Arc<McpManager>,
        exec_policy: ExecPolicyEngine,
        hooks: HookDispatcher,
    ) -> Self {
        let mut jobs = JobManager::default();
        let _ = jobs.load_from_store(&state);
        Self {
            config,
            model_registry,
            thread_manager: ThreadManager::new(state),
            tool_registry,
            mcp_manager,
            exec_policy,
            hooks,
            hook_pipeline: HookPipeline::new(),
            jobs,
        }
    }

    fn persisted_thread_data(&self, thread_id: &str) -> Result<Value> {
        let history = self
            .thread_manager
            .state_store()
            .list_messages(thread_id, Some(500))?
            .into_iter()
            .map(|message| {
                json!({
                    "id": message.id,
                    "role": message.role,
                    "content": message.content,
                    "item": message.item,
                    "created_at": message.created_at
                })
            })
            .collect::<Vec<_>>();

        let checkpoint =
            self.thread_manager
                .state_store()
                .load_checkpoint(thread_id, None)?
                .map(|record| {
                    json!({
                        "checkpoint_id": record.checkpoint_id,
                        "state": record.state,
                        "created_at": record.created_at
                    })
                });

        Ok(json!({
            "history": history,
            "checkpoint": checkpoint
        }))
    }

    fn persist_latest_checkpoint(&self, thread_id: &str, reason: &str, state: Value) -> Result<()> {
        self.thread_manager.state_store().save_checkpoint(
            thread_id,
            "latest",
            &json!({
                "reason": reason,
                "saved_at": chrono::Utc::now().timestamp(),
                "state": state
            }),
        )
    }

    pub async fn handle_thread(&mut self, req: ThreadRequest) -> Result<ThreadResponse> {
        match req {
            ThreadRequest::Create { .. } => {
                let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
                let new = self.thread_manager.spawn_thread_with_history(
                    "deepseek".to_string(),
                    cwd,
                    InitialHistory::New,
                    false,
                )?;
                let mut response = thread_response_from_new("created", new);
                response.data = self.persisted_thread_data(&response.thread_id)?;
                Ok(response)
            }
            ThreadRequest::Start(params) => {
                let cwd = params.cwd.clone().unwrap_or_else(|| {
                    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
                });
                let new = self.thread_manager.spawn_thread_with_history(
                    params.model_provider.clone().unwrap_or_else(|| "deepseek".to_string()),
                    cwd,
                    InitialHistory::New,
                    params.persist_extended_history,
                )?;
                let mut response = thread_response_from_new("started", new);
                response.data = self.persisted_thread_data(&response.thread_id)?;
                Ok(response)
            }
            ThreadRequest::Resume(params) => {
                let fallback_cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
                if let Some(new) = self.thread_manager.resume_thread_with_history(
                    &params,
                    &fallback_cwd,
                    "deepseek".to_string(),
                )? {
                    let mut response = thread_response_from_new("resumed", new);
                    response.data = self.persisted_thread_data(&response.thread_id)?;
                    Ok(response)
                } else {
                    Ok(ThreadResponse {
                        thread_id: params.thread_id,
                        status: "missing".to_string(),
                        thread: None,
                        threads: Vec::new(),
                        model: None,
                        model_provider: None,
                        cwd: None,
                        approval_policy: params.approval_policy,
                        sandbox: params.sandbox,
                        events: Vec::new(),
                        data: json!({"error":"thread not found"}),
                    })
                }
            }
            ThreadRequest::Fork(params) => {
                let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
                if let Some(new) = self.thread_manager.fork_thread(&params, &cwd)? {
                    let mut response = thread_response_from_new("forked", new);
                    response.data = self.persisted_thread_data(&response.thread_id)?;
                    Ok(response)
                } else {
                    Ok(ThreadResponse {
                        thread_id: params.thread_id,
                        status: "missing".to_string(),
                        thread: None,
                        threads: Vec::new(),
                        model: None,
                        model_provider: None,
                        cwd: None,
                        approval_policy: params.approval_policy,
                        sandbox: params.sandbox,
                        events: Vec::new(),
                        data: json!({"error":"thread not found"}),
                    })
                }
            }
            ThreadRequest::List(params) => Ok(ThreadResponse {
                thread_id: "list".to_string(),
                status: "ok".to_string(),
                thread: None,
                threads: self.thread_manager.list_threads(&params)?,
                model: None,
                model_provider: None,
                cwd: None,
                approval_policy: None,
                sandbox: None,
                events: Vec::new(),
                data: json!({}),
            }),
            ThreadRequest::Read(params) => {
                let id = params.thread_id.clone();
                let data = self.persisted_thread_data(&id)?;
                Ok(ThreadResponse {
                    thread_id: id,
                    status: "ok".to_string(),
                    thread: self.thread_manager.read_thread(&params)?,
                    threads: Vec::new(),
                    model: None,
                    model_provider: None,
                    cwd: None,
                    approval_policy: None,
                    sandbox: None,
                    events: Vec::new(),
                    data,
                })
            }
            ThreadRequest::SetName(params) => Ok(ThreadResponse {
                thread_id: params.thread_id.clone(),
                status: "ok".to_string(),
                thread: self.thread_manager.set_thread_name(&params)?,
                threads: Vec::new(),
                model: None,
                model_provider: None,
                cwd: None,
                approval_policy: None,
                sandbox: None,
                events: Vec::new(),
                data: json!({}),
            }),
            ThreadRequest::Archive { thread_id } => {
                self.thread_manager.archive_thread(&thread_id)?;
                Ok(ThreadResponse {
                    thread_id,
                    status: "archived".to_string(),
                    thread: None,
                    threads: Vec::new(),
                    model: None,
                    model_provider: None,
                    cwd: None,
                    approval_policy: None,
                    sandbox: None,
                    events: Vec::new(),
                    data: json!({}),
                })
            }
            ThreadRequest::Unarchive { thread_id } => {
                self.thread_manager.unarchive_thread(&thread_id)?;
                Ok(ThreadResponse {
                    thread_id,
                    status: "unarchived".to_string(),
                    thread: None,
                    threads: Vec::new(),
                    model: None,
                    model_provider: None,
                    cwd: None,
                    approval_policy: None,
                    sandbox: None,
                    events: Vec::new(),
                    data: json!({}),
                })
            }
            ThreadRequest::Message { thread_id, input } => {
                self.thread_manager.touch_message(&thread_id, &input)?;
                let response_id = format!("{thread_id}:{}", input.len());
                self.hooks
                    .emit(HookEvent::ResponseStart {
                        response_id: response_id.clone(),
                    })
                    .await;
                self.hooks
                    .emit(HookEvent::ResponseEnd {
                        response_id: response_id.clone(),
                    })
                    .await;

                Ok(ThreadResponse {
                    thread_id,
                    status: "accepted".to_string(),
                    thread: None,
                    threads: Vec::new(),
                    model: None,
                    model_provider: None,
                    cwd: None,
                    approval_policy: None,
                    sandbox: None,
                    events: vec![
                        EventFrame::ResponseStart {
                            response_id: response_id.clone(),
                        },
                        EventFrame::ResponseDelta {
                            response_id: response_id.clone(),
                            delta: "queued".to_string(),
                        },
                        EventFrame::ResponseEnd { response_id },
                    ],
                    data: json!({}),
                })
            }
        }
    }

    pub async fn handle_prompt(
        &mut self,
        req: PromptRequest,
        cli_overrides: &CliRuntimeOverrides,
    ) -> Result<PromptResponse> {
        let resolved = self.config.resolve_runtime_options(cli_overrides);
        let requested_model = req.model.clone().unwrap_or_else(|| resolved.model.clone());
        let selection =
            self.model_registry.resolve(Some(&requested_model), Some(resolved.provider));
        let resolved_model = selection.resolved.id.clone();
        let response_id = format!("resp-{}", Uuid::new_v4());

        self.hooks
            .emit(HookEvent::ResponseStart {
                response_id: response_id.clone(),
            })
            .await;
        self.hooks
            .emit(HookEvent::ResponseDelta {
                response_id: response_id.clone(),
                delta: "model-selected".to_string(),
            })
            .await;
        self.hooks
            .emit(HookEvent::ResponseEnd {
                response_id: response_id.clone(),
            })
            .await;

        let payload = json!({
            "provider": resolved.provider.as_str(),
            "model": resolved_model.clone(),
            "prompt": req.prompt,
            "telemetry": resolved.telemetry,
            "base_url": resolved.base_url,
            "has_api_key": resolved.api_key.as_ref().is_some_and(|k| !k.trim().is_empty()),
            "approval_policy": resolved.approval_policy,
            "sandbox_mode": resolved.sandbox_mode
        });
        if let Some(thread_id) = req.thread_id.as_ref() {
            self.thread_manager.touch_message(thread_id, &req.prompt)?;
            let assistant_message_id = self.thread_manager.state_store().append_message(
                thread_id,
                "assistant",
                &payload.to_string(),
                Some(payload.clone()),
            )?;
            self.persist_latest_checkpoint(
                thread_id,
                "prompt_response",
                json!({
                    "response_id": response_id.clone(),
                    "model": resolved_model.clone(),
                    "provider": resolved.provider.as_str(),
                    "assistant_message_id": assistant_message_id
                }),
            )?;
        }

        Ok(PromptResponse {
            output: payload.to_string(),
            model: resolved_model,
            events: vec![
                EventFrame::ResponseStart {
                    response_id: response_id.clone(),
                },
                EventFrame::ResponseDelta {
                    response_id: response_id.clone(),
                    delta: "model-selected".to_string(),
                },
                EventFrame::ResponseEnd { response_id },
            ],
        })
    }

    pub async fn invoke_tool(
        &self,
        call: ToolCall,
        approval_mode: AskForApproval,
        cwd: &Path,
    ) -> Result<Value> {
        let fallback_cwd = cwd.display().to_string();
        let (command, policy_cwd, execution_kind) = call.execution_subject(&fallback_cwd);
        let decision = self.exec_policy.check(ExecPolicyContext {
            command: &command,
            cwd: &policy_cwd,
            ask_for_approval: approval_mode,
            sandbox_mode: None,
        })?;
        let precheck = policy_precheck_payload(&decision, &command, &policy_cwd, execution_kind);
        let response_id = format!("tool-{}", Uuid::new_v4());
        let call_id = call
            .raw_tool_call_id
            .clone()
            .unwrap_or_else(|| format!("tool-call-{}", Uuid::new_v4()));
        self.hooks
            .emit(HookEvent::ToolLifecycle {
                response_id: response_id.clone(),
                tool_name: call.name.clone(),
                phase: "precheck".to_string(),
                payload: precheck.clone(),
            })
            .await;

        if !decision.allow {
            let reason = decision.reason().to_string();
            let approval_id = format!("approval-{}", Uuid::new_v4());
            let error_frame = EventFrame::Error {
                response_id: response_id.clone(),
                message: reason.clone(),
            };
            self.hooks
                .emit(HookEvent::ApprovalLifecycle {
                    approval_id,
                    phase: "denied".to_string(),
                    reason: Some(reason.clone()),
                })
                .await;
            self.hooks
                .emit(HookEvent::GenericEventFrame { frame: error_frame.clone() })
                .await;
            return Ok(json!({
                "ok": false,
                "status": "denied",
                "execution_kind": execution_kind,
                "response_id": response_id,
                "precheck": precheck,
                "error": reason,
                "events": [event_frame_payload(&error_frame)],
            }));
        }

        if decision.requires_approval {
            let approval_id = format!("approval-{}", Uuid::new_v4());
            let reason = decision.reason().to_string();
            let maybe_approval_frame = approval_request_frame(
                &decision.requirement,
                call_id,
                approval_id.clone(),
                response_id.clone(),
                command.clone(),
                policy_cwd.clone(),
            );
            self.hooks
                .emit(HookEvent::ApprovalLifecycle {
                    approval_id: approval_id.clone(),
                    phase: "requested".to_string(),
                    reason: Some(reason.clone()),
                })
                .await;
            let mut events = Vec::new();
            if let Some(frame) = maybe_approval_frame {
                self.hooks.emit(HookEvent::GenericEventFrame { frame: frame.clone() }).await;
                events.push(event_frame_payload(&frame));
            }
            return Ok(json!({
                "ok": false,
                "status": "approval_required",
                "execution_kind": execution_kind,
                "response_id": response_id,
                "approval_id": approval_id,
                "precheck": precheck,
                "error": reason,
                "events": events,
            }));
        }

        let start_frame = EventFrame::ToolCallStart {
            response_id: response_id.clone(),
            tool_name: call.name.clone(),
            arguments: tool_payload_value(&call.payload),
        };
        self.hooks
            .emit(HookEvent::GenericEventFrame { frame: start_frame.clone() })
            .await;
        self.hooks
            .emit(HookEvent::ToolLifecycle {
                response_id: response_id.clone(),
                tool_name: call.name.clone(),
                phase: "dispatching".to_string(),
                payload: json!({
                    "call_id": call_id,
                    "execution_kind": execution_kind
                }),
            })
            .await;

        match self.tool_registry.dispatch(call.clone(), true).await {
            Ok(tool_output) => {
                let result_frame = EventFrame::ToolCallResult {
                    response_id: response_id.clone(),
                    tool_name: call.name.clone(),
                    output: tool_output_value(&tool_output),
                };
                self.hooks
                    .emit(HookEvent::GenericEventFrame { frame: result_frame.clone() })
                    .await;
                self.hooks
                    .emit(HookEvent::ToolLifecycle {
                        response_id: response_id.clone(),
                        tool_name: call.name,
                        phase: "completed".to_string(),
                        payload: json!({ "ok": true }),
                    })
                    .await;
                Ok(json!({
                    "ok": true,
                    "status": "completed",
                    "execution_kind": execution_kind,
                    "response_id": response_id,
                    "precheck": precheck,
                    "output": tool_output,
                    "events": [
                        event_frame_payload(&start_frame),
                        event_frame_payload(&result_frame)
                    ]
                }))
            }
            Err(err) => {
                let message = format!("{err:?}");
                let error_frame = EventFrame::Error {
                    response_id: response_id.clone(),
                    message: message.clone(),
                };
                self.hooks
                    .emit(HookEvent::GenericEventFrame { frame: error_frame.clone() })
                    .await;
                self.hooks
                    .emit(HookEvent::ToolLifecycle {
                        response_id: response_id.clone(),
                        tool_name: call.name,
                        phase: "failed".to_string(),
                        payload: json!({ "error": message.clone() }),
                    })
                    .await;
                Ok(json!({
                    "ok": false,
                    "status": "failed",
                    "execution_kind": execution_kind,
                    "response_id": response_id,
                    "precheck": precheck,
                    "error": message,
                    "events": [
                        event_frame_payload(&start_frame),
                        event_frame_payload(&error_frame)
                    ]
                }))
            }
        }
    }

    pub async fn mcp_startup(&self) -> McpStartupCompleteEvent {
        let mut updates: Vec<McpStartupUpdateEvent> = Vec::new();
        let summary = self.mcp_manager.start_all(|update| {
            updates.push(update);
        });
        for update in updates {
            self.hooks
                .emit(HookEvent::GenericEventFrame {
                    frame: EventFrame::McpStartupUpdate { update },
                })
                .await;
        }
        self.hooks
            .emit(HookEvent::GenericEventFrame {
                frame: EventFrame::McpStartupComplete { summary: summary.clone() },
            })
            .await;
        summary
    }

    pub fn app_status(&self) -> AppResponse {
        let jobs = self.jobs.list();
        let events = jobs
            .iter()
            .flat_map(|job| {
                job.history.iter().map(|entry| EventFrame::ResponseDelta {
                    response_id: job.id.clone(),
                    delta: json!({
                        "kind": "job_transition",
                        "job_id": job.id.clone(),
                        "phase": entry.phase.clone(),
                        "status": job_status_to_str(entry.status),
                        "progress": entry.progress,
                        "detail": entry.detail.clone(),
                        "retry": job_retry_to_value(&entry.retry),
                        "at": entry.at
                    })
                    .to_string(),
                })
            })
            .collect::<Vec<_>>();
        AppResponse {
            ok: true,
            data: json!({
                "jobs": jobs.into_iter().map(|job| {
                    json!({
                        "id": job.id,
                        "name": job.name,
                        "status": job_status_to_str(job.status),
                        "progress": job.progress,
                        "detail": job.detail,
                        "retry": job_retry_to_value(&job.retry),
                        "history": job.history.iter().map(job_history_to_value).collect::<Vec<_>>()
                    })
                }).collect::<Vec<_>>()
            }),
            events,
        }
    }

    pub fn provider_default(&self) -> ProviderKind {
        self.config.provider
    }

    pub fn save_thread_checkpoint(
        &self,
        thread_id: &str,
        checkpoint_id: &str,
        state: &Value,
    ) -> Result<()> {
        self.thread_manager
            .state_store()
            .save_checkpoint(thread_id, checkpoint_id, state)
    }

    pub fn load_thread_checkpoint(
        &self,
        thread_id: &str,
        checkpoint_id: Option<&str>,
    ) -> Result<Option<Value>> {
        Ok(self
            .thread_manager
            .state_store()
            .load_checkpoint(thread_id, checkpoint_id)?
            .map(|checkpoint| checkpoint.state))
    }

    pub fn enqueue_job(&mut self, name: impl Into<String>) -> Result<JobRecord> {
        let job = self.jobs.enqueue(name);
        self.jobs.persist_job(self.thread_manager.state_store(), &job.id)?;
        Ok(job)
    }

    pub fn set_job_running(&mut self, job_id: &str) -> Result<()> {
        self.jobs.set_running(job_id);
        self.jobs.persist_job(self.thread_manager.state_store(), job_id)
    }

    pub fn update_job_progress(
        &mut self,
        job_id: &str,
        progress: u8,
        detail: Option<String>,
    ) -> Result<()> {
        self.jobs.update_progress(job_id, progress, detail);
        self.jobs.persist_job(self.thread_manager.state_store(), job_id)
    }

    pub fn complete_job(&mut self, job_id: &str) -> Result<()> {
        self.jobs.complete(job_id);
        self.jobs.persist_job(self.thread_manager.state_store(), job_id)
    }

    pub fn fail_job(&mut self, job_id: &str, detail: impl Into<String>) -> Result<()> {
        self.jobs.fail(job_id, detail);
        self.jobs.persist_job(self.thread_manager.state_store(), job_id)
    }

    pub fn cancel_job(&mut self, job_id: &str) -> Result<()> {
        self.jobs.cancel(job_id);
        self.jobs.persist_job(self.thread_manager.state_store(), job_id)
    }

    pub fn pause_job(&mut self, job_id: &str, detail: Option<String>) -> Result<()> {
        self.jobs.pause(job_id, detail);
        self.jobs.persist_job(self.thread_manager.state_store(), job_id)
    }

    pub fn resume_job(&mut self, job_id: &str, detail: Option<String>) -> Result<()> {
        self.jobs.resume(job_id, detail);
        self.jobs.persist_job(self.thread_manager.state_store(), job_id)
    }

    pub fn job_history(&self, job_id: &str) -> Vec<JobHistoryEntry> {
        self.jobs.history(job_id)
    }
}
