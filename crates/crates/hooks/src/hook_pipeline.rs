//! Hook 双向通信协议
//!
//! 定义 Hook 可以返回给运行时的指令类型，以及 Hook 管道的基础抽象

use std::sync::Arc;
use std::time::Duration;

use anyhow::Result;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};

use crate::HookEvent;

/// Hook 返回给运行时的指令
///
/// 这些指令允许 Hook 主动影响运行时的行为，而不仅仅是被动接收事件
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "action", rename_all = "snake_case")]
pub enum HookInstruction {
    /// 设置运行模式（如 plan/agent/yolo）
    SetMode { mode: String, reason: String },
    /// 在当前上下文前添加内容
    PrependContext { content: String },
    /// 向对话历史注入消息
    InjectMessage { role: String, content: String },
    /// 加载指定的 skill
    LoadSkill { skill: String },
    /// 建议使用某个工具
    SuggestTool { tool: String, reason: String },
    /// 要求用户批准某个操作
    RequireApproval {
        message: String,
        options: Vec<String>,
    },
    /// 发出警告（不阻断执行）
    Warn { message: String },
    /// 允许操作继续（无修改）
    Allow,
}

/// 双向 Hook trait
///
/// 与 `HookSink` 不同，`BidirectionalHook` 可以返回指令给运行时
#[async_trait]
pub trait BidirectionalHook: Send + Sync {
    /// 返回此 Hook 感兴趣的事件类型列表
    ///
    /// 空列表表示接收所有事件
    fn events(&self) -> Vec<String> {
        Vec::new()
    }

    /// 处理事件并返回指令列表
    ///
    /// 返回空指令列表表示不修改运行时行为
    async fn process(&self, event: &HookEvent) -> Result<Vec<HookInstruction>>;
}

/// Hook 管道
///
/// 管理多个 `BidirectionalHook` 并按顺序分发事件
#[derive(Default)]
pub struct HookPipeline {
    hooks: Vec<Arc<dyn BidirectionalHook>>,
    /// Hook 超时时间（默认 5 秒）
    timeout: Duration,
}

impl HookPipeline {
    /// 创建新的 Hook 管道
    pub fn new() -> Self {
        Self {
            hooks: Vec::new(),
            timeout: Duration::from_secs(5),
        }
    }

    /// 设置超时时间
    pub fn with_timeout(mut self, timeout: Duration) -> Self {
        self.timeout = timeout;
        self
    }

    /// 添加 Hook 到管道
    pub fn add_hook(&mut self, hook: Arc<dyn BidirectionalHook>) {
        self.hooks.push(hook);
    }

    /// 处理事件，收集所有 Hook 返回的指令
    ///
    /// 按顺序调用所有 Hook，如果某个 Hook 超时则跳过
    pub async fn process(&self, event: &HookEvent) -> Result<Vec<HookInstruction>> {
        let mut all_instructions = Vec::new();

        for hook in &self.hooks {
            // 检查 Hook 是否对此事件感兴趣
            if !hook.events().is_empty() {
                let event_type = match event {
                    HookEvent::UserMessage { .. } => "user_message",
                    HookEvent::ResponseStart { .. } => "response_start",
                    HookEvent::ResponseDelta { .. } => "response_delta",
                    HookEvent::ResponseEnd { .. } => "response_end",
                    HookEvent::ToolLifecycle { .. } => "tool_lifecycle",
                    HookEvent::JobLifecycle { .. } => "job_lifecycle",
                    HookEvent::ApprovalLifecycle { .. } => "approval_lifecycle",
                    HookEvent::GenericEventFrame { .. } => "generic",
                };

                if !hook.events().contains(&event_type.to_string()) {
                    continue;
                }
            }

            // 调用 Hook，带超时控制
            let hook = hook.clone();
            let timeout_result = tokio::time::timeout(self.timeout, hook.process(event)).await;

            match timeout_result {
                Ok(Ok(instructions)) => {
                    all_instructions.extend(instructions);
                }
                Ok(Err(err)) => {
                    tracing::warn!("Hook 处理失败: {:?}", err);
                    // 继续处理其他 Hook，不中断整个管道
                }
                Err(_) => {
                    tracing::warn!("Hook 处理超时（超过 {:?}），跳过", self.timeout);
                    // 超时跳过，继续处理其他 Hook
                }
            }
        }

        Ok(all_instructions)
    }

    /// 返回管道中的 Hook 数量
    pub fn len(&self) -> usize {
        self.hooks.len()
    }

