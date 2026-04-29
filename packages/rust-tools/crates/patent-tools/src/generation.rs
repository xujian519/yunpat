//! 专利生成模块

use crate::types::{Claim, ClaimType, QualityAssessment, TechnicalFeature};
use crate::error::Error;
use crate::llm::LlmClient;
use crate::Result;

/// 权利要求生成器
pub struct ClaimGenerator {
    /// LLM 客户端
    llm_client: LlmClient,
}

impl ClaimGenerator {
    /// 创建新的权利要求生成器
    pub fn new(llm_client: LlmClient) -> Self {
        Self { llm_client }
    }

    /// 生成独立权利要求
    pub async fn generate_independent_claim(
        &self,
        technical_features: &[TechnicalFeature],
        invention_type: &str,
    ) -> Result<Claim> {
        let prompt = format!(
            r#"请根据以下技术特征生成一项独立权利要求：

发明类型：{}
技术特征：{}

要求：
1. 权利要求以"一种{},其特征在于"开始
2. 包含所有必要技术特征
3. 技术特征应当具体、明确
4. 保护范围应当合理"#,
            invention_type,
            technical_features
                .iter()
                .enumerate()
                .map(|(i, f)| format!("{}. {}", i + 1, f.description))
                .collect::<Vec<_>>()
                .join("\n"),
            invention_type
        );

        let response = self.llm_client.chat_simple(&prompt).await?;

        // 解析生成的权利要求
        Ok(Claim {
            claim_type: ClaimType::Independent,
            number: 1,
            content: response.trim().to_string(),
            dependencies: None,
        })
    }

    /// 生成从属权利要求
    pub async fn generate_dependent_claim(
        &self,
        parent_claim: &Claim,
        additional_features: &[TechnicalFeature],
    ) -> Result<Claim> {
        let prompt = format!(
            r#"请根据以下信息生成一项从属权利要求：

引用的权利要求：{}
附加技术特征：{}

要求：
1. 以"根据权利要求{}所述的发明,其特征在于"开始
2. 包含附加技术特征
3. 语言简洁、明确"#,
            parent_claim.content,
            additional_features
                .iter()
                .enumerate()
                .map(|(i, f)| format!("{}. {}", i + 1, f.description))
                .collect::<Vec<_>>()
                .join("\n"),
            parent_claim.number
        );

        let response = self.llm_client.chat_simple(&prompt).await?;

        Ok(Claim {
            claim_type: ClaimType::Dependent,
            number: parent_claim.number + 1,
            content: response.trim().to_string(),
            dependencies: Some(vec![parent_claim.number]),
        })
    }

    /// 评估权利要求质量
    pub async fn assess_quality(&self, claims: &[Claim]) -> Result<QualityAssessment> {
        let claims_text = claims
            .iter()
            .map(|c| format!("{}. {}", c.number, c.content))
            .collect::<Vec<_>>()
            .join("\n");

        let prompt = format!(
            r#"请评估以下权利要求的质量：

{}

请从以下维度评估（0-100分）：
1. 清晰度：权利要求是否清晰、明确
2. 支持度：是否得到说明书支持
3. 保护范围：保护范围是否合理

请以JSON格式返回评估结果：
{{
  "overall_score": 总分,
  "clarity_score": 清晰度分数,
  "support_score": 支持度分数,
  "breadth_score": 保护范围分数,
  "issues": [
    {{
      "severity": "high|medium",
      "description": "问题描述",
      "suggestion": "修改建议"
    }}
  ]
}}"#,
            claims_text
        );

        let response = self.llm_client.chat_simple(&prompt).await?;

        // 解析 JSON 响应
        let assessment: QualityAssessment = serde_json::from_str(&response)
            .map_err(|e| Error::Generation(format!("Failed to parse quality assessment: {}", e)))?;

        Ok(assessment)
    }

