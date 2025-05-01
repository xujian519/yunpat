//! LLM Client Trait and Retry Logic
//!
//! This module provides a unified interface for LLM providers with robust retry logic,
//! exponential backoff, and proper error classification.
//!
//! # Architecture
//!
//! - `LlmClient` trait: Async interface for LLM providers (DeepSeek, `OpenAI`, etc.)
//! - `RetryPolicy`: Resolved retry policy from config (used directly by `with_retry`)
//! - `LlmError`: Classified errors with retryability information

//! - `with_retry`: Generic retry wrapper for any async operation
//!
//! # Example
//!
//! ```ignore
//! use crate::llm_client::{LlmClient, with_retry};
//! use crate::config::RetryPolicy;
//!
//! let policy = my_config.retry_policy();
//! let result = with_retry(&policy, || async {
//!     client.create_message(request).await
//! }, None).await;
//! ```

use crate::config::RetryPolicy;
use crate::models::{MessageRequest, MessageResponse, StreamEvent};
use anyhow::Result;
use std::future::Future;
use std::pin::Pin;
use std::time::{Duration, Instant};

#[cfg(test)]
pub mod mock;

// === LlmClient Trait ===

/// Type alias for boxed stream of SSE events
pub type StreamEventBox =
    Pin<Box<dyn futures_util::Stream<Item = Result<StreamEvent>> + Send + 'static>>;

/// Unified interface for LLM providers.
///
/// All async methods return boxed futures so the trait is object-safe
/// (`Arc<dyn LlmClient>` works). The boxing overhead is negligible compared
/// to LLM API latency.
#[allow(dead_code)] // trait is part of the LLM provider interface
pub trait LlmClient: Send + Sync {
    /// Returns the provider name (e.g., "deepseek")
    fn provider_name(&self) -> &'static str;

    /// Returns the model identifier being used
    fn model(&self) -> &str;

    /// Creates a non-streaming message completion.
    fn create_message(
        &self,
        request: MessageRequest,
    ) -> Pin<Box<dyn Future<Output = Result<MessageResponse>> + Send + '_>>;

    /// Creates a streaming message completion.
    fn create_message_stream(
        &self,
        request: MessageRequest,
    ) -> Pin<Box<dyn Future<Output = Result<StreamEventBox>> + Send + '_>>;

    /// Optional health check to verify API connectivity.
    fn health_check(&self) -> Pin<Box<dyn Future<Output = Result<bool>> + Send + '_>> {
        Box::pin(async { Ok(true) })
    }

    /// Fill-in-the-Middle completion (DeepSeek-specific). Returns an error
    /// by default; override in DeepSeekClient.
    fn fim_completion(
        &self,
        _model: &str,
        _prompt: &str,
        _suffix: &str,
        _max_tokens: u32,
    ) -> Pin<Box<dyn Future<Output = anyhow::Result<String>> + Send + '_>> {
        Box::pin(async {
            Err(anyhow::anyhow!(
                "FIM completion is not supported by this provider"
            ))
        })
    }
}

// === LlmError - Classified Error Types ===

/// Classified LLM errors with retryability information.
///
/// This enum categorizes API errors to enable smart retry decisions.
/// Some errors (rate limits, transient server errors) are retryable,
/// while others (auth failures, invalid requests) should fail immediately.
#[derive(Debug)]
pub enum LlmError {
    /// Rate limit exceeded (HTTP 429)
    /// Contains optional Retry-After duration from server
    RateLimited {
        message: String,
        retry_after: Option<Duration>,
    },

    /// Server error (HTTP 5xx)
    ServerError { status: u16, message: String },

    /// Network connectivity error
    NetworkError(String),

    /// Request timed out
    Timeout(Duration),

    /// Authentication failed (HTTP 401, 403)
    AuthenticationError(String),

    /// Invalid request parameters (HTTP 400)
    InvalidRequest { status: u16, message: String },

    /// Model-specific error (model not found, etc.)
    ModelError(String),

    /// Content policy violation (safety filters)
    ContentPolicyError(String),

    /// Failed to parse API response
    ParseError(String),

    /// Context length exceeded
    ContextLengthError(String),

    /// Catch-all for other errors
    Other(String),
}

