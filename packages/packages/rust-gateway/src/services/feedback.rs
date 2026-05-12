//! 用户反馈闭环存储
//!
//! 收集用户对意图路由结果的反馈，用于后续 A/B 测试和模型迭代。
//!
//! 数据模型:
//! - session_id:     会话标识
//! - message_index:  消息在会话中的索引
//! - user_input:     用户原始输入
//! - routed_intent:  网关路由到的意图
//! - feedback_type:  👍 correct / 👎 wrong / 📝 corrected(纠正)
//! - corrected_intent: 用户纠正后的意图（feedback_type=corrected 时必填）
//! - timestamp:      Unix timestamp
//! - metadata:       扩展字段（可选）
//!
//! 当前为内存环形缓冲区实现，后续可持久化到 SQLite/PostgreSQL。

use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::Mutex;

/// 反馈类型
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum FeedbackType {
    /// 用户确认路由正确
    Correct,
    /// 用户标记路由错误（未提供纠正意图）
    Wrong,
    /// 用户标记错误并提供了纠正意图
    Corrected,
}

/// 单条反馈记录
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct FeedbackRecord {
    pub session_id: String,
    pub message_index: usize,
    pub user_input: String,
    pub routed_intent: String,
    pub feedback_type: FeedbackType,
    pub corrected_intent: Option<String>,
    pub timestamp: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
}

/// 反馈存储 —— 内存环形缓冲区 + JSONL 持久化钩子
pub struct FeedbackStore {
    inner: Mutex<FeedbackBuffer>,
    capacity: usize,
}

struct FeedbackBuffer {
    records: VecDeque<FeedbackRecord>,
}

impl FeedbackStore {
    pub fn new(capacity: usize) -> Self {
        Self {
            inner: Mutex::new(FeedbackBuffer {
                records: VecDeque::with_capacity(capacity),
            }),
            capacity,
        }
    }

    /// 提交一条反馈记录
    pub fn submit(&self, record: FeedbackRecord) {
        let mut buf = self.inner.lock().unwrap();
        if buf.records.len() >= self.capacity {
            buf.records.pop_front();
        }
        buf.records.push_back(record);
    }

    /// 导出所有记录为 JSON 数组
    pub fn export_json(&self) -> Vec<FeedbackRecord> {
        let buf = self.inner.lock().unwrap();
        buf.records.iter().cloned().collect()
    }

    /// 导出为 JSON Lines 格式（便于追加写入文件）
    pub fn export_jsonl(&self) -> String {
        let buf = self.inner.lock().unwrap();
        buf.records
            .iter()
            .filter_map(|r| serde_json::to_string(r).ok())
            .collect::<Vec<_>>()
            .join("\n")
    }

    /// 统计概览
    pub fn stats(&self) -> FeedbackStats {
        let buf = self.inner.lock().unwrap();
        let total = buf.records.len();
        let correct = buf
            .records
            .iter()
            .filter(|r| r.feedback_type == FeedbackType::Correct)
            .count();
        let wrong = buf
            .records
            .iter()
            .filter(|r| r.feedback_type == FeedbackType::Wrong)
            .count();
        let corrected = buf
            .records
            .iter()
            .filter(|r| r.feedback_type == FeedbackType::Corrected)
            .count();

        FeedbackStats {
            total,
            correct,
            wrong,
            corrected,
            accuracy_rate: if total > 0 {
                (correct as f64) / (total as f64)
            } else {
                0.0
            },
        }
    }
}

/// 反馈统计摘要
#[derive(Clone, Debug, Serialize)]
pub struct FeedbackStats {
    pub total: usize,
    pub correct: usize,
    pub wrong: usize,
    pub corrected: usize,
    pub accuracy_rate: f64,
}
