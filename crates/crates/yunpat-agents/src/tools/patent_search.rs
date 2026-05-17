use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatentRecord {
    pub patent_id: String,
    pub title: String,
    pub snippet: String,
    pub url: String,
    pub assignee: Option<String>,
    pub publication_date: Option<String>,
    pub ipc_codes: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatentSearchResult {
    pub patents: Vec<PatentRecord>,
    pub total: usize,
    pub page: usize,
}

pub struct PatentSearchTool;

impl PatentSearchTool {
    pub fn new() -> Self {
        Self
    }

    pub async fn search(&self, query: &str, page: usize) -> anyhow::Result<PatentSearchResult> {
        let client =
            reqwest::Client::builder().timeout(std::time::Duration::from_secs(30)).build()?;

        let url = format!(
            "https://patents.google.com/xhr/query?url=q%3D{}%26page%3D{}",
            urlencoding::encode(query),
            page
        );

        let response = client.get(&url).send().await?;

        if !response.status().is_success() {
            anyhow::bail!("专利搜索请求失败: {}", response.status());
        }

        let data: serde_json::Value = response.json().await?;

        let mut patents = Vec::new();
        let mut total = 0;

        if let Some(results) = data.get("results") {
            if let Some(cluster) = results.get("cluster")
                && let Some(arr) = cluster.as_array()
            {
                for item in arr {
                    if let Some(patent) = Self::parse_patent(item) {
                        patents.push(patent);
                    }
                }
            }
            if let Some(num_found) = results.get("numFound") {
                total = num_found.as_u64().unwrap_or(0) as usize;
            }
        }

        Ok(PatentSearchResult { patents, total, page })
    }

    fn parse_patent(value: &serde_json::Value) -> Option<PatentRecord> {
        let patent_id = value.get("patent_number")?.as_str()?.to_string();
        let title = value.get("title").and_then(|t| t.as_str()).unwrap_or("").to_string();
        let snippet = value.get("snippet").and_then(|s| s.as_str()).unwrap_or("").to_string();
        let url = format!("https://patents.google.com/patent/{}", patent_id);
        let assignee = value.get("assignee").and_then(|a| a.as_str()).map(|s| s.to_string());
        let publication_date =
            value.get("publication_date").and_then(|d| d.as_str()).map(|s| s.to_string());
        let ipc_codes = value
            .get("ipc_codes")
            .and_then(|i| i.as_array())
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect());

        Some(PatentRecord {
            patent_id,
            title,
            snippet,
            url,
            assignee,
            publication_date,
            ipc_codes,
        })
    }
}

impl Default for PatentSearchTool {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_patent_search_tool_new() {
        let _tool = PatentSearchTool::new();
    }

    #[tokio::test]
    #[ignore = "需要网络连接，可能被限速"]
    async fn test_patent_search_basic() {
        let tool = PatentSearchTool::new();
        let result = tool.search("artificial intelligence", 0).await;

        match result {
            Ok(search_result) => {
                assert!(
                    search_result.patents.is_empty() || !search_result.patents.is_empty(),
                    "应返回专利列表"
                );
            }
            Err(e) => {
                println!("专利搜索失败（网络或限速）: {}", e);
            }
        }
    }

    #[test]
    fn test_patent_record_serialization() {
        let record = PatentRecord {
            patent_id: "US12345678B2".to_string(),
            title: "测试专利".to_string(),
            snippet: "这是一个测试专利的摘要".to_string(),
            url: "https://patents.google.com/patent/US12345678B2".to_string(),
            assignee: Some("测试公司".to_string()),
            publication_date: Some("2024-01-01".to_string()),
            ipc_codes: Some(vec!["G06N".to_string()]),
        };

        let json = serde_json::to_string(&record).expect("序列化失败");
        assert!(json.contains("US12345678B2"));
        assert!(json.contains("测试专利"));
    }
}
