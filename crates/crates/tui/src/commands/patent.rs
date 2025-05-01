//! Patent workflow slash commands: /research, /draft, /oa, /reexam, /invalid, /trademark

use super::{AppAction, CommandResult};
use crate::tui::app::App;

/// `/research <topic>` — Start a patent research workflow.
pub fn research(_app: &mut App, arg: Option<&str>) -> CommandResult {
    let topic = match arg {
        Some(t) if !t.trim().is_empty() => t.trim().to_string(),
        _ => {
            return CommandResult::error(
                "Usage: /research <topic>\n\n\
                 Start a patent research workflow on a given topic.\n\
                 Example: /research \"新用途专利创造性判定规则\"",
            );
        }
    };

    CommandResult::with_message_and_action(
        format!("Starting research on: {}", topic),
        AppAction::PatentWorkflow {
            agent_id: "research".to_string(),
            topic: Some(topic),
            case_id: None,
        },
    )
}

/// `/draft [topic]` — Start a patent drafting workflow.
pub fn draft(_app: &mut App, arg: Option<&str>) -> CommandResult {
    let topic = arg.map(|t| t.trim().to_string()).filter(|t| !t.is_empty());

    CommandResult::with_message_and_action(
        topic
            .as_deref()
            .map(|t| format!("Starting patent drafting for: {}", t))
            .unwrap_or_else(|| "Starting patent drafting workflow".to_string()),
        AppAction::PatentWorkflow {
            agent_id: "drafting".to_string(),
            topic,
            case_id: None,
        },
    )
}

/// `/oa [--case <id>]` — Start an OA (Office Action) response workflow.
pub fn oa(_app: &mut App, arg: Option<&str>) -> CommandResult {
    let case_id = parse_case_arg(arg);

    CommandResult::with_message_and_action(
        case_id
            .as_deref()
            .map(|id| format!("Starting OA response workflow for case: {}", id))
            .unwrap_or_else(|| "Starting OA response workflow".to_string()),
        AppAction::PatentWorkflow {
            agent_id: "oa-response".to_string(),
            topic: None,
            case_id,
        },
    )
}

/// `/reexam [--case <id>]` — Start a reexamination workflow.
pub fn reexam(_app: &mut App, arg: Option<&str>) -> CommandResult {
    let case_id = parse_case_arg(arg);

    CommandResult::with_message_and_action(
        case_id
            .as_deref()
            .map(|id| format!("Starting reexamination workflow for case: {}", id))
            .unwrap_or_else(|| "Starting reexamination workflow".to_string()),
        AppAction::PatentWorkflow {
            agent_id: "reexamination".to_string(),
            topic: None,
            case_id,
        },
    )
}

/// `/invalid [--case <id>]` — Start an invalidation workflow.
pub fn invalid(_app: &mut App, arg: Option<&str>) -> CommandResult {
    let case_id = parse_case_arg(arg);

    CommandResult::with_message_and_action(
        case_id
            .as_deref()
            .map(|id| format!("Starting invalidation workflow for case: {}", id))
            .unwrap_or_else(|| "Starting invalidation workflow".to_string()),
        AppAction::PatentWorkflow {
            agent_id: "invalidation".to_string(),
            topic: None,
            case_id,
        },
    )
}

/// `/trademark [topic]` — Start a trademark workflow.
pub fn trademark(_app: &mut App, arg: Option<&str>) -> CommandResult {
    let topic = arg.map(|t| t.trim().to_string()).filter(|t| !t.is_empty());

    CommandResult::with_message_and_action(
        topic
            .as_deref()
            .map(|t| format!("Starting trademark workflow for: {}", t))
            .unwrap_or_else(|| "Starting trademark workflow".to_string()),
        AppAction::PatentWorkflow {
            agent_id: "trademark".to_string(),
            topic,
            case_id: None,
        },
    )
}

