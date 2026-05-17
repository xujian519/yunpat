use super::AppAction;
use crate::commands::CommandResult;
use crate::tui::app::App;

pub fn kb(app: &mut App, arg: Option<&str>) -> CommandResult {
    let arg = arg.unwrap_or("").trim();
    let parts: Vec<&str> = arg.splitn(2, ' ').collect();
    let subcmd = parts.first().copied().unwrap_or("");
    let subarg = parts.get(1).copied().unwrap_or("");

    match subcmd {
        "search" => kb_search(app, subarg),
        "list" => kb_list(app),
        "index" => kb_index(app),
        "" | "help" => CommandResult::message(
            "知识库管理命令:\n\
             /kb search <query> — 搜索知识库（关键词匹配）\n\
             /kb list            — 列出知识库文件\n\
             /kb index           — 构建语义搜索向量索引\n\
             /kb help            — 显示帮助"
                .to_string(),
        ),
        _ => CommandResult::error(format!(
            "未知 /kb 子命令: {}。输入 /kb help 查看用法。",
            subcmd
        )),
    }
}

fn kb_search(_app: &mut App, query: &str) -> CommandResult {
    if query.is_empty() {
        return CommandResult::error("用法: /kb search <query>");
    }

    let kb = match yunpat_agents::knowledge::KnowledgeBase::default_kb() {
        Ok(kb) => kb,
        Err(e) => return CommandResult::error(format!("知识库加载失败: {}", e)),
    };

    if !kb.exists() {
        return CommandResult::error(
            "知识库目录不存在。请设置 YUNPAT_KB_PATH 环境变量指向知识库目录。",
        );
    }

    match kb.search(query, 10) {
        Ok(results) => {
            if results.is_empty() {
                return CommandResult::message(format!("未找到与 '{}' 相关的内容。", query));
            }
            let mut parts = vec![format!(
                "# 知识库搜索结果\n\n找到 {} 条相关内容：\n",
                results.len()
            )];
            for (i, chunk) in results.iter().enumerate() {
                parts.push(format!(
                    "## {}. {} (相关度: {:.1})\n\n- **文件**: {}\n\n{}",
                    i + 1,
                    chunk.title,
                    chunk.relevance,
                    chunk.file_path,
                    chunk.content
                ));
            }
            CommandResult::message(parts.join("\n\n---\n\n"))
        }
        Err(e) => CommandResult::error(format!("搜索失败: {}", e)),
    }
}

fn kb_list(_app: &mut App) -> CommandResult {
    let kb = match yunpat_agents::knowledge::KnowledgeBase::default_kb() {
        Ok(kb) => kb,
        Err(e) => return CommandResult::error(format!("知识库加载失败: {}", e)),
    };

    if !kb.exists() {
        return CommandResult::error(
            "知识库目录不存在。请设置 YUNPAT_KB_PATH 环境变量指向知识库目录。",
        );
    }

    match kb.list_files() {
        Ok(files) => {
            if files.is_empty() {
                return CommandResult::message("知识库目录为空，没有文件。".to_string());
            }
            let mut parts = vec![format!("# 知识库文件列表\n\n共 {} 个文件：\n", files.len())];
            for (i, path) in files.iter().enumerate() {
                let name =
                    path.file_name().map(|f| f.to_string_lossy().to_string()).unwrap_or_default();
                parts.push(format!("{}. {}", i + 1, name));
            }
            CommandResult::message(parts.join("\n"))
        }
        Err(e) => CommandResult::error(format!("列出文件失败: {}", e)),
    }
}

fn kb_index(_app: &mut App) -> CommandResult {
    CommandResult::with_message_and_action(
        "构建知识库语义索引...".to_string(),
        AppAction::PatentWorkflow {
            agent_id: "kb_index".to_string(),
            topic: Some("build_vector_index".to_string()),
            case_id: None,
        },
    )
}
