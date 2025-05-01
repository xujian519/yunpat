//! SSE (Server-Sent Events) 流解析器。
//!
//! 支持 OpenAI 兼容 API 的 SSE 流式响应解析，包括：
//! - 逐块解析 `data:` 行
//! - 处理多行 data、空行、注释行
//! - 提取 JSON 内容并反序列化
//! - 处理 `[DONE]` 信号

use std::pin::Pin;
use std::task::{Context, Poll};

/// 单个 SSE 事件。
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct SseEvent {
    /// 事件 ID（可选）
    pub id: Option<String>,
    /// 事件类型（可选，如 "message"）
    pub event: Option<String>,
    /// 事件数据（JSON 字符串或 `[DONE]`）
    pub data: String,
}

/// SSE 解码器状态机。
///
/// 处理字节流并产出 `SseEvent`。
pub struct SseDecoder {
    /// 当前累积的缓冲区
    buffer: String,
    /// 当前正在构建的事件
    current: SseEvent,
    has_fields: bool,
}

impl SseDecoder {
    /// 创建新的 SSE 解码器。
    pub fn new() -> Self {
        Self {
            buffer: String::new(),
            current: SseEvent::default(),
            has_fields: false,
        }
    }

    /// 向解码器输入字节数据。
    ///
    /// 数据会累积到内部缓冲区，等待完整行后解析。
    pub fn feed(&mut self, bytes: &[u8]) {
        // SSE 通常使用 UTF-8，但某些情况下可能不是
        // 这里假设输入是有效的 UTF-8
        if let Ok(text) = std::str::from_utf8(bytes) {
            self.buffer.push_str(text);
        }
    }

    /// 尝试从缓冲区解析下一个 SSE 事件。
    ///
    /// 如果没有完整事件，返回 `None`。
    pub fn next_event(&mut self) -> Option<SseEvent> {
        // 查找行尾（\n 或 \r\n）
        loop {
            let line_end = self.buffer.find('\n');
            let line_end = line_end?;
            let line = self.buffer[..line_end].to_string();
            // 移除可能的 \r
            let line = line.strip_suffix('\r').unwrap_or(&line);

            // 从缓冲区移除已处理的行（包括 \n）
            self.buffer = self.buffer[line_end + 1..].to_string();

            // 空行表示事件结束
            if line.is_empty() {
                if self.has_fields {
                    self.has_fields = false;
                    return Some(std::mem::take(&mut self.current));
                }
                // 否则继续读取下一行
                continue;
            }

            if let Some((field, value)) = line.split_once(':') {
                let value = value.strip_prefix(' ').unwrap_or(value);
                match field {
                    "data" => {
                        self.has_fields = true;
                        if !self.current.data.is_empty() {
                            self.current.data.push('\n');
                        }
                        self.current.data.push_str(value);
                    }
                    "id" => {
                        self.has_fields = true;
                        self.current.id = Some(value.to_string());
                    }
                    "event" => {
                        self.has_fields = true;
                        self.current.event = Some(value.to_string());
                    }
                    _ => {}
                }
            }
            // 注释行（以 : 开头）忽略
        }
    }

    /// 检查缓冲区是否还有未处理的数据。
    pub fn has_remaining(&self) -> bool {
        !self.buffer.is_empty()
    }

    /// 获取剩余未处理的缓冲区内容。
    pub fn remaining(&self) -> &str {
        &self.buffer
    }

    /// 清空所有状态。
    pub fn clear(&mut self) {
        self.buffer.clear();
        self.current = SseEvent::default();
        self.has_fields = false;
    }
}

impl Default for SseDecoder {
    fn default() -> Self {
        Self::new()
    }
}

/// SSE 流适配器，将 reqwest 字节流转换为 SseEvent 流。
pub struct SseStream<S> {
    inner: S,
    decoder: SseDecoder,
    finished: bool,
}

impl<S> SseStream<S> {
    pub fn new(inner: S) -> Self {
        Self {
            inner,
            decoder: SseDecoder::new(),
            finished: false,
        }
    }

    /// 尝试获取下一个事件。
    pub async fn next_event_stream<E>(
        &mut self,
    ) -> Option<std::result::Result<SseEvent, anyhow::Error>>
    where
        S: futures_core::Stream<Item = std::result::Result<bytes::Bytes, E>> + Unpin,
        E: std::fmt::Display,
    {
        if self.finished {
            return None;
        }

        // 先尝试从解码器产出事件
        if let Some(event) = self.decoder.next_event() {
            if event.data == "[DONE]" {
                self.finished = true;
            }
            return Some(Ok(event));
        }

        // 从底层流读取更多数据
        loop {
            use futures_util::StreamExt;
            match self.inner.next().await {
                None => {
                    // 流结束，检查是否有未处理的数据
                    if self.decoder.has_remaining() {
                        // 尝试最后一次解析
                        if let Some(event) = self.decoder.next_event() {
                            if event.data == "[DONE]" {
                                self.finished = true;
                            }
                            return Some(Ok(event));
                        }
                        // 还有剩余数据但不是完整事件
                        return None;
                    }
                    self.finished = true;
                    return None;
                }
                Some(Err(e)) => {
                    return Some(Err(anyhow::anyhow!("SSE stream error: {}", e)));
                }
                Some(Ok(bytes)) => {
                    self.decoder.feed(&bytes);
                    // 尝试解析新数据
                    if let Some(event) = self.decoder.next_event() {
                        if event.data == "[DONE]" {
                            self.finished = true;
                        }
                        return Some(Ok(event));
                    }
                    // 需要更多数据，继续循环
                }
            }
        }
    }
}