    /// 优化权利要求
    pub async fn optimize_claim(&self, claim: &Claim) -> Result<Claim> {
        let prompt = format!(
            r#"请优化以下权利要求，使其更加清晰、准确：

原权利要求：{}

请返回优化后的权利要求（仅返回权利要求内容，不要解释）。"#,
            claim.content
        );

        let response = self.llm_client.chat_simple(&prompt).await?;

        Ok(Claim {
            claim_type: claim.claim_type.clone(),
            number: claim.number,
            content: response.trim().to_string(),
            dependencies: claim.dependencies.clone(),
        })
    }
}

/// 说明书撰写器
pub struct SpecificationWriter {
    /// LLM 客户端
    llm_client: LlmClient,
}

impl SpecificationWriter {
    /// 创建新的说明书撰写器
    pub fn new(llm_client: LlmClient) -> Self {
        Self { llm_client }
    }

    /// 生成技术领域部分
    pub async fn generate_field_section(
        &self,
        technical_field: &str,
    ) -> Result<String> {
        let prompt = format!(
            r#"请为以下技术领域撰写专利说明书的"技术领域"部分：

技术领域：{}

要求：
1. 简明扼要地说明技术领域
2. 字数：50-100字
3. 客观、准确"#,
            technical_field
        );

        let response = self.llm_client.chat_simple(&prompt).await?;
        Ok(response)
    }

    /// 生成背景技术部分
    pub async fn generate_background_section(
        &self,
        prior_art: &[String],
    ) -> Result<String> {
        let prior_art_text = prior_art.iter().map(|s| s.as_str()).collect::<Vec<&str>>().join("\n");

        let prompt = format!(
            r#"请根据以下现有技术撰写专利说明书的"背景技术"部分：

现有技术：{}

要求：
1. 介绍相关现有技术
2. 指出现有技术的缺陷和不足
3. 字数：200-500字
4. 为本发明的技术方案铺垫"#,
            prior_art_text
        );

        let response = self.llm_client.chat_simple(&prompt).await?;
        Ok(response)
    }

    /// 生成发明内容部分
    pub async fn generate_summary_section(
        &self,
        technical_solution: &str,
        beneficial_effects: &[String],
    ) -> Result<String> {
        let effects_text = beneficial_effects.iter().map(|s| s.as_str()).collect::<Vec<&str>>().join("\n");

        let prompt = format!(
            r#"请根据以下信息撰写专利说明书的"发明内容"部分：

技术方案：{}

有益效果：{}

要求：
1. 详细描述技术方案
2. 列出有益效果
3. 字数：500-1000字
4. 清晰、具体、详实"#,
            technical_solution, effects_text
        );

        let response = self.llm_client.chat_simple(&prompt).await?;
        Ok(response)
    }

    /// 生成具体实施方式部分
    pub async fn generate_description_section(
        &self,
        examples: &[String],
    ) -> Result<String> {
        let examples_text = examples.iter().map(|s| s.as_str()).collect::<Vec<&str>>().join("\n");

        let prompt = format!(
            r#"请根据以下实施例撰写专利说明书的"具体实施方式"部分：

实施例：{}

要求：
1. 结合附图详细描述实施方式
2. 使本领域技术人员能够实现
3. 字数：1000-2000字
4. 清晰、具体、详实"#,
            examples_text
        );

        let response = self.llm_client.chat_simple(&prompt).await?;
        Ok(response)
    }

    /// 生成附图说明部分
    pub async fn generate_figures_section(&self, figures: &[String]) -> Result<String> {
        let figures_text = figures.iter().map(|s| s.as_str()).collect::<Vec<&str>>().join("\n");

        let prompt = format!(
            r#"请根据以下附图撰写专利说明书的"附图说明"部分：

附图：{}

要求：
1. 每幅附图都应当说明
2. 简洁明了
3. 字数适中"#,
            figures_text
        );

        let response = self.llm_client.chat_simple(&prompt).await?;
        Ok(response)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_generate_independent_claim() {
        // 此测试需要真实的 LLM 客户端，暂时跳过
        // TODO: 添加 mock LLM 客户端进行单元测试
    }

    #[tokio::test]
    async fn test_assess_quality() {
        // 此测试需要真实的 LLM 客户端，暂时跳过
        // TODO: 添加 mock LLM 客户端进行单元测试
    }
}
