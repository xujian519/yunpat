//! 专利分析模块

use crate::types::{CitedReference, OfficeAction, PatentRecord, Rejection, TechnicalFeature};
use crate::llm::LlmClient;
use crate::{Error, Result};

/// 特征提取器
pub struct FeatureExtractor {
    /// LLM 客户端
    llm_client: LlmClient,
}

impl FeatureExtractor {
    /// 创建新的特征提取器
    pub fn new(llm_client: LlmClient) -> Self {
        Self { llm_client }
    }

    /// 从技术交底书中提取特征
    pub async fn extract_from_disclosure(
        &self,
        disclosure: &str,
    ) -> Result<Vec<TechnicalFeature>> {
        let prompt = format!(
            r#"请从以下技术交底书中提取关键技术特征：

技术交底书：{}

请识别并提取：
1. 结构特征：具体的结构、组件、连接关系
2. 功能特征：实现的功能、操作、作用
3. 参数特征：具体的参数、数值、范围

请以JSON格式返回：
[
  {{
    "name": "特征名称",
    "description": "特征描述",
    "feature_type": "Structural"
  }}
]"#,
            disclosure
        );

        let response = self.llm_client.chat_simple(&prompt).await?;

        // 解析 JSON 响应
        let features: Vec<TechnicalFeature> = serde_json::from_str(&response)
            .map_err(|e| Error::Analysis(format!("Failed to parse features: {}", e)))?;

        Ok(features)
    }

    /// 从专利文本中提取特征
    pub async fn extract_from_patent(
        &self,
        patent: &PatentRecord,
    ) -> Result<Vec<TechnicalFeature>> {
        let prompt = format!(
            "请从以下专利中提取关键技术特征：

专利号：{}
标题：{}
摘要：{}

请提取关键技术特征，以JSON格式返回。",
            patent.patent_number, patent.title, patent.abstract_text
        );

        let response = self.llm_client.chat_simple(&prompt).await?;

        // 解析 JSON 响应
        let features: Vec<TechnicalFeature> = serde_json::from_str(&response)
            .map_err(|e| Error::Analysis(format!("Failed to parse features: {}", e)))?;

        Ok(features)
    }

    /// 分析特征关系
    pub async fn analyze_feature_relationships(
        &self,
        features: &[TechnicalFeature],
    ) -> Result<Vec<(usize, usize, String)>> {
        let features_text = features
            .iter()
            .enumerate()
            .map(|(i, f)| format!("{}. {}", i + 1, f.description))
            .collect::<Vec<_>>()
            .join("\n");

        let prompt = format!(
            r#"请分析以下技术特征之间的关系：

{}

请识别特征之间的：
1. 依赖关系
2. 组合关系
3. 排斥关系

请以JSON格式返回关系列表：
[
  [特征索引1, 特征索引2, "关系描述"]
]"#,
            features_text
        );

        let response = self.llm_client.chat_simple(&prompt).await?;

        // 解析 JSON 响应
        let relationships: Vec<(usize, usize, String)> = serde_json::from_str(&response)
            .map_err(|e| Error::Analysis(format!("Failed to parse relationships: {}", e)))?;

        Ok(relationships)
    }
}

/// 现有技术分析器
pub struct PriorArtAnalyzer {
    /// LLM 客户端
    llm_client: LlmClient,
}

impl PriorArtAnalyzer {
    /// 创建新的现有技术分析器
    pub fn new(llm_client: LlmClient) -> Self {
        Self { llm_client }
    }

    /// 分析新颖性
    pub async fn analyze_novelty(
        &self,
        invention: &[TechnicalFeature],
        prior_art: &[PatentRecord],
    ) -> Result<bool> {
        let invention_text = invention
            .iter()
            .map(|f| f.description.as_str())
            .collect::<Vec<&str>>()
            .join("; ");

        let prior_art_text = prior_art
            .iter()
            .map(|p| format!("{}: {}", p.patent_number, p.abstract_text))
            .collect::<Vec<_>>()
            .iter()
            .map(|s| s.as_str())
            .collect::<Vec<&str>>()
            .join("\n\n");

        let prompt = format!(
            r#"请分析本发明相对于现有技术是否具有新颖性：

本发明的技术特征：{}

现有技术：{}

请判断本发明是否具有新颖性（即现有技术是否未公开相同的技术方案）。
请返回：true（具有新颖性）或 false（不具有新颖性）。"#,
            invention_text, prior_art_text
        );

        let response = self.llm_client.chat_simple(&prompt).await?;

        let response_lower = response.to_lowercase();
        let has_novelty = response_lower.contains("true")
            || response_lower.contains("具有新颖性")
            || response_lower.contains("具备新颖性");

        Ok(has_novelty)
    }

