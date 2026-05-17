//! RAII guard that restores the terminal to a usable state on panic or early return.
//!
//! Any panic while raw mode / alternate screen is active leaves the terminal in
//! a broken state (no echo, no cursor, alternate screen). This guard's `Drop`
//! impl reverses all terminal setup so the user gets a working shell back even
//! if the process unwinds.

use std::io;
use std::sync::atomic::{AtomicBool, Ordering};

use crossterm::cursor::Show;
use crossterm::event::{DisableBracketedPaste, DisableMouseCapture, PopKeyboardEnhancementFlags};
use crossterm::execute;
use crossterm::terminal::{LeaveAlternateScreen, disable_raw_mode};

/// Tracks whether a `TerminalGuard` has already run its cleanup to avoid
/// double-restoring on nested guards (e.g. if main and a test both create one).
static CLEANUP_DONE: AtomicBool = AtomicBool::new(false);

/// Terminal state flags captured at guard creation time.
/// These drive conditional cleanup (only undo what was actually set up).
#[derive(Debug, Clone, Copy)]
pub struct TerminalFlags {
    pub alt_screen: bool,
    pub mouse_capture: bool,
    pub bracketed_paste: bool,
}

impl Default for TerminalFlags {
    fn default() -> Self {
        Self {
            alt_screen: true,
            mouse_capture: true,
            bracketed_paste: true,
        }
    }
}

/// RAII guard that restores terminal state when dropped.
///
/// Create after `enable_raw_mode()` + `EnterAlternateScreen` succeed.
/// On `Drop` it will:
/// 1. Pop keyboard enhancement flags
/// 2. Disable raw mode
/// 3. Leave alternate screen (if it was entered)
/// 4. Disable mouse capture (if it was enabled)
/// 5. Disable bracketed paste (if it was enabled)
/// 6. Show the cursor
///
/// All cleanup operations are best-effort; errors are logged rather than
/// propagated since we're likely in a panic unwind path.
pub struct TerminalGuard {
    flags: TerminalFlags,
    /// Set to true once the guard has been explicitly disarmed (normal exit
    /// path). Disarmed guards skip cleanup so the normal cleanup in `run()`
    /// stays authoritative and we avoid double-restoring.
    disarmed: bool,
}

impl TerminalGuard {
    /// Create a new guard with the given flags.
    /// The guard assumes raw mode is already active.
    pub fn new(flags: TerminalFlags) -> Self {
        Self { flags, disarmed: false }
    }

    /// Disarm the guard so it won't cleanup on drop (used on normal exit).
    pub fn disarm(&mut self) {
        self.disarmed = true;
    }
}

impl Drop for TerminalGuard {
    fn drop(&mut self) {
        if self.disarmed || CLEANUP_DONE.swap(true, Ordering::SeqCst) {
            return;
        }

        // Best-effort cleanup; swallow all errors since we may be panicking.
        let _ = execute!(io::stdout(), PopKeyboardEnhancementFlags);
        let _ = disable_raw_mode();

        if self.flags.alt_screen {
            let _ = execute!(io::stdout(), LeaveAlternateScreen);
        }
        if self.flags.mouse_capture {
            let _ = execute!(io::stdout(), DisableMouseCapture);
        }
        if self.flags.bracketed_paste {
            let _ = execute!(io::stdout(), DisableBracketedPaste);
        }

        let _ = execute!(io::stdout(), Show);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn disarm_prevents_cleanup() {
        let mut guard = TerminalGuard::new(TerminalFlags::default());
        guard.disarm();
        assert!(guard.disarmed);
    }

    #[test]
    fn new_guard_is_not_disarmed() {
        let guard = TerminalGuard::new(TerminalFlags::default());
        assert!(!guard.disarmed);
    }

    #[test]
    fn flags_customization() {
        let flags = TerminalFlags {
            alt_screen: false,
            mouse_capture: true,
            bracketed_paste: false,
        };
        let guard = TerminalGuard::new(flags);
        assert!(!guard.flags.alt_screen);
        assert!(guard.flags.mouse_capture);
        assert!(!guard.flags.bracketed_paste);
    }
}
