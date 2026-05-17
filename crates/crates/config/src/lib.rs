use std::collections::BTreeMap;
use std::fs;
#[cfg(unix)]
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use anyhow::{Context, Result, bail};
use serde::{Deserialize, Serialize};
use yunpat_secrets::SecretSource;
pub use yunpat_secrets::Secrets;

#[cfg(unix)]
use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};

pub const CONFIG_FILE_NAME: &str = "config.toml";
const DEFAULT_DEEPSEEK_MODEL: &str = "deepseek-v4-pro";
const DEFAULT_NVIDIA_NIM_MODEL: &str = "deepseek-ai/deepseek-v4-pro";
const DEFAULT_NVIDIA_NIM_FLASH_MODEL: &str = "deepseek-ai/deepseek-v4-flash";
const DEFAULT_OPENAI_MODEL: &str = "gpt-4.1";
const DEFAULT_DEEPSEEK_BASE_URL: &str = "https://api.deepseek.com/beta";
const DEFAULT_NVIDIA_NIM_BASE_URL: &str = "https://integrate.api.nvidia.com/v1";
const DEFAULT_OPENAI_BASE_URL: &str = "https://api.openai.com/v1";
const DEFAULT_OPENROUTER_MODEL: &str = "deepseek/deepseek-v4-pro";
const DEFAULT_OPENROUTER_FLASH_MODEL: &str = "deepseek/deepseek-v4-flash";
const DEFAULT_NOVITA_MODEL: &str = "deepseek/deepseek-v4-pro";
const DEFAULT_NOVITA_FLASH_MODEL: &str = "deepseek/deepseek-v4-flash";
const DEFAULT_FIREWORKS_MODEL: &str = "accounts/fireworks/models/deepseek-v4-pro";
const DEFAULT_SGLANG_MODEL: &str = "deepseek-ai/DeepSeek-V4-Pro";
const DEFAULT_SGLANG_FLASH_MODEL: &str = "deepseek-ai/DeepSeek-V4-Flash";
const DEFAULT_OPENROUTER_BASE_URL: &str = "https://openrouter.ai/api/v1";
const DEFAULT_NOVITA_BASE_URL: &str = "https://api.novita.ai/v1";
const DEFAULT_FIREWORKS_BASE_URL: &str = "https://api.fireworks.ai/inference/v1";
const DEFAULT_SGLANG_BASE_URL: &str = "http://localhost:30000/v1";
const DEFAULT_VLLM_MODEL: &str = "deepseek-ai/DeepSeek-V4-Pro";
const DEFAULT_VLLM_FLASH_MODEL: &str = "deepseek-ai/DeepSeek-V4-Flash";
const DEFAULT_VLLM_BASE_URL: &str = "http://localhost:8000/v1";
const DEFAULT_OLLAMA_MODEL: &str = "deepseek-coder:1.3b";
const DEFAULT_OLLAMA_BASE_URL: &str = "http://localhost:11434/v1";
const DEFAULT_ZHIPU_BASE_URL: &str = "https://open.bigmodel.cn/api/paas/v4";
const DEFAULT_ZHIPU_MODEL: &str = "glm-4-flash";
const DEFAULT_MOONSHOT_BASE_URL: &str = "https://api.moonshot.cn/v1";
const DEFAULT_MOONSHOT_MODEL: &str = "moonshot-v1-128k";
const DEFAULT_DOUBAO_BASE_URL: &str = "https://ark.cn-beijing.volces.com/api/v3";
const DEFAULT_DOUBAO_MODEL: &str = "doubao-1-5-pro-256k";

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "kebab-case")]
pub enum ProviderKind {
    #[default]
    Deepseek,
    NvidiaNim,
    Openai,
    Openrouter,
    Novita,
    Fireworks,
    Sglang,
    Vllm,
    Ollama,
    Zhipu,
    Moonshot,
    Doubao,
}

