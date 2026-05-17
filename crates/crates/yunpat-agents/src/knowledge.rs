//! Local knowledge base reader for the Research Agent.
//!
//! Supports keyword matching and semantic search (when embedding provider is available).

use anyhow::{Context, Result};
use std::path::{Path, PathBuf};

use crate::context::EmbeddingProvider;
use crate::vector_store::{VectorDocument, VectorStore};

/// A chunk of knowledge base content matched by a query.
#[derive(Debug, Clone)]
pub struct KnowledgeChunk {
    pub file_path: String,
    pub title: String,
    pub content: String,
    pub relevance: f32,
}

/// Knowledge base with keyword and semantic search.
pub struct KnowledgeBase {
    base_dir: PathBuf,
    vector_store: VectorStore,
}

impl KnowledgeBase {
    pub fn new(base_dir: PathBuf) -> Self {
        Self {
            base_dir,
            vector_store: VectorStore::new(),
        }
    }

    /// Default knowledge base path.
    ///
    /// Checks `YUNPAT_KB_PATH` env var first, then falls back to
    /// `~/.yunpat/knowledge-base/`.
    pub fn default_path() -> Result<PathBuf> {
        if let Ok(p) = std::env::var("YUNPAT_KB_PATH") {
            let path = PathBuf::from(p);
            if path.is_absolute() {
                return Ok(path);
            }
        }
        let home = dirs::home_dir().context("failed to resolve home directory")?;
        Ok(home.join(".yunpat").join("knowledge-base"))
    }

    /// Create with the default path.
    pub fn default_kb() -> Result<Self> {
        Ok(Self::new(Self::default_path()?))
    }

    /// Search the knowledge base for chunks matching the given keywords.
    /// Returns results sorted by relevance (highest first).
    pub fn search(&self, query: &str, max_results: usize) -> Result<Vec<KnowledgeChunk>> {
        if !self.base_dir.exists() {
            return Ok(vec![]);
        }

        let keywords = extract_keywords(query);
        let mut results: Vec<KnowledgeChunk> = Vec::new();

        let entries = glob_kb_files(&self.base_dir)?;
        for path in entries {
            let content = std::fs::read_to_string(&path).unwrap_or_default();
            if content.is_empty() {
                continue;
            }

            let title = extract_title(&content).unwrap_or_else(|| {
                path.file_name().map(|f| f.to_string_lossy().to_string()).unwrap_or_default()
            });

            let score = score_content(&content, &keywords);
            if score > 0.0 {
                // Extract relevant sections (paragraphs containing keywords).
                let relevant_sections = extract_relevant_sections(&content, &keywords);
                results.push(KnowledgeChunk {
                    file_path: path.to_string_lossy().to_string(),
                    title,
                    content: relevant_sections,
                    relevance: score,
                });
            }
        }

        results.sort_by(|a, b| {
            b.relevance.partial_cmp(&a.relevance).unwrap_or(std::cmp::Ordering::Equal)
        });
        results.truncate(max_results);
        Ok(results)
    }

    /// List all files in the knowledge base.
    pub fn list_files(&self) -> Result<Vec<PathBuf>> {
        if !self.base_dir.exists() {
            return Ok(vec![]);
        }
        glob_kb_files(&self.base_dir)
    }

    /// Check if the knowledge base directory exists.
    pub fn exists(&self) -> bool {
        self.base_dir.exists()
    }

    /// Check if the vector index is populated.
    pub fn has_vector_index(&self) -> bool {
        !self.vector_store.is_empty()
    }

