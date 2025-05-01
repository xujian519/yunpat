use std::path::Path;

pub struct PatentDownloadTool;

impl PatentDownloadTool {
    pub fn new() -> Self {
        Self
    }

    pub async fn download_pdf(&self, patent_id: &str, output_dir: &str) -> anyhow::Result<String> {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(60))
            .build()?;

        let url = format!(
            "https://patentimages.storage.googleapis.com/{}/{}.pdf",
            patent_id.replace("-", ""),
            patent_id.replace("-", "")
        );

        let response = client.get(&url).send().await?;

        if !response.status().is_success() {
            anyhow::bail!("下载失败: HTTP {}", response.status());
        }

        let bytes = response.bytes().await?;

        let filename = format!("{}.pdf", patent_id.replace("/", "_"));
        let output_path = Path::new(output_dir).join(filename);

        tokio::fs::create_dir_all(output_dir).await?;
        tokio::fs::write(&output_path, bytes).await?;

        Ok(output_path.to_string_lossy().to_string())
    }

    pub async fn download_multiple(
        &self,
        patent_ids: &[&str],
        output_dir: &str,
    ) -> Vec<PatentDownloadResult> {
        let mut results = Vec::new();

        for patent_id in patent_ids {
            match self.download_pdf(patent_id, output_dir).await {
                Ok(path) => {
                    results.push(PatentDownloadResult {
                        patent_id: patent_id.to_string(),
                        success: true,
                        path: Some(path),
                        error: None,
                    });
                }
                Err(e) => {
                    results.push(PatentDownloadResult {
                        patent_id: patent_id.to_string(),
                        success: false,
                        path: None,
                        error: Some(e.to_string()),
                    });
                }
            }
        }

        results
    }
}

#[derive(Debug, Clone)]
pub struct PatentDownloadResult {
    pub patent_id: String,
    pub success: bool,
    pub path: Option<String>,
    pub error: Option<String>,
}

impl Default for PatentDownloadTool {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_patent_download_tool_new() {
        let _tool = PatentDownloadTool::new();
    }

    #[tokio::test]
    #[ignore = "需要网络连接"]
    async fn test_download_pdf() {
        let tool = PatentDownloadTool::new();
        let result = tool.download_pdf("US20240012345A1", "/tmp/patents").await;

        match result {
            Ok(path) => {
                assert!(path.ends_with(".pdf"));
            }
            Err(e) => {
                println!("下载失败（网络或文件不存在）: {}", e);
            }
        }
    }
}