impl ProviderKind {
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Deepseek => "deepseek",
            Self::NvidiaNim => "nvidia-nim",
            Self::Openai => "openai",
            Self::Openrouter => "openrouter",
            Self::Novita => "novita",
            Self::Fireworks => "fireworks",
            Self::Sglang => "sglang",
            Self::Vllm => "vllm",
            Self::Ollama => "ollama",
            Self::Zhipu => "zhipu",
            Self::Moonshot => "moonshot",
            Self::Doubao => "doubao",
        }
    }

    #[must_use]
    pub fn parse(value: &str) -> Option<Self> {
        match value.trim().to_ascii_lowercase().as_str() {
            "deepseek" | "deep-seek" => Some(Self::Deepseek),
            "nvidia" | "nvidia-nim" | "nvidia_nim" | "nim" => Some(Self::NvidiaNim),
            "openai" | "open-ai" => Some(Self::Openai),
            "openrouter" | "open_router" => Some(Self::Openrouter),
            "novita" => Some(Self::Novita),
            "fireworks" | "fireworks-ai" => Some(Self::Fireworks),
            "sglang" | "sg-lang" => Some(Self::Sglang),
            "vllm" | "v-llm" => Some(Self::Vllm),
            "ollama" | "ollama-local" => Some(Self::Ollama),
            "zhipu" | "glm" | "bigmodel" => Some(Self::Zhipu),
            "moonshot" | "kimi" => Some(Self::Moonshot),
            "doubao" | "volcengine" | "bytedance" => Some(Self::Doubao),
            _ => None,
        }
    }

    /// Returns the TOML table key for this provider.
    ///
    /// Used in `config.toml` as `[providers.<key>]` and in
    /// `get_value`/`set_value` as `providers.<key>.api_key` etc.
    ///
    /// ```ignore
    /// assert_eq!(ProviderKind::NvidiaNim.toml_key(), "nvidia_nim");
    /// assert_eq!(ProviderKind::Zhipu.toml_key(), "zhipu");
    /// ```
    #[must_use]
    pub fn toml_key(self) -> &'static str {
        match self {
            Self::Deepseek => "deepseek",
            Self::NvidiaNim => "nvidia_nim",
            Self::Openai => "openai",
            Self::Openrouter => "openrouter",
            Self::Novita => "novita",
            Self::Fireworks => "fireworks",
            Self::Sglang => "sglang",
            Self::Vllm => "vllm",
            Self::Ollama => "ollama",
            Self::Zhipu => "zhipu",
            Self::Moonshot => "moonshot",
            Self::Doubao => "doubao",
        }
    }

    #[must_use]
    pub fn from_toml_key(key: &str) -> Option<Self> {
        Self::all().find(|p| p.toml_key() == key)
    }

    pub fn all() -> impl Iterator<Item = Self> {
        const VARIANTS: [ProviderKind; 12] = [
            ProviderKind::Deepseek,
            ProviderKind::NvidiaNim,
            ProviderKind::Openai,
            ProviderKind::Openrouter,
            ProviderKind::Novita,
            ProviderKind::Fireworks,
            ProviderKind::Sglang,
            ProviderKind::Vllm,
            ProviderKind::Ollama,
            ProviderKind::Zhipu,
            ProviderKind::Moonshot,
            ProviderKind::Doubao,
        ];
        VARIANTS.into_iter()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProviderConfigToml {
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub model: Option<String>,
    #[serde(default)]
    pub http_headers: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProvidersToml {
    #[serde(default)]
    pub deepseek: ProviderConfigToml,
    #[serde(default)]
    pub nvidia_nim: ProviderConfigToml,
    #[serde(default)]
    pub openai: ProviderConfigToml,
    #[serde(default)]
    pub openrouter: ProviderConfigToml,
    #[serde(default)]
    pub novita: ProviderConfigToml,
    #[serde(default)]
    pub fireworks: ProviderConfigToml,
    #[serde(default)]
    pub sglang: ProviderConfigToml,
    #[serde(default)]
    pub vllm: ProviderConfigToml,
    #[serde(default)]
    pub ollama: ProviderConfigToml,
    #[serde(default)]
    pub zhipu: ProviderConfigToml,
    #[serde(default)]
    pub moonshot: ProviderConfigToml,
    #[serde(default)]
    pub doubao: ProviderConfigToml,
}

impl ProvidersToml {
    #[must_use]
    pub fn for_provider(&self, provider: ProviderKind) -> &ProviderConfigToml {
        match provider {
            ProviderKind::Deepseek => &self.deepseek,
            ProviderKind::NvidiaNim => &self.nvidia_nim,
            ProviderKind::Openai => &self.openai,
            ProviderKind::Openrouter => &self.openrouter,
            ProviderKind::Novita => &self.novita,
            ProviderKind::Fireworks => &self.fireworks,
            ProviderKind::Sglang => &self.sglang,
            ProviderKind::Vllm => &self.vllm,
            ProviderKind::Ollama => &self.ollama,
            ProviderKind::Zhipu => &self.zhipu,
            ProviderKind::Moonshot => &self.moonshot,
            ProviderKind::Doubao => &self.doubao,
        }
    }

    pub fn for_provider_mut(&mut self, provider: ProviderKind) -> &mut ProviderConfigToml {
        match provider {
            ProviderKind::Deepseek => &mut self.deepseek,
            ProviderKind::NvidiaNim => &mut self.nvidia_nim,
            ProviderKind::Openai => &mut self.openai,
            ProviderKind::Openrouter => &mut self.openrouter,
            ProviderKind::Novita => &mut self.novita,
            ProviderKind::Fireworks => &mut self.fireworks,
            ProviderKind::Sglang => &mut self.sglang,
            ProviderKind::Vllm => &mut self.vllm,
            ProviderKind::Ollama => &mut self.ollama,
            ProviderKind::Zhipu => &mut self.zhipu,
            ProviderKind::Moonshot => &mut self.moonshot,
            ProviderKind::Doubao => &mut self.doubao,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ConfigToml {
    /// TUI-compatible DeepSeek API key. Kept at the root so both `deepseek`
    /// and `deepseek-tui` can share a single config file.
    pub api_key: Option<String>,
    /// TUI-compatible DeepSeek base URL.
    pub base_url: Option<String>,
    /// Optional extra HTTP headers forwarded to model API requests.
    #[serde(default)]
    pub http_headers: BTreeMap<String, String>,
    /// TUI-compatible default DeepSeek model.
    pub default_text_model: Option<String>,
    #[serde(default)]
    pub provider: ProviderKind,
    pub model: Option<String>,
    pub auth_mode: Option<String>,
    pub chatgpt_access_token: Option<String>,
    pub device_code_session: Option<String>,
    pub output_mode: Option<String>,
    pub log_level: Option<String>,
    pub telemetry: Option<bool>,
    pub approval_policy: Option<String>,
    pub sandbox_mode: Option<String>,
    #[serde(default)]
    pub providers: ProvidersToml,
    /// Per-domain network policy (#135). When absent, network tools fall back
    /// to a permissive default that mirrors pre-v0.7.0 behavior.
    #[serde(default)]
    pub network: Option<NetworkPolicyToml>,
    /// Community skill installer settings (#140). Mirrors
    /// [`SkillsToml`] from the TUI side; the dispatcher consults
    /// `registry_url` when running `deepseek skill install`.
    #[serde(default)]
    pub skills: Option<SkillsToml>,
    /// Workspace side-git snapshots (#137). The live TUI defaults this to
    /// enabled with 7-day retention when absent.
    #[serde(default)]
    pub snapshots: Option<SnapshotsToml>,
    /// Post-edit LSP diagnostics injection (#136). When absent, the engine
    /// applies the defaults documented in [`LspConfigToml`].
    #[serde(default)]
    pub lsp: Option<LspConfigToml>,
    #[serde(flatten)]
    pub extras: BTreeMap<String, toml::Value>,
}

/// On-disk schema for the `[skills]` table (#140). See `config.example.toml`
/// for documentation.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SkillsToml {
    /// Curated registry index URL. When unset, the TUI falls back to the
    /// bundled default (community-curated GitHub raw).
    #[serde(default)]
    pub registry_url: Option<String>,
    /// Per-skill maximum *uncompressed* size in bytes. When unset, the TUI
    /// uses 5 MiB.
    #[serde(default)]
    pub max_install_size_bytes: Option<u64>,
}

/// On-disk schema for the `[snapshots]` table (#137). See
/// `config.example.toml` for documentation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotsToml {
    #[serde(default = "default_snapshots_enabled")]
    pub enabled: bool,
    #[serde(default = "default_snapshot_max_age_days")]
    pub max_age_days: u64,
}

fn default_snapshots_enabled() -> bool {
    true
}

fn default_snapshot_max_age_days() -> u64 {
    7
}

impl Default for SnapshotsToml {
    fn default() -> Self {
        Self {
            enabled: default_snapshots_enabled(),
            max_age_days: default_snapshot_max_age_days(),
        }
    }
}

/// On-disk schema for the `[network]` table (#135). See `config.example.toml`
/// for documentation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkPolicyToml {
    /// Decision for hosts that are not in `allow` or `deny`. One of
    /// `"allow" | "deny" | "prompt"`. Defaults to `"prompt"`.
    #[serde(default = "default_network_decision")]
    pub default: String,
    /// Hosts that are always allowed. Subdomain rules: a leading dot
    /// (`.example.com`) matches subdomains but not the apex.
    #[serde(default)]
    pub allow: Vec<String>,
    /// Hosts that are always denied. Deny entries win over allow entries.
    #[serde(default)]
    pub deny: Vec<String>,
    /// Whether to record one audit-log line per outbound network call.
    #[serde(default = "default_network_audit")]
    pub audit: bool,
}

fn default_network_decision() -> String {
    "prompt".to_string()
}

fn default_network_audit() -> bool {
    true
}

impl Default for NetworkPolicyToml {
    fn default() -> Self {
        Self {
            default: default_network_decision(),
            allow: Vec::new(),
            deny: Vec::new(),
            audit: default_network_audit(),
        }
    }
}

/// On-disk schema for the `[lsp]` table (#136). See `config.example.toml`
/// for documentation. All fields are optional so the TUI runtime can fall
/// back to its own defaults when keys are absent.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LspConfigToml {
    /// Master switch.
    pub enabled: Option<bool>,
    /// Maximum time to wait for diagnostics after an edit, in milliseconds.
    pub poll_after_edit_ms: Option<u64>,
    /// Cap on diagnostics surfaced per file.
    pub max_diagnostics_per_file: Option<usize>,
    /// When `true`, warnings (severity 2) are surfaced in addition to errors.
    pub include_warnings: Option<bool>,
    /// Optional override for the `language -> [cmd, ...args]` table.
    pub servers: Option<BTreeMap<String, Vec<String>>>,
}

impl ConfigToml {
    /// Merge project-level overrides from `$WORKSPACE/.deepseek/config.toml`.
    /// Only populated fields in `project` are applied; everything else
    /// keeps its global value. Provider-specific sub-tables are merged
    /// field-by-field so a project can set just `providers.deepseek.model`
    /// without needing to repeat `api_key` or `base_url`.
    pub fn merge_project_overrides(&mut self, project: ConfigToml) {
        // Check provider override condition before moving fields.
        let has_api_key = project.api_key.is_some();

        // Top-level scalar fields: apply when the project has a value.
        if has_api_key {
            self.api_key = project.api_key;
        }
        if project.base_url.is_some() {
            self.base_url = project.base_url;
        }
        if !project.http_headers.is_empty() {
            self.http_headers = project.http_headers;
        }
        if project.default_text_model.is_some() {
            self.default_text_model = project.default_text_model;
        }
        if project.model.is_some() {
            self.model = project.model;
        }
        if project.auth_mode.is_some() {
            self.auth_mode = project.auth_mode;
        }
        if project.output_mode.is_some() {
            self.output_mode = project.output_mode;
        }
        if project.telemetry.is_some() {
            self.telemetry = project.telemetry;
        }
        if project.approval_policy.is_some() {
            self.approval_policy = project.approval_policy;
        }
        if project.sandbox_mode.is_some() {
            self.sandbox_mode = project.sandbox_mode;
        }
        // Provider is only overridden if explicitly set (non-default).
        if project.provider != ProviderKind::Deepseek || has_api_key {
            self.provider = project.provider;
        }

        // Merge provider sub-tables field-by-field.
        for provider in ProviderKind::all() {
            merge_provider_config(
                self.providers.for_provider_mut(provider),
                project.providers.for_provider(provider),
            );
        }

        if project.network.is_some() {
            self.network = project.network;
        }
        if project.skills.is_some() {
            self.skills = project.skills;
        }
        if project.snapshots.is_some() {
            self.snapshots = project.snapshots;
        }
        if project.lsp.is_some() {
            self.lsp = project.lsp;
        }
        for (k, v) in project.extras {
            self.extras.insert(k, v);
        }
    }

    #[must_use]
    pub fn get_value(&self, key: &str) -> Option<String> {
        match key {
            "provider" => return Some(self.provider.as_str().to_string()),
            "api_key" => return self.api_key.clone(),
            "base_url" => return self.base_url.clone(),
            "http_headers" => return serialize_http_headers(&self.http_headers),
            "default_text_model" => return self.default_text_model.clone(),
            "model" => return self.model.clone(),
            "auth.mode" => return self.auth_mode.clone(),
            "auth.chatgpt_access_token" => return self.chatgpt_access_token.clone(),
            "auth.device_code_session" => return self.device_code_session.clone(),
            "output_mode" => return self.output_mode.clone(),
            "log_level" => return self.log_level.clone(),
            "telemetry" => return self.telemetry.map(|v| v.to_string()),
            "approval_policy" => return self.approval_policy.clone(),
            "sandbox_mode" => return self.sandbox_mode.clone(),
            _ => {}
        }
        if let Some((provider, field)) = parse_provider_key(key) {
            let cfg = self.providers.for_provider(provider);
            return match field {
                "api_key" => cfg.api_key.clone(),
                "base_url" => cfg.base_url.clone(),
                "model" => cfg.model.clone(),
                "http_headers" => serialize_http_headers(&cfg.http_headers),
                _ => None,
            };
        }
        self.extras.get(key).map(toml::Value::to_string)
    }

    pub fn set_value(&mut self, key: &str, value: &str) -> Result<()> {
        match key {
            "provider" => {
                self.provider = ProviderKind::parse(value)
                    .with_context(|| format!("unknown provider '{value}'"))?;
            }
            "api_key" => self.api_key = Some(value.to_string()),
            "base_url" => self.base_url = Some(value.to_string()),
            "http_headers" => self.http_headers = parse_http_headers(value)?,
            "default_text_model" => self.default_text_model = Some(value.to_string()),
            "model" => self.model = Some(value.to_string()),
            "auth.mode" => self.auth_mode = Some(value.to_string()),
            "auth.chatgpt_access_token" => self.chatgpt_access_token = Some(value.to_string()),
            "auth.device_code_session" => self.device_code_session = Some(value.to_string()),
            "output_mode" => self.output_mode = Some(value.to_string()),
            "log_level" => self.log_level = Some(value.to_string()),
            "telemetry" => {
                self.telemetry = Some(parse_bool(value)?);
            }
            "approval_policy" => self.approval_policy = Some(value.to_string()),
            "sandbox_mode" => self.sandbox_mode = Some(value.to_string()),
            _ => {
                if let Some((provider, field)) = parse_provider_key(key) {
                    let cfg = self.providers.for_provider_mut(provider);
                    match field {
                        "api_key" => cfg.api_key = Some(value.to_string()),
                        "base_url" => cfg.base_url = Some(value.to_string()),
                        "model" => cfg.model = Some(value.to_string()),
                        "http_headers" => cfg.http_headers = parse_http_headers(value)?,
                        _ => bail!("unknown provider field: {field}"),
                    }
                    if provider == ProviderKind::Deepseek {
                        match field {
                            "api_key" => self.api_key = Some(value.to_string()),
                            "base_url" => self.base_url = Some(value.to_string()),
                            "model" => self.default_text_model = Some(value.to_string()),
                            "http_headers" => self.http_headers = parse_http_headers(value)?,
                            _ => {}
                        }
                    }
                } else {
                    self.extras.insert(key.to_string(), toml::Value::String(value.to_string()));
                }
            }
        }
        Ok(())
    }

    pub fn unset_value(&mut self, key: &str) -> Result<()> {
        match key {
            "provider" => self.provider = ProviderKind::Deepseek,
            "api_key" => self.api_key = None,
            "base_url" => self.base_url = None,
            "http_headers" => self.http_headers.clear(),
            "default_text_model" => self.default_text_model = None,
            "model" => self.model = None,
            "auth.mode" => self.auth_mode = None,
            "auth.chatgpt_access_token" => self.chatgpt_access_token = None,
            "auth.device_code_session" => self.device_code_session = None,
            "output_mode" => self.output_mode = None,
            "log_level" => self.log_level = None,
            "telemetry" => self.telemetry = None,
            "approval_policy" => self.approval_policy = None,
            "sandbox_mode" => self.sandbox_mode = None,
            _ => {
                if let Some((provider, field)) = parse_provider_key(key) {
                    let cfg = self.providers.for_provider_mut(provider);
                    match field {
                        "api_key" => cfg.api_key = None,
                        "base_url" => cfg.base_url = None,
                        "model" => cfg.model = None,
                        "http_headers" => cfg.http_headers.clear(),
                        _ => {}
                    }
                    if provider == ProviderKind::Deepseek {
                        match field {
                            "api_key" => self.api_key = None,
                            "base_url" => self.base_url = None,
                            "model" => self.default_text_model = None,
                            "http_headers" => self.http_headers.clear(),
                            _ => {}
                        }
                    }
                } else {
                    self.extras.remove(key);
                }
            }
        }
        Ok(())
    }

    #[must_use]
    pub fn list_values(&self) -> BTreeMap<String, String> {
        let mut out = BTreeMap::new();
        out.insert("provider".to_string(), self.provider.as_str().to_string());

        if let Some(v) = self.api_key.as_ref() {
            out.insert("api_key".to_string(), redact_secret(v));
        }
        if let Some(v) = self.base_url.as_ref() {
            out.insert("base_url".to_string(), v.clone());
        }
        if let Some(v) = serialize_http_headers(&self.http_headers) {
            out.insert("http_headers".to_string(), v);
        }
        if let Some(v) = self.default_text_model.as_ref() {
            out.insert("default_text_model".to_string(), v.clone());
        }
        if let Some(v) = self.model.as_ref() {
            out.insert("model".to_string(), v.clone());
        }
        if let Some(v) = self.auth_mode.as_ref() {
            out.insert("auth.mode".to_string(), v.clone());
        }
        if let Some(v) = self.chatgpt_access_token.as_ref() {
            out.insert("auth.chatgpt_access_token".to_string(), redact_secret(v));
        }
        if let Some(v) = self.device_code_session.as_ref() {
            out.insert("auth.device_code_session".to_string(), redact_secret(v));
        }
        if let Some(v) = self.output_mode.as_ref() {
            out.insert("output_mode".to_string(), v.clone());
        }
        if let Some(v) = self.log_level.as_ref() {
            out.insert("log_level".to_string(), v.clone());
        }
        if let Some(v) = self.telemetry {
            out.insert("telemetry".to_string(), v.to_string());
        }
        if let Some(v) = self.approval_policy.as_ref() {
            out.insert("approval_policy".to_string(), v.clone());
        }
        if let Some(v) = self.sandbox_mode.as_ref() {
            out.insert("sandbox_mode".to_string(), v.clone());
        }

        for provider in ProviderKind::all() {
            let toml_key = provider.toml_key();
            let cfg = self.providers.for_provider(provider);
            if let Some(v) = cfg.api_key.as_ref() {
                out.insert(format!("providers.{toml_key}.api_key"), redact_secret(v));
            }
            if let Some(v) = cfg.base_url.as_ref() {
                out.insert(format!("providers.{toml_key}.base_url"), v.clone());
            }
            if let Some(v) = cfg.model.as_ref() {
                out.insert(format!("providers.{toml_key}.model"), v.clone());
            }
            if let Some(v) = serialize_http_headers(&cfg.http_headers) {
                out.insert(format!("providers.{toml_key}.http_headers"), v);
            }
        }

        for (k, v) in &self.extras {
            out.insert(k.clone(), v.to_string());
        }
        out
    }

    /// Resolve runtime options without touching platform credential stores.
    ///
    /// This method keeps library callers prompt-free: CLI flag → config file
    /// → environment. Call `resolve_runtime_options_with_secrets` when a
    /// user-facing dispatcher should recover OS-keyring credentials.
    #[must_use]
    pub fn resolve_runtime_options(&self, cli: &CliRuntimeOverrides) -> ResolvedRuntimeOptions {
        let no_keyring = Secrets::new(std::sync::Arc::new(
            yunpat_secrets::InMemoryKeyringStore::new(),
        ));
        self.resolve_runtime_options_with_secrets(cli, &no_keyring)
    }

    /// Resolve runtime options using an explicit secrets façade.
    ///
    /// API-key precedence is **CLI flag → config-file → keyring → environment**.
    #[must_use]
    pub fn resolve_runtime_options_with_secrets(
        &self,
        cli: &CliRuntimeOverrides,
        secrets: &Secrets,
    ) -> ResolvedRuntimeOptions {
        let env = EnvRuntimeOverrides::load();
        let provider = cli.provider.or(env.provider).unwrap_or(self.provider);

        let provider_cfg = self.providers.for_provider(provider);
        let root_yunpat_api_key =
            (provider == ProviderKind::Deepseek).then(|| self.api_key.clone()).flatten();
        let root_yunpat_base_url =
            (provider == ProviderKind::Deepseek).then(|| self.base_url.clone()).flatten();
        let root_yunpat_model = (provider == ProviderKind::Deepseek)
            .then(|| self.default_text_model.clone())
            .flatten();
        // CLI flag wins outright. Otherwise: config-file → injected secrets/env.
        // This makes `deepseek auth set` a reliable fix even when the user's
        // shell still exports an old key. When the file is empty, the injected
        // secrets façade recovers older OS-keyring credentials before falling
        // back to ambient env.
        let from_file = provider_cfg.api_key.clone().or(root_yunpat_api_key);
        let (api_key, api_key_source) = if let Some(value) = cli.api_key.clone() {
            (Some(value), Some(RuntimeApiKeySource::Cli))
        } else if let Some(value) = from_file.clone().filter(|v| !v.trim().is_empty()) {
            (Some(value), Some(RuntimeApiKeySource::ConfigFile))
        } else if let Some((value, source)) = secrets.resolve_with_source(provider.as_str()) {
            let source = match source {
                SecretSource::Keyring => RuntimeApiKeySource::Keyring,
                SecretSource::Env => RuntimeApiKeySource::Env,
            };
            (Some(value), Some(source))
        } else {
            (None, None)
        };

        let base_url = cli
            .base_url
            .clone()
            .or_else(|| env.base_url_for(provider))
            .or_else(|| provider_cfg.base_url.clone())
            .or(root_yunpat_base_url)
            .unwrap_or_else(|| match provider {
                ProviderKind::Deepseek => DEFAULT_DEEPSEEK_BASE_URL.to_string(),
                ProviderKind::NvidiaNim => DEFAULT_NVIDIA_NIM_BASE_URL.to_string(),
                ProviderKind::Openai => DEFAULT_OPENAI_BASE_URL.to_string(),
                ProviderKind::Openrouter => DEFAULT_OPENROUTER_BASE_URL.to_string(),
                ProviderKind::Novita => DEFAULT_NOVITA_BASE_URL.to_string(),
                ProviderKind::Fireworks => DEFAULT_FIREWORKS_BASE_URL.to_string(),
                ProviderKind::Sglang => DEFAULT_SGLANG_BASE_URL.to_string(),
                ProviderKind::Vllm => DEFAULT_VLLM_BASE_URL.to_string(),
                ProviderKind::Ollama => DEFAULT_OLLAMA_BASE_URL.to_string(),
                ProviderKind::Zhipu => DEFAULT_ZHIPU_BASE_URL.to_string(),
                ProviderKind::Moonshot => DEFAULT_MOONSHOT_BASE_URL.to_string(),
                ProviderKind::Doubao => DEFAULT_DOUBAO_BASE_URL.to_string(),
            });

        let model = cli
            .model
            .clone()
            .or_else(|| env.model.clone())
            .or_else(|| provider_cfg.model.clone())
            .or(root_yunpat_model)
            .or_else(|| self.model.clone())
            .unwrap_or_else(|| match provider {
                ProviderKind::Deepseek => DEFAULT_DEEPSEEK_MODEL.to_string(),
                ProviderKind::NvidiaNim => DEFAULT_NVIDIA_NIM_MODEL.to_string(),
                ProviderKind::Openai => DEFAULT_OPENAI_MODEL.to_string(),
                ProviderKind::Openrouter => DEFAULT_OPENROUTER_MODEL.to_string(),
                ProviderKind::Novita => DEFAULT_NOVITA_MODEL.to_string(),
                ProviderKind::Fireworks => DEFAULT_FIREWORKS_MODEL.to_string(),
                ProviderKind::Sglang => DEFAULT_SGLANG_MODEL.to_string(),
                ProviderKind::Vllm => DEFAULT_VLLM_MODEL.to_string(),
                ProviderKind::Ollama => DEFAULT_OLLAMA_MODEL.to_string(),
                ProviderKind::Zhipu => DEFAULT_ZHIPU_MODEL.to_string(),
                ProviderKind::Moonshot => DEFAULT_MOONSHOT_MODEL.to_string(),
                ProviderKind::Doubao => DEFAULT_DOUBAO_MODEL.to_string(),
            });
        let model = normalize_model_for_provider(provider, &model);

        let mut http_headers = self.http_headers.clone();
        http_headers.extend(provider_cfg.http_headers.clone());
        if let Some(env_headers) = env.http_headers {
            http_headers.extend(env_headers);
        }
        http_headers.retain(|name, value| !name.trim().is_empty() && !value.trim().is_empty());

        let output_mode = cli
            .output_mode
            .clone()
            .or_else(|| env.output_mode.clone())
            .or_else(|| self.output_mode.clone());
        let auth_mode = cli
            .auth_mode
            .clone()
            .or_else(|| env.auth_mode.clone())
            .or_else(|| self.auth_mode.clone());
        let log_level = cli
            .log_level
            .clone()
            .or_else(|| env.log_level.clone())
            .or_else(|| self.log_level.clone());
        let telemetry = cli.telemetry.or(env.telemetry).or(self.telemetry).unwrap_or(false);
        let approval_policy = cli
            .approval_policy
            .clone()
            .or_else(|| env.approval_policy.clone())
            .or_else(|| self.approval_policy.clone());
        let sandbox_mode = cli
            .sandbox_mode
            .clone()
            .or_else(|| env.sandbox_mode.clone())
            .or_else(|| self.sandbox_mode.clone());

        ResolvedRuntimeOptions {
            provider,
            model,
            api_key,
            api_key_source,
            base_url,
            auth_mode,
            output_mode,
            log_level,
            telemetry,
            approval_policy,
            sandbox_mode,
            http_headers,
        }
    }
}

fn parse_provider_key(key: &str) -> Option<(ProviderKind, &str)> {
    let rest = key.strip_prefix("providers.")?;
    let dot = rest.find('.')?;
    let toml_name = &rest[..dot];
    let field = &rest[dot + 1..];
    let provider = ProviderKind::from_toml_key(toml_name)?;
    Some((provider, field))
}

fn merge_provider_config(target: &mut ProviderConfigToml, source: &ProviderConfigToml) {
    if source.api_key.is_some() {
        target.api_key = source.api_key.clone();
    }
    if source.base_url.is_some() {
        target.base_url = source.base_url.clone();
    }
    if source.model.is_some() {
        target.model = source.model.clone();
    }
    if !source.http_headers.is_empty() {
        target.http_headers = source.http_headers.clone();
    }
}

/// Load a project-level config from `$WORKSPACE/.deepseek/config.toml`.
/// Returns `None` if the file doesn't exist or can't be parsed.
pub fn load_project_config(workspace: &Path) -> Option<ConfigToml> {
    let path = workspace.join(".deepseek").join(CONFIG_FILE_NAME);
    if !path.exists() {
        return None;
    }
    let raw = fs::read_to_string(&path).ok()?;
    toml::from_str(&raw).ok()
}

fn normalize_model_for_provider(provider: ProviderKind, model: &str) -> String {
    if matches!(provider, ProviderKind::Ollama) {
        return model.to_string();
    }

    let normalized = model.trim().to_ascii_lowercase();
    match (provider, normalized.as_str()) {
        (ProviderKind::NvidiaNim, "deepseek-v4-pro" | "deepseek-v4pro") => {
            DEFAULT_NVIDIA_NIM_MODEL.to_string()
        }
        (
            ProviderKind::NvidiaNim,
            "deepseek-v4-flash" | "deepseek-v4flash" | "deepseek-chat" | "deepseek-reasoner"
            | "deepseek-r1" | "deepseek-v3" | "deepseek-v3.2",
        ) => DEFAULT_NVIDIA_NIM_FLASH_MODEL.to_string(),
        (ProviderKind::Openrouter, "deepseek-v4-pro" | "deepseek-v4pro") => {
            DEFAULT_OPENROUTER_MODEL.to_string()
        }
        (
            ProviderKind::Openrouter,
            "deepseek-v4-flash" | "deepseek-v4flash" | "deepseek-chat" | "deepseek-reasoner"
            | "deepseek-r1" | "deepseek-v3" | "deepseek-v3.2",
        ) => DEFAULT_OPENROUTER_FLASH_MODEL.to_string(),
        (ProviderKind::Novita, "deepseek-v4-pro" | "deepseek-v4pro") => {
            DEFAULT_NOVITA_MODEL.to_string()
        }
        (
            ProviderKind::Novita,
            "deepseek-v4-flash" | "deepseek-v4flash" | "deepseek-chat" | "deepseek-reasoner"
            | "deepseek-r1" | "deepseek-v3" | "deepseek-v3.2",
        ) => DEFAULT_NOVITA_FLASH_MODEL.to_string(),
        (ProviderKind::Fireworks, "deepseek-v4-pro" | "deepseek-v4pro") => {
            DEFAULT_FIREWORKS_MODEL.to_string()
        }
        (ProviderKind::Sglang, "deepseek-v4-pro" | "deepseek-v4pro") => {
            DEFAULT_SGLANG_MODEL.to_string()
        }
        (
            ProviderKind::Sglang,
            "deepseek-v4-flash" | "deepseek-v4flash" | "deepseek-chat" | "deepseek-reasoner"
            | "deepseek-r1" | "deepseek-v3" | "deepseek-v3.2",
        ) => DEFAULT_SGLANG_FLASH_MODEL.to_string(),
        (ProviderKind::Vllm, "deepseek-v4-pro" | "deepseek-v4pro") => {
            DEFAULT_VLLM_MODEL.to_string()
        }
        (
            ProviderKind::Vllm,
            "deepseek-v4-flash" | "deepseek-v4flash" | "deepseek-chat" | "deepseek-reasoner"
            | "deepseek-r1" | "deepseek-v3" | "deepseek-v3.2",
        ) => DEFAULT_VLLM_FLASH_MODEL.to_string(),
        _ => model.to_string(),
    }
}

#[derive(Debug, Clone, Default)]
pub struct CliRuntimeOverrides {
    pub provider: Option<ProviderKind>,
    pub model: Option<String>,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub auth_mode: Option<String>,
    pub output_mode: Option<String>,
    pub log_level: Option<String>,
    pub telemetry: Option<bool>,
    pub approval_policy: Option<String>,
    pub sandbox_mode: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RuntimeApiKeySource {
    Cli,
    ConfigFile,
    Keyring,
    Env,
}

impl RuntimeApiKeySource {
    #[must_use]
    pub fn as_env_value(self) -> &'static str {
        match self {
            Self::Cli => "cli",
            Self::ConfigFile => "config",
            Self::Keyring => "keyring",
            Self::Env => "env",
        }
    }
}

#[derive(Debug, Clone)]
pub struct ResolvedRuntimeOptions {
    pub provider: ProviderKind,
    pub model: String,
    pub api_key: Option<String>,
    pub api_key_source: Option<RuntimeApiKeySource>,
    pub base_url: String,
    pub auth_mode: Option<String>,
    pub output_mode: Option<String>,
    pub log_level: Option<String>,
    pub telemetry: bool,
    pub approval_policy: Option<String>,
    pub sandbox_mode: Option<String>,
    pub http_headers: BTreeMap<String, String>,
}

#[derive(Debug, Clone)]
pub struct ConfigStore {
    path: PathBuf,
    pub config: ConfigToml,
}

impl ConfigStore {
    pub fn load(path: Option<PathBuf>) -> Result<Self> {
        let path = resolve_config_path(path)?;
        if !path.exists() {
            return Ok(Self {
                path,
                config: ConfigToml::default(),
            });
        }

        let raw = fs::read_to_string(&path)
            .with_context(|| format!("failed to read config at {}", path.display()))?;
        let parsed: ConfigToml = toml::from_str(&raw)
            .with_context(|| format!("failed to parse config at {}", path.display()))?;

        Ok(Self { path, config: parsed })
    }

    pub fn save(&self) -> Result<()> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent).with_context(|| {
                format!("failed to create config directory {}", parent.display())
            })?;
        }
        let body = toml::to_string_pretty(&self.config).context("failed to serialize config")?;
        #[cfg(unix)]
        {
            let mut file = fs::OpenOptions::new()
                .write(true)
                .create(true)
                .truncate(true)
                .mode(0o600)
                .open(&self.path)
                .with_context(|| format!("failed to write config at {}", self.path.display()))?;
            file.write_all(body.as_bytes())
                .with_context(|| format!("failed to write config at {}", self.path.display()))?;
            file.set_permissions(fs::Permissions::from_mode(0o600)).with_context(|| {
                format!(
                    "failed to set config permissions at {}",
                    self.path.display()
                )
            })?;
        }
        #[cfg(not(unix))]
        {
            fs::write(&self.path, body)
                .with_context(|| format!("failed to write config at {}", self.path.display()))?;
        }
        Ok(())
    }

    #[must_use]
    pub fn path(&self) -> &Path {
        &self.path
    }
}