/// `/creativity [topic]` — Start a creativity assessment workflow.
pub fn creativity(_app: &mut App, arg: Option<&str>) -> CommandResult {
    let topic = arg.map(|t| t.trim().to_string()).filter(|t| !t.is_empty());

    CommandResult::with_message_and_action(
        topic
            .as_deref()
            .map(|t| format!("Starting creativity assessment for: {}", t))
            .unwrap_or_else(|| "Starting creativity assessment workflow".to_string()),
        AppAction::PatentWorkflow {
            agent_id: "creativity".to_string(),
            topic,
            case_id: None,
        },
    )
}

/// `/patent-search <query>` — Search patents via Google Patents.
pub fn patent_search(_app: &mut App, arg: Option<&str>) -> CommandResult {
    let query = match arg {
        Some(q) if !q.trim().is_empty() => q.trim().to_string(),
        _ => {
            return CommandResult::error(
                "Usage: /patent-search <query>\n\n\
                 Search patents via Google Patents.\n\
                 Example: /patent-search artificial intelligence",
            );
        }
    };

    CommandResult::with_message_and_action(
        format!("Searching patents for: {}", query),
        AppAction::PatentWorkflow {
            agent_id: "patent_search".to_string(),
            topic: Some(query),
            case_id: None,
        },
    )
}

/// `/paper-search <query>` — Search academic papers via Semantic Scholar.
pub fn paper_search(_app: &mut App, arg: Option<&str>) -> CommandResult {
    let query = match arg {
        Some(q) if !q.trim().is_empty() => q.trim().to_string(),
        _ => {
            return CommandResult::error(
                "Usage: /paper-search <query>\n\n\
                 Search academic papers via Semantic Scholar.\n\
                 Example: /paper-search machine learning",
            );
        }
    };

    CommandResult::with_message_and_action(
        format!("Searching papers for: {}", query),
        AppAction::PatentWorkflow {
            agent_id: "paper_search".to_string(),
            topic: Some(query),
            case_id: None,
        },
    )
}

/// `/patent-db <query> [--ipc <code>] [--applicant <name>]` — Search local PostgreSQL patent database.
pub fn patent_db(_app: &mut App, arg: Option<&str>) -> CommandResult {
    let arg_str = match arg {
        Some(q) if !q.trim().is_empty() => q.trim(),
        _ => {
            return CommandResult::error(
                "Usage: /patent-db <query> [--ipc <code>] [--applicant <name>]\n\n\
                 Search local patent database with optional filters.\n\
                 Examples:\n\
                 /patent-db artificial intelligence\n\
                 /patent-db --ipc G06N\n\
                 /patent-db --applicant 华为\n\
                 /patent-db 电池 --ipc H01M --applicant 宁德时代",
            );
        }
    };

    let mut query = String::new();
    let mut ipc_filter = None;
    let mut applicant_filter = None;

    let parts: Vec<&str> = arg_str.split_whitespace().collect();
    let mut i = 0;
    while i < parts.len() {
        if parts[i] == "--ipc" {
            if i + 1 < parts.len() {
                ipc_filter = Some(parts[i + 1].to_string());
                i += 2;
                continue;
            }
        } else if parts[i] == "--applicant" {
            if i + 1 < parts.len() {
                applicant_filter = Some(parts[i + 1].to_string());
                i += 2;
                continue;
            }
        } else {
            if !query.is_empty() {
                query.push(' ');
            }
            query.push_str(parts[i]);
        }
        i += 1;
    }

    let mut extra = serde_json::Map::new();
    if !query.is_empty() {
        extra.insert("query".to_string(), serde_json::Value::String(query));
    }
    if let Some(ipc) = ipc_filter {
        extra.insert("ipc_code".to_string(), serde_json::Value::String(ipc));
    }
    if let Some(applicant) = applicant_filter {
        extra.insert(
            "applicant".to_string(),
            serde_json::Value::String(applicant),
        );
    }

    let display_msg = if extra.contains_key("query") {
        format!(
            "Searching local patent database for: {}",
            extra["query"].as_str().unwrap()
        )
    } else {
        "Searching local patent database".to_string()
    };

    CommandResult::with_message_and_action(
        display_msg,
        AppAction::PatentWorkflow {
            agent_id: "patent_db".to_string(),
            topic: arg.map(|s| s.to_string()),
            case_id: None,
        },
    )
}