impl<S, E> futures_core::Stream for SseStream<S>
where
    S: futures_core::Stream<Item = std::result::Result<bytes::Bytes, E>> + Unpin,
    E: std::fmt::Display,
{
    type Item = std::result::Result<SseEvent, anyhow::Error>;

    fn poll_next(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        if self.finished {
            return Poll::Ready(None);
        }

        // 先尝试从解码器产出事件
        if let Some(event) = self.decoder.next_event() {
            if event.data == "[DONE]" {
                self.finished = true;
            }
            return Poll::Ready(Some(Ok(event)));
        }

        // 从底层流读取更多数据
        loop {
            match std::pin::Pin::new(&mut self.inner).poll_next(cx) {
                Poll::Pending => return Poll::Pending,
                Poll::Ready(None) => {
                    // 流结束，检查是否有未处理的数据
                    if self.decoder.has_remaining() {
                        // 尝试最后一次解析
                        if let Some(event) = self.decoder.next_event() {
                            if event.data == "[DONE]" {
                                self.finished = true;
                            }
                            return Poll::Ready(Some(Ok(event)));
                        }
                        // 还有剩余数据但不是完整事件
                        return Poll::Ready(None);
                    }
                    self.finished = true;
                    return Poll::Ready(None);
                }
                Poll::Ready(Some(Err(e))) => {
                    return Poll::Ready(Some(Err(anyhow::anyhow!("SSE stream error: {}", e))));
                }
                Poll::Ready(Some(Ok(bytes))) => {
                    self.decoder.feed(&bytes);
                    // 尝试解析新数据
                    if let Some(event) = self.decoder.next_event() {
                        if event.data == "[DONE]" {
                            self.finished = true;
                        }
                        return Poll::Ready(Some(Ok(event)));
                    }
                    // 需要更多数据，继续循环
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sse_decoder_basic() {
        let mut decoder = SseDecoder::new();
        decoder.feed(b"data: hello\n\n");

        let event = decoder.next_event().unwrap();
        assert_eq!(event.data, "hello");
        assert_eq!(event.id, None);
        assert_eq!(event.event, None);
    }

    #[test]
    fn test_sse_decoder_multiline_data() {
        let mut decoder = SseDecoder::new();
        decoder.feed(b"data: line1\ndata: line2\n\n");

        let event = decoder.next_event().unwrap();
        assert_eq!(event.data, "line1\nline2");
    }

    #[test]
    fn test_sse_decoder_with_id_and_event() {
        let mut decoder = SseDecoder::new();
        decoder.feed(b"id: 123\nevent: message\ndata: hello\n\n");

        let event = decoder.next_event().unwrap();
        assert_eq!(event.data, "hello");
        assert_eq!(event.id, Some("123".to_string()));
        assert_eq!(event.event, Some("message".to_string()));
    }

    #[test]
    fn test_sse_decoder_done() {
        let mut decoder = SseDecoder::new();
        decoder.feed(b"data: [DONE]\n\n");

        let event = decoder.next_event().unwrap();
        assert_eq!(event.data, "[DONE]");
    }

    #[test]
    fn test_sse_decoder_ignore_comments() {
        let mut decoder = SseDecoder::new();
        decoder.feed(b": this is a comment\ndata: hello\n\n");

        let event = decoder.next_event().unwrap();
        assert_eq!(event.data, "hello");
    }

    #[test]
    fn test_sse_decoder_partial_data() {
        let mut decoder = SseDecoder::new();
        decoder.feed(b"data: hel");
        assert!(decoder.next_event().is_none());

        decoder.feed(b"lo\n\n");
        let event = decoder.next_event().unwrap();
        assert_eq!(event.data, "hello");
    }

    #[test]
    fn test_sse_decoder_multiple_events() {
        let mut decoder = SseDecoder::new();
        decoder.feed(b"data: event1\n\ndata: event2\n\n");

        let event1 = decoder.next_event().unwrap();
        assert_eq!(event1.data, "event1");

        let event2 = decoder.next_event().unwrap();
        assert_eq!(event2.data, "event2");

        assert!(decoder.next_event().is_none());
    }

    #[test]
    fn test_sse_decoder_crlf() {
        let mut decoder = SseDecoder::new();
        decoder.feed(b"data: hello\r\n\r\n");

        let event = decoder.next_event().unwrap();
        assert_eq!(event.data, "hello");
    }

    #[test]
    fn test_sse_decoder_empty_data() {
        let mut decoder = SseDecoder::new();
        decoder.feed(b"data: \n\n");

        let event = decoder.next_event().unwrap();
        assert_eq!(event.data, "");
    }
}
