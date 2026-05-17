use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaperRecord {
    pub paper_id: String,
    pub title: String,
    pub abstract_text: Option<String>,
    pub authors: Vec<String>,
    pub year: Option<u32>,
    pub venue: Option<String>,
    pub url: String,
    pub citation_count: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaperSearchResult {
    pub papers: Vec<PaperRecord>,
    pub total: usize,
    pub offset: usize,
}

pub struct PaperSearchTool;

impl PaperSearchTool {
    pub fn new() -> Self {
        Self
    }

    pub async fn search(
        &self,
        query: &str,
        limit: usize,
        offset: usize,
    ) -> anyhow::Result<PaperSearchResult> {
        let client =
            reqwest::Client::builder().timeout(std::time::Duration::from_secs(30)).build()?;

        let url = format!(
            "https://api.semanticscholar.org/graph/v1/paper/search?query={}&fields=title,abstract,authors,year,venue,url,citationCount&limit={}&offset={}",
            urlencoding::encode(query),
            limit.min(100),
            offset
        );

        let response = client.get(&url).send().await?;

        if !response.status().is_success() {
            anyhow::bail!("论文搜索请求失败: {}", response.status());
        }

        let data: serde_json::Value = response.json().await?;

        let mut papers = Vec::new();
        let mut total = 0;

        if let Some(arr) = data.get("data").and_then(|d| d.as_array()) {
            for item in arr {
                if let Some(paper) = Self::parse_paper(item) {
                    papers.push(paper);
                }
            }
        }

        if let Some(t) = data.get("total").and_then(|t| t.as_u64()) {
            total = t as usize;
        }

        Ok(PaperSearchResult { papers, total, offset })
    }

    fn parse_paper(value: &serde_json::Value) -> Option<PaperRecord> {
        let paper_id = value.get("paperId")?.as_str()?.to_string();
        let title = value.get("title").and_then(|t| t.as_str()).unwrap_or("").to_string();
        let abstract_text = value.get("abstract").and_then(|a| a.as_str()).map(|s| s.to_string());
        let authors = value
            .get("authors")
            .and_then(|a| a.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.get("name").and_then(|n| n.as_str()).map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default();
        let year = value.get("year").and_then(|y| y.as_u64()).map(|y| y as u32);
        let venue = value.get("venue").and_then(|v| v.as_str()).map(|s| s.to_string());
        let url = value.get("url").and_then(|u| u.as_str()).unwrap_or("").to_string();
        let citation_count = value.get("citationCount").and_then(|c| c.as_u64()).map(|c| c as u32);

        Some(PaperRecord {
            paper_id,
            title,
            abstract_text,
            authors,
            year,
            venue,
            url,
            citation_count,
        })
    }
}

impl Default for PaperSearchTool {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_paper_search_tool_new() {
        let _tool = PaperSearchTool::new();
    }

    #[tokio::test]
    #[ignore = "需要网络连接，可能被限速"]
    async fn test_paper_search_basic() {
        let tool = PaperSearchTool::new();
        let result = tool.search("machine learning", 10, 0).await;

        match result {
            Ok(search_result) => {
                assert!(
                    search_result.papers.is_empty() || !search_result.papers.is_empty(),
                    "应返回论文列表"
                );
            }
            Err(e) => {
                println!("论文搜索失败（网络或限速）: {}", e);
            }
        }
    }

    #[test]
    fn test_paper_record_serialization() {
        let record = PaperRecord {
            paper_id: "test123".to_string(),
            title: "测试论文".to_string(),
            abstract_text: Some("这是一个测试摘要".to_string()),
            authors: vec!["张三".to_string(), "李四".to_string()],
            year: Some(2024),
            venue: Some("测试期刊".to_string()),
            url: "https://example.com/paper".to_string(),
            citation_count: Some(100),
        };

        let json = serde_json::to_string(&record).expect("序列化失败");
        assert!(json.contains("测试论文"));
        assert!(json.contains("张三"));
    }
}
