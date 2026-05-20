use std::collections::HashMap;
use std::path::{Path, PathBuf};

use anyhow::Result;
use serde_json::{Value, json};
use uuid::Uuid;
use yunpat_protocol::{
    Thread, ThreadForkParams, ThreadListParams, ThreadReadParams, ThreadResumeParams,
    ThreadSetNameParams, ThreadStatus,
};
use yunpat_state::{
    SessionSource, StateStore, ThreadListFilters, ThreadMetadata,
    ThreadStatus as PersistedThreadStatus,
};

use crate::{InitialHistory, NewThread};

pub struct ThreadManager {
    store: StateStore,
    running_threads: HashMap<String, Thread>,
    cli_version: String,
}

impl ThreadManager {
    pub fn new(store: StateStore) -> Self {
        Self {
            store,
            running_threads: HashMap::new(),
            cli_version: env!("CARGO_PKG_VERSION").to_string(),
        }
    }

    pub fn state_store(&self) -> &StateStore {
        &self.store
    }

    pub fn spawn_thread_with_history(
        &mut self,
        model_provider: String,
        cwd: PathBuf,
        initial_history: InitialHistory,
        persist_extended_history: bool,
    ) -> Result<NewThread> {
        let id = format!("thread-{}", Uuid::new_v4());
        let now = chrono::Utc::now().timestamp();
        let preview = preview_from_initial_history(&initial_history);
        let source = match initial_history {
            InitialHistory::New => SessionSource::Interactive,
            InitialHistory::Forked(_) => SessionSource::Fork,
            InitialHistory::Resumed { .. } => SessionSource::Resume,
        };
        let thread = Thread {
            id: id.clone(),
            preview,
            ephemeral: !persist_extended_history,
            model_provider: model_provider.clone(),
            created_at: now,
            updated_at: now,
            status: ThreadStatus::Running,
            path: None,
            cwd: cwd.clone(),
            cli_version: self.cli_version.clone(),
            source: match source {
                SessionSource::Interactive => yunpat_protocol::SessionSource::Interactive,
                SessionSource::Resume => yunpat_protocol::SessionSource::Resume,
                SessionSource::Fork => yunpat_protocol::SessionSource::Fork,
                SessionSource::Api => yunpat_protocol::SessionSource::Api,
                SessionSource::Unknown => yunpat_protocol::SessionSource::Unknown,
            },
            name: None,
        };
        self.persist_thread(&thread, None)?;
        match &initial_history {
            InitialHistory::Forked(items) => {
                for item in items {
                    self.store.append_message(
                        &thread.id,
                        "history",
                        &item.to_string(),
                        Some(item.clone()),
                    )?;
                }
            }
            InitialHistory::Resumed { history, .. } => {
                for item in history {
                    self.store.append_message(
                        &thread.id,
                        "history",
                        &item.to_string(),
                        Some(item.clone()),
                    )?;
                }
            }
            InitialHistory::New => {}
        }
        self.running_threads.insert(thread.id.clone(), thread.clone());
        Ok(NewThread {
            thread,
            model: "auto".to_string(),
            model_provider,
            cwd,
            approval_policy: None,
            sandbox: None,
        })
    }