impl std::fmt::Display for LlmError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LlmError::RateLimited { message, .. } => write!(f, "Rate limit exceeded: {message}"),
            LlmError::ServerError { status, message } => {
                write!(f, "Server error ({status}): {message}")
            }
            LlmError::NetworkError(msg) => write!(f, "Network error: {msg}"),
            LlmError::Timeout(d) => write!(f, "Request timed out after {d:?}"),
            LlmError::AuthenticationError(msg) => write!(f, "Authentication failed: {msg}"),
            LlmError::InvalidRequest { status, message } => {
                write!(f, "Invalid request ({status}): {message}")
            }
            LlmError::ModelError(msg) => write!(f, "Model error: {msg}"),
            LlmError::ContentPolicyError(msg) => write!(f, "Content policy violation: {msg}"),
            LlmError::ParseError(msg) => write!(f, "Response parsing error: {msg}"),
            LlmError::ContextLengthError(msg) => write!(f, "Context length exceeded: {msg}"),
            LlmError::Other(msg) => write!(f, "LLM error: {msg}"),
        }
    }
}

impl std::error::Error for LlmError {}

impl LlmError {
    /// Determines if this error is potentially transient and worth retrying.
    ///
    /// Retryable errors:
    /// - Rate limits (with backoff)
    /// - Server errors (5xx)
    /// - Network errors (connection issues)
    /// - Timeouts
    ///
    /// Non-retryable errors:
    /// - Authentication failures
    /// - Invalid requests
    /// - Content policy violations
    /// - Context length errors
    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            LlmError::RateLimited { .. }
                | LlmError::ServerError { .. }
                | LlmError::NetworkError(_)
                | LlmError::Timeout(_)
        )
    }

    /// Returns the server-suggested retry delay if available.
    ///
    /// This is typically present for rate limit errors when the server
    /// provides a Retry-After header.
    pub fn suggested_retry_delay(&self) -> Option<Duration> {
        match self {
            LlmError::RateLimited { retry_after, .. } => *retry_after,
            _ => None,
        }
    }

    /// Constructs an `LlmError` from HTTP status code and response body.
    ///
    /// Performs heuristic classification based on:
    /// - Status code (429 = rate limit, 401/403 = auth, 5xx = server error)
    /// - Response body keywords (`context_length`, `content_policy`, safety, etc.)
    pub fn from_http_response(status: u16, body: &str) -> Self {
        match status {
            429 => LlmError::RateLimited {
                message: body.to_string(),
                retry_after: None,
            },
            401 | 403 => LlmError::AuthenticationError(body.to_string()),
            400 => {
                // Classify 400 errors by examining the response body
                let body_lower = body.to_lowercase();
                if body_lower.contains("context_length")
                    || body_lower.contains("token")
                    || body_lower.contains("too long")
                    || body_lower.contains("maximum")
                {
                    LlmError::ContextLengthError(body.to_string())
                } else if body_lower.contains("content_policy")
                    || body_lower.contains("safety")
                    || body_lower.contains("harmful")
                    || body_lower.contains("inappropriate")
                {
                    LlmError::ContentPolicyError(body.to_string())
                } else if body_lower.contains("model") && body_lower.contains("not found") {
                    LlmError::ModelError(body.to_string())
                } else {
                    LlmError::InvalidRequest {
                        status,
                        message: body.to_string(),
                    }
                }
            }
            404 => {
                if body.to_lowercase().contains("model") {
                    LlmError::ModelError(body.to_string())
                } else {
                    LlmError::InvalidRequest {
                        status,
                        message: body.to_string(),
                    }
                }
            }
            500..=599 => LlmError::ServerError {
                status,
                message: body.to_string(),
            },
            _ => LlmError::Other(format!("HTTP {status}: {body}")),
        }
    }

    /// Constructs an `LlmError` from HTTP status code, body, and optional Retry-After header.
    pub fn from_http_response_with_retry_after(
        status: u16,
        body: &str,
        retry_after: Option<Duration>,
    ) -> Self {
        let mut error = Self::from_http_response(status, body);
        if let LlmError::RateLimited {
            retry_after: ref mut ra,
            ..
        } = error
        {
            *ra = retry_after;
        }
        error
    }

    /// Constructs an `LlmError` from a reqwest error.
    pub fn from_reqwest(err: &reqwest::Error) -> Self {
        if err.is_timeout() {
            LlmError::Timeout(Duration::from_secs(0))
        } else if err.is_connect() {
            LlmError::NetworkError(format!("Connection failed: {err}"))
        } else if err.is_request() {
            LlmError::NetworkError(format!("Request failed: {err}"))
        } else {
            LlmError::Other(err.to_string())
        }
    }
}

impl From<reqwest::Error> for LlmError {
    fn from(err: reqwest::Error) -> Self {
        LlmError::from_reqwest(&err)
    }
}

