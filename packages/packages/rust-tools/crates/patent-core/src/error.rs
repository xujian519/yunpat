use thiserror::Error;

#[derive(Error, Debug)]
pub enum Error {
    #[error("解析错误: {0}")]
    Parse(String),
    #[error("验证错误: {0}")]
    Validation(String),
    #[error("IO错误: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON错误: {0}")]
    Json(#[from] serde_json::Error),
    #[error("正则错误: {0}")]
    Regex(#[from] regex::Error),
}

pub type Result<T> = std::result::Result<T, Error>;