    pub fn resume_thread_with_history(
        &mut self,
        params: &ThreadResumeParams,
        fallback_cwd: &Path,
        model_provider: String,
    ) -> Result<Option<NewThread>> {
        if params.history.is_none()
            && let Some(thread) = self.running_threads.get(&params.thread_id).cloned()
        {
            return Ok(Some(NewThread {
                model: params.model.clone().unwrap_or_else(|| "auto".to_string()),
                model_provider: params.model_provider.clone().unwrap_or(model_provider),
                cwd: params.cwd.clone().unwrap_or_else(|| thread.cwd.clone()),
                approval_policy: params.approval_policy.clone(),
                sandbox: params.sandbox.clone(),
                thread,
            }));
        }

        let persisted = self.store.get_thread(&params.thread_id)?;
        let Some(metadata) = persisted else {
            return Ok(None);
        };
        let mut thread = to_protocol_thread(metadata);
        thread.status = ThreadStatus::Running;
        thread.updated_at = chrono::Utc::now().timestamp();
        thread.cwd = params.cwd.clone().unwrap_or_else(|| fallback_cwd.to_path_buf());

        if let Some(patent_ctx) = &params.patent_context
            && patent_ctx.pending_hitl
        {
            tracing::info!(
                thread_id = %thread.id,
                intent = %patent_ctx.intent_type,
                "Resuming thread with pending HITL patent context"
            );
        }

        let mut _hitl_injected = false;
        if let Ok(Some(cp)) = self.store.load_unified_checkpoint(&thread.id, None)
            && matches!(cp.source, yunpat_state::CheckpointSource::TsOrchestrator)
        {
            tracing::info!(
                thread_id = %thread.id,
                checkpoint_id = %cp.checkpoint_id,
                "Found TS orchestrator checkpoint during resume"
            );

            if let Some(state) = cp.orchestrator_state {
                let hitl_msg = json!({
                    "role": "system",
                    "content": format!("⚠️ [系统提示] 检测到未完成的人机协作(HITL)任务，请根据以下待审内容继续处理：\n```json\n{}\n```", serde_json::to_string_pretty(&state).unwrap_or_default())
                });

                self.store.append_message(
                    &thread.id,
                    "system",
                    &hitl_msg.to_string(),
                    Some(hitl_msg),
                )?;
                _hitl_injected = true;
            }
        }

        self.persist_thread(&thread, None)?;
        self.running_threads.insert(thread.id.clone(), thread.clone());
        if let Some(history) = params.history.as_ref() {
            for item in history {
                self.store.append_message(
                    &thread.id,
                    "history",
                    &item.to_string(),
                    Some(item.clone()),
                )?;
            }
        }

        Ok(Some(NewThread {
            model: params.model.clone().unwrap_or_else(|| "auto".to_string()),
            model_provider: params.model_provider.clone().unwrap_or(model_provider),
            cwd: thread.cwd.clone(),
            approval_policy: params.approval_policy.clone(),
            sandbox: params.sandbox.clone(),
            thread,
        }))
    }

    pub fn fork_thread(
        &mut self,
        params: &ThreadForkParams,
        fallback_cwd: &Path,
    ) -> Result<Option<NewThread>> {
        let parent = self.store.get_thread(&params.thread_id)?;
        let Some(parent) = parent else {
            return Ok(None);
        };
        let parent_thread = to_protocol_thread(parent);
        let new = self.spawn_thread_with_history(
            params
                .model_provider
                .clone()
                .unwrap_or_else(|| parent_thread.model_provider.clone()),
            params.cwd.clone().unwrap_or_else(|| fallback_cwd.to_path_buf()),
            InitialHistory::Forked(vec![json!({
                "type": "fork",
                "from_thread_id": parent_thread.id
            })]),
            params.persist_extended_history,
        )?;
        Ok(Some(new))
    }

    pub fn list_threads(&self, params: &ThreadListParams) -> Result<Vec<Thread>> {
        let list = self.store.list_threads(ThreadListFilters {
            include_archived: params.include_archived,
            limit: params.limit,
        })?;
        Ok(list.into_iter().map(to_protocol_thread).collect())
    }

    pub fn read_thread(&self, params: &ThreadReadParams) -> Result<Option<Thread>> {
        Ok(self.store.get_thread(&params.thread_id)?.map(to_protocol_thread))
    }

    pub fn set_thread_name(&mut self, params: &ThreadSetNameParams) -> Result<Option<Thread>> {
        let Some(mut metadata) = self.store.get_thread(&params.thread_id)? else {
            return Ok(None);
        };
        metadata.name = Some(params.name.clone());
        metadata.updated_at = chrono::Utc::now().timestamp();
        self.store.upsert_thread(&metadata)?;
        let updated = to_protocol_thread(metadata);
        self.running_threads.insert(updated.id.clone(), updated.clone());
        Ok(Some(updated))
    }

    pub fn archive_thread(&mut self, thread_id: &str) -> Result<()> {
        self.store.mark_archived(thread_id)?;
        if let Some(thread) = self.running_threads.get_mut(thread_id) {
            thread.status = ThreadStatus::Archived;
        }
        Ok(())
    }

    pub fn unarchive_thread(&mut self, thread_id: &str) -> Result<()> {
        self.store.mark_unarchived(thread_id)?;
        Ok(())
    }

