//! # Patent Tools - 专利工具集
//!
//! 提供专利检索、分析、生成等功能
//!
//! ## 模块结构
//! - `search`: 检索引擎
//! - `generation`: 权利要求生成
//! - `analysis`: 技术分析
//! - `types`: 核心类型定义

pub mod error;
pub mod types;
pub mod search;
pub mod generation;
pub mod analysis;
pub mod llm;

pub use error::{Error, Result};
pub use types::*;
pub use search::{SearchEngine, SearchResult};
pub use generation::{ClaimGenerator, SpecificationWriter};
pub use analysis::{FeatureExtractor, PriorArtAnalyzer, OfficeActionParser};
pub use llm::{LlmClient, LlmConfig, LlmProvider};

/// 专利工具版本
pub const VERSION: &str = "0.1.0";