/// Process-wide default [`Secrets`] façade. The first caller wins; the
/// lock is exposed so test or CLI code can install an explicit
/// backend (e.g. an [`yunpat_secrets::InMemoryKeyringStore`]) before
/// any resolver runs.
pub fn default_secrets() -> &'static Secrets {
    static SECRETS: OnceLock<Secrets> = OnceLock::new();
    SECRETS.get_or_init(|| {
        // Tests should never poke real platform credential stores. Cargo sets the
        // `RUST_TEST_*` family of env vars (and `CARGO_PKG_NAME` is
        // always populated), but the `cfg(test)` flag is the canonical
        // signal here. See `install_test_secrets` for explicit installs.
        #[cfg(test)]
        {
            Secrets::new(std::sync::Arc::new(
                yunpat_secrets::InMemoryKeyringStore::new(),
            ))
        }
        #[cfg(not(test))]
        {
            Secrets::auto_detect()
        }
    })
}

pub fn resolve_config_path(explicit: Option<PathBuf>) -> Result<PathBuf> {
    if let Some(path) = explicit {
        return Ok(path);
    }
    if let Ok(path) = std::env::var("DEEPSEEK_CONFIG_PATH") {
        let trimmed = path.trim();
        if !trimmed.is_empty() {
            return Ok(PathBuf::from(trimmed));
        }
    }
    default_config_path()
}

