//! TUI-specific configuration.

use serde::Deserialize;

/// UI configuration loaded from config files.
#[derive(Debug, Clone, Deserialize, Default)]
pub struct TuiConfig {
    pub alternate_screen: Option<String>,
    pub mouse_capture: Option<bool>,
    /// Timeout for startup terminal mode/probe calls in milliseconds.
    /// Defaults to 500ms when omitted.
    pub terminal_probe_timeout_ms: Option<u64>,
    /// Ordered list of footer items the user wants visible. `None` (the field
    /// missing from `config.toml`) means "use the built-in default order"; an
    /// empty `Some(vec![])` means "show nothing in the footer".
    ///
    /// Edited interactively via `/statusline`; persisted to `tui.status_items`
    /// in `config.toml (in data dir)`.
    pub status_items: Option<Vec<super::StatusItem>>,
    /// Emit OSC 8 hyperlink escape sequences around URLs in the transcript so
    /// supporting terminals (iTerm2, Terminal.app 13+, Ghostty, Kitty,
    /// WezTerm, Alacritty, recent gnome-terminal/konsole) make them
    /// Cmd+click-openable. Terminals without OSC 8 support render the plain
    /// label and ignore the escape. Defaults to `true`; set `false` for
    /// terminals that misrender the sequence.
    pub osc8_links: Option<bool>,
    /// High-level notification trigger condition. When set, overrides the
    /// `[notifications].threshold_secs` gate from the lower-level
    /// `[notifications]` block:
    ///
    /// - `Always` — fire a turn-completion notification on every successful
    ///   turn regardless of duration. The configured `[notifications].method`
    ///   and `include_summary` flag are still respected.
    /// - `Never` — suppress all turn-completion notifications.
    /// - Unset (default) — fall back to the `[notifications]` defaults.
    pub notification_condition: Option<NotificationCondition>,
}

/// High-level notification trigger override. See
/// [`TuiConfig::notification_condition`].
#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum NotificationCondition {
    /// Notify on every successful turn (no duration threshold).
    Always,
    /// Suppress notifications entirely.
    Never,
}

/// Notification delivery method.
#[derive(Debug, Clone, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum NotificationMethod {
    /// Auto-detect: OSC 9 for iTerm.app / Ghostty / WezTerm; BEL on
    /// macOS / Linux otherwise; on Windows the fallback is `Off`
    /// because BEL maps to the system error chime there (#583).
    #[default]
    Auto,
    /// OSC 9 escape.
    Osc9,
    /// Plain BEL character.
    Bel,
    /// Disable notifications.
    Off,
}

fn default_threshold_secs() -> u64 {
    30
}

/// Desktop-notification configuration (OSC 9 / BEL on turn completion).
#[derive(Debug, Clone, Deserialize, Default)]
pub struct NotificationsConfig {
    /// Delivery method: `auto` | `osc9` | `bel` | `off`. Default: `auto`.
    /// `auto` resolves to OSC 9 in iTerm.app / Ghostty / WezTerm; on
    /// macOS / Linux it falls back to BEL, and on Windows it falls
    /// back to `Off` so the post-turn notification doesn't ring the
    /// system error chime (#583).
    #[serde(default)]
    pub method: NotificationMethod,
    /// Only notify when the turn took at least this many seconds. Default: 30.
    #[serde(default = "default_threshold_secs")]
    pub threshold_secs: u64,
    /// Include a short summary (elapsed time + cost) in the notification body.
    /// Default: `false`.
    #[serde(default)]
    pub include_summary: bool,
}
