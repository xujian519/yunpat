//! 专利工作流状态机
//!
//! 状态：Draft → Search → Analyze → Respond → Manage
//! 每个状态对应一个 TUI 面板布局

use serde::{Deserialize, Serialize};

/// 专利工作流状态
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PatentWorkflowState {
    /// 空闲状态
    Idle,
    /// 专利检索中
    Searching,
    /// 专利分析中
    Analyzing,
    /// 审查答复中
    Responding,
    /// 专利管理
    Managing,
    /// 结果展示
    ResultDisplay,
}

/// 专利工作流上下文
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatentWorkflowContext {
    /// 当前状态
    pub state: PatentWorkflowState,
    /// 当前操作的专利标题
    pub current_title: Option<String>,
    /// 当前操作的专利号
    pub current_patent_number: Option<String>,
    /// 最近的结果（JSON）
    pub last_result: Option<String>,
    /// 错误信息
    pub error: Option<String>,
}

impl Default for PatentWorkflowContext {
    fn default() -> Self {
        Self {
            state: PatentWorkflowState::Idle,
            current_title: None,
            current_patent_number: None,
            last_result: None,
            error: None,
        }
    }
}

impl PatentWorkflowContext {
    pub fn new() -> Self {
        Self::default()
    }

    /// 转换到新状态
    pub fn transition(&mut self, new_state: PatentWorkflowState) {
        self.state = new_state;
        self.error = None;
    }

    /// 设置错误
    pub fn set_error(&mut self, msg: impl Into<String>) {
        self.error = Some(msg.into());
        self.state = PatentWorkflowState::Idle;
    }
}