impl From<serde_json::Error> for LlmError {
    fn from(err: serde_json::Error) -> Self {
        LlmError::ParseError(err.to_string())
    }
}

// === Retry Error and Result Types ===

/// Error returned when all retry attempts have been exhausted.
#[derive(Debug)]
pub struct RetryError {
    /// The last error encountered
    pub last_error: LlmError,

    /// Total number of attempts made
    pub attempts: u32,

    /// Total time spent across all attempts
    pub total_time: Duration,
}

impl std::fmt::Display for RetryError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "Retry exhausted after {} attempts ({:?}): {}",
            self.attempts, self.total_time, self.last_error
        )
    }
}

impl std::error::Error for RetryError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        Some(&self.last_error)
    }
}

/// Result type for retry operations
pub type RetryResult<T> = Result<T, RetryError>;

/// Callback type for retry notifications
///
/// Called before each retry with:
/// - The error that triggered the retry
/// - The attempt number (0-based)
/// - The delay before the next attempt
pub type RetryCallback = Box<dyn Fn(&LlmError, u32, Duration) + Send + Sync>;

// === with_retry - Generic Retry Wrapper ===

/// Executes an async operation with configurable retry logic.
///
/// This function wraps any async operation that returns `Result<T, LlmError>`
/// and automatically retries on transient failures using exponential backoff.
///
/// # Arguments
///
/// * `policy` - Resolved retry policy (delays, max attempts, etc.)
/// * `operation` - Async closure to execute (will be called multiple times on retry)
/// * `callback` - Optional callback for retry notifications (logging, metrics, etc.)
pub async fn with_retry<F, Fut, T>(
    policy: &RetryPolicy,
    mut operation: F,
    callback: Option<RetryCallback>,
) -> RetryResult<T>
where
    F: FnMut() -> Fut,
    Fut: Future<Output = Result<T, LlmError>>,
{
    // If retries are disabled, just run once
    if !policy.enabled {
        return operation().await.map_err(|e| RetryError {
            last_error: e,
            attempts: 1,
            total_time: Duration::ZERO,
        });
    }

    let start_time = Instant::now();
    let total_timeout = if policy.total_timeout > 0.0 {
        Some(Duration::from_secs_f64(policy.total_timeout))
    } else {
        None
    };

    let mut last_error: Option<LlmError> = None;

    // Attempt 0 is the first try, then up to max_retries additional attempts
    for attempt in 0..=policy.max_retries {
        // Check total timeout
        if let Some(timeout) = total_timeout
            && start_time.elapsed() >= timeout
        {
            return Err(RetryError {
                last_error: last_error.unwrap_or(LlmError::Timeout(timeout)),
                attempts: attempt,
                total_time: start_time.elapsed(),
            });
        }

        match operation().await {
            Ok(result) => return Ok(result),
            Err(err) => {
                // Non-retryable errors fail immediately
                if !err.is_retryable() {
                    return Err(RetryError {
                        last_error: err,
                        attempts: attempt + 1,
                        total_time: start_time.elapsed(),
                    });
                }

                // Last attempt - no more retries
                if attempt >= policy.max_retries {
                    return Err(RetryError {
                        last_error: err,
                        attempts: attempt + 1,
                        total_time: start_time.elapsed(),
                    });
                }

                // Calculate delay
                // Use server's Retry-After if available and configured
                let base_delay = policy.delay_for_attempt(attempt);
                let delay = if policy.respect_retry_after {
                    err.suggested_retry_delay().unwrap_or(base_delay)
                } else {
                    base_delay
                };

                // Notify callback if provided
                if let Some(ref cb) = callback {
                    cb(&err, attempt, delay);
                }

                last_error = Some(err);

                // Wait before retrying
                tokio::time::sleep(delay).await;
            }
        }
    }

    // Should not reach here, but handle gracefully
    Err(RetryError {
        last_error: last_error.unwrap_or(LlmError::Other("Unknown retry error".to_string())),
        attempts: policy.max_retries + 1,
        total_time: start_time.elapsed(),
    })
}

// === Utility Functions ===

/// Parses the Retry-After header value into a Duration.
///
/// Supports both:
/// - Seconds as integer: "120" -> 120 seconds
/// - HTTP-date format: "Wed, 21 Oct 2015 07:28:00 GMT" (not implemented, returns None)
pub fn parse_retry_after(value: &str) -> Option<Duration> {
    // Try parsing as seconds
    if let Ok(seconds) = value.parse::<u64>() {
        return Some(Duration::from_secs(seconds));
    }

    // Try parsing as float seconds
    if let Ok(seconds) = value.parse::<f64>() {
        return Some(Duration::from_secs_f64(seconds));
    }

    // HTTP-date format not supported yet
    // Could use chrono or httpdate crate if needed
    None
}

