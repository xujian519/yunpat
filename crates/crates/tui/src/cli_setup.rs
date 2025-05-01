//! Setup subcommand implementation and helper functions.
//!
//! Extracted from main.rs to reduce its size.

use std::path::{Path, PathBuf};

use anyhow::{Context, Result, anyhow};
use colored::Colorize;

use crate::cli_defs::SetupArgs;
use crate::config::{Config, DEFAULT_TEXT_MODEL};
use crate::mcp::{McpConfig, McpServerConfig};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WriteStatus {
    Created,
    Overwritten,
    SkippedExists,
}

pub fn ensure_parent_dir(path: &Path) -> Result<()> {
    if let Some(parent) = path.parent()
        && !parent.as_os_str().is_empty()
    {
        std::fs::create_dir_all(parent)
            .with_context(|| format!("Failed to create directory for {}", parent.display()))?;
    }
    Ok(())
}

pub fn write_template_file(path: &Path, contents: &str, force: bool) -> Result<WriteStatus> {
    ensure_parent_dir(path)?;

    if path.exists() && !force {
        return Ok(WriteStatus::SkippedExists);
    }

    let status = if path.exists() {
        WriteStatus::Overwritten
    } else {
        WriteStatus::Created
    };

    std::fs::write(path, contents)
        .with_context(|| format!("Failed to write template at {}", path.display()))?;

    Ok(status)
}

pub fn mcp_template_json() -> Result<String> {
    let mut cfg = McpConfig::default();
    cfg.servers.insert(
        "example".to_string(),
        McpServerConfig {
            command: Some("node".to_string()),
            args: vec!["./path/to/your-mcp-server.js".to_string()],
            env: std::collections::HashMap::new(),
            url: None,
            connect_timeout: None,
            execute_timeout: None,
            read_timeout: None,
            disabled: true,
            enabled: true,
            required: false,
            enabled_tools: Vec::new(),
            disabled_tools: Vec::new(),
        },
    );
    serde_json::to_string_pretty(&cfg)
        .map_err(|e| anyhow!("Failed to render MCP template JSON: {e}"))
}

pub fn init_mcp_config(path: &Path, force: bool) -> Result<WriteStatus> {
    let template = mcp_template_json()?;
    write_template_file(path, &template, force)
}

fn skills_template(name: &str) -> String {
    format!(
        "\
---\n\
name: {name}\n\
description: Quick repo diagnostics and setup guidance\n\
allowed-tools: diagnostics, list_dir, read_file, grep_files, git_status, git_diff\n\
---\n\n\
When this skill is active:\n\
1. Run the diagnostics tool to report workspace and sandbox status.\n\
2. Skim key project files (README.md, Cargo.toml, AGENTS.md) before editing.\n\
3. Prefer small, validated changes and summarize what you verified.\n\
"
    )
}

pub fn init_skills_dir(skills_dir: &Path, force: bool) -> Result<(PathBuf, WriteStatus)> {
    std::fs::create_dir_all(skills_dir)
        .with_context(|| format!("Failed to create skills dir {}", skills_dir.display()))?;

    let skill_name = "getting-started";
    let skill_path = skills_dir.join(skill_name).join("SKILL.md");
    ensure_parent_dir(&skill_path)?;

    let status = write_template_file(&skill_path, &skills_template(skill_name), force)?;
    Ok((skill_path, status))
}

fn tools_readme_template() -> &'static str {
    "# Local tools\n\n\
     Drop self-describing scripts here so they can be discovered by\n\
     `deepseek-tui setup --status` and surfaced in `deepseek-tui doctor`.\n\n\
     Each script should start with a frontmatter-style header so the\n\
     description is visible without executing the file:\n\n\
     ```\n\
     # name: my-tool\n\
     # description: One-line summary of what this tool does\n\
     # usage: my-tool [args...]\n\
     ```\n\n\
     The directory is intentionally not auto-loaded into the agent's tool\n\
     catalog. Wire individual tools through MCP, hooks, or skills when you\n\
     want them available inside a session.\n"
}

fn tools_example_script() -> &'static str {
    "#!/usr/bin/env sh\n\
     # name: example\n\
     # description: Print a confirmation that local tool discovery works\n\
     # usage: example [name]\n\
     printf 'deepseek-tui local tool ok: %s\\n' \"${1:-world}\"\n"
}

