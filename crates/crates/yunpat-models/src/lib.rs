//! YunPat Models — Multi-provider ModelProvider interface.
//!
//! Provides a unified `ModelProvider` trait with implementations for
//! OpenAI-compatible APIs (DeepSeek, Zhipu, Moonshot, Doubao, local models).
//!
//! Features:
//! - Lazy provider initialization
//! - Streaming chat completions
//! - Multimodal (image + text) support
//! - Embedding generation
//! - Optional reranking

pub mod config_builder;
pub mod openai_compat;
pub mod provider;
pub mod sse;
pub mod types;

pub use openai_compat::OpenAICompatProvider;
pub use provider::ModelProvider;
pub use types::*;