/// Extracts Retry-After duration from response headers
pub fn extract_retry_after(headers: &reqwest::header::HeaderMap) -> Option<Duration> {
    headers
        .get(reqwest::header::RETRY_AFTER)
        .and_then(|v| v.to_str().ok())
        .and_then(parse_retry_after)
}

// === Tests ===

#[cfg(test)]
mod tests {
    use super::*;

    fn assert_f64_eq(actual: f64, expected: f64) {
        assert!(
            (actual - expected).abs() < f64::EPSILON,
            "expected {expected}, got {actual}"
        );
    }

    #[test]
    fn test_retry_policy_defaults() {
        let p = RetryPolicy {
            enabled: true,
            max_retries: 3,
            initial_delay: 1.0,
            max_delay: 60.0,
            exponential_base: 2.0,
            jitter: true,
            jitter_factor: 0.1,
            respect_retry_after: true,
            total_timeout: 0.0,
        };
        assert!(p.enabled);
        assert_eq!(p.max_retries, 3);
        assert_f64_eq(p.initial_delay, 1.0);
        assert_f64_eq(p.max_delay, 60.0);
        assert_f64_eq(p.exponential_base, 2.0);
        assert!(p.jitter);
    }

    #[test]
    fn test_retry_policy_disabled() {
        let p = RetryPolicy {
            enabled: false,
            ..RetryPolicy {
                enabled: false,
                max_retries: 3,
                initial_delay: 1.0,
                max_delay: 60.0,
                exponential_base: 2.0,
                jitter: true,
                jitter_factor: 0.1,
                respect_retry_after: true,
                total_timeout: 0.0,
            }
        };
        assert!(!p.enabled);
    }

    #[test]
    fn test_delay_for_attempt_exponential() {
        let p = RetryPolicy {
            jitter: false,
            ..RetryPolicy {
                enabled: true,
                max_retries: 3,
                initial_delay: 1.0,
                max_delay: 60.0,
                exponential_base: 2.0,
                jitter: false,
                jitter_factor: 0.1,
                respect_retry_after: true,
                total_timeout: 0.0,
            }
        };

        // delay = initial * base^attempt
        let d0 = p.delay_for_attempt(0);
        assert_eq!(d0, Duration::from_secs_f64(1.0));
        let d1 = p.delay_for_attempt(1);
        assert_eq!(d1, Duration::from_secs_f64(2.0));
        let d2 = p.delay_for_attempt(2);
        assert_eq!(d2, Duration::from_secs_f64(4.0));
        let d3 = p.delay_for_attempt(3);
        assert_eq!(d3, Duration::from_secs_f64(8.0));
    }

    #[test]
    fn test_delay_for_attempt_capped() {
        let p = RetryPolicy {
            max_delay: 5.0,
            jitter: false,
            ..RetryPolicy {
                enabled: true,
                max_retries: 3,
                initial_delay: 1.0,
                max_delay: 5.0,
                exponential_base: 2.0,
                jitter: false,
                jitter_factor: 0.1,
                respect_retry_after: true,
                total_timeout: 0.0,
            }
        };
        let d3 = p.delay_for_attempt(3);
        assert_eq!(d3, Duration::from_secs_f64(5.0));
    }

    #[test]
    fn test_delay_for_attempt_with_jitter() {
        let p = RetryPolicy {
            jitter: true,
            ..RetryPolicy {
                enabled: true,
                max_retries: 3,
                initial_delay: 1.0,
                max_delay: 60.0,
                exponential_base: 2.0,
                jitter: true,
                jitter_factor: 0.1,
                respect_retry_after: true,
                total_timeout: 0.0,
            }
        };
        let d1 = p.delay_for_attempt(1);
        let d2 = p.delay_for_attempt(1);
        let base = 2.0;
        let range = base * 0.1;
        assert!(d1.as_secs_f64() >= base - range);
        assert!(d1.as_secs_f64() <= base + range);
        assert!(d2.as_secs_f64() >= base - range);
        assert!(d2.as_secs_f64() <= base + range);
    }