pub fn init_tools_dir(
    tools_dir: &Path,
    force: bool,
) -> Result<(PathBuf, WriteStatus, WriteStatus)> {
    std::fs::create_dir_all(tools_dir)
        .with_context(|| format!("Failed to create tools dir {}", tools_dir.display()))?;

    let readme_path = tools_dir.join("README.md");
    let readme_status = write_template_file(&readme_path, tools_readme_template(), force)?;

    let example_path = tools_dir.join("example.sh");
    let example_status = write_template_file(&example_path, tools_example_script(), force)?;

    Ok((tools_dir.to_path_buf(), readme_status, example_status))
}

fn plugins_readme_template() -> &'static str {
    "# Local plugins\n\n\
     Plugins are richer than tools: each one lives in its own subdirectory\n\
     with a `PLUGIN.md` describing what it does and how to enable it. The\n\
     directory is created so users have a documented place to drop\n\
     experiments without touching `~/.deepseek/skills/`.\n\n\
     A plugin layout looks like:\n\n\
     ```\n\
     plugins/\n\
       my-plugin/\n\
         PLUGIN.md   # frontmatter + body, same shape as SKILL.md\n\
         scripts/    # optional helpers invoked by the plugin\n\
     ```\n\n\
     Plugins are not loaded automatically. Wire them up through skills,\n\
     hooks, or MCP servers when you want them active in a session.\n"
}

fn plugin_example_template() -> &'static str {
    "---\n\
     name: example\n\
     description: Placeholder plugin so /skills and doctor have something to show\n\
     status: example\n\
     ---\n\n\
     This is a starter plugin layout. Edit or replace it once you have a\n\
     real plugin. The agent does not load this file directly; reference it\n\
     from a skill or MCP wrapper if you want it active in a session.\n"
}

pub fn init_plugins_dir(
    plugins_dir: &Path,
    force: bool,
) -> Result<(PathBuf, PathBuf, WriteStatus, WriteStatus)> {
    std::fs::create_dir_all(plugins_dir)
        .with_context(|| format!("Failed to create plugins dir {}", plugins_dir.display()))?;

    let readme_path = plugins_dir.join("README.md");
    let readme_status = write_template_file(&readme_path, plugins_readme_template(), force)?;

    let example_path = plugins_dir.join("example").join("PLUGIN.md");
    ensure_parent_dir(&example_path)?;
    let example_status = write_template_file(&example_path, plugin_example_template(), force)?;

    Ok((readme_path, example_path, readme_status, example_status))
}

/// Resolve the user-supplied CORS origins for `deepseek serve --http`.
///
/// Sources, in priority order (later sources extend earlier ones):
/// 1. `--cors-origin URL` flags (repeatable)
/// 2. `DEEPSEEK_CORS_ORIGINS` env var (comma-separated)
/// 3. `[runtime_api] cors_origins = [...]` in `config.toml`
///
/// The runtime API always allows the built-in dev defaults
/// (localhost:3000, localhost:1420, tauri://localhost). User entries are
/// appended on top — empty strings are skipped, and duplicates are deduped
/// while preserving first-seen order. Whalescale#255 / #561.
pub fn resolve_cors_origins(config: &Config, flag_origins: &[String]) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    let push = |raw: &str, out: &mut Vec<String>| {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            return;
        }
        if !out.iter().any(|existing| existing == trimmed) {
            out.push(trimmed.to_string());
        }
    };
    for o in flag_origins {
        push(o, &mut out);
    }
    if let Ok(env_value) = std::env::var("DEEPSEEK_CORS_ORIGINS") {
        for piece in env_value.split(',') {
            push(piece, &mut out);
        }
    }
    if let Some(rt) = &config.runtime_api
        && let Some(list) = &rt.cors_origins
    {
        for o in list {
            push(o, &mut out);
        }
    }
    out
}

pub fn yunpat_home_dir() -> PathBuf {
    dirs::home_dir().map_or_else(|| PathBuf::from(".deepseek"), |h| h.join(".deepseek"))
}

pub fn default_tools_dir() -> PathBuf {
    yunpat_home_dir().join("tools")
}

pub fn default_plugins_dir() -> PathBuf {
    yunpat_home_dir().join("plugins")
}