    /// 管道是否为空
    pub fn is_empty(&self) -> bool {
        self.hooks.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // 测试用的 Mock Hook
    struct MockHook {
        events: Vec<String>,
        instructions: Vec<HookInstruction>,
    }

    #[async_trait]
    impl BidirectionalHook for MockHook {
        fn events(&self) -> Vec<String> {
            self.events.clone()
        }

        async fn process(&self, _event: &HookEvent) -> Result<Vec<HookInstruction>> {
            Ok(self.instructions.clone())
        }
    }

    #[tokio::test]
    async fn test_hook_instruction_serialization() {
        let instruction = HookInstruction::SetMode {
            mode: "plan".to_string(),
            reason: "复杂任务需要规划".to_string(),
        };

        let json = serde_json::to_value(&instruction).unwrap();
        assert_eq!(json["action"], "set_mode");
        assert_eq!(json["mode"], "plan");

        let deserialized: HookInstruction = serde_json::from_value(json).unwrap();
        match deserialized {
            HookInstruction::SetMode { mode, .. } => {
                assert_eq!(mode, "plan");
            }
            _ => panic!("反序列化失败"),
        }
    }

    #[tokio::test]
    async fn test_hook_pipeline_empty() {
        let pipeline = HookPipeline::new();
        let event = HookEvent::ResponseStart {
            response_id: "test".to_string(),
        };

        let instructions = pipeline.process(&event).await.unwrap();
        assert!(instructions.is_empty());
    }

    #[tokio::test]
    async fn test_hook_pipeline_single_hook() {
        let mut pipeline = HookPipeline::new();

        let hook = Arc::new(MockHook {
            events: vec!["response_start".to_string()],
            instructions: vec![HookInstruction::Warn {
                message: "测试警告".to_string(),
            }],
        });

        pipeline.add_hook(hook);

        let event = HookEvent::ResponseStart {
            response_id: "test".to_string(),
        };

        let instructions = pipeline.process(&event).await.unwrap();
        assert_eq!(instructions.len(), 1);
        match &instructions[0] {
            HookInstruction::Warn { message } => {
                assert_eq!(message, "测试警告");
            }
            _ => panic!("指令类型错误"),
        }
    }

    #[tokio::test]
    async fn test_hook_pipeline_event_filtering() {
        let mut pipeline = HookPipeline::new();

        // 只对 response_start 感兴趣的 Hook
        let hook = Arc::new(MockHook {
            events: vec!["response_start".to_string()],
            instructions: vec![HookInstruction::Allow],
        });

        pipeline.add_hook(hook);

        // 发送不感兴趣的事件
        let event = HookEvent::ResponseEnd {
            response_id: "test".to_string(),
        };

        let instructions = pipeline.process(&event).await.unwrap();
        assert!(instructions.is_empty());
    }

    #[tokio::test]
    async fn test_hook_pipeline_multiple_hooks() {
        let mut pipeline = HookPipeline::new();

        let hook1 = Arc::new(MockHook {
            events: Vec::new(),
            instructions: vec![HookInstruction::Warn { message: "警告1".to_string() }],
        });

        let hook2 = Arc::new(MockHook {
            events: Vec::new(),
            instructions: vec![
                HookInstruction::Warn { message: "警告2".to_string() },
                HookInstruction::SuggestTool {
                    tool: "search".to_string(),
                    reason: "需要搜索".to_string(),
                },
            ],
        });

        pipeline.add_hook(hook1);
        pipeline.add_hook(hook2);

        let event = HookEvent::ResponseStart {
            response_id: "test".to_string(),
        };

        let instructions = pipeline.process(&event).await.unwrap();
        assert_eq!(instructions.len(), 3);
    }

    #[tokio::test]
    async fn test_hook_pipeline_timeout() {
        // 创建一个会超时的 Hook
        struct SlowHook;
        #[async_trait]
        impl BidirectionalHook for SlowHook {
            async fn process(&self, _event: &HookEvent) -> Result<Vec<HookInstruction>> {
                tokio::time::sleep(Duration::from_secs(10)).await;
                Ok(vec![HookInstruction::Allow])
            }
        }

        let mut pipeline = HookPipeline::new().with_timeout(Duration::from_millis(100));
        pipeline.add_hook(Arc::new(SlowHook));

        let event = HookEvent::ResponseStart {
            response_id: "test".to_string(),
        };

        // 应该超时并返回空指令
        let instructions = pipeline.process(&event).await.unwrap();
        assert!(instructions.is_empty());
    }
}