pub fn default_config_path() -> Result<PathBuf> {
    let home = dirs::home_dir().context("failed to resolve home directory for config path")?;
    // Prefer ~/.yunpat/; fall back to ~/.deepseek/ for backward compatibility.
    let yunpat = home.join(".yunpat").join(CONFIG_FILE_NAME);
    if yunpat.exists() {
        return Ok(yunpat);
    }
    let legacy = home.join(".deepseek").join(CONFIG_FILE_NAME);
    if legacy.exists() {
        return Ok(legacy);
    }
    // Neither exists — default to ~/.yunpat/ for new installs.
    Ok(yunpat)
}

fn parse_bool(raw: &str) -> Result<bool> {
    match raw.trim().to_ascii_lowercase().as_str() {
        "1" | "true" | "yes" | "on" | "enabled" => Ok(true),
        "0" | "false" | "no" | "off" | "disabled" => Ok(false),
        _ => bail!("invalid boolean '{raw}'"),
    }
}

fn parse_http_headers(raw: &str) -> Result<BTreeMap<String, String>> {
    let mut headers = BTreeMap::new();
    for pair in raw.trim().split(',') {
        let pair = pair.trim();
        if pair.is_empty() {
            continue;
        }
        let Some((name, value)) = pair.split_once('=') else {
            bail!("invalid header pair '{pair}', expected name=value");
        };
        let name = name.trim();
        let value = value.trim();
        if name.is_empty() {
            bail!("header name cannot be empty");
        }
        if value.is_empty() {
            continue;
        }
        headers.insert(name.to_string(), value.to_string());
    }
    Ok(headers)
}

fn serialize_http_headers(headers: &BTreeMap<String, String>) -> Option<String> {
    if headers.is_empty() {
        return None;
    }
    Some(
        headers
            .iter()
            .map(|(name, value)| format!("{name}={value}"))
            .collect::<Vec<_>>()
            .join(","),
    )
}

fn redact_secret(secret: &str) -> String {
    if secret.len() <= 16 {
        return "********".to_string();
    }
    format!("{}***{}", &secret[..4], &secret[secret.len() - 4..])
}

