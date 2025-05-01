//! YunPat 工具服务 - ML 工具核心实现
//!
//! 提供文本嵌入、文本分类、数据分析三种工具的 Rust 实现

pub mod tools {
    tonic::include_proto!("yunpat.tools");
}

pub mod common {
    tonic::include_proto!("yunpat.common");
}

pub mod analysis;
pub mod classification;
pub mod embedding;
