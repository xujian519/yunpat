//! SSE 流式传输集成测试。

use yunpat_models::sse::SseDecoder;

#[tokio::test]
async fn test_sse_decoder_single_event() {
    let mut decoder = SseDecoder::new();
    decoder.feed(b"data: {\"id\":\"1\",\"choices\":[{\"delta\":{\"content\":\"Hello\"}}]}\n\n");

    let event = decoder.next_event().unwrap();
    assert_eq!(
        event.data,
        r#"{"id":"1","choices":[{"delta":{"content":"Hello"}}]}"#
    );
}

#[tokio::test]
async fn test_sse_decoder_multiple_events() {
    let mut decoder = SseDecoder::new();
    decoder.feed(
        b"data: {\"id\":\"1\",\"choices\":[{\"delta\":{\"content\":\"Hello\"}}]}\n\ndata: {\"id\":\"2\",\"choices\":[{\"delta\":{\"content\":\" world\"}}]}\n\n"
    );

    let event1 = decoder.next_event().unwrap();
    assert!(event1.data.contains("Hello"));

    let event2 = decoder.next_event().unwrap();
    assert!(event2.data.contains("world"));

    assert!(decoder.next_event().is_none());
}

#[tokio::test]
async fn test_sse_decoder_done_signal() {
    let mut decoder = SseDecoder::new();
    decoder.feed(b"data: [DONE]\n\n");

    let event = decoder.next_event().unwrap();
    assert_eq!(event.data, "[DONE]");
}

#[tokio::test]
async fn test_sse_decoder_partial_data() {
    let mut decoder = SseDecoder::new();
    decoder.feed(b"data: {\"id\":\"1\"");
    assert!(decoder.next_event().is_none());

    decoder.feed(b",\"choices\":[{\"delta\":{\"content\":\"Hello\"}}]}\n\n");
    let event = decoder.next_event().unwrap();
    assert!(event.data.contains("Hello"));
}

#[tokio::test]
async fn test_sse_decoder_with_id_and_event() {
    let mut decoder = SseDecoder::new();
    decoder.feed(b"id: msg-1\nevent: message\ndata: {\"content\":\"test\"}\n\n");

    let event = decoder.next_event().unwrap();
    assert_eq!(event.id, Some("msg-1".to_string()));
    assert_eq!(event.event, Some("message".to_string()));
    assert_eq!(event.data, r#"{"content":"test"}"#);
}

#[tokio::test]
async fn test_sse_decoder_ignore_comments() {
    let mut decoder = SseDecoder::new();
    decoder.feed(b": this is a comment\ndata: {\"content\":\"test\"}\n\n");

    let event = decoder.next_event().unwrap();
    assert_eq!(event.data, r#"{"content":"test"}"#);
}

#[tokio::test]
async fn test_sse_decoder_multiline_data() {
    let mut decoder = SseDecoder::new();
    decoder.feed(b"data: line1\ndata: line2\n\n");

    let event = decoder.next_event().unwrap();
    assert_eq!(event.data, "line1\nline2");
}

#[tokio::test]
async fn test_sse_decoder_empty_data() {
    let mut decoder = SseDecoder::new();
    decoder.feed(b"data: \n\n");

    let event = decoder.next_event().unwrap();
    assert_eq!(event.data, "");
}

#[tokio::test]
async fn test_sse_decoder_crlf() {
    let mut decoder = SseDecoder::new();
    decoder.feed(b"data: hello\r\n\r\n");

    let event = decoder.next_event().unwrap();
    assert_eq!(event.data, "hello");
}

#[tokio::test]
async fn test_sse_decoder_real_stream() {
    use bytes::Bytes;
    use std::pin::Pin;
    use std::task::{Context, Poll};

    struct MockStream {
        chunks: Vec<&'static [u8]>,
        index: usize,
    }

    impl futures_core::Stream for MockStream {
        type Item = std::result::Result<Bytes, std::io::Error>;

        fn poll_next(mut self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
            if self.index < self.chunks.len() {
                let chunk = self.chunks[self.index];
                self.index += 1;
                Poll::Ready(Some(Ok(Bytes::from_static(chunk))))
            } else {
                Poll::Ready(None)
            }
        }
    }

    let mock = MockStream {
        chunks: vec![
            b"data: {\"id\":\"1\",\"choices\":[{\"delta\":{\"content\":\"Hello\"}}]}\n\n",
            b"data: {\"id\":\"2\",\"choices\":[{\"delta\":{\"content\":\" world\"}}]}\n\n",
            b"data: [DONE]\n\n",
        ],
        index: 0,
    };

    let mut sse_stream = yunpat_models::sse::SseStream::new(mock);
    let mut events = Vec::new();

    while let Some(result) = sse_stream.next_event_stream().await {
        events.push(result.unwrap());
    }

    assert_eq!(events.len(), 3);
    assert!(events[0].data.contains("Hello"));
    assert!(events[1].data.contains("world"));
    assert_eq!(events[2].data, "[DONE]");
}