#[derive(Debug, Clone, Default)]
struct EnvRuntimeOverrides {
    provider: Option<ProviderKind>,
    model: Option<String>,
    output_mode: Option<String>,
    auth_mode: Option<String>,
    log_level: Option<String>,
    telemetry: Option<bool>,
    approval_policy: Option<String>,
    sandbox_mode: Option<String>,
    http_headers: Option<BTreeMap<String, String>>,
    yunpat_base_url: Option<String>,
    nvidia_base_url: Option<String>,
    openai_base_url: Option<String>,
    openrouter_base_url: Option<String>,
    novita_base_url: Option<String>,
    fireworks_base_url: Option<String>,
    sglang_base_url: Option<String>,
    vllm_base_url: Option<String>,
    ollama_base_url: Option<String>,
    zhipu_base_url: Option<String>,
    moonshot_base_url: Option<String>,
    doubao_base_url: Option<String>,
}

impl EnvRuntimeOverrides {
    fn load() -> Self {
        Self {
            provider: std::env::var("DEEPSEEK_PROVIDER").ok().and_then(|v| ProviderKind::parse(&v)),
            model: std::env::var("DEEPSEEK_MODEL").ok(),
            output_mode: std::env::var("DEEPSEEK_OUTPUT_MODE").ok(),
            auth_mode: std::env::var("DEEPSEEK_AUTH_MODE").ok(),
            log_level: std::env::var("DEEPSEEK_LOG_LEVEL").ok(),
            telemetry: std::env::var("DEEPSEEK_TELEMETRY").ok().and_then(|v| parse_bool(&v).ok()),
            approval_policy: std::env::var("DEEPSEEK_APPROVAL_POLICY").ok(),
            sandbox_mode: std::env::var("DEEPSEEK_SANDBOX_MODE").ok(),
            http_headers: std::env::var("DEEPSEEK_HTTP_HEADERS")
                .ok()
                .and_then(|value| parse_http_headers(&value).ok())
                .filter(|headers| !headers.is_empty()),
            yunpat_base_url: std::env::var("DEEPSEEK_BASE_URL")
                .ok()
                .filter(|v| !v.trim().is_empty()),
            nvidia_base_url: std::env::var("NVIDIA_NIM_BASE_URL")
                .or_else(|_| std::env::var("NIM_BASE_URL"))
                .or_else(|_| std::env::var("NVIDIA_BASE_URL"))
                .ok()
                .filter(|v| !v.trim().is_empty()),
            openai_base_url: std::env::var("OPENAI_BASE_URL").ok().filter(|v| !v.trim().is_empty()),
            openrouter_base_url: std::env::var("OPENROUTER_BASE_URL")
                .ok()
                .filter(|v| !v.trim().is_empty()),
            novita_base_url: std::env::var("NOVITA_BASE_URL").ok().filter(|v| !v.trim().is_empty()),
            fireworks_base_url: std::env::var("FIREWORKS_BASE_URL")
                .ok()
                .filter(|v| !v.trim().is_empty()),
            sglang_base_url: std::env::var("SGLANG_BASE_URL").ok().filter(|v| !v.trim().is_empty()),
            vllm_base_url: std::env::var("VLLM_BASE_URL").ok().filter(|v| !v.trim().is_empty()),
            ollama_base_url: std::env::var("OLLAMA_BASE_URL").ok().filter(|v| !v.trim().is_empty()),
            zhipu_base_url: std::env::var("ZHIPU_BASE_URL").ok().filter(|v| !v.trim().is_empty()),
            moonshot_base_url: std::env::var("MOONSHOT_BASE_URL")
                .ok()
                .filter(|v| !v.trim().is_empty()),
            doubao_base_url: std::env::var("DOUBAO_BASE_URL").ok().filter(|v| !v.trim().is_empty()),
        }
    }

