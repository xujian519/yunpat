/**
 * RustCheckpointBridge — HITL checkpoint 跨语言持久化桥
 *
 * 在 TypeScript 侧读写 Rust StateStore 使用的同一个 SQLite 数据库
 * (~/.yunpat/state.db)，确保 JSON 格式与 Rust 的 UnifiedCheckpoint
 * serde 序列化完全兼容（snake_case 字段名）。
 *
 * Phase 2C.2: HITL checkpoint cross-language persistence
 */

import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { homedir } from 'node:os'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UnifiedCheckpoint {
  schema_version: number // always 2
  checkpoint_id: string
  thread_id: string
  source: 'ts_orchestrator' | 'rust_engine' | 'hybrid'
  created_at: number // unix epoch seconds
  engine_state?: unknown
  orchestrator_state?: unknown
  shared_metadata: unknown
}

export interface HITLCheckpointData {
  sessionId: string
  taskPlan: unknown
  results: Record<string, unknown>
  hitlRequests: unknown[]
  metrics: unknown
  stats: unknown
}

const SCHEMA_VERSION = 2

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS checkpoints (
    thread_id TEXT NOT NULL,
    checkpoint_id TEXT NOT NULL,
    state_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY(thread_id, checkpoint_id)
  )
`

const CREATE_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_checkpoints_thread_created_at
    ON checkpoints(thread_id, created_at DESC)
`

// ---------------------------------------------------------------------------
// RustCheckpointBridge
// ---------------------------------------------------------------------------

export class RustCheckpointBridge {
  private db: Database.Database

  constructor(dbPath?: string) {
    const resolved = dbPath
      ? resolve(dbPath.replace(/^~/, homedir()))
      : resolve(homedir(), '.yunpat', 'state.db')

    // 确保目录存在
    mkdirSync(dirname(resolved), { recursive: true })

    this.db = new Database(resolved)
    this.db.pragma('journal_mode = WAL')

    // 建表（如果不存在）— 与 Rust StateStore 使用完全相同的 schema
    this.db.exec(CREATE_TABLE_SQL)
    this.db.exec(CREATE_INDEX_SQL)
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * 保存 HITL 检查点，source 固定为 ts_orchestrator。
   * orchestrator_state 存储 HITL 数据，shared_metadata 留空对象。
   */
  saveHITLCheckpoint(threadId: string, checkpointId: string, data: HITLCheckpointData): void {
    const checkpoint: UnifiedCheckpoint = {
      schema_version: SCHEMA_VERSION,
      checkpoint_id: checkpointId,
      thread_id: threadId,
      source: 'ts_orchestrator',
      created_at: Math.floor(Date.now() / 1000),
      engine_state: undefined,
      orchestrator_state: data,
      shared_metadata: {},
    }

    const stateJson = JSON.stringify(checkpoint)

    // UPSERT — 与 Rust 端 ON CONFLICT 语义一致
    const stmt = this.db.prepare(`
      INSERT INTO checkpoints(thread_id, checkpoint_id, state_json, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(thread_id, checkpoint_id) DO UPDATE SET
        state_json = excluded.state_json,
        created_at = excluded.created_at
    `)
    stmt.run(threadId, checkpointId, stateJson, checkpoint.created_at)
  }

  /**
   * 加载 HITL 检查点。
   * 如果不传 checkpointId，返回该 thread 最新的 ts_orchestrator 检查点。
   */
  loadHITLCheckpoint(threadId: string, checkpointId?: string): UnifiedCheckpoint | null {
    const row = checkpointId
      ? (this.db
          .prepare('SELECT state_json FROM checkpoints WHERE thread_id = ? AND checkpoint_id = ?')
          .get(threadId, checkpointId) as { state_json: string } | undefined)
      : (this.db
          .prepare(
            `SELECT state_json FROM checkpoints
             WHERE thread_id = ? AND json_extract(state_json, '$.source') = 'ts_orchestrator'
             ORDER BY created_at DESC LIMIT 1`
          )
          .get(threadId) as { state_json: string } | undefined)

    if (!row) return null
    return this.parseCheckpoint(row.state_json, threadId, checkpointId)
  }

  /**
   * 列出指定 thread 下所有 ts_orchestrator 来源的检查点。
   */
  listHITLCheckpoints(threadId: string): UnifiedCheckpoint[] {
    const rows = this.db
      .prepare(
        `SELECT state_json FROM checkpoints
         WHERE thread_id = ? AND json_extract(state_json, '$.source') = 'ts_orchestrator'
         ORDER BY created_at DESC`
      )
      .all(threadId) as { state_json: string }[]

    return rows
      .map((row) => this.parseCheckpoint(row.state_json, threadId))
      .filter(Boolean) as UnifiedCheckpoint[]
  }

  /**
   * 删除指定检查点。
   */
  deleteCheckpoint(threadId: string, checkpointId: string): void {
    this.db
      .prepare('DELETE FROM checkpoints WHERE thread_id = ? AND checkpoint_id = ?')
      .run(threadId, checkpointId)
  }

  /**
   * 关闭数据库连接。
   */
  close(): void {
    this.db.close()
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private parseCheckpoint(
    json: string,
    threadId: string,
    checkpointId?: string
  ): UnifiedCheckpoint | null {
    try {
      const cp = JSON.parse(json) as UnifiedCheckpoint
      // 与 Rust 端一致：从行字段回填缺失的 id
      if (!cp.checkpoint_id && checkpointId) cp.checkpoint_id = checkpointId
      if (!cp.thread_id) cp.thread_id = threadId
      return cp
    } catch {
      return null
    }
  }
}
