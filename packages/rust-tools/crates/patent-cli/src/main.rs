//! 专利工具 CLI

use clap::{Parser, Subcommand};
use patent_core::{
    classification::IpcClassifier,
    drafting::{ClaimGenerator, ClaimOptions, DisclosureParser, FeatureExtractor, InventionUnderstanding},
    drafting::claims::InventionType as InvType,
    oa::{ClaimReviser, OaParser, OaResponder},
    quality::QualityAssessor,
};
use std::path::PathBuf;

/// 专利工具 CLI
#[derive(Parser, Debug)]
#[command(name = "patent-cli")]
#[command(about = "专利工具 CLI", long_about = None)]
#[command(version)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand, Debug)]
enum Commands {
    /// 提取技术特征
    ExtractFeatures {
        #[arg(short, long)]
        text: Option<String>,
        #[arg(short, long)]
        file: Option<PathBuf>,
    },

    /// 解析交底书
    ParseDisclosure {
        #[arg(short, long)]
        text: Option<String>,
        #[arg(short, long)]
        file: Option<PathBuf>,
    },

    /// 生成权利要求
    GenerateClaims {
        #[arg(short, long)]
        title: String,
        #[arg(short, long)]
        solution: String,
        #[arg(short = 't', long, default_value = "product")]
        invention_type: String,
    },

    /// 解析审查意见
    ParseOa {
        #[arg(short, long)]
        text: Option<String>,
        #[arg(short, long)]
        file: Option<PathBuf>,
    },

    /// 推荐答复策略
    RecommendStrategy {
        #[arg(short, long)]
        oa_json: String,
    },

    /// 修改权利要求
    ReviseClaims {
        #[arg(short, long)]
        claims_file: PathBuf,
        #[arg(short = 't', long, default_value = "Hybrid")]
        strategy: String,
    },

    /// 评估权利要求质量
    AssessQuality {
        #[arg(short, long)]
        claims_file: PathBuf,
    },

    /// IPC 分类
    ClassifyIpc {
        #[arg(short, long)]
        text: String,
    },
}

fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::ExtractFeatures { text, file } => {
            let input = read_input(text, file)?;
            let features = FeatureExtractor::extract_features(&input, None);
            let pfe = FeatureExtractor::extract_problem_feature_effects(&input, None, None);
            print_json(&serde_json::json!({
                "features": features,
                "problem_feature_effects": pfe,
            }));
        }

        Commands::ParseDisclosure { text, file } => {
            let input = read_input(text, file)?;
            let doc = DisclosureParser::parse(&input);
            let title = doc.sections.get("发明名称").cloned().unwrap_or_default();
            print_json(&serde_json::json!({
                "title": title,
                "sections": doc.sections,
                "confidence": doc.confidence,
            }));
        }

        Commands::GenerateClaims { title, solution, invention_type } => {
            let inv_type = match invention_type.as_str() {
                "method" => InvType::Method,
                "use" => InvType::Use,
                _ => InvType::Product,
            };
            let features = FeatureExtractor::extract_features(&solution, None);
            let essential: Vec<_> = features.iter().filter(|f| f.feature_type == patent_core::FeatureType::Essential).cloned().collect();
            let optional: Vec<_> = features.iter().filter(|f| f.feature_type == patent_core::FeatureType::Optional).cloned().collect();
            let understanding = InventionUnderstanding {
                title,
                invention_type: inv_type,
                essential_features: essential,
                optional_features: optional,
            };
            let claims = ClaimGenerator::generate_all_claims(&understanding, &ClaimOptions::default());
            let rendered: Vec<String> = claims.iter().map(ClaimGenerator::render_claim).collect();
            print_json(&serde_json::json!({
                "claims": claims,
                "rendered": rendered,
            }));
        }

        Commands::ParseOa { text, file } => {
            let input = read_input(text, file)?;
            let oa = OaParser::parse(&input)?;
            print_json(&serde_json::json!({
                "oa_type": format!("{:?}", oa.oa_type),
                "citations": oa.citations,
                "affected_claims": oa.affected_claims,
                "examiner_arguments": oa.examiner_arguments,
            }));
        }

        Commands::RecommendStrategy { oa_json } => {
            let oa: patent_core::OfficeAction = serde_json::from_str(&oa_json)?;
            let strategies = OaResponder::analyze_and_recommend(&oa);
            print_json(&serde_json::json!({
                "strategies": strategies,
            }));
        }

        Commands::ReviseClaims { claims_file, strategy } => {
            let content = std::fs::read_to_string(&claims_file)?;
            let claims: Vec<patent_core::ClaimDraft> = serde_json::from_str(&content)?;
            let strat = patent_core::ResponseStrategy {
                strategy_type: match strategy.as_str() {
                    "AmendClaims" => patent_core::ResponseStrategyType::AmendClaims,
                    "Argue" => patent_core::ResponseStrategyType::Argue,
                    _ => patent_core::ResponseStrategyType::Hybrid,
                },
                reasoning: "CLI 指定策略".into(),
                confidence: 0.7,
            };
            let revised = ClaimReviser::revise(&claims, &strat);
            let quality = ClaimReviser::assess_revision(&claims, &revised);
            print_json(&serde_json::json!({
                "revised_claims": revised,
                "revision_quality": quality,
            }));
        }

        Commands::AssessQuality { claims_file } => {
            let content = std::fs::read_to_string(&claims_file)?;
            let claims: Vec<patent_core::ClaimDraft> = serde_json::from_str(&content)?;
            let assessment = QualityAssessor::assess_claims(&claims);
            print_json(&serde_json::json!({
                "clarity_score": assessment.clarity_score,
                "support_score": assessment.support_score,
                "scope_score": assessment.scope_score,
                "overall_score": assessment.overall_score,
                "issues": assessment.issues,
            }));
        }

        Commands::ClassifyIpc { text } => {
            let classifier = IpcClassifier::new();
            let results = classifier.classify(&text);
            print_json(&serde_json::json!({
                "classifications": results,
            }));
        }
    }

    Ok(())
}

fn read_input(text: Option<String>, file: Option<PathBuf>) -> anyhow::Result<String> {
    match (text, file) {
        (Some(t), _) => Ok(t),
        (_, Some(path)) => Ok(std::fs::read_to_string(path)?),
        _ => anyhow::bail!("请提供 --text 或 --file 参数"),
    }
}

fn print_json(data: &serde_json::Value) {
    println!("{}", serde_json::to_string_pretty(data).unwrap_or_default());
}