    fn base_url_for(&self, provider: ProviderKind) -> Option<String> {
        // Defaults belong in the resolver's final fallback so config-file
        // values (`providers.<name>.base_url`) still win when env is unset.
        match provider {
            ProviderKind::Deepseek => self.yunpat_base_url.clone(),
            ProviderKind::NvidiaNim => self.nvidia_base_url.clone(),
            ProviderKind::Openai => self.openai_base_url.clone(),
            ProviderKind::Openrouter => self.openrouter_base_url.clone(),
            ProviderKind::Novita => self.novita_base_url.clone(),
            ProviderKind::Fireworks => self.fireworks_base_url.clone(),
            ProviderKind::Sglang => self.sglang_base_url.clone(),
            ProviderKind::Vllm => self.vllm_base_url.clone(),
            ProviderKind::Ollama => self.ollama_base_url.clone(),
            ProviderKind::Zhipu => self.zhipu_base_url.clone(),
            ProviderKind::Moonshot => self.moonshot_base_url.clone(),
            ProviderKind::Doubao => self.doubao_base_url.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::ffi::OsString;
    use std::sync::{Mutex, OnceLock};

    fn env_lock() -> std::sync::MutexGuard<'static, ()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(())).lock().unwrap()
    }

    struct EnvGuard {
        yunpat_api_key: Option<OsString>,
        yunpat_base_url: Option<OsString>,
        yunpat_http_headers: Option<OsString>,
        yunpat_model: Option<OsString>,
        yunpat_provider: Option<OsString>,
        nvidia_api_key: Option<OsString>,
        nvidia_nim_api_key: Option<OsString>,
        nim_base_url: Option<OsString>,
        nvidia_base_url: Option<OsString>,
        nvidia_nim_base_url: Option<OsString>,
        openrouter_api_key: Option<OsString>,
        openrouter_base_url: Option<OsString>,
        novita_api_key: Option<OsString>,
        novita_base_url: Option<OsString>,
        fireworks_api_key: Option<OsString>,
        fireworks_base_url: Option<OsString>,
        sglang_api_key: Option<OsString>,
        sglang_base_url: Option<OsString>,
        vllm_api_key: Option<OsString>,
        vllm_base_url: Option<OsString>,
        ollama_api_key: Option<OsString>,
        ollama_base_url: Option<OsString>,
    }

    impl EnvGuard {
        fn without_yunpat_runtime_overrides() -> Self {
            let guard = Self {
                yunpat_api_key: env::var_os("DEEPSEEK_API_KEY"),
                yunpat_base_url: env::var_os("DEEPSEEK_BASE_URL"),
                yunpat_http_headers: env::var_os("DEEPSEEK_HTTP_HEADERS"),
                yunpat_model: env::var_os("DEEPSEEK_MODEL"),
                yunpat_provider: env::var_os("DEEPSEEK_PROVIDER"),
                nvidia_api_key: env::var_os("NVIDIA_API_KEY"),
                nvidia_nim_api_key: env::var_os("NVIDIA_NIM_API_KEY"),
                nim_base_url: env::var_os("NIM_BASE_URL"),
                nvidia_base_url: env::var_os("NVIDIA_BASE_URL"),
                nvidia_nim_base_url: env::var_os("NVIDIA_NIM_BASE_URL"),
                openrouter_api_key: env::var_os("OPENROUTER_API_KEY"),
                openrouter_base_url: env::var_os("OPENROUTER_BASE_URL"),
                novita_api_key: env::var_os("NOVITA_API_KEY"),
                novita_base_url: env::var_os("NOVITA_BASE_URL"),
                fireworks_api_key: env::var_os("FIREWORKS_API_KEY"),
                fireworks_base_url: env::var_os("FIREWORKS_BASE_URL"),
                sglang_api_key: env::var_os("SGLANG_API_KEY"),
                sglang_base_url: env::var_os("SGLANG_BASE_URL"),
                vllm_api_key: env::var_os("VLLM_API_KEY"),
                vllm_base_url: env::var_os("VLLM_BASE_URL"),
                ollama_api_key: env::var_os("OLLAMA_API_KEY"),
                ollama_base_url: env::var_os("OLLAMA_BASE_URL"),
            };
            // Safety: test-only environment mutation guarded by a module mutex.
            unsafe {
                env::remove_var("DEEPSEEK_API_KEY");
                env::remove_var("DEEPSEEK_BASE_URL");
                env::remove_var("DEEPSEEK_HTTP_HEADERS");
                env::remove_var("DEEPSEEK_MODEL");
                env::remove_var("DEEPSEEK_PROVIDER");
                env::remove_var("NVIDIA_API_KEY");
                env::remove_var("NVIDIA_NIM_API_KEY");
                env::remove_var("NIM_BASE_URL");
                env::remove_var("NVIDIA_BASE_URL");
                env::remove_var("NVIDIA_NIM_BASE_URL");
                env::remove_var("OPENROUTER_API_KEY");
                env::remove_var("OPENROUTER_BASE_URL");
                env::remove_var("NOVITA_API_KEY");
                env::remove_var("NOVITA_BASE_URL");
                env::remove_var("FIREWORKS_API_KEY");
                env::remove_var("FIREWORKS_BASE_URL");
                env::remove_var("SGLANG_API_KEY");
                env::remove_var("SGLANG_BASE_URL");
                env::remove_var("VLLM_API_KEY");
                env::remove_var("VLLM_BASE_URL");
                env::remove_var("OLLAMA_API_KEY");
                env::remove_var("OLLAMA_BASE_URL");
            }
            guard
        }

        unsafe fn restore_var(key: &str, value: Option<OsString>) {
            if let Some(value) = value {
                unsafe { env::set_var(key, value) };
            } else {
                unsafe { env::remove_var(key) };
            }
        }
    }

    impl Drop for EnvGuard {
        fn drop(&mut self) {
            // Safety: test-only environment mutation guarded by a module mutex.
            unsafe {
                Self::restore_var("DEEPSEEK_API_KEY", self.yunpat_api_key.take());
                Self::restore_var("DEEPSEEK_BASE_URL", self.yunpat_base_url.take());
                Self::restore_var("DEEPSEEK_HTTP_HEADERS", self.yunpat_http_headers.take());
                Self::restore_var("DEEPSEEK_MODEL", self.yunpat_model.take());
                Self::restore_var("DEEPSEEK_PROVIDER", self.yunpat_provider.take());
                Self::restore_var("NVIDIA_API_KEY", self.nvidia_api_key.take());
                Self::restore_var("NVIDIA_NIM_API_KEY", self.nvidia_nim_api_key.take());
                Self::restore_var("NIM_BASE_URL", self.nim_base_url.take());
                Self::restore_var("NVIDIA_BASE_URL", self.nvidia_base_url.take());
                Self::restore_var("NVIDIA_NIM_BASE_URL", self.nvidia_nim_base_url.take());
                Self::restore_var("OPENROUTER_API_KEY", self.openrouter_api_key.take());
                Self::restore_var("OPENROUTER_BASE_URL", self.openrouter_base_url.take());
                Self::restore_var("NOVITA_API_KEY", self.novita_api_key.take());
                Self::restore_var("NOVITA_BASE_URL", self.novita_base_url.take());
                Self::restore_var("FIREWORKS_API_KEY", self.fireworks_api_key.take());
                Self::restore_var("FIREWORKS_BASE_URL", self.fireworks_base_url.take());
                Self::restore_var("SGLANG_API_KEY", self.sglang_api_key.take());
                Self::restore_var("SGLANG_BASE_URL", self.sglang_base_url.take());
                Self::restore_var("VLLM_API_KEY", self.vllm_api_key.take());
                Self::restore_var("VLLM_BASE_URL", self.vllm_base_url.take());
                Self::restore_var("OLLAMA_API_KEY", self.ollama_api_key.take());
                Self::restore_var("OLLAMA_BASE_URL", self.ollama_base_url.take());
            }
        }
    }

    #[test]
    fn root_yunpat_fields_are_runtime_fallbacks() {
        let _lock = env_lock();
        let _env = EnvGuard::without_yunpat_runtime_overrides();
        let config = ConfigToml {
            api_key: Some("root-key".to_string()),
            base_url: Some("https://api.deepseek.com".to_string()),
            default_text_model: Some("deepseek-v4-pro".to_string()),
            ..ConfigToml::default()
        };

        let resolved = config.resolve_runtime_options(&CliRuntimeOverrides::default());

        assert_eq!(resolved.provider, ProviderKind::Deepseek);
        assert_eq!(resolved.api_key.as_deref(), Some("root-key"));
        assert_eq!(resolved.base_url, "https://api.deepseek.com");
        assert_eq!(resolved.model, "deepseek-v4-pro");
    }

    #[test]
    fn yunpat_runtime_defaults_to_beta_endpoint() {
        let _lock = env_lock();
        let _env = EnvGuard::without_yunpat_runtime_overrides();
        let config = ConfigToml::default();

        let resolved = config.resolve_runtime_options(&CliRuntimeOverrides::default());

        assert_eq!(resolved.provider, ProviderKind::Deepseek);
        assert_eq!(resolved.base_url, DEFAULT_DEEPSEEK_BASE_URL);
        assert_eq!(resolved.model, DEFAULT_DEEPSEEK_MODEL);
    }

    #[test]
    fn provider_specific_yunpat_fields_override_tui_compat_fields() {
        let _lock = env_lock();
        let _env = EnvGuard::without_yunpat_runtime_overrides();
        let mut config = ConfigToml {
            api_key: Some("root-key".to_string()),
            base_url: Some("https://api.deepseek.com".to_string()),
            default_text_model: Some("deepseek-v4-pro".to_string()),
            ..ConfigToml::default()
        };
        config.providers.deepseek.api_key = Some("provider-key".to_string());
        config.providers.deepseek.base_url = Some("https://api.deepseeki.com".to_string());
        config.providers.deepseek.model = Some("deepseek-v4-flash".to_string());

        let resolved = config.resolve_runtime_options(&CliRuntimeOverrides::default());

        assert_eq!(resolved.api_key.as_deref(), Some("provider-key"));
        assert_eq!(resolved.base_url, "https://api.deepseeki.com");
        assert_eq!(resolved.model, "deepseek-v4-flash");
    }

    #[test]
    fn provider_http_headers_override_root_headers() {
        let _lock = env_lock();
        let _env = EnvGuard::without_yunpat_runtime_overrides();
        let mut config = ConfigToml {
            api_key: Some("root-key".to_string()),
            base_url: Some("https://api.deepseek.com".to_string()),
            default_text_model: Some("deepseek-v4-pro".to_string()),
            ..ConfigToml::default()
        };
        config.providers.deepseek.api_key = Some("provider-key".to_string());
        config.providers.deepseek.base_url = Some("https://api.deepseeki.com".to_string());
        config.providers.deepseek.model = Some("deepseek-v4-flash".to_string());
        config.http_headers.insert("X-Shared".to_string(), "root".to_string());
        config
            .providers
            .deepseek
            .http_headers
            .insert("X-Model-Provider-Id".to_string(), "tongyi".to_string());
        config
            .providers
            .deepseek
            .http_headers
            .insert("X-Shared".to_string(), "provider".to_string());

        let resolved = config.resolve_runtime_options(&CliRuntimeOverrides::default());

        assert_eq!(resolved.api_key.as_deref(), Some("provider-key"));
        assert_eq!(resolved.base_url, "https://api.deepseeki.com");
        assert_eq!(resolved.model, "deepseek-v4-flash");
        assert_eq!(
            resolved.http_headers.get("X-Model-Provider-Id").map(String::as_str),
            Some("tongyi")
        );
        assert_eq!(
            resolved.http_headers.get("X-Shared").map(String::as_str),
            Some("provider")
        );
    }

    #[test]
    fn http_headers_env_overrides_config() {
        let _lock = env_lock();
        let _env = EnvGuard::without_yunpat_runtime_overrides();
        let mut config = ConfigToml::default();
        config
            .http_headers
            .insert("X-Model-Provider-Id".to_string(), "from-file".to_string());
        // Safety: test-only environment mutation guarded by a module mutex.
        unsafe {
            env::set_var("DEEPSEEK_HTTP_HEADERS", "X-Model-Provider-Id=from-env");
        }

        let resolved = config.resolve_runtime_options(&CliRuntimeOverrides::default());

        assert_eq!(
            resolved.http_headers.get("X-Model-Provider-Id").map(String::as_str),
            Some("from-env")
        );
    }

    #[test]
    fn nvidia_nim_provider_defaults_to_catalog_endpoint_and_model() {
        let _lock = env_lock();
        let _env = EnvGuard::without_yunpat_runtime_overrides();
        let config = ConfigToml {
            provider: ProviderKind::NvidiaNim,
            ..ConfigToml::default()
        };

        let resolved = config.resolve_runtime_options(&CliRuntimeOverrides::default());

        assert_eq!(resolved.provider, ProviderKind::NvidiaNim);
        assert_eq!(resolved.base_url, DEFAULT_NVIDIA_NIM_BASE_URL);
        assert_eq!(resolved.model, DEFAULT_NVIDIA_NIM_MODEL);
    }

    #[test]
    fn nvidia_nim_provider_uses_provider_specific_credentials() {
        let _lock = env_lock();
        let _env = EnvGuard::without_yunpat_runtime_overrides();
        let mut config = ConfigToml {
            provider: ProviderKind::NvidiaNim,
            ..ConfigToml::default()
        };
        config.providers.nvidia_nim.api_key = Some("nim-key".to_string());
        config.providers.nvidia_nim.base_url = Some("https://nim.example/v1".to_string());
        config.providers.nvidia_nim.model = Some("deepseek-ai/deepseek-v4-pro".to_string());

        let resolved = config.resolve_runtime_options(&CliRuntimeOverrides::default());

        assert_eq!(resolved.provider, ProviderKind::NvidiaNim);
        assert_eq!(resolved.api_key.as_deref(), Some("nim-key"));
        assert_eq!(resolved.base_url, "https://nim.example/v1");
        assert_eq!(resolved.model, "deepseek-ai/deepseek-v4-pro");
    }

    #[test]
    fn nvidia_nim_provider_normalizes_flash_aliases() {
        let _lock = env_lock();
        let _env = EnvGuard::without_yunpat_runtime_overrides();
        let cli = CliRuntimeOverrides {
            provider: Some(ProviderKind::NvidiaNim),
            model: Some("deepseek-v4-flash".to_string()),
            ..CliRuntimeOverrides::default()
        };

        let resolved = ConfigToml::default().resolve_runtime_options(&cli);

        assert_eq!(resolved.provider, ProviderKind::NvidiaNim);
        assert_eq!(resolved.model, DEFAULT_NVIDIA_NIM_FLASH_MODEL);
    }

    #[test]
    fn nvidia_nim_provider_uses_nvidia_env_credentials() {
        let _lock = env_lock();
        let _env = EnvGuard::without_yunpat_runtime_overrides();
        // Safety: test-only environment mutation guarded by a module mutex.
        unsafe {
            env::set_var("DEEPSEEK_PROVIDER", "nvidia-nim");
            env::set_var("NVIDIA_API_KEY", "nim-env-key");
            env::set_var("NVIDIA_NIM_BASE_URL", "https://nim-env.example/v1");
        }

        let config = ConfigToml::default();
        let resolved = config.resolve_runtime_options(&CliRuntimeOverrides::default());

        assert_eq!(resolved.provider, ProviderKind::NvidiaNim);
        assert_eq!(resolved.api_key.as_deref(), Some("nim-env-key"));
        assert_eq!(resolved.base_url, "https://nim-env.example/v1");
        assert_eq!(resolved.model, DEFAULT_NVIDIA_NIM_MODEL);
    }

    #[test]
    fn nvidia_nim_provider_accepts_short_nim_base_url_alias() {
        let _lock = env_lock();
        let _env = EnvGuard::without_yunpat_runtime_overrides();
        // Safety: test-only environment mutation guarded by a module mutex.
        unsafe {
            env::set_var("DEEPSEEK_PROVIDER", "nvidia-nim");
            env::set_var("NVIDIA_API_KEY", "nim-env-key");
            env::set_var("NIM_BASE_URL", "https://short-nim.example/v1");
        }

        let config = ConfigToml::default();
        let resolved = config.resolve_runtime_options(&CliRuntimeOverrides::default());

        assert_eq!(resolved.provider, ProviderKind::NvidiaNim);
        assert_eq!(resolved.base_url, "https://short-nim.example/v1");
    }

    #[test]
    fn nvidia_nim_provider_can_fallback_to_yunpat_api_key_env() {
        let _lock = env_lock();
        let _env = EnvGuard::without_yunpat_runtime_overrides();
        // Safety: test-only environment mutation guarded by a module mutex.
        unsafe {
            env::set_var("DEEPSEEK_PROVIDER", "nvidia-nim");
            env::set_var("DEEPSEEK_API_KEY", "deepseek-compat-key");
        }

        let config = ConfigToml::default();
        let resolved = config.resolve_runtime_options(&CliRuntimeOverrides::default());

        assert_eq!(resolved.provider, ProviderKind::NvidiaNim);
        assert_eq!(resolved.api_key.as_deref(), Some("deepseek-compat-key"));
    }

    #[test]
    fn list_values_redacts_root_api_key() {
        let config = ConfigToml {
            api_key: Some("sk-deepseek-secret".to_string()),
            ..ConfigToml::default()
        };

        let values = config.list_values();

        assert_eq!(
            values.get("api_key").map(String::as_str),
            Some("sk-d***cret")
        );
    }

    #[test]
    fn list_values_fully_redacts_short_api_key() {
        let config = ConfigToml {
            api_key: Some("short-key".to_string()),
            ..ConfigToml::default()
        };

        let values = config.list_values();

        assert_eq!(values.get("api_key").map(String::as_str), Some("********"));
    }

    #[cfg(unix)]
    #[test]
    fn save_clamps_existing_config_permissions() {
        use std::time::{SystemTime, UNIX_EPOCH};

        let unique = SystemTime::now().duration_since(UNIX_EPOCH).expect("clock").as_nanos();
        let dir = std::env::temp_dir().join(format!(
            "deepseek-config-perms-{}-{unique}",
            std::process::id()
        ));
        fs::create_dir_all(&dir).expect("mkdir");
        let path = dir.join(CONFIG_FILE_NAME);
        fs::write(&path, "api_key = \"old\"\n").expect("seed config");
        fs::set_permissions(&path, fs::Permissions::from_mode(0o644)).expect("chmod seed");

        let store = ConfigStore {
            path: path.clone(),
            config: ConfigToml {
                api_key: Some("new-secret".to_string()),
                ..ConfigToml::default()
            },
        };
        store.save().expect("save");

        let mode = fs::metadata(&path).expect("metadata").permissions().mode() & 0o777;
        assert_eq!(mode, 0o600);

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn provider_kind_parses_openrouter_and_novita_aliases() {
        assert_eq!(
            ProviderKind::parse("openrouter"),
            Some(ProviderKind::Openrouter)
        );
        assert_eq!(
            ProviderKind::parse("OPEN_ROUTER"),
            Some(ProviderKind::Openrouter)
        );
        assert_eq!(ProviderKind::parse("novita"), Some(ProviderKind::Novita));
        assert_eq!(ProviderKind::parse("Novita"), Some(ProviderKind::Novita));
        assert_eq!(
            ProviderKind::parse("fireworks-ai"),
            Some(ProviderKind::Fireworks)
        );
        assert_eq!(ProviderKind::parse("sg-lang"), Some(ProviderKind::Sglang));
        assert_eq!(ProviderKind::parse("v-llm"), Some(ProviderKind::Vllm));
        assert_eq!(ProviderKind::parse("vllm"), Some(ProviderKind::Vllm));
        assert_eq!(ProviderKind::parse("ollama"), Some(ProviderKind::Ollama));
        assert_eq!(
            ProviderKind::parse("ollama-local"),
            Some(ProviderKind::Ollama)
        );
    }

    #[test]
    fn openrouter_provider_defaults_to_canonical_endpoint_and_model() {
        let _lock = env_lock();
        let _env = EnvGuard::without_yunpat_runtime_overrides();
        let config = ConfigToml {
            provider: ProviderKind::Openrouter,
            ..ConfigToml::default()
        };

        let resolved = config.resolve_runtime_options(&CliRuntimeOverrides::default());

        assert_eq!(resolved.provider, ProviderKind::Openrouter);
        assert_eq!(resolved.base_url, DEFAULT_OPENROUTER_BASE_URL);
        assert_eq!(resolved.model, DEFAULT_OPENROUTER_MODEL);
    }

    #[test]
    fn novita_provider_defaults_to_canonical_endpoint_and_model() {
        let _lock = env_lock();
        let _env = EnvGuard::without_yunpat_runtime_overrides();
        let config = ConfigToml {
            provider: ProviderKind::Novita,
            ..ConfigToml::default()
        };

        let resolved = config.resolve_runtime_options(&CliRuntimeOverrides::default());

        assert_eq!(resolved.provider, ProviderKind::Novita);
        assert_eq!(resolved.base_url, DEFAULT_NOVITA_BASE_URL);
        assert_eq!(resolved.model, DEFAULT_NOVITA_MODEL);
    }

    #[test]
    fn fireworks_provider_defaults_to_canonical_endpoint_and_model() {
        let _lock = env_lock();
        let _env = EnvGuard::without_yunpat_runtime_overrides();
        let config = ConfigToml {
            provider: ProviderKind::Fireworks,
            ..ConfigToml::default()
        };

        let resolved = config.resolve_runtime_options(&CliRuntimeOverrides::default());

        assert_eq!(resolved.provider, ProviderKind::Fireworks);
        assert_eq!(resolved.base_url, DEFAULT_FIREWORKS_BASE_URL);
        assert_eq!(resolved.model, DEFAULT_FIREWORKS_MODEL);
    }

    #[test]
    fn sglang_provider_defaults_to_local_endpoint_and_model() {
        let _lock = env_lock();
        let _env = EnvGuard::without_yunpat_runtime_overrides();
        let config = ConfigToml {
            provider: ProviderKind::Sglang,
            ..ConfigToml::default()
        };

        let resolved = config.resolve_runtime_options(&CliRuntimeOverrides::default());

        assert_eq!(resolved.provider, ProviderKind::Sglang);
        assert_eq!(resolved.base_url, DEFAULT_SGLANG_BASE_URL);
        assert_eq!(resolved.model, DEFAULT_SGLANG_MODEL);
    }

    #[test]
    fn vllm_provider_defaults_to_local_endpoint_and_model() {
        let _lock = env_lock();
        let _env = EnvGuard::without_yunpat_runtime_overrides();
        let config = ConfigToml {
            provider: ProviderKind::Vllm,
            ..ConfigToml::default()
        };

        let resolved = config.resolve_runtime_options(&CliRuntimeOverrides::default());

        assert_eq!(resolved.provider, ProviderKind::Vllm);
        assert_eq!(resolved.base_url, DEFAULT_VLLM_BASE_URL);
        assert_eq!(resolved.model, DEFAULT_VLLM_MODEL);
    }

    #[test]
    fn ollama_provider_defaults_to_local_endpoint_and_small_model() {
        let _lock = env_lock();
        let _env = EnvGuard::without_yunpat_runtime_overrides();
        let config = ConfigToml {
            provider: ProviderKind::Ollama,
            ..ConfigToml::default()
        };

        let resolved = config.resolve_runtime_options(&CliRuntimeOverrides::default());

        assert_eq!(resolved.provider, ProviderKind::Ollama);
        assert_eq!(resolved.base_url, DEFAULT_OLLAMA_BASE_URL);
        assert_eq!(resolved.model, DEFAULT_OLLAMA_MODEL);
        assert_eq!(resolved.api_key, None);
    }

    #[test]
    fn ollama_provider_preserves_model_tags() {
        let _lock = env_lock();
        let _env = EnvGuard::without_yunpat_runtime_overrides();
        let cli = CliRuntimeOverrides {
            provider: Some(ProviderKind::Ollama),
            model: Some("deepseek-coder-v2:16b".to_string()),
            ..CliRuntimeOverrides::default()
        };

        let resolved = ConfigToml::default().resolve_runtime_options(&cli);

        assert_eq!(resolved.provider, ProviderKind::Ollama);
        assert_eq!(resolved.model, "deepseek-coder-v2:16b");
    }

    #[test]
    fn ollama_env_overrides_provider_base_url_and_optional_key() {
        let _lock = env_lock();
        let _env = EnvGuard::without_yunpat_runtime_overrides();
        // Safety: test-only environment mutation guarded by a module mutex.
        unsafe {
            env::set_var("DEEPSEEK_PROVIDER", "ollama-local");
            env::set_var("OLLAMA_BASE_URL", "http://ollama.example/v1");
            env::set_var("OLLAMA_API_KEY", "ollama-env-key");
        }

        let resolved =
            ConfigToml::default().resolve_runtime_options(&CliRuntimeOverrides::default());

        assert_eq!(resolved.provider, ProviderKind::Ollama);
        assert_eq!(resolved.base_url, "http://ollama.example/v1");
        assert_eq!(resolved.api_key.as_deref(), Some("ollama-env-key"));
    }

    #[test]
    fn openrouter_env_api_key_falls_back_when_config_missing() {
        let _lock = env_lock();
        let _env = EnvGuard::without_yunpat_runtime_overrides();
        // Safety: test-only environment mutation guarded by a module mutex.
        unsafe {
            env::set_var("DEEPSEEK_PROVIDER", "openrouter");
            env::set_var("OPENROUTER_API_KEY", "or-env-key");
        }

        let resolved =
            ConfigToml::default().resolve_runtime_options(&CliRuntimeOverrides::default());

        assert_eq!(resolved.provider, ProviderKind::Openrouter);
        assert_eq!(resolved.api_key.as_deref(), Some("or-env-key"));
        assert_eq!(resolved.base_url, DEFAULT_OPENROUTER_BASE_URL);
    }

    #[test]
    fn novita_env_api_key_falls_back_when_config_missing() {
        let _lock = env_lock();
        let _env = EnvGuard::without_yunpat_runtime_overrides();
        // Safety: test-only environment mutation guarded by a module mutex.
        unsafe {
            env::set_var("DEEPSEEK_PROVIDER", "novita");
            env::set_var("NOVITA_API_KEY", "novita-env-key");
        }

        let resolved =
            ConfigToml::default().resolve_runtime_options(&CliRuntimeOverrides::default());

        assert_eq!(resolved.provider, ProviderKind::Novita);
        assert_eq!(resolved.api_key.as_deref(), Some("novita-env-key"));
        assert_eq!(resolved.base_url, DEFAULT_NOVITA_BASE_URL);
    }

    #[test]
    fn fireworks_env_api_key_falls_back_when_config_missing() {
        let _lock = env_lock();
        let _env = EnvGuard::without_yunpat_runtime_overrides();
        // Safety: test-only environment mutation guarded by a module mutex.
        unsafe {
            env::set_var("DEEPSEEK_PROVIDER", "fireworks");
            env::set_var("FIREWORKS_API_KEY", "fw-env-key");
        }

        let resolved =
            ConfigToml::default().resolve_runtime_options(&CliRuntimeOverrides::default());

        assert_eq!(resolved.provider, ProviderKind::Fireworks);
        assert_eq!(resolved.api_key.as_deref(), Some("fw-env-key"));
        assert_eq!(resolved.base_url, DEFAULT_FIREWORKS_BASE_URL);
    }

    #[test]
    fn openrouter_provider_normalizes_flash_aliases() {
        let _lock = env_lock();
        let _env = EnvGuard::without_yunpat_runtime_overrides();
        let cli = CliRuntimeOverrides {
            provider: Some(ProviderKind::Openrouter),
            model: Some("deepseek-v4-flash".to_string()),
            ..CliRuntimeOverrides::default()
        };

        let resolved = ConfigToml::default().resolve_runtime_options(&cli);

        assert_eq!(resolved.provider, ProviderKind::Openrouter);
        assert_eq!(resolved.model, DEFAULT_OPENROUTER_FLASH_MODEL);
    }

    #[test]
    fn novita_provider_normalizes_flash_aliases() {
        let _lock = env_lock();
        let _env = EnvGuard::without_yunpat_runtime_overrides();
        let cli = CliRuntimeOverrides {
            provider: Some(ProviderKind::Novita),
            model: Some("deepseek-v4-flash".to_string()),
            ..CliRuntimeOverrides::default()
        };

        let resolved = ConfigToml::default().resolve_runtime_options(&cli);

        assert_eq!(resolved.provider, ProviderKind::Novita);
        assert_eq!(resolved.model, DEFAULT_NOVITA_FLASH_MODEL);
    }

    #[test]
    fn sglang_provider_normalizes_flash_aliases() {
        let _lock = env_lock();
        let _env = EnvGuard::without_yunpat_runtime_overrides();
        let cli = CliRuntimeOverrides {
            provider: Some(ProviderKind::Sglang),
            model: Some("deepseek-v4-flash".to_string()),
            ..CliRuntimeOverrides::default()
        };

        let resolved = ConfigToml::default().resolve_runtime_options(&cli);

        assert_eq!(resolved.provider, ProviderKind::Sglang);
        assert_eq!(resolved.model, DEFAULT_SGLANG_FLASH_MODEL);
    }

    #[test]
    fn vllm_provider_normalizes_flash_aliases() {
        let _lock = env_lock();
        let _env = EnvGuard::without_yunpat_runtime_overrides();
        let cli = CliRuntimeOverrides {
            provider: Some(ProviderKind::Vllm),
            model: Some("deepseek-v4-flash".to_string()),
            ..CliRuntimeOverrides::default()
        };

        let resolved = ConfigToml::default().resolve_runtime_options(&cli);

        assert_eq!(resolved.provider, ProviderKind::Vllm);
        assert_eq!(resolved.model, DEFAULT_VLLM_FLASH_MODEL);
    }

    #[test]
    fn openrouter_provider_specific_config_overrides_env() {
        let _lock = env_lock();
        let _env = EnvGuard::without_yunpat_runtime_overrides();
        let mut config = ConfigToml {
            provider: ProviderKind::Openrouter,
            ..ConfigToml::default()
        };
        config.providers.openrouter.api_key = Some("file-key".to_string());
        config.providers.openrouter.base_url = Some("https://or-mirror.example/v1".to_string());

        let resolved = config.resolve_runtime_options(&CliRuntimeOverrides::default());

        assert_eq!(resolved.api_key.as_deref(), Some("file-key"));
        assert_eq!(resolved.base_url, "https://or-mirror.example/v1");
    }

    #[test]
    fn config_file_resolves_above_env_and_keyring() {
        use yunpat_secrets::KeyringStore;
        let _lock = env_lock();
        let _env = EnvGuard::without_yunpat_runtime_overrides();
        // Safety: env mutation guarded by env_lock().
        unsafe { std::env::set_var("DEEPSEEK_API_KEY", "env-key") };

        let store = std::sync::Arc::new(yunpat_secrets::InMemoryKeyringStore::new());
        store.set("deepseek", "ring-key").unwrap();
        let secrets = Secrets::new(store);

        let mut config = ConfigToml::default();
        config.providers.deepseek.api_key = Some("file-key".to_string());

        let resolved =
            config.resolve_runtime_options_with_secrets(&CliRuntimeOverrides::default(), &secrets);
        assert_eq!(resolved.api_key.as_deref(), Some("file-key"));
        assert_eq!(
            resolved.api_key_source,
            Some(RuntimeApiKeySource::ConfigFile)
        );

        // Safety: env mutation guarded by env_lock().
        unsafe { std::env::remove_var("DEEPSEEK_API_KEY") };
    }

    #[test]
    fn env_resolves_when_config_file_and_keyring_empty() {
        let _lock = env_lock();
        let _env = EnvGuard::without_yunpat_runtime_overrides();
        // Safety: env mutation guarded by env_lock().
        unsafe { std::env::set_var("DEEPSEEK_API_KEY", "env-key") };

        let secrets = Secrets::new(std::sync::Arc::new(
            yunpat_secrets::InMemoryKeyringStore::new(),
        ));
        let config = ConfigToml::default();

        let resolved =
            config.resolve_runtime_options_with_secrets(&CliRuntimeOverrides::default(), &secrets);
        assert_eq!(resolved.api_key.as_deref(), Some("env-key"));
        assert_eq!(resolved.api_key_source, Some(RuntimeApiKeySource::Env));

        // Safety: env mutation guarded by env_lock().
        unsafe { std::env::remove_var("DEEPSEEK_API_KEY") };
    }

    #[test]
    fn config_file_resolves_when_keyring_and_env_empty() {
        let _lock = env_lock();
        let _env = EnvGuard::without_yunpat_runtime_overrides();

        let secrets = Secrets::new(std::sync::Arc::new(
            yunpat_secrets::InMemoryKeyringStore::new(),
        ));
        let mut config = ConfigToml::default();
        config.providers.deepseek.api_key = Some("file-key".to_string());

        let resolved =
            config.resolve_runtime_options_with_secrets(&CliRuntimeOverrides::default(), &secrets);
        assert_eq!(resolved.api_key.as_deref(), Some("file-key"));
        assert_eq!(
            resolved.api_key_source,
            Some(RuntimeApiKeySource::ConfigFile)
        );
    }

    #[test]
    fn keyring_resolves_when_config_file_empty_even_if_env_is_set() {
        use yunpat_secrets::KeyringStore;
        let _lock = env_lock();
        let _env = EnvGuard::without_yunpat_runtime_overrides();
        // Safety: env mutation guarded by env_lock().
        unsafe { std::env::set_var("DEEPSEEK_API_KEY", "stale-env-key") };

        let store = std::sync::Arc::new(yunpat_secrets::InMemoryKeyringStore::new());
        store.set("deepseek", "ring-key").unwrap();
        let secrets = Secrets::new(store);

        let resolved = ConfigToml::default()
            .resolve_runtime_options_with_secrets(&CliRuntimeOverrides::default(), &secrets);
        assert_eq!(resolved.api_key.as_deref(), Some("ring-key"));
        assert_eq!(resolved.api_key_source, Some(RuntimeApiKeySource::Keyring));

        // Safety: env mutation guarded by env_lock().
        unsafe { std::env::remove_var("DEEPSEEK_API_KEY") };
    }

    #[test]
    fn cli_flag_still_overrides_keyring() {
        use yunpat_secrets::KeyringStore;
        let _lock = env_lock();
        let _env = EnvGuard::without_yunpat_runtime_overrides();

        let store = std::sync::Arc::new(yunpat_secrets::InMemoryKeyringStore::new());
        store.set("deepseek", "ring-key").unwrap();
        let secrets = Secrets::new(store);

        let cli = CliRuntimeOverrides {
            api_key: Some("cli-key".to_string()),
            ..CliRuntimeOverrides::default()
        };
        let resolved = ConfigToml::default().resolve_runtime_options_with_secrets(&cli, &secrets);
        assert_eq!(resolved.api_key.as_deref(), Some("cli-key"));
        assert_eq!(resolved.api_key_source, Some(RuntimeApiKeySource::Cli));
    }

    #[test]
    fn zhipu_provider_get_set_round_trip() {
        let mut config = ConfigToml::default();
        config.set_value("providers.zhipu.api_key", "zhipu-key").unwrap();
        assert_eq!(
            config.get_value("providers.zhipu.api_key"),
            Some("zhipu-key".to_string())
        );
        config.unset_value("providers.zhipu.api_key").unwrap();
        assert_eq!(config.get_value("providers.zhipu.api_key"), None);
    }

    #[test]
    fn moonshot_provider_get_set_round_trip() {
        let mut config = ConfigToml::default();
        config.set_value("providers.moonshot.api_key", "moonshot-key").unwrap();
        assert_eq!(
            config.get_value("providers.moonshot.api_key"),
            Some("moonshot-key".to_string())
        );
        config.unset_value("providers.moonshot.api_key").unwrap();
        assert_eq!(config.get_value("providers.moonshot.api_key"), None);
    }

    #[test]
    fn doubao_provider_get_set_round_trip() {
        let mut config = ConfigToml::default();
        config.set_value("providers.doubao.api_key", "doubao-key").unwrap();
        assert_eq!(
            config.get_value("providers.doubao.api_key"),
            Some("doubao-key".to_string())
        );
        config.unset_value("providers.doubao.api_key").unwrap();
        assert_eq!(config.get_value("providers.doubao.api_key"), None);
    }

    #[test]
    fn zhipu_provider_defaults() {
        let _lock = env_lock();
        let _env = EnvGuard::without_yunpat_runtime_overrides();
        let config = ConfigToml {
            provider: ProviderKind::Zhipu,
            ..ConfigToml::default()
        };

        let resolved = config.resolve_runtime_options(&CliRuntimeOverrides::default());

        assert_eq!(resolved.provider, ProviderKind::Zhipu);
        assert_eq!(resolved.base_url, DEFAULT_ZHIPU_BASE_URL);
        assert_eq!(resolved.model, DEFAULT_ZHIPU_MODEL);
    }

    #[test]
    fn moonshot_provider_defaults() {
        let _lock = env_lock();
        let _env = EnvGuard::without_yunpat_runtime_overrides();
        let config = ConfigToml {
            provider: ProviderKind::Moonshot,
            ..ConfigToml::default()
        };

        let resolved = config.resolve_runtime_options(&CliRuntimeOverrides::default());

        assert_eq!(resolved.provider, ProviderKind::Moonshot);
        assert_eq!(resolved.base_url, DEFAULT_MOONSHOT_BASE_URL);
        assert_eq!(resolved.model, DEFAULT_MOONSHOT_MODEL);
    }

    #[test]
    fn doubao_provider_defaults() {
        let _lock = env_lock();
        let _env = EnvGuard::without_yunpat_runtime_overrides();
        let config = ConfigToml {
            provider: ProviderKind::Doubao,
            ..ConfigToml::default()
        };

        let resolved = config.resolve_runtime_options(&CliRuntimeOverrides::default());

        assert_eq!(resolved.provider, ProviderKind::Doubao);
        assert_eq!(resolved.base_url, DEFAULT_DOUBAO_BASE_URL);
        assert_eq!(resolved.model, DEFAULT_DOUBAO_MODEL);
    }
}