/// `/ocr <image_path>` — Extract text from image using OCR.
pub fn ocr_command(_app: &mut App, arg: Option<&str>) -> CommandResult {
    let image_path = match arg {
        Some(p) if !p.trim().is_empty() => p.trim().to_string(),
        _ => {
            return CommandResult::error(
                "Usage: /ocr <image_path> [language]\n\n\
                 Extract text from image using OCR.\n\
                 Examples:\n\
                 /ocr /path/to/image.png\n\
                 /ocr /path/to/image.jpg chi_sim",
            );
        }
    };

    let parts: Vec<&str> = image_path.split_whitespace().collect();
    let path = parts[0].to_string();
    let lang = parts.get(1).map(|s| s.to_string());

    CommandResult::with_message_and_action(
        format!("Extracting text from: {}", path),
        AppAction::PatentWorkflow {
            agent_id: "ocr".to_string(),
            topic: Some(format!(
                "{} {}",
                path,
                lang.as_deref().unwrap_or("chi_sim+eng")
            )),
            case_id: None,
        },
    )
}

/// `/docx <markdown_path>` — Convert Markdown file to DOCX.
pub fn docx_command(_app: &mut App, arg: Option<&str>) -> CommandResult {
    let file_path = match arg {
        Some(p) if !p.trim().is_empty() => p.trim().to_string(),
        _ => {
            return CommandResult::error(
                "Usage: /docx <markdown_path> [output_path]\n\n\
                 Convert Markdown file to DOCX format.\n\
                 Examples:\n\
                 /docx report.md\n\
                 /docx report.md output.docx",
            );
        }
    };

    let parts: Vec<&str> = file_path.split_whitespace().collect();
    let md_path = parts[0].to_string();
    let output = parts.get(1).map(|s| s.to_string());

    CommandResult::with_message_and_action(
        format!("Converting {} to DOCX", md_path),
        AppAction::PatentWorkflow {
            agent_id: "docx".to_string(),
            topic: Some(format!(
                "{} {}",
                md_path,
                output.as_deref().unwrap_or("output.docx")
            )),
            case_id: None,
        },
    )
}

