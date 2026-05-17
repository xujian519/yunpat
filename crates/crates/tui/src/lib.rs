//! YunPat TUI library.
//!
//! This crate provides both a library (for reuse by other crates) and a binary
//! (`yunpat-tui`). The library exposes the core engine, runtime APIs, tools,
//! models, and configuration modules.

pub mod acp_server;
pub mod audit;
pub mod auto_reasoning;
pub mod automation_manager;
pub mod cli_defs;
pub mod cli_setup;
pub mod client;
pub mod command_safety;
pub mod commands;
pub mod compaction;
pub mod composer_history;
pub mod composer_stash;
pub mod config;
pub mod config_ui;
pub mod core;
pub mod cost_status;
pub mod cycle_manager;
pub mod error_taxonomy;
pub mod eval;
pub mod execpolicy;
pub mod features;
pub mod handoff;
pub mod hooks;
pub mod llm_client;
pub mod localization;
pub mod logging;
pub mod lsp;
pub mod mcp;
pub mod mcp_server;
pub mod memory;
pub mod models;
pub mod network_policy;
pub mod palette;
pub use yunpat_patent_tui as patent;
pub mod pricing;
pub mod project_context;
pub mod project_doc;
pub mod prompts;
pub mod repl;
pub mod retry_status;
pub mod rlm;
pub mod runtime_api;
pub mod runtime_threads;
pub mod sandbox;
pub mod schema_migration;
pub mod seam_manager;
pub mod session_manager;
pub mod settings;
pub mod skills;
pub mod snapshot;
pub mod task_manager;
pub mod tools;
pub mod tui;
pub mod utils;
pub mod working_set;
pub mod workspace_trust;
pub mod yunpat_theme;

#[cfg(test)]
pub mod test_support;
