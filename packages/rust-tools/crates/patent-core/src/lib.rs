//! # Patent Core - 专利核心算法库
//!
//! 提供专利撰写、OA答复、质量评估、分类等核心算法。
//! 不依赖 LLM 调用，纯规则/算法逻辑。

pub mod error;
pub mod types;
pub mod drafting;
pub mod oa;
pub mod quality;
pub mod classification;

pub use error::{Error, Result};
pub use types::*;

/// 库版本
pub const VERSION: &str = "0.1.0";