    /// Build vector index from all KB files using the embedding provider.
    pub fn build_vector_index(&mut self, embedder: &dyn EmbeddingProvider) -> Result<()> {
        let files = self.list_files()?;
        if files.is_empty() {
            return Ok(());
        }

        let mut texts = Vec::new();
        let mut metas: Vec<(String, String)> = Vec::new();

        for path in &files {
            let content = std::fs::read_to_string(path).unwrap_or_default();
            if content.is_empty() {
                continue;
            }
            let title = extract_title(&content).unwrap_or_else(|| {
                path.file_name().map(|f| f.to_string_lossy().to_string()).unwrap_or_default()
            });
            // Chunk into ~500 char segments for embedding.
            for chunk in content.as_bytes().chunks(500) {
                let chunk_str = String::from_utf8_lossy(chunk).to_string();
                texts.push(chunk_str);
                metas.push((path.to_string_lossy().to_string(), title.clone()));
            }
        }

        if texts.is_empty() {
            return Ok(());
        }

        let embeddings = embedder.embed(texts.clone())?;

        for (i, embedding) in embeddings.into_iter().enumerate() {
            let (file_path, title) = &metas[i];
            self.vector_store.add_document(VectorDocument {
                doc_id: format!("kb_{}", i),
                title: title.clone(),
                content: texts[i].clone(),
                embedding,
                metadata: {
                    let mut m = std::collections::HashMap::new();
                    m.insert("file_path".to_string(), file_path.clone());
                    m
                },
            });
        }

        Ok(())
    }

    /// Semantic search using embedding similarity.
    pub fn semantic_search(
        &self,
        query: &str,
        top_k: usize,
        embedder: &dyn EmbeddingProvider,
    ) -> Result<Vec<KnowledgeChunk>> {
        if self.vector_store.is_empty() {
            return Ok(vec![]);
        }

        let embeddings = embedder.embed(vec![query.to_string()])?;
        let query_embedding = match embeddings.first() {
            Some(e) => e.as_slice(),
            None => return Ok(vec![]),
        };

        let results = self.vector_store.search(query_embedding, top_k);
        Ok(results
            .into_iter()
            .map(|r| KnowledgeChunk {
                file_path: r.doc.metadata.get("file_path").cloned().unwrap_or_default(),
                title: r.doc.title,
                content: r.doc.content,
                relevance: r.similarity,
            })
            .collect())
    }

    /// Hybrid search combining keyword and semantic matching.
    pub fn hybrid_search(
        &self,
        query: &str,
        top_k: usize,
        embedder: &dyn EmbeddingProvider,
    ) -> Result<Vec<KnowledgeChunk>> {
        if self.vector_store.is_empty() {
            // Fall back to keyword search.
            return self.search(query, top_k);
        }

        let embeddings = embedder.embed(vec![query.to_string()])?;
        let query_embedding = match embeddings.first() {
            Some(e) => e.as_slice(),
            None => return self.search(query, top_k),
        };

        let keywords = extract_keywords(query);
        // alpha=0.7 gives more weight to semantic similarity.
        let results = self.vector_store.hybrid_search(query_embedding, &keywords, top_k, 0.7);

        Ok(results
            .into_iter()
            .map(|r| KnowledgeChunk {
                file_path: r.doc.metadata.get("file_path").cloned().unwrap_or_default(),
                title: r.doc.title,
                content: r.doc.content,
                relevance: r.similarity,
            })
            .collect())
    }
}

/// Find all markdown files in the knowledge base directory.
fn glob_kb_files(dir: &Path) -> Result<Vec<PathBuf>> {
    let mut files = Vec::new();
    if !dir.is_dir() {
        return Ok(files);
    }

    for entry in walkdir(dir) {
        let path = entry;
        if let Some(ext) = path.extension()
            && (ext == "md" || ext == "txt" || ext == "markdown")
        {
            files.push(path);
        }
    }

    // Sort by filename for deterministic ordering.
    files.sort();
    Ok(files)
}

/// Simple directory walker (no external dependency).
fn walkdir(dir: &Path) -> Vec<PathBuf> {
    let mut result = Vec::new();
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                result.extend(walkdir(&path));
            } else {
                result.push(path);
            }
        }
    }
    result
}

/// Extract keywords from a query string.
fn extract_keywords(query: &str) -> Vec<String> {
    // Split on whitespace and common punctuation, filter short words.
    query
        .split(|c: char| {
            c.is_whitespace() || c == '，' || c == '。' || c == '、' || c == ',' || c == '.'
        })
        .map(|s| s.trim().to_lowercase())
        .filter(|s| s.len() >= 2)
        .collect()
}

