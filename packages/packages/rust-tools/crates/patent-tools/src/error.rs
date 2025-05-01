//! 错误类型定义

use thiserror::Error;

/// 专利工具错误类型
#[derive(Debug, Error)]
pub enum Error {
    /// 搜索错误
    #[error("搜索错误: {0}")]
    Search(String),

    /// 生成错误
    #[error("生成错误: {0}")]
    Generation(String),

    /// 分析错误
    #[error("分析错误: {0}")]
    Analysis(String),

    /// 网络错误
    #[error("网络错误: {0}")]
    Network(#[from] reqwest::Error),

    /// JSON 解析错误
    #[error("JSON 解析错误: {0}")]
    Json(#[from] serde_json::Error),

    /// IO 错误
    #[error("IO 错误: {0}")]
    Io(#[from] std::io::Error),

    /// 其他错误
    #[error("未知错误: {0}")]
    Other(String),
}

/// 结果类型
pub type Result<T> = std::result::Result<T, Error>;