    #[test]
    fn test_is_retryable_status() {
        assert!(RetryPolicy::is_retryable_status(429));
        assert!(RetryPolicy::is_retryable_status(500));
        assert!(RetryPolicy::is_retryable_status(502));
        assert!(RetryPolicy::is_retryable_status(503));
        assert!(RetryPolicy::is_retryable_status(504));
        assert!(!RetryPolicy::is_retryable_status(400));
        assert!(!RetryPolicy::is_retryable_status(401));
        assert!(!RetryPolicy::is_retryable_status(403));
        assert!(!RetryPolicy::is_retryable_status(404));
    }

    #[test]
    fn test_llm_error_retryable() {
        // Retryable errors
        assert!(
            LlmError::RateLimited {
                message: "too many requests".to_string(),
                retry_after: None
            }
            .is_retryable()
        );
        assert!(
            LlmError::ServerError {
                status: 500,
                message: "internal error".to_string()
            }
            .is_retryable()
        );
        assert!(LlmError::NetworkError("connection refused".to_string()).is_retryable());
        assert!(LlmError::Timeout(Duration::from_secs(30)).is_retryable());

        // Non-retryable errors
        assert!(!LlmError::AuthenticationError("invalid key".to_string()).is_retryable());
        assert!(
            !LlmError::InvalidRequest {
                status: 400,
                message: "bad json".to_string()
            }
            .is_retryable()
        );
        assert!(!LlmError::ContentPolicyError("unsafe content".to_string()).is_retryable());
        assert!(!LlmError::ContextLengthError("too long".to_string()).is_retryable());
    }

    #[test]
    fn test_llm_error_from_http_response() {
        // Rate limit
        let err = LlmError::from_http_response(429, "rate limit exceeded");
        assert!(matches!(err, LlmError::RateLimited { .. }));

        // Auth errors
        let err = LlmError::from_http_response(401, "invalid api key");
        assert!(matches!(err, LlmError::AuthenticationError(_)));

        let err = LlmError::from_http_response(403, "forbidden");
        assert!(matches!(err, LlmError::AuthenticationError(_)));

        // Server errors
        let err = LlmError::from_http_response(500, "internal server error");
        assert!(matches!(err, LlmError::ServerError { status: 500, .. }));

        let err = LlmError::from_http_response(503, "service unavailable");
        assert!(matches!(err, LlmError::ServerError { status: 503, .. }));

        // Context length
        let err = LlmError::from_http_response(400, "context_length_exceeded");
        assert!(matches!(err, LlmError::ContextLengthError(_)));

        // Content policy
        let err = LlmError::from_http_response(400, "content_policy_violation");
        assert!(matches!(err, LlmError::ContentPolicyError(_)));

        // Generic 400
        let err = LlmError::from_http_response(400, "invalid json");
        assert!(matches!(err, LlmError::InvalidRequest { status: 400, .. }));
    }

    #[test]
    fn test_llm_error_suggested_retry_delay() {
        let err = LlmError::RateLimited {
            message: "slow down".to_string(),
            retry_after: Some(Duration::from_secs(60)),
        };
        assert_eq!(err.suggested_retry_delay(), Some(Duration::from_secs(60)));

        let err = LlmError::ServerError {
            status: 500,
            message: "error".to_string(),
        };
        assert_eq!(err.suggested_retry_delay(), None);
    }

    #[test]
    fn test_parse_retry_after() {
        // Integer seconds
        assert_eq!(parse_retry_after("120"), Some(Duration::from_secs(120)));
        assert_eq!(parse_retry_after("0"), Some(Duration::from_secs(0)));

        // Float seconds
        assert_eq!(parse_retry_after("1.5"), Some(Duration::from_secs_f64(1.5)));

        // Invalid
        assert_eq!(parse_retry_after("invalid"), None);
        assert_eq!(parse_retry_after(""), None);
    }

    #[test]
    fn test_retry_policy_struct_update() {
        let defaults = RetryPolicy {
            enabled: true,
            max_retries: 3,
            initial_delay: 1.0,
            max_delay: 60.0,
            exponential_base: 2.0,
            jitter: true,
            jitter_factor: 0.1,
            respect_retry_after: true,
            total_timeout: 0.0,
        };
        let overridden = RetryPolicy {
            max_retries: 5,
            initial_delay: 2.0,
            ..defaults.clone()
        };
        assert_eq!(overridden.max_retries, 5);
        assert_f64_eq(overridden.initial_delay, 2.0);
        assert_eq!(overridden.enabled, defaults.enabled);
        assert_f64_eq(overridden.max_delay, defaults.max_delay);
    }

