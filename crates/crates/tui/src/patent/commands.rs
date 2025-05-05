#![allow(dead_code, clippy::manual_map)]
//! 专利相关命令定义
//!
//! TUI 中可用的专利命令：
//! /search <title>  - 专利检索
//! /analyze <id>    - 专利分析
//! /respond <id>    - 审查答复
//! /manage          - 专利管理面板
//! /legal <query>   - 法律知识查询

/// 专利命令
#[derive(Debug, Clone)]
pub enum PatentCommand {
    /// 专利检索
    Search { query: String },
    /// 专利分析
    Analyze { patent_number: String },
    /// 审查答复
    Respond { patent_number: String },
    /// 专利管理
    Manage,
    /// 法律知识查询
    LegalQuery { query: String },
}

impl PatentCommand {
    /// 从用户输入解析命令
    pub fn parse(input: &str) -> Option<Self> {
        let input = input.trim();

        if let Some(query) = input.strip_prefix("/search ") {
            Some(Self::Search {
                query: query.to_string(),
            })
        } else if let Some(id) = input.strip_prefix("/analyze ") {
            Some(Self::Analyze {
                patent_number: id.to_string(),
            })
        } else if let Some(id) = input.strip_prefix("/respond ") {
            Some(Self::Respond {
                patent_number: id.to_string(),
            })
        } else if input == "/manage" {
            Some(Self::Manage)
        } else if let Some(query) = input.strip_prefix("/legal ") {
            Some(Self::LegalQuery {
                query: query.to_string(),
            })
        } else {
            None
        }
    }

    /// 获取命令帮助文本
    pub fn help_text() -> &'static str {
        "专利命令：
  /search <title>    专利检索
  /analyze <id>      专利分析
  /respond <id>      审查答复
  /manage            专利管理面板
  /legal <query>     法律知识查询"
    }
}