pub fn default_checkpoints_dir() -> PathBuf {
    yunpat_home_dir().join("sessions").join("checkpoints")
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CleanPlan {
    pub targets: Vec<PathBuf>,
}

pub fn collect_clean_targets(checkpoints_dir: &Path) -> CleanPlan {
    let candidates = ["latest.json", "offline_queue.json"];
    let targets = candidates
        .iter()
        .map(|name| checkpoints_dir.join(name))
        .filter(|p| p.exists())
        .collect();
    CleanPlan { targets }
}

pub fn execute_clean_plan(plan: &CleanPlan) -> Result<Vec<PathBuf>> {
    let mut removed = Vec::with_capacity(plan.targets.len());
    for path in &plan.targets {
        std::fs::remove_file(path)
            .with_context(|| format!("Failed to remove {}", path.display()))?;
        removed.push(path.clone());
    }
    Ok(removed)
}

pub fn run_setup(config: &Config, workspace: &Path, args: SetupArgs) -> Result<()> {
    if args.status {
        return run_setup_status(config, workspace);
    }
    if args.clean {
        return run_setup_clean(&default_checkpoints_dir(), args.force);
    }

    use crate::palette;

    let (aqua_r, aqua_g, aqua_b) = palette::DEEPSEEK_SKY_RGB;
    let (sky_r, sky_g, sky_b) = palette::DEEPSEEK_SKY_RGB;

    let any_explicit = args.mcp || args.skills || args.tools || args.plugins;
    let run_mcp = args.mcp || args.all || !any_explicit;
    let run_skills = args.skills || args.all || !any_explicit;
    let run_tools = args.tools || args.all;
    let run_plugins = args.plugins || args.all;

    println!(
        "{}",
        "DeepSeek Setup".truecolor(aqua_r, aqua_g, aqua_b).bold()
    );
    println!("{}", "==============".truecolor(sky_r, sky_g, sky_b));
    println!("Workspace: {}", crate::utils::display_path(workspace));

    if run_mcp {
        let mcp_path = config.mcp_config_path();
        let status = init_mcp_config(&mcp_path, args.force)?;
        match status {
            WriteStatus::Created => {
                println!("  ✓ Created MCP config at {}", mcp_path.display());
            }
            WriteStatus::Overwritten => {
                println!("  ✓ Overwrote MCP config at {}", mcp_path.display());
            }
            WriteStatus::SkippedExists => {
                println!("  · MCP config already exists at {}", mcp_path.display());
            }
        }
        println!("    Next: edit the file, then run `deepseek mcp list` or `deepseek mcp tools`.");
    }

    if run_skills {
        let skills_dir = if args.local {
            workspace.join("skills")
        } else {
            config.skills_dir()
        };
        let (skill_path, status) = init_skills_dir(&skills_dir, args.force)?;
        match status {
            WriteStatus::Created => {
                println!("  ✓ Created example skill at {}", skill_path.display());
            }
            WriteStatus::Overwritten => {
                println!("  ✓ Overwrote example skill at {}", skill_path.display());
            }
            WriteStatus::SkippedExists => {
                println!(
                    "  · Example skill already exists at {}",
                    skill_path.display()
                );
            }
        }
        if args.local {
            println!(
                "    Local skills dir enabled for this workspace: {}",
                crate::utils::display_path(&skills_dir)
            );
        } else {
            println!(
                "    Skills dir: {}",
                crate::utils::display_path(&skills_dir)
            );
        }
        println!("    Next: run the TUI and use `/skills` then `/skill getting-started`.");
    }

    if run_tools {
        let tools_dir = default_tools_dir();
        let (dir, readme_status, example_status) = init_tools_dir(&tools_dir, args.force)?;
        report_write_status("Tools README", &dir.join("README.md"), readme_status);
        report_write_status("Example tool", &dir.join("example.sh"), example_status);
        println!("    Tools dir: {}", crate::utils::display_path(&dir));
        println!("    Next: drop scripts here; surface them via skills/MCP when ready.");
    }

    if run_plugins {
        let plugins_dir = default_plugins_dir();
        let (readme_path, example_path, readme_status, example_status) =
            init_plugins_dir(&plugins_dir, args.force)?;
        report_write_status("Plugins README", &readme_path, readme_status);
        report_write_status("Example plugin", &example_path, example_status);
        println!(
            "    Plugins dir: {}",
            crate::utils::display_path(&plugins_dir)
        );
        println!("    Next: copy the example dir, edit PLUGIN.md, wire via skill/MCP.");
    }

    let sandbox = crate::sandbox::get_platform_sandbox();
    if let Some(kind) = sandbox {
        println!("  ✓ Sandbox available: {kind}");
    } else {
        println!("  · Sandbox not available on this platform (best-effort only).");
    }

    Ok(())
}

fn report_write_status(label: &str, path: &Path, status: WriteStatus) {
    match status {
        WriteStatus::Created => {
            println!("  ✓ Created {label} at {}", path.display());
        }
        WriteStatus::Overwritten => {
            println!("  ✓ Overwrote {label} at {}", path.display());
        }
        WriteStatus::SkippedExists => {
            println!("  · {label} already exists at {}", path.display());
        }
    }
}

/// Source of the resolved DeepSeek API key, used in status reports.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ApiKeySource {
    Env,
    Config,
    Keyring,
    Missing,
}