    fn default_policy() -> RetryPolicy {
        RetryPolicy {
            enabled: true,
            max_retries: 3,
            initial_delay: 1.0,
            max_delay: 60.0,
            exponential_base: 2.0,
            jitter: true,
            jitter_factor: 0.1,
            respect_retry_after: true,
            total_timeout: 0.0,
        }
    }

    #[tokio::test]
    async fn test_with_retry_success_first_attempt() {
        let policy = default_policy();
        let mut call_count = 0;

        let result = with_retry(
            &policy,
            || {
                call_count += 1;
                async { Ok::<_, LlmError>(42) }
            },
            None,
        )
        .await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 42);
        assert_eq!(call_count, 1);
    }

    #[tokio::test]
    async fn test_with_retry_disabled() {
        let policy = RetryPolicy {
            enabled: false,
            ..default_policy()
        };
        let mut call_count = 0;

        let result: RetryResult<i32> = with_retry(
            &policy,
            || {
                call_count += 1;
                async {
                    Err(LlmError::ServerError {
                        status: 500,
                        message: "error".to_string(),
                    })
                }
            },
            None,
        )
        .await;

        assert!(result.is_err());
        assert_eq!(call_count, 1); // No retries when disabled
    }

    #[tokio::test]
    async fn test_with_retry_non_retryable_error() {
        let policy = default_policy();
        let mut call_count = 0;

        let result: RetryResult<i32> = with_retry(
            &policy,
            || {
                call_count += 1;
                async { Err(LlmError::AuthenticationError("bad key".to_string())) }
            },
            None,
        )
        .await;

        assert!(result.is_err());
        assert_eq!(call_count, 1); // Auth errors are not retried
    }

    #[tokio::test]
    async fn test_with_retry_eventual_success() {
        let policy = RetryPolicy {
            max_retries: 3,
            initial_delay: 0.01,
            jitter: false,
            ..default_policy()
        };

        let call_count = std::sync::Arc::new(std::sync::atomic::AtomicU32::new(0));
        let cc = call_count.clone();

        let result = with_retry(
            &policy,
            || {
                let count = cc.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                async move {
                    if count < 2 {
                        Err(LlmError::ServerError {
                            status: 500,
                            message: "temporary error".to_string(),
                        })
                    } else {
                        Ok::<_, LlmError>(42)
                    }
                }
            },
            None,
        )
        .await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 42);
        assert_eq!(call_count.load(std::sync::atomic::Ordering::SeqCst), 3); // 2 failures + 1 success
    }

    #[tokio::test]
    async fn test_with_retry_exhausted() {
        let policy = RetryPolicy {
            max_retries: 2,
            initial_delay: 0.01,
            jitter: false,
            ..default_policy()
        };

        let call_count = std::sync::Arc::new(std::sync::atomic::AtomicU32::new(0));
        let cc = call_count.clone();

        let result: RetryResult<i32> = with_retry(
            &policy,
            || {
                cc.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                async {
                    Err(LlmError::ServerError {
                        status: 500,
                        message: "persistent error".to_string(),
                    })
                }
            },
            None,
        )
        .await;

        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.attempts, 3); // 1 initial + 2 retries
        assert_eq!(call_count.load(std::sync::atomic::Ordering::SeqCst), 3);
    }

    #[tokio::test]
    async fn test_with_retry_callback() {
        let policy = RetryPolicy {
            max_retries: 2,
            initial_delay: 0.01,
            jitter: false,
            ..default_policy()
        };

        let callback_count = std::sync::Arc::new(std::sync::atomic::AtomicU32::new(0));
        let cc = callback_count.clone();

        let _: RetryResult<i32> = with_retry(
            &policy,
            || async {
                Err(LlmError::ServerError {
                    status: 500,
                    message: "error".to_string(),
                })
            },
            Some(Box::new(move |_err, _attempt, _delay| {
                cc.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
            })),
        )
        .await;

        // Callback called once per retry (not for the final failure)
        assert_eq!(callback_count.load(std::sync::atomic::Ordering::SeqCst), 2);
    }

    #[test]
    fn test_retry_error_display() {
        let err = RetryError {
            last_error: LlmError::ServerError {
                status: 500,
                message: "internal error".to_string(),
            },
            attempts: 4,
            total_time: Duration::from_secs(10),
        };

        let display = format!("{err}");
        assert!(display.contains("4 attempts"));
        assert!(display.contains("10"));
        assert!(display.contains("Server error"));
    }
}