/// Parse `--case <id>` from a command argument string.
fn parse_case_arg(arg: Option<&str>) -> Option<String> {
    let arg = arg?;
    let parts: Vec<&str> = arg.split_whitespace().collect();
    for i in 0..parts.len() {
        if parts[i] == "--case" {
            return parts.get(i + 1).map(|s| s.to_string());
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_case_arg_present() {
        assert_eq!(
            parse_case_arg(Some("--case abc123")),
            Some("abc123".to_string())
        );
    }

    #[test]
    fn test_parse_case_arg_absent() {
        assert_eq!(parse_case_arg(Some("some other text")), None);
    }

    #[test]
    fn test_parse_case_arg_none() {
        assert_eq!(parse_case_arg(None), None);
    }

    #[test]
    fn test_patent_db_command_with_query() {
        use crate::config::Config;
        use crate::tui::app::{App, TuiOptions};
        use std::path::PathBuf;

        let options = TuiOptions {
            model: "deepseek-v4-pro".to_string(),
            workspace: PathBuf::from("."),
            config_path: None,
            config_profile: None,
            allow_shell: false,
            use_alt_screen: true,
            use_mouse_capture: false,
            use_bracketed_paste: true,
            max_subagents: 1,
            skills_dir: PathBuf::from("."),
            memory_path: PathBuf::from("memory.md"),
            notes_path: PathBuf::from("notes.txt"),
            mcp_config_path: PathBuf::from("mcp.json"),
            use_memory: false,
            start_in_agent_mode: false,
            skip_onboarding: true,
            yolo: false,
            resume_session_id: None,
            initial_input: None,
        };
        let mut app = App::new(options, &Config::default());

        let result = patent_db(&mut app, Some("人工智能"));
        assert!(!result.is_error);
        assert!(result.message.is_some());
        assert!(
            result
                .message
                .as_ref()
                .unwrap()
                .contains("Searching local patent database")
        );
        assert!(result.action.is_some());
    }

    #[test]
    fn test_patent_db_command_without_query() {
        use crate::config::Config;
        use crate::tui::app::{App, TuiOptions};
        use std::path::PathBuf;

        let options = TuiOptions {
            model: "deepseek-v4-pro".to_string(),
            workspace: PathBuf::from("."),
            config_path: None,
            config_profile: None,
            allow_shell: false,
            use_alt_screen: true,
            use_mouse_capture: false,
            use_bracketed_paste: true,
            max_subagents: 1,
            skills_dir: PathBuf::from("."),
            memory_path: PathBuf::from("memory.md"),
            notes_path: PathBuf::from("notes.txt"),
            mcp_config_path: PathBuf::from("mcp.json"),
            use_memory: false,
            start_in_agent_mode: false,
            skip_onboarding: true,
            yolo: false,
            resume_session_id: None,
            initial_input: None,
        };
        let mut app = App::new(options, &Config::default());

        let result = patent_db(&mut app, None);
        assert!(result.is_error);
        assert!(
            result
                .message
                .as_ref()
                .unwrap()
                .contains("Usage: /patent-db")
        );
    }

    #[test]
    fn test_patent_db_command_with_ipc_filter() {
        use crate::config::Config;
        use crate::tui::app::{App, TuiOptions};
        use std::path::PathBuf;

        let options = TuiOptions {
            model: "deepseek-v4-pro".to_string(),
            workspace: PathBuf::from("."),
            config_path: None,
            config_profile: None,
            allow_shell: false,
            use_alt_screen: true,
            use_mouse_capture: false,
            use_bracketed_paste: true,
            max_subagents: 1,
            skills_dir: PathBuf::from("."),
            memory_path: PathBuf::from("memory.md"),
            notes_path: PathBuf::from("notes.txt"),
            mcp_config_path: PathBuf::from("mcp.json"),
            use_memory: false,
            start_in_agent_mode: false,
            skip_onboarding: true,
            yolo: false,
            resume_session_id: None,
            initial_input: None,
        };
        let mut app = App::new(options, &Config::default());

        let result = patent_db(&mut app, Some("--ipc G06N"));
        assert!(!result.is_error);
        assert!(
            result
                .message
                .as_ref()
                .unwrap()
                .contains("Searching local patent database")
        );
    }

    #[test]
    fn test_patent_db_command_with_applicant_filter() {
        use crate::config::Config;
        use crate::tui::app::{App, TuiOptions};
        use std::path::PathBuf;

        let options = TuiOptions {
            model: "deepseek-v4-pro".to_string(),
            workspace: PathBuf::from("."),
            config_path: None,
            config_profile: None,
            allow_shell: false,
            use_alt_screen: true,
            use_mouse_capture: false,
            use_bracketed_paste: true,
            max_subagents: 1,
            skills_dir: PathBuf::from("."),
            memory_path: PathBuf::from("memory.md"),
            notes_path: PathBuf::from("notes.txt"),
            mcp_config_path: PathBuf::from("mcp.json"),
            use_memory: false,
            start_in_agent_mode: false,
            skip_onboarding: true,
            yolo: false,
            resume_session_id: None,
            initial_input: None,
        };
        let mut app = App::new(options, &Config::default());

        let result = patent_db(&mut app, Some("--applicant 华为"));
        assert!(!result.is_error);
        assert!(
            result
                .message
                .as_ref()
                .unwrap()
                .contains("Searching local patent database")
        );
    }
}
