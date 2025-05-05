pub mod checkpoint_schema;

use std::collections::HashMap;
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use chrono::Utc;
use rusqlite::{Connection, OptionalExtension, params};
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub use checkpoint_schema::{
    CheckpointSource, UNIFIED_CHECKPOINT_SCHEMA_VERSION, UnifiedCheckpoint,
};

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
pub struct ThreadMetadata {
    pub id: String,
    pub rollout_path: Option<PathBuf>,
    pub preview: String,
    pub ephemeral: bool,
    pub model_provider: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub status: ThreadStatus,
    pub path: Option<PathBuf>,
    pub cwd: PathBuf,
    pub cli_version: String,
    pub source: SessionSource,
    pub name: Option<String>,
    pub sandbox_policy: Option<String>,
    pub approval_mode: Option<String>,
    pub archived: bool,
    pub archived_at: Option<i64>,
    pub git_sha: Option<String>,
    pub git_branch: Option<String>,
    pub git_origin_url: Option<String>,
    pub memory_mode: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DynamicToolRecord {
    pub position: i64,
    pub name: String,
    pub description: Option<String>,
    pub input_schema: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageRecord {
    pub id: i64,
    pub thread_id: String,
    pub role: String,
    pub content: String,
    pub item: Option<Value>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckpointRecord {
    pub thread_id: String,
    pub checkpoint_id: String,
    pub state: Value,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum JobStateStatus {
    Queued,
    Running,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobStateRecord {
    pub id: String,
    pub name: String,
    pub status: JobStateStatus,
    pub progress: Option<u8>,
    pub detail: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone)]
pub struct ThreadListFilters {
    pub include_archived: bool,
    pub limit: Option<usize>,
}

impl Default for ThreadListFilters {
    fn default() -> Self {
        Self {
            include_archived: false,
            limit: Some(50),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SessionIndexEntry {
    thread_id: String,
    thread_name: Option<String>,
    updated_at: i64,
    rollout_path: Option<PathBuf>,
}

#[derive(Debug, Clone)]
pub struct StateStore {
    db_path: PathBuf,
    session_index_path: PathBuf,
}

impl StateStore {
    pub fn open(path: Option<PathBuf>) -> Result<Self> {
        let db_path = path.unwrap_or_else(default_state_db_path);
        let session_index_path = db_path
            .parent()
            .unwrap_or_else(|| Path::new("."))
            .join("session_index.jsonl");
        if let Some(parent) = db_path.parent() {
            fs::create_dir_all(parent).with_context(|| {
                format!("failed to create state directory {}", parent.display())
            })?;
        }
        let store = Self {
            db_path,
            session_index_path,
        };
        store.init_schema()?;
        Ok(store)
    }

    pub fn db_path(&self) -> &Path {
        &self.db_path
    }

    fn conn(&self) -> Result<Connection> {
        Connection::open(&self.db_path)
            .with_context(|| format!("failed to open state db {}", self.db_path.display()))
    }

    fn init_schema(&self) -> Result<()> {
        let conn = self.conn()?;
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS threads (
                id TEXT PRIMARY KEY,
                rollout_path TEXT,
                preview TEXT NOT NULL,
                ephemeral INTEGER NOT NULL,
                model_provider TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                status TEXT NOT NULL,
                path TEXT,
                cwd TEXT NOT NULL,
                cli_version TEXT NOT NULL,
                source TEXT NOT NULL,
                title TEXT,
                sandbox_policy TEXT,
                approval_mode TEXT,
                archived INTEGER NOT NULL DEFAULT 0,
                archived_at INTEGER,
                git_sha TEXT,
                git_branch TEXT,
                git_origin_url TEXT,
                memory_mode TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_threads_updated_at ON threads(updated_at DESC);
            CREATE INDEX IF NOT EXISTS idx_threads_archived_at ON threads(archived_at DESC);
            CREATE INDEX IF NOT EXISTS idx_threads_archived_updated ON threads(archived, updated_at DESC);

            CREATE TABLE IF NOT EXISTS thread_dynamic_tools (
                thread_id TEXT NOT NULL,
                position INTEGER NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                input_schema TEXT NOT NULL,
                PRIMARY KEY (thread_id, position),
                FOREIGN KEY(thread_id) REFERENCES threads(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                thread_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                item_json TEXT,
                created_at INTEGER NOT NULL,
                FOREIGN KEY(thread_id) REFERENCES threads(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_messages_thread_created_at ON messages(thread_id, created_at ASC);

            CREATE TABLE IF NOT EXISTS checkpoints (
                thread_id TEXT NOT NULL,
                checkpoint_id TEXT NOT NULL,
                state_json TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                PRIMARY KEY(thread_id, checkpoint_id),
                FOREIGN KEY(thread_id) REFERENCES threads(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_checkpoints_thread_created_at ON checkpoints(thread_id, created_at DESC);

            CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                status TEXT NOT NULL,
                progress INTEGER,
                detail TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_jobs_updated_at ON jobs(updated_at DESC);

            -- Case management tables (M0.7)
            CREATE TABLE IF NOT EXISTS cases (
                case_id TEXT PRIMARY KEY,
                application_no TEXT,
                title TEXT NOT NULL,
                patent_type TEXT NOT NULL,
                inventor TEXT,
                agent TEXT,
                applicant TEXT,
                status TEXT NOT NULL DEFAULT 'active',
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);

            CREATE TABLE IF NOT EXISTS case_documents (
                doc_id TEXT PRIMARY KEY,
                case_id TEXT NOT NULL,
                doc_type TEXT NOT NULL,
                file_path TEXT NOT NULL,
                uploaded_at INTEGER NOT NULL,
                FOREIGN KEY(case_id) REFERENCES cases(case_id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_case_docs_case ON case_documents(case_id);

            CREATE TABLE IF NOT EXISTS case_tasks (
                task_id TEXT PRIMARY KEY,
                case_id TEXT NOT NULL,
                agent_id TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                started_at INTEGER NOT NULL,
                completed_at INTEGER,
                output_artifacts TEXT,
                FOREIGN KEY(case_id) REFERENCES cases(case_id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_case_tasks_case ON case_tasks(case_id);
            "#,
        )
        .context("failed to initialize thread schema")?;
        Ok(())
    }

    pub fn upsert_thread(&self, thread: &ThreadMetadata) -> Result<()> {
        let conn = self.conn()?;
        conn.execute(
            r#"
            INSERT INTO threads (
                id, rollout_path, preview, ephemeral, model_provider, created_at, updated_at, status, path, cwd,
                cli_version, source, title, sandbox_policy, approval_mode, archived, archived_at,
                git_sha, git_branch, git_origin_url, memory_mode
            ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10,
                ?11, ?12, ?13, ?14, ?15, ?16, ?17,
                ?18, ?19, ?20, ?21
            )
            ON CONFLICT(id) DO UPDATE SET
                rollout_path=excluded.rollout_path,
                preview=excluded.preview,
                ephemeral=excluded.ephemeral,
                model_provider=excluded.model_provider,
                created_at=excluded.created_at,
                updated_at=excluded.updated_at,
                status=excluded.status,
                path=excluded.path,
                cwd=excluded.cwd,
                cli_version=excluded.cli_version,
                source=excluded.source,
                title=excluded.title,
                sandbox_policy=excluded.sandbox_policy,
                approval_mode=excluded.approval_mode,
                archived=excluded.archived,
                archived_at=excluded.archived_at,
                git_sha=excluded.git_sha,
                git_branch=excluded.git_branch,
                git_origin_url=excluded.git_origin_url,
                memory_mode=excluded.memory_mode
            "#,
            params![
                thread.id,
                path_to_opt_string(thread.rollout_path.as_deref()),
                thread.preview,
                bool_to_i64(thread.ephemeral),
                thread.model_provider,
                thread.created_at,
                thread.updated_at,
                thread_status_to_str(&thread.status),
                path_to_opt_string(thread.path.as_deref()),
                thread.cwd.display().to_string(),
                thread.cli_version,
                session_source_to_str(&thread.source),
                thread.name,
                thread.sandbox_policy,
                thread.approval_mode,
                bool_to_i64(thread.archived),
                thread.archived_at,
                thread.git_sha,
                thread.git_branch,
                thread.git_origin_url,
                thread.memory_mode,
            ],
        )
        .context("failed to upsert thread metadata")?;

        self.append_thread_name(
            &thread.id,
            thread.name.clone(),
            thread.updated_at,
            thread.rollout_path.clone(),
        )?;
        Ok(())
    }

    pub fn get_thread(&self, id: &str) -> Result<Option<ThreadMetadata>> {
        let conn = self.conn()?;
        conn.query_row(
            r#"
            SELECT id, rollout_path, preview, ephemeral, model_provider, created_at, updated_at, status, path, cwd,
                   cli_version, source, title, sandbox_policy, approval_mode, archived, archived_at,
                   git_sha, git_branch, git_origin_url, memory_mode
            FROM threads
            WHERE id = ?1
            "#,
            params![id],
            row_to_thread,
        )
        .optional()
        .context("failed to read thread")
    }

    pub fn list_threads(&self, filters: ThreadListFilters) -> Result<Vec<ThreadMetadata>> {
        let conn = self.conn()?;
        let sql = if filters.include_archived {
            "SELECT id, rollout_path, preview, ephemeral, model_provider, created_at, updated_at, status, path, cwd, cli_version, source, title, sandbox_policy, approval_mode, archived, archived_at, git_sha, git_branch, git_origin_url, memory_mode FROM threads ORDER BY updated_at DESC LIMIT ?1"
        } else {
            "SELECT id, rollout_path, preview, ephemeral, model_provider, created_at, updated_at, status, path, cwd, cli_version, source, title, sandbox_policy, approval_mode, archived, archived_at, git_sha, git_branch, git_origin_url, memory_mode FROM threads WHERE archived = 0 ORDER BY updated_at DESC LIMIT ?1"
        };

        let mut stmt = conn.prepare(sql).context("failed to prepare list query")?;
        let limit = i64::try_from(filters.limit.unwrap_or(50)).unwrap_or(50);
        let mut rows = stmt
            .query(params![limit])
            .context("failed to query threads")?;
        let mut out = Vec::new();
        while let Some(row) = rows.next().context("failed to iterate thread rows")? {
            out.push(row_to_thread(row)?);
        }
        Ok(out)
    }

    pub fn mark_archived(&self, id: &str) -> Result<()> {
        let conn = self.conn()?;
        conn.execute(
            "UPDATE threads SET archived = 1, archived_at = ?2, status = ?3 WHERE id = ?1",
            params![
                id,
                Utc::now().timestamp(),
                thread_status_to_str(&ThreadStatus::Archived)
            ],
        )
        .context("failed to archive thread")?;
        Ok(())
    }

    pub fn mark_unarchived(&self, id: &str) -> Result<()> {
        let conn = self.conn()?;
        conn.execute(
            "UPDATE threads SET archived = 0, archived_at = NULL WHERE id = ?1",
            params![id],
        )
        .context("failed to unarchive thread")?;
        Ok(())
    }

    pub fn delete_thread(&self, id: &str) -> Result<()> {
        let conn = self.conn()?;
        conn.execute("DELETE FROM threads WHERE id = ?1", params![id])
            .context("failed to delete thread")?;
        Ok(())
    }

    pub fn set_thread_memory_mode(&self, id: &str, mode: Option<&str>) -> Result<()> {
        let conn = self.conn()?;
        conn.execute(
            "UPDATE threads SET memory_mode = ?2 WHERE id = ?1",
            params![id, mode],
        )
        .context("failed to update thread memory mode")?;
        Ok(())
    }

    pub fn get_thread_memory_mode(&self, id: &str) -> Result<Option<String>> {
        let conn = self.conn()?;
        conn.query_row(
            "SELECT memory_mode FROM threads WHERE id = ?1",
            params![id],
            |row| row.get::<_, Option<String>>(0),
        )
        .optional()
        .context("failed to read thread memory mode")
        .map(Option::flatten)
    }

    pub fn persist_dynamic_tools(
        &self,
        thread_id: &str,
        tools: &[DynamicToolRecord],
    ) -> Result<()> {
        let mut conn = self.conn()?;
        let tx = conn
            .transaction()
            .context("failed to begin dynamic tools transaction")?;
        tx.execute(
            "DELETE FROM thread_dynamic_tools WHERE thread_id = ?1",
            params![thread_id],
        )
        .context("failed to clear dynamic tools")?;
        for tool in tools {
            tx.execute(
                "INSERT INTO thread_dynamic_tools(thread_id, position, name, description, input_schema) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    thread_id,
                    tool.position,
                    tool.name,
                    tool.description,
                    tool.input_schema.to_string()
                ],
            )
            .with_context(|| format!("failed to persist dynamic tool {}", tool.name))?;
        }
        tx.commit().context("failed to commit dynamic tools")?;
        Ok(())
    }

    pub fn get_dynamic_tools(&self, thread_id: &str) -> Result<Vec<DynamicToolRecord>> {
        let conn = self.conn()?;
        let mut stmt = conn
            .prepare(
                "SELECT position, name, description, input_schema FROM thread_dynamic_tools WHERE thread_id = ?1 ORDER BY position ASC",
            )
            .context("failed to prepare get dynamic tools query")?;
        let mut rows = stmt
            .query(params![thread_id])
            .context("failed to query dynamic tools")?;
        let mut out = Vec::new();
        while let Some(row) = rows.next().context("failed to iterate dynamic tools")? {
            let input_schema_raw: String =
                row.get(3).context("failed to read tool input schema")?;
            let input_schema: Value =
                serde_json::from_str(&input_schema_raw).with_context(|| {
                    format!("failed to parse input schema for dynamic tool in thread {thread_id}")
                })?;
            out.push(DynamicToolRecord {
                position: row.get(0).context("failed to read tool position")?,
                name: row.get(1).context("failed to read tool name")?,
                description: row.get(2).context("failed to read tool description")?,
                input_schema,
            });
        }
        Ok(out)
    }

    pub fn append_message(
        &self,
        thread_id: &str,
        role: &str,
        content: &str,
        item: Option<Value>,
    ) -> Result<i64> {
        let conn = self.conn()?;
        let created_at = Utc::now().timestamp();
        let item_json = item
            .as_ref()
            .map(serde_json::to_string)
            .transpose()
            .context("failed to serialize message item payload")?;
        conn.execute(
            "INSERT INTO messages(thread_id, role, content, item_json, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![thread_id, role, content, item_json, created_at],
        )
        .with_context(|| format!("failed to append message for thread {thread_id}"))?;
        Ok(conn.last_insert_rowid())
    }

    pub fn list_messages(
        &self,
        thread_id: &str,
        limit: Option<usize>,
    ) -> Result<Vec<MessageRecord>> {
        let conn = self.conn()?;
        let limit = i64::try_from(limit.unwrap_or(500)).unwrap_or(500);
        let mut stmt = conn
            .prepare(
                "SELECT id, thread_id, role, content, item_json, created_at FROM messages WHERE thread_id = ?1 ORDER BY created_at ASC LIMIT ?2",
            )
            .context("failed to prepare message listing query")?;
        let mut rows = stmt
            .query(params![thread_id, limit])
            .with_context(|| format!("failed to list messages for thread {thread_id}"))?;
        let mut out = Vec::new();
        while let Some(row) = rows.next().context("failed to iterate message rows")? {
            let item_json: Option<String> = row.get(4).context("failed to read item json")?;
            let item = item_json
                .as_deref()
                .map(serde_json::from_str)
                .transpose()
                .with_context(|| {
                    format!("failed to parse message item json in thread {thread_id}")
                })?;
            out.push(MessageRecord {
                id: row.get(0).context("failed to read message id")?,
                thread_id: row.get(1).context("failed to read message thread id")?,
                role: row.get(2).context("failed to read message role")?,
                content: row.get(3).context("failed to read message content")?,
                item,
                created_at: row.get(5).context("failed to read message timestamp")?,
            });
        }
        Ok(out)
    }

    pub fn clear_messages(&self, thread_id: &str) -> Result<usize> {
        let conn = self.conn()?;
        conn.execute(
            "DELETE FROM messages WHERE thread_id = ?1",
            params![thread_id],
        )
        .with_context(|| format!("failed to clear messages for thread {thread_id}"))
    }

    pub fn save_checkpoint(
        &self,
        thread_id: &str,
        checkpoint_id: &str,
        state: &Value,
    ) -> Result<()> {
        self.save_checkpoint_v2(
            thread_id,
            checkpoint_id,
            CheckpointSource::RustEngine,
            state,
            &Value::Null,
        )
    }

    pub fn save_checkpoint_v2(
        &self,
        thread_id: &str,
        checkpoint_id: &str,
        source: CheckpointSource,
        engine_state: &Value,
        metadata: &Value,
    ) -> Result<()> {
        let unified = UnifiedCheckpoint::new(
            checkpoint_id.to_string(),
            thread_id.to_string(),
            source,
            Utc::now().timestamp(),
        )
        .with_engine_state(engine_state.clone())
        .with_metadata(metadata.clone());

        let state_json =
            serde_json::to_string(&unified).context("failed to encode unified checkpoint")?;
        let conn = self.conn()?;
        conn.execute(
            r#"
            INSERT INTO checkpoints(thread_id, checkpoint_id, state_json, created_at)
            VALUES (?1, ?2, ?3, ?4)
            ON CONFLICT(thread_id, checkpoint_id) DO UPDATE SET
                state_json = excluded.state_json,
                created_at = excluded.created_at
            "#,
            params![thread_id, checkpoint_id, state_json, unified.created_at],
        )
        .with_context(|| {
            format!("failed to save checkpoint v2 {checkpoint_id} for thread {thread_id}")
        })?;
        Ok(())
    }

    pub fn load_checkpoint(
        &self,
        thread_id: &str,
        checkpoint_id: Option<&str>,
    ) -> Result<Option<CheckpointRecord>> {
        let conn = self.conn()?;
        if let Some(checkpoint_id) = checkpoint_id {
            let row = conn
                .query_row(
                    "SELECT thread_id, checkpoint_id, state_json, created_at FROM checkpoints WHERE thread_id = ?1 AND checkpoint_id = ?2",
                    params![thread_id, checkpoint_id],
                    |row| {
                        let state_json: String = row.get(2)?;
                        let state = parse_checkpoint_state(&state_json);
                        Ok(CheckpointRecord {
                            thread_id: row.get(0)?,
                            checkpoint_id: row.get(1)?,
                            state,
                            created_at: row.get(3)?,
                        })
                    },
                )
                .optional()
                .with_context(|| {
                    format!("failed to load checkpoint {checkpoint_id} for thread {thread_id}")
                })?;
            return Ok(row);
        }

        conn.query_row(
            "SELECT thread_id, checkpoint_id, state_json, created_at FROM checkpoints WHERE thread_id = ?1 ORDER BY created_at DESC LIMIT 1",
            params![thread_id],
            |row| {
                let state_json: String = row.get(2)?;
                let state = parse_checkpoint_state(&state_json);
                Ok(CheckpointRecord {
                    thread_id: row.get(0)?,
                    checkpoint_id: row.get(1)?,
                    state,
                    created_at: row.get(3)?,
                })
            },
        )
        .optional()
        .with_context(|| format!("failed to load latest checkpoint for thread {thread_id}"))
    }

    pub fn load_unified_checkpoint(
        &self,
        thread_id: &str,
        checkpoint_id: Option<&str>,
    ) -> Result<Option<UnifiedCheckpoint>> {
        let conn = self.conn()?;
        if let Some(checkpoint_id) = checkpoint_id {
            let row: Option<String> = conn
                .query_row(
                    "SELECT state_json FROM checkpoints WHERE thread_id = ?1 AND checkpoint_id = ?2",
                    params![thread_id, checkpoint_id],
                    |row| row.get::<_, String>(0),
                )
                .optional()
                .with_context(|| {
                    format!("failed to load unified checkpoint {checkpoint_id} for thread {thread_id}")
                })?;
            return match row {
                Some(json) => {
                    let mut cp = parse_unified_checkpoint(&json)?;
                    if cp.checkpoint_id.is_empty() {
                        cp.checkpoint_id = checkpoint_id.to_string();
                    }
                    if cp.thread_id.is_empty() {
                        cp.thread_id = thread_id.to_string();
                    }
                    Ok(Some(cp))
                }
                None => Ok(None),
            };
        }

        let row: Option<String> = conn
            .query_row(
                "SELECT state_json FROM checkpoints WHERE thread_id = ?1 ORDER BY created_at DESC LIMIT 1",
                params![thread_id],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .with_context(|| format!("failed to load latest unified checkpoint for thread {thread_id}"))?;
        match row {
            Some(json) => {
                let mut cp = parse_unified_checkpoint(&json)?;
                if cp.thread_id.is_empty() {
                    cp.thread_id = thread_id.to_string();
                }
                Ok(Some(cp))
            }
            None => Ok(None),
        }
    }

    pub fn list_checkpoints(
        &self,
        thread_id: &str,
        limit: Option<usize>,
    ) -> Result<Vec<CheckpointRecord>> {
        let conn = self.conn()?;
        let limit = i64::try_from(limit.unwrap_or(100)).unwrap_or(100);
        let mut stmt = conn
            .prepare(
                "SELECT thread_id, checkpoint_id, state_json, created_at FROM checkpoints WHERE thread_id = ?1 ORDER BY created_at DESC LIMIT ?2",
            )
            .context("failed to prepare checkpoint list query")?;
        let mut rows = stmt
            .query(params![thread_id, limit])
            .with_context(|| format!("failed to list checkpoints for thread {thread_id}"))?;

        let mut out = Vec::new();
        while let Some(row) = rows.next().context("failed to iterate checkpoint rows")? {
            let state_json: String = row.get(2).context("failed to read checkpoint state json")?;
            let state = parse_checkpoint_state(&state_json);
            out.push(CheckpointRecord {
                thread_id: row.get(0).context("failed to read checkpoint thread id")?,
                checkpoint_id: row.get(1).context("failed to read checkpoint id")?,
                state,
                created_at: row.get(3).context("failed to read checkpoint timestamp")?,
            });
        }
        Ok(out)
    }

    pub fn list_unified_checkpoints(
        &self,
        thread_id: &str,
        limit: Option<usize>,
    ) -> Result<Vec<UnifiedCheckpoint>> {
        let conn = self.conn()?;
        let limit = i64::try_from(limit.unwrap_or(100)).unwrap_or(100);
        let mut stmt = conn
            .prepare(
                "SELECT state_json FROM checkpoints WHERE thread_id = ?1 ORDER BY created_at DESC LIMIT ?2",
            )
            .context("failed to prepare unified checkpoint list query")?;
        let mut rows = stmt.query(params![thread_id, limit]).with_context(|| {
            format!("failed to list unified checkpoints for thread {thread_id}")
        })?;

        let mut out = Vec::new();
        while let Some(row) = rows
            .next()
            .context("failed to iterate unified checkpoint rows")?
        {
            let state_json: String = row
                .get(0)
                .context("failed to read unified checkpoint state json")?;
            let checkpoint = parse_unified_checkpoint(&state_json)?;
            out.push(checkpoint);
        }
        Ok(out)
    }

    pub fn delete_checkpoint(&self, thread_id: &str, checkpoint_id: &str) -> Result<()> {
        let conn = self.conn()?;
        conn.execute(
            "DELETE FROM checkpoints WHERE thread_id = ?1 AND checkpoint_id = ?2",
            params![thread_id, checkpoint_id],
        )
        .with_context(|| {
            format!("failed to delete checkpoint {checkpoint_id} for thread {thread_id}")
        })?;
        Ok(())
    }

    pub fn upsert_job(&self, job: &JobStateRecord) -> Result<()> {
        let conn = self.conn()?;
        conn.execute(
            r#"
            INSERT INTO jobs(id, name, status, progress, detail, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                status = excluded.status,
                progress = excluded.progress,
                detail = excluded.detail,
                created_at = excluded.created_at,
                updated_at = excluded.updated_at
            "#,
            params![
                job.id,
                job.name,
                job_state_status_to_str(&job.status),
                job.progress.map(i64::from),
                job.detail,
                job.created_at,
                job.updated_at
            ],
        )
        .with_context(|| format!("failed to upsert job {}", job.id))?;
        Ok(())
    }

    pub fn get_job(&self, id: &str) -> Result<Option<JobStateRecord>> {
        let conn = self.conn()?;
        conn.query_row(
            "SELECT id, name, status, progress, detail, created_at, updated_at FROM jobs WHERE id = ?1",
            params![id],
            |row| {
                let status_raw: String = row.get(2)?;
                let progress: Option<i64> = row.get(3)?;
                Ok(JobStateRecord {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    status: job_state_status_from_str(&status_raw),
                    progress: progress.and_then(|v| u8::try_from(v).ok()),
                    detail: row.get(4)?,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            },
        )
        .optional()
        .with_context(|| format!("failed to read job {id}"))
    }

    pub fn list_jobs(&self, limit: Option<usize>) -> Result<Vec<JobStateRecord>> {
        let conn = self.conn()?;
        let limit = i64::try_from(limit.unwrap_or(100)).unwrap_or(100);
        let mut stmt = conn
            .prepare(
                "SELECT id, name, status, progress, detail, created_at, updated_at FROM jobs ORDER BY updated_at DESC LIMIT ?1",
            )
            .context("failed to prepare job list query")?;
        let mut rows = stmt
            .query(params![limit])
            .context("failed to query persisted jobs")?;
        let mut out = Vec::new();
        while let Some(row) = rows.next().context("failed to iterate persisted jobs")? {
            let status_raw: String = row.get(2).context("failed to read job status")?;
            let progress: Option<i64> = row.get(3).context("failed to read job progress")?;
            out.push(JobStateRecord {
                id: row.get(0).context("failed to read job id")?,
                name: row.get(1).context("failed to read job name")?,
                status: job_state_status_from_str(&status_raw),
                progress: progress.and_then(|v| u8::try_from(v).ok()),
                detail: row.get(4).context("failed to read job detail")?,
                created_at: row.get(5).context("failed to read job created_at")?,
                updated_at: row.get(6).context("failed to read job updated_at")?,
            });
        }
        Ok(out)
    }

    pub fn delete_job(&self, id: &str) -> Result<()> {
        let conn = self.conn()?;
        conn.execute("DELETE FROM jobs WHERE id = ?1", params![id])
            .with_context(|| format!("failed to delete job {id}"))?;
        Ok(())
    }

    pub fn find_rollout_path_by_id(&self, id: &str) -> Result<Option<PathBuf>> {
        let conn = self.conn()?;
        conn.query_row(
            "SELECT rollout_path FROM threads WHERE id = ?1",
            params![id],
            |row| row.get::<_, Option<String>>(0),
        )
        .optional()
        .context("failed to lookup rollout path")
        .map(|opt| opt.flatten().map(PathBuf::from))
    }

    pub fn append_thread_name(
        &self,
        thread_id: &str,
        thread_name: Option<String>,
        updated_at: i64,
        rollout_path: Option<PathBuf>,
    ) -> Result<()> {
        if let Some(parent) = self.session_index_path.parent() {
            fs::create_dir_all(parent).with_context(|| {
                format!(
                    "failed to create session index directory {}",
                    parent.display()
                )
            })?;
        }
        let entry = SessionIndexEntry {
            thread_id: thread_id.to_string(),
            thread_name,
            updated_at,
            rollout_path,
        };
        let encoded =
            serde_json::to_string(&entry).context("failed to serialize session index entry")?;
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.session_index_path)
            .with_context(|| {
                format!(
                    "failed to open session index {}",
                    self.session_index_path.display()
                )
            })?;
        writeln!(file, "{encoded}").context("failed to append session index entry")?;
        Ok(())
    }

    pub fn find_thread_name_by_id(&self, thread_id: &str) -> Result<Option<String>> {
        let map = self.session_index_map()?;
        Ok(map
            .get(thread_id)
            .and_then(|entry| entry.thread_name.clone()))
    }

    pub fn find_thread_names_by_ids(
        &self,
        ids: &[String],
    ) -> Result<HashMap<String, Option<String>>> {
        let map = self.session_index_map()?;
        let mut out = HashMap::new();
        for id in ids {
            let name = map.get(id).and_then(|entry| entry.thread_name.clone());
            out.insert(id.clone(), name);
        }
        Ok(out)
    }

    pub fn find_thread_path_by_name_str(&self, name: &str) -> Result<Option<PathBuf>> {
        let map = self.session_index_map()?;
        let matched = map
            .values()
            .filter(|entry| {
                entry
                    .thread_name
                    .as_deref()
                    .is_some_and(|n| n.eq_ignore_ascii_case(name))
            })
            .max_by_key(|entry| entry.updated_at);
        Ok(matched.and_then(|entry| entry.rollout_path.clone()))
    }

    fn session_index_map(&self) -> Result<HashMap<String, SessionIndexEntry>> {
        if !self.session_index_path.exists() {
            return Ok(HashMap::new());
        }
        let file = OpenOptions::new()
            .read(true)
            .open(&self.session_index_path)
            .with_context(|| {
                format!(
                    "failed to read session index {}",
                    self.session_index_path.display()
                )
            })?;
        let reader = BufReader::new(file);
        let mut latest = HashMap::<String, SessionIndexEntry>::new();
        for line in reader.lines() {
            let line = line.context("failed to read session index line")?;
            if line.trim().is_empty() {
                continue;
            }
            let parsed: SessionIndexEntry =
                serde_json::from_str(&line).context("failed to parse session index entry")?;
            latest.insert(parsed.thread_id.clone(), parsed);
        }
        Ok(latest)
    }
}

fn default_state_db_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".deepseek")
        .join("state.db")
}

fn parse_checkpoint_state(state_json: &str) -> Value {
    serde_json::from_str(state_json)
        .and_then(|v: Value| {
            if v.get("schema_version").is_some() {
                serde_json::from_value::<UnifiedCheckpoint>(v)
                    .map(|cp| cp.engine_state.unwrap_or(Value::Null))
            } else {
                Ok(v)
            }
        })
        .unwrap_or(Value::Null)
}

fn parse_unified_checkpoint(state_json: &str) -> Result<UnifiedCheckpoint> {
    serde_json::from_str(state_json)
        .and_then(|v: Value| {
            if v.get("schema_version").is_some() {
                serde_json::from_value(v)
            } else {
                let v1: Value = v;
                Ok(UnifiedCheckpoint::new(
                    "migrated".to_string(),
                    "".to_string(),
                    CheckpointSource::RustEngine,
                    0,
                )
                .with_engine_state(v1))
            }
        })
        .context("failed to parse unified checkpoint")
}

fn bool_to_i64(value: bool) -> i64 {
    if value { 1 } else { 0 }
}

fn i64_to_bool(value: i64) -> bool {
    value != 0
}

fn thread_status_to_str(status: &ThreadStatus) -> &'static str {
    match status {
        ThreadStatus::Running => "running",
        ThreadStatus::Idle => "idle",
        ThreadStatus::Completed => "completed",
        ThreadStatus::Failed => "failed",
        ThreadStatus::Paused => "paused",
        ThreadStatus::Archived => "archived",
    }
}

fn thread_status_from_str(value: &str) -> ThreadStatus {
    match value {
        "running" => ThreadStatus::Running,
        "idle" => ThreadStatus::Idle,
        "completed" => ThreadStatus::Completed,
        "failed" => ThreadStatus::Failed,
        "paused" => ThreadStatus::Paused,
        "archived" => ThreadStatus::Archived,
        _ => ThreadStatus::Idle,
    }
}

fn session_source_to_str(source: &SessionSource) -> &'static str {
    match source {
        SessionSource::Interactive => "interactive",
        SessionSource::Resume => "resume",
        SessionSource::Fork => "fork",
        SessionSource::Api => "api",
        SessionSource::Unknown => "unknown",
    }
}

fn session_source_from_str(value: &str) -> SessionSource {
    match value {
        "interactive" => SessionSource::Interactive,
        "resume" => SessionSource::Resume,
        "fork" => SessionSource::Fork,
        "api" => SessionSource::Api,
        _ => SessionSource::Unknown,
    }
}

fn path_to_opt_string(path: Option<&Path>) -> Option<String> {
    path.map(|p| p.display().to_string())
}

fn job_state_status_to_str(status: &JobStateStatus) -> &'static str {
    match status {
        JobStateStatus::Queued => "queued",
        JobStateStatus::Running => "running",
        JobStateStatus::Completed => "completed",
        JobStateStatus::Failed => "failed",
        JobStateStatus::Cancelled => "cancelled",
    }
}

fn job_state_status_from_str(value: &str) -> JobStateStatus {
    match value {
        "queued" => JobStateStatus::Queued,
        "running" => JobStateStatus::Running,
        "completed" => JobStateStatus::Completed,
        "failed" => JobStateStatus::Failed,
        "cancelled" => JobStateStatus::Cancelled,
        _ => JobStateStatus::Queued,
    }
}

fn row_to_thread(row: &rusqlite::Row<'_>) -> rusqlite::Result<ThreadMetadata> {
    let status_raw: String = row.get(7)?;
    let source_raw: String = row.get(11)?;
    let rollout_path: Option<String> = row.get(1)?;
    let path: Option<String> = row.get(8)?;
    Ok(ThreadMetadata {
        id: row.get(0)?,
        rollout_path: rollout_path.map(PathBuf::from),
        preview: row.get(2)?,
        ephemeral: i64_to_bool(row.get(3)?),
        model_provider: row.get(4)?,
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
        status: thread_status_from_str(&status_raw),
        path: path.map(PathBuf::from),
        cwd: PathBuf::from(row.get::<_, String>(9)?),
        cli_version: row.get(10)?,
        source: session_source_from_str(&source_raw),
        name: row.get(12)?,
        sandbox_policy: row.get(13)?,
        approval_mode: row.get(14)?,
        archived: i64_to_bool(row.get(15)?),
        archived_at: row.get(16)?,
        git_sha: row.get(17)?,
        git_branch: row.get(18)?,
        git_origin_url: row.get(19)?,
        memory_mode: row.get(20)?,
    })
}

// ---------------------------------------------------------------------------
// Case management types and CRUD
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CaseStatus {
    Active,
    Archived,
    Deleted,
}

impl CaseStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            CaseStatus::Active => "active",
            CaseStatus::Archived => "archived",
            CaseStatus::Deleted => "deleted",
        }
    }
}

fn case_status_from_str(s: &str) -> CaseStatus {
    match s {
        "archived" => CaseStatus::Archived,
        "deleted" => CaseStatus::Deleted,
        _ => CaseStatus::Active,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseRecord {
    pub case_id: String,
    pub application_no: Option<String>,
    pub title: String,
    pub patent_type: String,
    pub inventor: Option<String>,
    pub agent: Option<String>,
    pub applicant: Option<String>,
    pub status: CaseStatus,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseDocumentRecord {
    pub doc_id: String,
    pub case_id: String,
    pub doc_type: String,
    pub file_path: String,
    pub uploaded_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseTaskRecord {
    pub task_id: String,
    pub case_id: String,
    pub agent_id: String,
    pub status: String,
    pub started_at: i64,
    pub completed_at: Option<i64>,
    pub output_artifacts: Option<String>,
}

impl StateStore {
    /// Create a new case.
    pub fn create_case(&self, c: &CaseRecord) -> Result<()> {
        let conn = self.conn()?;
        conn.execute(
            "INSERT INTO cases (case_id, application_no, title, patent_type, inventor, agent, applicant, status, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                c.case_id, c.application_no, c.title, c.patent_type,
                c.inventor, c.agent, c.applicant, c.status.as_str(),
                c.created_at, c.updated_at
            ],
        ).context("failed to create case")?;
        Ok(())
    }

    /// Get a case by ID.
    pub fn get_case(&self, case_id: &str) -> Result<Option<CaseRecord>> {
        let conn = self.conn()?;
        let mut stmt = conn.prepare(
            "SELECT case_id, application_no, title, patent_type, inventor, agent, applicant, status, created_at, updated_at
             FROM cases WHERE case_id = ?1 AND status != 'deleted'"
        )?;
        stmt.query_row(params![case_id], row_to_case)
            .optional()
            .context("failed to get case")
    }

    /// List all active cases.
    pub fn list_cases(&self) -> Result<Vec<CaseRecord>> {
        let conn = self.conn()?;
        let mut stmt = conn.prepare(
            "SELECT case_id, application_no, title, patent_type, inventor, agent, applicant, status, created_at, updated_at
             FROM cases WHERE status != 'deleted' ORDER BY updated_at DESC"
        )?;
        stmt.query_map([], row_to_case)
            .context("failed to list cases")?
            .collect::<rusqlite::Result<Vec<_>>>()
            .context("failed to collect cases")
    }

    /// Archive a case.
    pub fn archive_case(&self, case_id: &str) -> Result<()> {
        let conn = self.conn()?;
        let now = Utc::now().timestamp();
        conn.execute(
            "UPDATE cases SET status = 'archived', updated_at = ?1 WHERE case_id = ?2",
            params![now, case_id],
        )
        .context("failed to archive case")?;
        Ok(())
    }

    /// Add a document to a case.
    pub fn add_case_document(&self, doc: &CaseDocumentRecord) -> Result<()> {
        let conn = self.conn()?;
        conn.execute(
            "INSERT INTO case_documents (doc_id, case_id, doc_type, file_path, uploaded_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                doc.doc_id,
                doc.case_id,
                doc.doc_type,
                doc.file_path,
                doc.uploaded_at
            ],
        )
        .context("failed to add case document")?;
        Ok(())
    }

    /// List documents for a case.
    pub fn list_case_documents(&self, case_id: &str) -> Result<Vec<CaseDocumentRecord>> {
        let conn = self.conn()?;
        let mut stmt = conn.prepare(
            "SELECT doc_id, case_id, doc_type, file_path, uploaded_at
             FROM case_documents WHERE case_id = ?1 ORDER BY uploaded_at DESC",
        )?;
        stmt.query_map(params![case_id], row_to_case_doc)
            .context("failed to list case documents")?
            .collect::<rusqlite::Result<Vec<_>>>()
            .context("failed to collect case documents")
    }

    /// Add a task to a case.
    pub fn add_case_task(&self, task: &CaseTaskRecord) -> Result<()> {
        let conn = self.conn()?;
        conn.execute(
            "INSERT INTO case_tasks (task_id, case_id, agent_id, status, started_at, completed_at, output_artifacts)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![task.task_id, task.case_id, task.agent_id, task.status,
                    task.started_at, task.completed_at, task.output_artifacts],
        ).context("failed to add case task")?;
        Ok(())
    }

    /// List tasks for a case.
    pub fn list_case_tasks(&self, case_id: &str) -> Result<Vec<CaseTaskRecord>> {
        let conn = self.conn()?;
        let mut stmt = conn.prepare(
            "SELECT task_id, case_id, agent_id, status, started_at, completed_at, output_artifacts
             FROM case_tasks WHERE case_id = ?1 ORDER BY started_at DESC",
        )?;
        stmt.query_map(params![case_id], row_to_case_task)
            .context("failed to list case tasks")?
            .collect::<rusqlite::Result<Vec<_>>>()
            .context("failed to collect case tasks")
    }
}

fn row_to_case(row: &rusqlite::Row<'_>) -> rusqlite::Result<CaseRecord> {
    let status_raw: String = row.get(7)?;
    Ok(CaseRecord {
        case_id: row.get(0)?,
        application_no: row.get(1)?,
        title: row.get(2)?,
        patent_type: row.get(3)?,
        inventor: row.get(4)?,
        agent: row.get(5)?,
        applicant: row.get(6)?,
        status: case_status_from_str(&status_raw),
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
    })
}

fn row_to_case_doc(row: &rusqlite::Row<'_>) -> rusqlite::Result<CaseDocumentRecord> {
    Ok(CaseDocumentRecord {
        doc_id: row.get(0)?,
        case_id: row.get(1)?,
        doc_type: row.get(2)?,
        file_path: row.get(3)?,
        uploaded_at: row.get(4)?,
    })
}

fn row_to_case_task(row: &rusqlite::Row<'_>) -> rusqlite::Result<CaseTaskRecord> {
    Ok(CaseTaskRecord {
        task_id: row.get(0)?,
        case_id: row.get(1)?,
        agent_id: row.get(2)?,
        status: row.get(3)?,
        started_at: row.get(4)?,
        completed_at: row.get(5)?,
        output_artifacts: row.get(6)?,
    })
}

#[cfg(test)]
mod case_tests {
    use super::*;

    fn test_store() -> StateStore {
        use std::sync::atomic::{AtomicU64, Ordering};
        static COUNTER: AtomicU64 = AtomicU64::new(0);
        let n = COUNTER.fetch_add(1, Ordering::Relaxed);
        let dir = std::env::temp_dir().join(format!("yunpat_case_test_{}", n));
        let _ = std::fs::create_dir_all(&dir);
        let db = dir.join("test.db");
        let _ = std::fs::remove_file(&db);
        StateStore::open(Some(db)).unwrap()
    }

    #[test]
    fn test_create_and_get_case() {
        let store = test_store();
        let now = Utc::now().timestamp();
        let case = CaseRecord {
            case_id: "test-001".to_string(),
            application_no: Some("CN2024XXXX".to_string()),
            title: "测试案件".to_string(),
            patent_type: "发明".to_string(),
            inventor: Some("张三".to_string()),
            agent: None,
            applicant: None,
            status: CaseStatus::Active,
            created_at: now,
            updated_at: now,
        };
        store.create_case(&case).unwrap();

        let fetched = store.get_case("test-001").unwrap().unwrap();
        assert_eq!(fetched.case_id, "test-001");
        assert_eq!(fetched.title, "测试案件");
        assert_eq!(fetched.patent_type, "发明");
    }

    #[test]
    fn test_list_cases() {
        let store = test_store();
        let now = Utc::now().timestamp();
        for i in 100..103 {
            store
                .create_case(&CaseRecord {
                    case_id: format!("list-{}", i),
                    application_no: None,
                    title: format!("案件 {}", i),
                    patent_type: "实用新型".to_string(),
                    inventor: None,
                    agent: None,
                    applicant: None,
                    status: CaseStatus::Active,
                    created_at: now,
                    updated_at: now,
                })
                .unwrap();
        }
        let cases = store.list_cases().unwrap();
        assert!(cases.len() >= 3);
    }

    #[test]
    fn test_archive_case() {
        let store = test_store();
        let now = Utc::now().timestamp();
        store
            .create_case(&CaseRecord {
                case_id: "arch-001".to_string(),
                application_no: None,
                title: "归档测试".to_string(),
                patent_type: "外观设计".to_string(),
                inventor: None,
                agent: None,
                applicant: None,
                status: CaseStatus::Active,
                created_at: now,
                updated_at: now,
            })
            .unwrap();

        store.archive_case("arch-001").unwrap();
        let fetched = store.get_case("arch-001").unwrap().unwrap();
        assert_eq!(fetched.status, CaseStatus::Archived);
    }

    #[test]
    fn test_add_and_list_documents() {
        let store = test_store();
        let now = Utc::now().timestamp();
        store
            .create_case(&CaseRecord {
                case_id: "doc-001".to_string(),
                application_no: None,
                title: "文档测试".to_string(),
                patent_type: "发明".to_string(),
                inventor: None,
                agent: None,
                applicant: None,
                status: CaseStatus::Active,
                created_at: now,
                updated_at: now,
            })
            .unwrap();

        store
            .add_case_document(&CaseDocumentRecord {
                doc_id: "doc-001-1".to_string(),
                case_id: "doc-001".to_string(),
                doc_type: "office_action".to_string(),
                file_path: "/tmp/oa.pdf".to_string(),
                uploaded_at: now,
            })
            .unwrap();

        let docs = store.list_case_documents("doc-001").unwrap();
        assert_eq!(docs.len(), 1);
        assert_eq!(docs[0].doc_type, "office_action");
    }

    #[test]
    fn test_add_and_list_tasks() {
        let store = test_store();
        let now = Utc::now().timestamp();
        store
            .create_case(&CaseRecord {
                case_id: "task-001".to_string(),
                application_no: None,
                title: "任务测试".to_string(),
                patent_type: "发明".to_string(),
                inventor: None,
                agent: None,
                applicant: None,
                status: CaseStatus::Active,
                created_at: now,
                updated_at: now,
            })
            .unwrap();

        store
            .add_case_task(&CaseTaskRecord {
                task_id: "task-001-1".to_string(),
                case_id: "task-001".to_string(),
                agent_id: "research".to_string(),
                status: "completed".to_string(),
                started_at: now,
                completed_at: Some(now + 100),
                output_artifacts: Some("report.md".to_string()),
            })
            .unwrap();

        let tasks = store.list_case_tasks("task-001").unwrap();
        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].agent_id, "research");
    }
}

#[cfg(test)]
mod unified_checkpoint_tests {
    use super::*;

    fn test_store() -> StateStore {
        use std::sync::atomic::{AtomicU64, Ordering};
        static COUNTER: AtomicU64 = AtomicU64::new(0);
        let n = COUNTER.fetch_add(1, Ordering::Relaxed);
        let dir = std::env::temp_dir().join(format!("yunpat_cp_test_{}", n));
        let _ = std::fs::create_dir_all(&dir);
        let db = dir.join("test.db");
        let _ = std::fs::remove_file(&db);
        StateStore::open(Some(db)).unwrap()
    }

    fn ensure_thread(store: &StateStore, thread_id: &str) {
        let now = Utc::now().timestamp();
        let thread = ThreadMetadata {
            id: thread_id.to_string(),
            rollout_path: None,
            preview: String::new(),
            ephemeral: false,
            model_provider: "test".to_string(),
            created_at: now,
            updated_at: now,
            status: ThreadStatus::Running,
            path: None,
            cwd: std::env::current_dir().unwrap_or_default(),
            cli_version: "test".to_string(),
            source: SessionSource::Interactive,
            name: None,
            sandbox_policy: None,
            approval_mode: None,
            archived: false,
            archived_at: None,
            git_sha: None,
            git_branch: None,
            git_origin_url: None,
            memory_mode: None,
        };
        store.upsert_thread(&thread).unwrap();
    }

    #[test]
    fn unified_checkpoint_round_trip() {
        let store = test_store();
        let thread_id = "thread-unified-001";
        let checkpoint_id = "cp-unified-001";
        ensure_thread(&store, thread_id);

        let engine_state = serde_json::json!({
            "step": 1,
            "messages": ["hello", "world"]
        });

        let metadata = serde_json::json!({
            "intent": "search",
            "confidence": 0.95
        });

        store
            .save_checkpoint_v2(
                thread_id,
                checkpoint_id,
                CheckpointSource::RustEngine,
                &engine_state,
                &metadata,
            )
            .unwrap();

        let loaded = store
            .load_unified_checkpoint(thread_id, Some(checkpoint_id))
            .unwrap()
            .unwrap();

        assert_eq!(loaded.schema_version, 2);
        assert_eq!(loaded.checkpoint_id, checkpoint_id);
        assert_eq!(loaded.thread_id, thread_id);
        assert!(matches!(loaded.source, CheckpointSource::RustEngine));
        assert_eq!(loaded.engine_state, Some(engine_state));
        assert_eq!(loaded.shared_metadata, metadata);
    }

    #[test]
    fn checkpoint_migration_v1_to_v2() {
        let store = test_store();
        let thread_id = "thread-migrate-001";
        let checkpoint_id = "cp-v1-001";
        ensure_thread(&store, thread_id);

        let v1_state = serde_json::json!({
            "old_field": "old_value",
            "nested": {"key": "value"}
        });

        store
            .save_checkpoint(thread_id, checkpoint_id, &v1_state)
            .unwrap();

        let loaded_v1 = store.load_checkpoint(thread_id, Some(checkpoint_id));
        assert!(loaded_v1.is_ok());
        let record = loaded_v1.unwrap().unwrap();
        assert_eq!(record.checkpoint_id, checkpoint_id);

        let loaded_v2 = store.load_unified_checkpoint(thread_id, Some(checkpoint_id));
        assert!(loaded_v2.is_ok());
        let unified = loaded_v2.unwrap().unwrap();
        assert_eq!(unified.schema_version, 2);
        assert_eq!(unified.checkpoint_id, checkpoint_id);
        assert_eq!(unified.engine_state, Some(v1_state));
    }

    #[test]
    fn list_unified_checkpoints() {
        let store = test_store();
        let thread_id = "thread-list-001";
        ensure_thread(&store, thread_id);

        for i in 0..3 {
            store
                .save_checkpoint_v2(
                    thread_id,
                    &format!("cp-{}", i),
                    CheckpointSource::Hybrid,
                    &serde_json::json!({"index": i}),
                    &serde_json::json!({"seq": i}),
                )
                .unwrap();
        }

        let checkpoints = store.list_unified_checkpoints(thread_id, None).unwrap();
        assert_eq!(checkpoints.len(), 3);
        assert!(matches!(checkpoints[0].source, CheckpointSource::Hybrid));
    }

    #[test]
    fn checkpoint_source_ts_orchestrator() {
        let store = test_store();
        let thread_id = "thread-ts-001";
        ensure_thread(&store, thread_id);

        store
            .save_checkpoint_v2(
                thread_id,
                "cp-ts-001",
                CheckpointSource::TsOrchestrator,
                &serde_json::json!({"plan": "step1"}),
                &serde_json::json!({"agent": "writer"}),
            )
            .unwrap();

        let loaded = store
            .load_unified_checkpoint(thread_id, Some("cp-ts-001"))
            .unwrap()
            .unwrap();

        assert!(matches!(loaded.source, CheckpointSource::TsOrchestrator));
    }
}