    pub fn touch_message(&mut self, thread_id: &str, input: &str) -> Result<()> {
        let Some(mut metadata) = self.store.get_thread(thread_id)? else {
            return Ok(());
        };
        metadata.updated_at = chrono::Utc::now().timestamp();
        metadata.preview = truncate_preview(input);
        metadata.status = PersistedThreadStatus::Running;
        self.store.upsert_thread(&metadata)?;
        if let Some(thread) = self.running_threads.get_mut(thread_id) {
            thread.updated_at = metadata.updated_at;
            thread.preview = metadata.preview;
            thread.status = ThreadStatus::Running;
        }
        let message_id = self.store.append_message(thread_id, "user", input, None)?;
        self.store.save_checkpoint(
            thread_id,
            "latest",
            &json!({
                "reason": "thread_message",
                "message_id": message_id,
                "role": "user",
                "preview": truncate_preview(input),
                "updated_at": metadata.updated_at
            }),
        )?;
        Ok(())
    }

    fn persist_thread(&self, thread: &Thread, rollout_path: Option<PathBuf>) -> Result<()> {
        self.store.upsert_thread(&ThreadMetadata {
            id: thread.id.clone(),
            rollout_path,
            preview: thread.preview.clone(),
            ephemeral: thread.ephemeral,
            model_provider: thread.model_provider.clone(),
            created_at: thread.created_at,
            updated_at: thread.updated_at,
            status: to_persisted_status(&thread.status),
            path: thread.path.clone(),
            cwd: thread.cwd.clone(),
            cli_version: thread.cli_version.clone(),
            source: to_persisted_source(&thread.source),
            name: thread.name.clone(),
            sandbox_policy: None,
            approval_mode: None,
            archived: matches!(thread.status, ThreadStatus::Archived),
            archived_at: None,
            git_sha: None,
            git_branch: None,
            git_origin_url: None,
            memory_mode: None,
        })
    }
}

fn to_protocol_thread(thread: ThreadMetadata) -> Thread {
    Thread {
        id: thread.id,
        preview: thread.preview,
        ephemeral: thread.ephemeral,
        model_provider: thread.model_provider,
        created_at: thread.created_at,
        updated_at: thread.updated_at,
        status: match thread.status {
            PersistedThreadStatus::Running => ThreadStatus::Running,
            PersistedThreadStatus::Idle => ThreadStatus::Idle,
            PersistedThreadStatus::Completed => ThreadStatus::Completed,
            PersistedThreadStatus::Failed => ThreadStatus::Failed,
            PersistedThreadStatus::Paused => ThreadStatus::Paused,
            PersistedThreadStatus::Archived => ThreadStatus::Archived,
        },
        path: thread.path,
        cwd: thread.cwd,
        cli_version: thread.cli_version,
        source: match thread.source {
            SessionSource::Interactive => yunpat_protocol::SessionSource::Interactive,
            SessionSource::Resume => yunpat_protocol::SessionSource::Resume,
            SessionSource::Fork => yunpat_protocol::SessionSource::Fork,
            SessionSource::Api => yunpat_protocol::SessionSource::Api,
            SessionSource::Unknown => yunpat_protocol::SessionSource::Unknown,
        },
        name: thread.name,
    }
}

fn to_persisted_status(status: &ThreadStatus) -> PersistedThreadStatus {
    match status {
        ThreadStatus::Running => PersistedThreadStatus::Running,
        ThreadStatus::Idle => PersistedThreadStatus::Idle,
        ThreadStatus::Completed => PersistedThreadStatus::Completed,
        ThreadStatus::Failed => PersistedThreadStatus::Failed,
        ThreadStatus::Paused => PersistedThreadStatus::Paused,
        ThreadStatus::Archived => PersistedThreadStatus::Archived,
    }
}

fn to_persisted_source(source: &yunpat_protocol::SessionSource) -> SessionSource {
    match source {
        yunpat_protocol::SessionSource::Interactive => SessionSource::Interactive,
        yunpat_protocol::SessionSource::Resume => SessionSource::Resume,
        yunpat_protocol::SessionSource::Fork => SessionSource::Fork,
        yunpat_protocol::SessionSource::Api => SessionSource::Api,
        yunpat_protocol::SessionSource::Unknown => SessionSource::Unknown,
    }
}

pub(crate) fn preview_from_initial_history(initial_history: &InitialHistory) -> String {
    match initial_history {
        InitialHistory::New => "New conversation".to_string(),
        InitialHistory::Forked(items) => truncate_preview(
            &items
                .first()
                .map(Value::to_string)
                .unwrap_or_else(|| "Forked conversation".to_string()),
        ),
        InitialHistory::Resumed { history, .. } => truncate_preview(
            &history
                .first()
                .map(Value::to_string)
                .unwrap_or_else(|| "Resumed conversation".to_string()),
        ),
    }
}

pub(crate) fn truncate_preview(value: &str) -> String {
    value.chars().take(120).collect()
}
