//! 基于 stdio 的双向 Hook 实现
//!
//! 通过子进程 stdio 通信实现双向 Hook 协议

use std::process::Stdio;
use std::time::Duration;

use anyhow::{Context, Result};
use async_trait::async_trait;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command as TokioCommand;

use super::{BidirectionalHook, HookEvent, HookInstruction};
use tokio::io::AsyncWriteExt;

/// 默认 Hook 超时时间（5 秒）
const DEFAULT_TIMEOUT: Duration = Duration::from_secs(5);

/// 基于 stdio 的双向 Hook
///
/// 启动子进程，通过 stdin 发送事件，从 stdout 逐行读取 JSONL 格式的指令
pub struct StdioBidirectionalHook {
    /// 子进程命令和参数
    command: String,
    args: Vec<String>,
    /// 超时时间
    timeout: Duration,
    /// 感兴趣的事件类型
    events: Vec<String>,
}

impl StdioBidirectionalHook {
    /// 创建新的 stdio Hook
    pub fn new(command: impl Into<String>) -> Self {
        Self {
            command: command.into(),
            args: Vec::new(),
            timeout: DEFAULT_TIMEOUT,
            events: Vec::new(),
        }
    }

    /// 添加命令行参数
    pub fn arg(mut self, arg: impl Into<String>) -> Self {
        self.args.push(arg.into());
        self
    }

    /// 设置超时时间
    pub fn with_timeout(mut self, timeout: Duration) -> Self {
        self.timeout = timeout;
        self
    }

    /// 设置感兴趣的事件类型
    ///
    /// 空列表表示接收所有事件
    pub fn with_events(mut self, events: Vec<String>) -> Self {
        self.events = events;
        self
    }

    /// 执行子进程并处理事件
    async fn execute(&self, event: &HookEvent) -> Result<Vec<HookInstruction>> {
        let mut cmd = TokioCommand::new(&self.command);
        for arg in &self.args {
            cmd.arg(arg);
        }
        cmd.stdin(Stdio::piped());
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        let mut child = cmd.spawn().context("启动 Hook 子进程失败")?;

        // 写入事件到 stdin
        {
            let stdin = child.stdin.as_mut().context("无法获取子进程 stdin")?;
            let event_json = serde_json::to_string(event).context("序列化事件失败")?;
            stdin
                .write_all(event_json.as_bytes())
                .await
                .context("写入子进程 stdin 失败")?;
            stdin.write_all(b"\n").await.context("写入换行符失败")?;
        }
        // stdin 在此处 drop，通知子进程输入结束

        // take() 取走 stdout/stderr 所有权
        let stdout = child.stdout.take().context("无法获取子进程 stdout")?;
        let stderr = child.stderr.take().context("无法获取子进程 stderr")?;

        // 后台读取 stderr
        let stderr_handle = tokio::spawn(async move {
            let mut reader = BufReader::new(stderr);
            let mut error_lines = Vec::new();
            let mut line = String::new();
            while reader.read_line(&mut line).await.unwrap_or(0) > 0 {
                error_lines.push(line.clone());
                line.clear();
            }
            error_lines
        });

        // 后台读取 stdout JSONL
        let read_task = tokio::spawn(async move {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();
            let mut result = Vec::new();
            while let Some(line) = lines.next_line().await.unwrap_or(None) {
                if line.trim().is_empty() {
                    continue;
                }
                match serde_json::from_str::<HookInstruction>(&line) {
                    Ok(instruction) => result.push(instruction),
                    Err(err) => {
                        tracing::warn!("解析 Hook 指令失败: {}, 行内容: {}", err, line);
                    }
                }
            }
            result
        });

        // 等待读取完成或超时
        let mut instructions = Vec::new();
        match tokio::time::timeout(self.timeout, read_task).await {
            Ok(Ok(result)) => instructions = result,
            Ok(Err(err)) => tracing::warn!("读取 Hook 输出失败: {:?}", err),
            Err(_) => {
                tracing::warn!("Hook 执行超时（超过 {:?}）", self.timeout);
                let _ = child.kill().await;
            }
        }

        // 等待子进程退出
        match tokio::time::timeout(Duration::from_secs(1), child.wait()).await {
            Ok(Ok(status)) => {
                if !status.success() {
                    tracing::warn!("Hook 子进程退出码: {:?}", status);
                }
            }
            Ok(Err(err)) => tracing::warn!("等待 Hook 子进程退出失败: {:?}", err),
            Err(_) => {
                tracing::warn!("等待 Hook 子进程退出超时");
                let _ = child.kill().await;
            }
        }

        // 检查 stderr
        if let Ok(stderr_lines) =
            tokio::time::timeout(Duration::from_millis(100), stderr_handle).await
            && let Ok(lines) = stderr_lines
            && !lines.is_empty()
        {
            tracing::debug!("Hook stderr 输出:\n{}", lines.join("\n"));
        }

        Ok(instructions)
    }
}

