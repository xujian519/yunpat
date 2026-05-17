//! Capacity and retry configuration management.
#![allow(dead_code)]

use std::collections::HashMap;

use serde::Deserialize;

/// Raw retry configuration loaded from config files.
#[derive(Debug, Clone, Deserialize)]
pub struct RetryConfig {
    pub enabled: Option<bool>,
    pub max_retries: Option<u32>,
    pub initial_delay: Option<f64>,
    pub max_delay: Option<f64>,
    pub exponential_base: Option<f64>,
}

/// This is the single source of truth for retry configuration across the
/// codebase. It's resolved from the raw `Config::retry` (deserialized TOML)
/// with defaults applied, then passed directly to `with_retry` in the LLM
/// client layer.
#[derive(Debug, Clone)]
pub struct RetryPolicy {
    pub enabled: bool,
    pub max_retries: u32,
    pub initial_delay: f64,
    pub max_delay: f64,
    pub exponential_base: f64,
    /// Whether to add random jitter to delays (default: true)
    pub jitter: bool,
    /// Jitter factor — ± this fraction of the computed delay (default: 0.1)
    pub jitter_factor: f64,
    /// Whether to respect the server's `Retry-After` header (default: true)
    pub respect_retry_after: bool,
    /// Total timeout for all retry attempts combined in seconds (0 = no limit)
    pub total_timeout: f64,
}

impl RetryPolicy {
    /// Compute the backoff delay for a retry attempt.
    #[must_use]
    pub fn delay_for_attempt(&self, attempt: u32) -> std::time::Duration {
        let exponent = i32::try_from(attempt).unwrap_or(i32::MAX);
        let delay = self.initial_delay * self.exponential_base.powi(exponent);
        let delay = delay.min(self.max_delay);

        let final_delay = if self.jitter {
            let jitter_range = delay * self.jitter_factor;
            let bytes = *uuid::Uuid::new_v4().as_bytes();
            let sample = u16::from_le_bytes([bytes[0], bytes[1]]);
            let random_factor = f64::from(sample) / f64::from(u16::MAX);
            let jitter = jitter_range * (2.0 * random_factor - 1.0);
            (delay + jitter).max(0.0)
        } else {
            delay
        };

        std::time::Duration::from_secs_f64(final_delay)
    }

    /// Check if an HTTP status code should trigger a retry.
    #[must_use]
    #[allow(dead_code)]
    pub fn is_retryable_status(status: u16) -> bool {
        matches!(status, 429 | 500 | 502 | 503 | 504)
    }
}

/// Capacity-controller config loaded from config files/environment.
///
/// Enable in `config.toml (in data dir)`:
/// ```toml
/// [capacity]
/// enabled = true
/// ```
#[derive(Debug, Clone, Deserialize)]
pub struct CapacityConfig {
    pub enabled: Option<bool>,
    pub low_risk_max: Option<f64>,
    pub medium_risk_max: Option<f64>,
    pub severe_min_slack: Option<f64>,
    pub severe_violation_ratio: Option<f64>,
    pub refresh_cooldown_turns: Option<u64>,
    pub replan_cooldown_turns: Option<u64>,
    pub max_replay_per_turn: Option<usize>,
    pub min_turns_before_guardrail: Option<u64>,
    pub profile_window: Option<usize>,
    pub yunpat_v3_2_chat_prior: Option<f64>,
    pub yunpat_v3_2_reasoner_prior: Option<f64>,
    pub yunpat_v4_pro_prior: Option<f64>,
    pub yunpat_v4_flash_prior: Option<f64>,
    pub fallback_default_prior: Option<f64>,
}

/// Context management configuration (append-only layered context with Flash seams).
#[derive(Debug, Clone, Deserialize, Default)]
pub struct ContextConfig {
    /// Master enable for layered context management. Default: false while
    /// v0.7.5 audits V4 prefix-cache behavior.
    #[serde(default)]
    pub enabled: Option<bool>,
    /// Verbatim window: last N turns never summarized. Default: 16.
    #[serde(default)]
    pub verbatim_window_turns: Option<usize>,
    /// Soft seam thresholds based on the active request input estimate.
    #[serde(default)]
    pub l1_threshold: Option<usize>,
    #[serde(default)]
    pub l2_threshold: Option<usize>,
    #[serde(default)]
    pub l3_threshold: Option<usize>,
    /// Hard cycle boundary. Default: 768000.
    #[serde(default)]
    pub cycle_threshold: Option<usize>,
    /// Model used for seam/briefing work. Default: "deepseek-v4-flash".
    #[serde(default)]
    pub seam_model: Option<String>,
    /// Per-model threshold overrides.
    #[serde(default)]
    pub per_model: Option<HashMap<String, PerModelContextConfig>>,
}

/// Sub-agent model overrides. Keys in `models` can be role names (`worker`,
/// `explorer`, `awaiter`) or type names (`general`, `explore`, `plan`,
/// `review`, `custom`). Per-call explicit model choices still win.
#[derive(Debug, Clone, Deserialize, Default)]
pub struct SubagentsConfig {
    #[serde(default)]
    pub default_model: Option<String>,
    #[serde(default)]
    pub worker_model: Option<String>,
    #[serde(default)]
    pub explorer_model: Option<String>,
    #[serde(default)]
    pub awaiter_model: Option<String>,
    #[serde(default)]
    pub review_model: Option<String>,
    #[serde(default)]
    pub custom_model: Option<String>,
    #[serde(default)]
    pub models: Option<HashMap<String, String>>,
    /// Maximum concurrent sub-agents. Overrides the top-level max_subagents
    /// setting. Clamped to [1, MAX_SUBAGENTS].
    #[serde(default)]
    pub max_concurrent: Option<usize>,
}

/// Per-model context tuning.
#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
pub struct PerModelContextConfig {
    #[serde(default)]
    pub l1_threshold: Option<usize>,
    #[serde(default)]
    pub l2_threshold: Option<usize>,
    #[serde(default)]
    pub l3_threshold: Option<usize>,
    #[serde(default)]
    pub cycle_threshold: Option<usize>,
}