    /// 分析创造性
    pub async fn analyze_inventive_step(
        &self,
        invention: &[TechnicalFeature],
        prior_art: &[PatentRecord],
    ) -> Result<bool> {
        let invention_text = invention
            .iter()
            .map(|f| f.description.as_str())
            .collect::<Vec<&str>>()
            .join("; ");

        let prior_art_text = prior_art
            .iter()
            .map(|p| format!("{}: {}", p.patent_number, p.abstract_text))
            .collect::<Vec<_>>()
            .iter()
            .map(|s| s.as_str())
            .collect::<Vec<&str>>()
            .join("\n\n");

        let prompt = format!(
            r#"请分析本发明相对于现有技术是否具有创造性：

本发明的技术特征：{}

现有技术：{}

请判断本发明对于本领域技术人员来说是否显而易见。
请返回：true（具有创造性）或 false（不具有创造性）。"#,
            invention_text, prior_art_text
        );

        let response = self.llm_client.chat_simple(&prompt).await?;

        let response_lower = response.to_lowercase();
        let has_inventive_step = response_lower.contains("true")
            || response_lower.contains("具有创造性")
            || response_lower.contains("具备创造性");

        Ok(has_inventive_step)
    }

    /// 查找最接近的现有技术
    pub async fn find_closest_prior_art(
        &self,
        invention: &[TechnicalFeature],
        prior_art: &[PatentRecord],
    ) -> Result<Option<PatentRecord>> {
        if prior_art.is_empty() {
            return Ok(None);
        }

        // 简单实现：返回第一个现有技术
        // TODO: 实现更复杂的相似度计算
        Ok(Some(prior_art[0].clone()))
    }

    /// 对比技术特征
    pub async fn compare_features(
        &self,
        features1: &[TechnicalFeature],
        features2: &[TechnicalFeature],
    ) -> Result<Vec<(usize, usize, f64)>> {
        let features1_text = features1
            .iter()
            .map(|f| f.description.as_str())
            .collect::<Vec<&str>>()
            .join("\n");

        let features2_text = features2
            .iter()
            .map(|f| f.description.as_str())
            .collect::<Vec<&str>>()
            .join("\n");

        let prompt = format!(
            r#"请对比两组技术特征的相似度：

技术特征组1：{}

技术特征组2：{}

请为每对特征计算相似度分数（0-1之间），以JSON格式返回：
[
  [特征组1索引, 特征组2索引, 相似度分数]
]"#,
            features1_text, features2_text
        );

        let response = self.llm_client.chat_simple(&prompt).await?;

        // 解析 JSON 响应
        let comparisons: Vec<(usize, usize, f64)> = serde_json::from_str(&response)
            .map_err(|e| Error::Analysis(format!("Failed to parse comparisons: {}", e)))?;

        Ok(comparisons)
    }
}

/// 审查意见解析器
pub struct OfficeActionParser {
    /// LLM 客户端
    llm_client: LlmClient,
}

impl OfficeActionParser {
    /// 创建新的审查意见解析器
    pub fn new(llm_client: LlmClient) -> Self {
        Self { llm_client }
    }

    /// 解析审查意见通知书
    pub async fn parse_office_action(&self, text: &str) -> Result<OfficeAction> {
        let prompt = format!(
            r#"请解析以下审查意见通知书，提取结构化信息：

审查意见：{}

请以JSON格式返回：
{{
  "application_number": "申请号",
  "action_type": "FirstAction",
  "rejections": [
    {{
      "rejection_type": "LackOfNovelty",
      "claim_numbers": [1, 2],
      "reasons": "驳回理由",
      "cited_references": ["对比文件号"]
    }}
  ],
  "cited_references": [
    {{
      "publication_number": "文献号",
      "document_type": "文献类型",
      "relevance": "相关性说明",
      "publication_date": "公开日期"
    }}
  ]
}}"#,
            text
        );

        let response = self.llm_client.chat_simple(&prompt).await?;

        // 解析 JSON 响应
        let office_action: OfficeAction = serde_json::from_str(&response)
            .map_err(|e| Error::Analysis(format!("Failed to parse office action: {}", e)))?;

        Ok(office_action)
    }

    /// 提取驳回理由
    pub async fn extract_rejections(&self, text: &str) -> Result<Vec<Rejection>> {
        let office_action = self.parse_office_action(text).await?;
        Ok(office_action.rejections)
    }

    /// 提取引用的对比文件
    pub async fn extract_cited_references(&self, text: &str) -> Result<Vec<CitedReference>> {
        let office_action = self.parse_office_action(text).await?;
        Ok(office_action.cited_references)
    }
}