pub fn resolve_api_key_source(config: &Config) -> ApiKeySource {
    if std::env::var("DEEPSEEK_API_KEY")
        .ok()
        .filter(|k| !k.trim().is_empty())
        .is_some()
    {
        match std::env::var("DEEPSEEK_API_KEY_SOURCE").ok().as_deref() {
            Some("config") => return ApiKeySource::Config,
            Some("keyring") => return ApiKeySource::Keyring,
            _ => {}
        }
    }

    if config
        .api_key
        .as_ref()
        .is_some_and(|k| !k.trim().is_empty())
        || config
            .provider_config()
            .and_then(|entry| entry.api_key.as_ref())
            .is_some_and(|k| !k.trim().is_empty())
    {
        ApiKeySource::Config
    } else if std::env::var("DEEPSEEK_API_KEY")
        .ok()
        .filter(|k| !k.trim().is_empty())
        .is_some()
    {
        ApiKeySource::Env
    } else {
        ApiKeySource::Missing
    }
}

pub fn count_dir_entries(dir: &Path) -> usize {
    std::fs::read_dir(dir)
        .map(|entries| entries.filter_map(std::result::Result::ok).count())
        .unwrap_or(0)
}

pub fn skills_count_for(dir: &Path) -> usize {
    if !dir.exists() {
        return 0;
    }
    crate::skills::SkillRegistry::discover(dir).len()
}

