//! Case management slash command: /case

use super::{AppAction, CommandResult};
use crate::tui::app::App;

/// `/case <subcommand> [args...]` — Manage patent cases.
///
/// Subcommands:
/// - `new <title> --type <type>` — Create a new case
/// - `list` — List all cases
/// - `show <id>` — Show case details
/// - `doc add <id> --type <type> <path>` — Add a document to a case
/// - `archive <id>` — Archive a case
pub fn case(app: &mut App, arg: Option<&str>) -> CommandResult {
    let arg = match arg {
        Some(a) if !a.trim().is_empty() => a.trim(),
        _ => {
            return CommandResult::error(
                "Usage: /case <subcommand> [args...]\n\n\
                 Subcommands:\n\
                 - new <title> --type <发明|实用新型|外观设计>\n\
                 - list\n\
                 - show <id>\n\
                 - doc add <id> --type <type> <path>\n\
                 - archive <id>",
            );
        }
    };

    let parts: Vec<&str> = arg.splitn(2, ' ').collect();
    let subcommand = parts[0];
    let sub_args = parts.get(1).copied();

    match subcommand {
        "new" => case_new(app, sub_args),
        "list" | "ls" => case_list(app),
        "show" => case_show(sub_args),
        "doc" => case_doc(sub_args),
        "archive" => case_archive(sub_args),
        _ => CommandResult::error(format!(
            "Unknown /case subcommand: '{}'. Use /case for help.",
            subcommand
        )),
    }
}

fn case_new(_app: &mut App, arg: Option<&str>) -> CommandResult {
    let arg = match arg {
        Some(a) => a,
        None => {
            return CommandResult::error(
                "Usage: /case new <title> --type <发明|实用新型|外观设计>",
            );
        }
    };

    // Parse title and --type
    let patent_type = extract_flag_value(arg, "--type").unwrap_or_else(|| "发明".to_string());

    // Title is everything before --type
    let title = if let Some(pos) = arg.find("--type") {
        arg[..pos].trim()
    } else {
        arg.trim()
    };

    if title.is_empty() {
        return CommandResult::error("Case title cannot be empty");
    }

    CommandResult::with_message_and_action(
        format!("Creating case: '{}' (type: {})", title, patent_type),
        AppAction::CaseCreate {
            title: title.to_string(),
            patent_type,
        },
    )
}

fn case_list(_app: &mut App) -> CommandResult {
    CommandResult::action(AppAction::CaseList)
}

fn case_show(arg: Option<&str>) -> CommandResult {
    let id = match arg {
        Some(id) if !id.trim().is_empty() => id.trim().to_string(),
        _ => {
            return CommandResult::error("Usage: /case show <id>");
        }
    };

    CommandResult::action(AppAction::CaseShow { case_id: id })
}

fn case_doc(arg: Option<&str>) -> CommandResult {
    let arg = match arg {
        Some(a) => a,
        None => {
            return CommandResult::error("Usage: /case doc add <case-id> --type <type> <path>");
        }
    };

    let parts: Vec<&str> = arg.splitn(2, ' ').collect();
    if parts[0] != "add" {
        return CommandResult::error(format!(
            "Unknown /case doc subcommand: '{}'. Only 'add' is supported.",
            parts[0]
        ));
    }

    let rest = parts.get(1).copied().unwrap_or("");
    let rest_parts: Vec<&str> = rest.split_whitespace().collect();

    if rest_parts.len() < 3 {
        return CommandResult::error("Usage: /case doc add <case-id> --type <type> <path>");
    }

    let case_id = rest_parts[0].to_string();
    let doc_type = extract_flag_value(rest, "--type").unwrap_or_else(|| "other".to_string());
    // Path is everything after --type <value>
    let path = if let Some(pos) = rest.find("--type") {
        let after_flag = &rest[pos + "--type".len()..];
        let after_flag = after_flag.trim_start();
        // Skip the type value
        if let Some(space) = after_flag.find(' ') {
            after_flag[space..].trim().to_string()
        } else {
            return CommandResult::error("File path is required after --type <value>");
        }
    } else {
        rest_parts.last().copied().unwrap_or("").to_string()
    };

    CommandResult::with_message_and_action(
        format!(
            "Adding document to case {}: {} ({})",
            case_id, path, doc_type
        ),
        AppAction::CaseDocAdd {
            case_id,
            doc_type,
            file_path: path,
        },
    )
}

fn case_archive(arg: Option<&str>) -> CommandResult {
    let id = match arg {
        Some(id) if !id.trim().is_empty() => id.trim().to_string(),
        _ => {
            return CommandResult::error("Usage: /case archive <id>");
        }
    };

    CommandResult::action(AppAction::CaseArchive { case_id: id })
}

/// Extract the value of a `--flag <value>` pair from an argument string.
fn extract_flag_value(input: &str, flag: &str) -> Option<String> {
    let parts: Vec<&str> = input.split_whitespace().collect();
    for i in 0..parts.len() {
        if parts[i] == flag {
            return parts.get(i + 1).map(|s| s.to_string());
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_flag_value() {
        assert_eq!(
            extract_flag_value("test title --type 发明", "--type"),
            Some("发明".to_string())
        );
        assert_eq!(extract_flag_value("no flag here", "--type"), None);
    }
}