#[async_trait]
impl BidirectionalHook for StdioBidirectionalHook {
    fn events(&self) -> Vec<String> {
        self.events.clone()
    }

    async fn process(&self, event: &HookEvent) -> Result<Vec<HookInstruction>> {
        self.execute(event).await
    }
}

/// 便捷构建器
impl std::fmt::Debug for StdioBidirectionalHook {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("StdioBidirectionalHook")
            .field("command", &self.command)
            .field("args", &self.args)
            .field("timeout", &self.timeout)
            .field("events", &self.events)
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // 创建一个简单的 echo Hook 用于测试
    #[cfg(unix)]
    fn create_echo_hook() -> StdioBidirectionalHook {
        // 使用 cat 作为简单的 echo 程序
        StdioBidirectionalHook::new("cat").with_timeout(Duration::from_secs(1))
    }

    #[tokio::test]
    #[cfg(unix)]
    async fn test_stdio_hook_basic() {
        let hook = create_echo_hook();
        let event = HookEvent::ResponseStart {
            response_id: "test-123".to_string(),
        };

        // cat 会将输入回显，但我们需要它输出有效的 HookInstruction
        // 所以这个测试只是验证进程启动和通信流程
        let result = hook.process(&event).await;
        assert!(result.is_ok());
        // cat 只是回显，不会输出有效的 HookInstruction
        assert!(result.unwrap().is_empty());
    }

    #[tokio::test]
    async fn test_stdio_hook_timeout() {
        // 创建一个会超时的 Hook（sleep 10 秒）
        #[cfg(unix)]
        {
            let hook = StdioBidirectionalHook::new("sleep")
                .arg("10")
                .with_timeout(Duration::from_millis(100));

            let event = HookEvent::ResponseStart {
                response_id: "test".to_string(),
            };

            let result = hook.process(&event).await;
            assert!(result.is_ok());
            // 超时应该返回空指令
            assert!(result.unwrap().is_empty());
        }

        #[cfg(windows)]
        {
            let hook = StdioBidirectionalHook::new("timeout")
                .arg("10")
                .with_timeout(Duration::from_millis(100));

            let event = HookEvent::ResponseStart {
                response_id: "test".to_string(),
            };

            let result = hook.process(&event).await;
            assert!(result.is_ok());
            assert!(result.unwrap().is_empty());
        }
    }

    #[tokio::test]
    async fn test_stdio_hook_builder() {
        let hook = StdioBidirectionalHook::new("test-hook")
            .arg("--verbose")
            .arg("--mode=fast")
            .with_events(vec![
                "response_start".to_string(),
                "tool_lifecycle".to_string(),
            ])
            .with_timeout(Duration::from_secs(10));

        assert_eq!(hook.command, "test-hook");
        assert_eq!(hook.args, vec!["--verbose", "--mode=fast"]);
        assert_eq!(hook.events.len(), 2);
        assert_eq!(hook.timeout, Duration::from_secs(10));
    }

    #[tokio::test]
    async fn test_stdio_hook_event_filtering() {
        let hook = StdioBidirectionalHook::new("cat")
            .with_events(vec!["response_start".to_string()])
            .with_timeout(Duration::from_secs(1));

        // 应该只对 response_start 感兴趣
        assert_eq!(hook.events().len(), 1);
        assert_eq!(hook.events()[0], "response_start");
    }
}