fn run_setup_status(config: &Config, workspace: &Path) -> Result<()> {
    use crate::palette;

    let (aqua_r, aqua_g, aqua_b) = palette::DEEPSEEK_SKY_RGB;
    let (sky_r, sky_g, sky_b) = palette::DEEPSEEK_SKY_RGB;
    let (red_r, red_g, red_b) = palette::DEEPSEEK_RED_RGB;

    println!(
        "{}",
        "DeepSeek Status".truecolor(aqua_r, aqua_g, aqua_b).bold()
    );
    println!("{}", "===============".truecolor(sky_r, sky_g, sky_b));
    println!("workspace: {}", workspace.display());

    match resolve_api_key_source(config) {
        ApiKeySource::Env => println!(
            "  {} api_key: set via DEEPSEEK_API_KEY",
            "✓".truecolor(aqua_r, aqua_g, aqua_b)
        ),
        ApiKeySource::Keyring => println!(
            "  {} api_key: set via OS keyring",
            "✓".truecolor(aqua_r, aqua_g, aqua_b)
        ),
        ApiKeySource::Config => println!(
            "  {} api_key: set via config",
            "✓".truecolor(aqua_r, aqua_g, aqua_b)
        ),
        ApiKeySource::Missing => {
            let (env_var, login_hint) = match config.api_provider() {
                crate::config::ApiProvider::NvidiaNim => (
                    "NVIDIA_API_KEY",
                    "deepseek auth set --provider nvidia-nim --api-key \"...\"",
                ),
                crate::config::ApiProvider::Openrouter => (
                    "OPENROUTER_API_KEY",
                    "deepseek auth set --provider openrouter --api-key \"...\"",
                ),
                crate::config::ApiProvider::Novita => (
                    "NOVITA_API_KEY",
                    "deepseek auth set --provider novita --api-key \"...\"",
                ),
                crate::config::ApiProvider::Fireworks => (
                    "FIREWORKS_API_KEY",
                    "deepseek auth set --provider fireworks --api-key \"...\"",
                ),
                crate::config::ApiProvider::Sglang => (
                    "SGLANG_API_KEY",
                    "deepseek auth set --provider sglang --api-key \"...\"",
                ),
                crate::config::ApiProvider::Vllm => (
                    "VLLM_API_KEY",
                    "deepseek auth set --provider vllm --api-key \"...\"",
                ),
                crate::config::ApiProvider::Ollama => {
                    ("OLLAMA_API_KEY", "deepseek auth set --provider ollama")
                }
                crate::config::ApiProvider::Deepseek | crate::config::ApiProvider::DeepseekCN => {
                    ("DEEPSEEK_API_KEY", "deepseek auth set --provider deepseek")
                }
            };
            println!(
                "  {} api_key: missing  (set {env_var} or `[providers.{}].api_key` in ~/.deepseek/config.toml; or run `{login_hint}`)",
                "✗".truecolor(red_r, red_g, red_b),
                match config.api_provider() {
                    crate::config::ApiProvider::NvidiaNim => "nvidia_nim",
                    crate::config::ApiProvider::Openrouter => "openrouter",
                    crate::config::ApiProvider::Novita => "novita",
                    crate::config::ApiProvider::Fireworks => "fireworks",
                    crate::config::ApiProvider::Sglang => "sglang",
                    crate::config::ApiProvider::Vllm => "vllm",
                    crate::config::ApiProvider::Ollama => "ollama",
                    crate::config::ApiProvider::Deepseek
                    | crate::config::ApiProvider::DeepseekCN => "deepseek",
                }
            );
        }
    }
    println!("  · base_url: {}", config.yunpat_base_url());
    let model = config
        .default_text_model
        .clone()
        .unwrap_or_else(|| DEFAULT_TEXT_MODEL.to_string());
    println!("  · default_text_model: {model}");

    let mcp_path = config.mcp_config_path();
    let mcp_count = match crate::mcp::load_config(&mcp_path) {
        Ok(cfg) => cfg.servers.len(),
        Err(_) => 0,
    };
    let mcp_present = if mcp_path.exists() { "" } else { "  (missing)" };
    println!(
        "  · mcp servers: {mcp_count} at {}{mcp_present}",
        mcp_path.display()
    );

    let skills_dir = config.skills_dir();
    println!(
        "  · skills: {} at {}",
        skills_count_for(&skills_dir),
        crate::utils::display_path(&skills_dir)
    );

    let tools_dir = default_tools_dir();
    let tools_present = if tools_dir.exists() {
        ""
    } else {
        "  (missing — run `setup --tools`)"
    };
    println!(
        "  · tools: {} entries at {}{tools_present}",
        if tools_dir.exists() {
            count_dir_entries(&tools_dir)
        } else {
            0
        },
        crate::utils::display_path(&tools_dir)
    );

    let plugins_dir = default_plugins_dir();
    let plugins_present = if plugins_dir.exists() {
        ""
    } else {
        "  (missing — run `setup --plugins`)"
    };
    println!(
        "  · plugins: {} entries at {}{plugins_present}",
        if plugins_dir.exists() {
            count_dir_entries(&plugins_dir)
        } else {
            0
        },
        crate::utils::display_path(&plugins_dir)
    );

    let sandbox = crate::sandbox::get_platform_sandbox();
    match sandbox {
        Some(kind) => println!(
            "  {} sandbox: {kind}",
            "✓".truecolor(aqua_r, aqua_g, aqua_b)
        ),
        None => println!(
            "  {} sandbox: unavailable (commands run best-effort)",
            "!".truecolor(sky_r, sky_g, sky_b)
        ),
    }

    println!("  {} {}", "·".dimmed(), dotenv_status_line(workspace));

    println!();
    println!("Run `deepseek-tui doctor --json` for a machine-readable check.");
    Ok(())
}

pub fn dotenv_status_line(workspace: &Path) -> String {
    let dotenv = workspace.join(".env");
    if dotenv.exists() {
        return format!(".env present at {}", dotenv.display());
    }

    if workspace.join(".env.example").exists() {
        return ".env not present in workspace (run `cp .env.example .env` and edit)".to_string();
    }

    ".env not present in workspace".to_string()
}

pub fn run_setup_clean(checkpoints_dir: &Path, force: bool) -> Result<()> {
    if !checkpoints_dir.exists() {
        println!(
            "Nothing to clean — checkpoints dir does not exist: {}",
            checkpoints_dir.display()
        );
        return Ok(());
    }

    let plan = collect_clean_targets(checkpoints_dir);
    if plan.targets.is_empty() {
        println!(
            "Nothing to clean — no checkpoint files in {}",
            checkpoints_dir.display()
        );
        return Ok(());
    }

    if !force {
        println!(
            "Would remove {} checkpoint file(s) (use --force to apply):",
            plan.targets.len()
        );
        for path in &plan.targets {
            println!("  · {}", path.display());
        }
        return Ok(());
    }

    let removed = execute_clean_plan(&plan)?;
    println!("{}", "Cleaned checkpoints:".bold());
    for path in &removed {
        println!("  ✓ {}", path.display());
    }
    Ok(())
}