/// Extract the first H1 or H2 title from markdown content.
fn extract_title(content: &str) -> Option<String> {
    for line in content.lines() {
        let trimmed = line.trim();
        if let Some(title) = trimmed.strip_prefix("# ") {
            return Some(title.to_string());
        }
        if let Some(title) = trimmed.strip_prefix("## ") {
            return Some(title.to_string());
        }
    }
    None
}

/// Score content relevance based on keyword frequency.
fn score_content(content: &str, keywords: &[String]) -> f32 {
    if keywords.is_empty() {
        return 0.0;
    }

    let lower = content.to_lowercase();
    let mut total_hits = 0;
    let mut keywords_matched = 0;

    for kw in keywords {
        let count = lower.matches(kw.as_str()).count();
        if count > 0 {
            keywords_matched += 1;
            total_hits += count;
        }
    }

    if keywords_matched == 0 {
        return 0.0;
    }

    // Score: coverage ratio * log(1 + hit count)
    let coverage = keywords_matched as f32 / keywords.len() as f32;
    let density = (1.0 + total_hits as f32).ln();
    coverage * density
}

/// Extract paragraphs that contain at least one keyword.
fn extract_relevant_sections(content: &str, keywords: &[String]) -> String {
    let paragraphs: Vec<&str> = content.split("\n\n").collect();
    let lower_keywords: Vec<String> = keywords.iter().map(|k| k.to_lowercase()).collect();

    let relevant: Vec<&str> = paragraphs
        .into_iter()
        .filter(|para| {
            let lower = para.to_lowercase();
            lower_keywords.iter().any(|kw| lower.contains(kw.as_str()))
        })
        .collect();

    // If nothing matched, return the first 500 chars as context.
    if relevant.is_empty() {
        return content.chars().take(500).collect();
    }

    // Limit total size.
    let combined: String = relevant.join("\n\n");
    if combined.len() > 2000 {
        combined.chars().take(2000).collect()
    } else {
        combined
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_keywords() {
        let kws = extract_keywords("新用途 专利 创造性");
        assert!(kws.contains(&"新用途".to_string()));
        assert!(kws.contains(&"专利".to_string()));
        assert!(kws.contains(&"创造性".to_string()));
    }

    #[test]
    fn test_extract_keywords_filters_short() {
        let kws = extract_keywords("a b 专利");
        assert!(!kws.contains(&"a".to_string()));
        assert!(kws.contains(&"专利".to_string()));
    }

    #[test]
    fn test_extract_title() {
        let content = "# 专利审查指南\n\nSome content";
        assert_eq!(extract_title(content), Some("专利审查指南".to_string()));
    }

    #[test]
    fn test_extract_title_h2() {
        let content = "## 子标题\n\nSome content";
        assert_eq!(extract_title(content), Some("子标题".to_string()));
    }

    #[test]
    fn test_extract_title_none() {
        let content = "No title here\nJust text";
        assert_eq!(extract_title(content), None);
    }

    #[test]
    fn test_score_content() {
        let content = "专利创造性判断标准\n新用途专利的创造性要求";
        let kws = extract_keywords("专利 创造性");
        let score = score_content(content, &kws);
        assert!(score > 0.0);
    }

    #[test]
    fn test_score_content_no_match() {
        let content = "今天天气很好";
        let kws = extract_keywords("专利 创造性");
        let score = score_content(content, &kws);
        assert_eq!(score, 0.0);
    }

    #[test]
    fn test_extract_relevant_sections() {
        let content = "第一段关于专利的内容\n\n第二段无关内容\n\n第三段关于创造性的内容";
        let kws = extract_keywords("专利 创造性");
        let sections = extract_relevant_sections(content, &kws);
        assert!(sections.contains("专利"));
        assert!(sections.contains("创造性"));
    }
}
