//! Vector semantic search for the knowledge base.
//!
//! Provides in-memory vector storage with cosine similarity search.
//! Phase 1: Pure HashMap storage with JSON persistence.
//! Future: SQLite + vec0 extension or dedicated vector DB.

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VectorDocument {
    pub doc_id: String,
    pub title: String,
    pub content: String,
    pub embedding: Vec<f32>,
    #[serde(default)]
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone)]
pub struct VectorSearchResult {
    pub doc: VectorDocument,
    pub similarity: f32,
}

pub struct VectorStore {
    documents: HashMap<String, VectorDocument>,
}

impl Default for VectorStore {
    fn default() -> Self {
        Self::new()
    }
}

impl VectorStore {
    pub fn new() -> Self {
        Self {
            documents: HashMap::new(),
        }
    }

    pub fn add_document(&mut self, doc: VectorDocument) {
        self.documents.insert(doc.doc_id.clone(), doc);
    }

    pub fn remove_document(&mut self, doc_id: &str) -> bool {
        self.documents.remove(doc_id).is_some()
    }

    pub fn get_document(&self, doc_id: &str) -> Option<&VectorDocument> {
        self.documents.get(doc_id)
    }

    pub fn len(&self) -> usize {
        self.documents.len()
    }

    pub fn is_empty(&self) -> bool {
        self.documents.is_empty()
    }

    pub fn search(&self, query_embedding: &[f32], top_k: usize) -> Vec<VectorSearchResult> {
        if self.documents.is_empty() || query_embedding.is_empty() {
            return vec![];
        }

        let mut results: Vec<VectorSearchResult> = self
            .documents
            .values()
            .map(|doc| {
                let similarity = cosine_similarity(query_embedding, &doc.embedding);
                VectorSearchResult {
                    doc: doc.clone(),
                    similarity,
                }
            })
            .collect();

        results.sort_by(|a, b| {
            b.similarity
                .partial_cmp(&a.similarity)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        results.truncate(top_k);
        results
    }

    pub fn hybrid_search(
        &self,
        query_embedding: &[f32],
        keywords: &[String],
        top_k: usize,
        alpha: f32,
    ) -> Vec<VectorSearchResult> {
        if self.documents.is_empty() {
            return vec![];
        }

        let mut results: Vec<VectorSearchResult> = self
            .documents
            .values()
            .map(|doc| {
                let semantic_score = if query_embedding.is_empty() {
                    0.0
                } else {
                    cosine_similarity(query_embedding, &doc.embedding)
                };

                let keyword_score = if keywords.is_empty() {
                    0.0
                } else {
                    score_keywords(&doc.content, keywords)
                };

                let hybrid_score = alpha * semantic_score + (1.0 - alpha) * keyword_score;

                VectorSearchResult {
                    doc: doc.clone(),
                    similarity: hybrid_score,
                }
            })
            .collect();

        results.sort_by(|a, b| {
            b.similarity
                .partial_cmp(&a.similarity)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        results.truncate(top_k);
        results
    }

    pub fn list_ids(&self) -> Vec<String> {
        self.documents.keys().cloned().collect()
    }

    pub fn to_json(&self) -> Result<Vec<u8>> {
        let docs: Vec<&VectorDocument> = self.documents.values().collect();
        Ok(serde_json::to_vec(&docs)?)
    }

    pub fn from_json(data: &[u8]) -> Result<Self> {
        let docs: Vec<VectorDocument> = serde_json::from_slice(data)?;
        let mut store = Self::new();
        for doc in docs {
            store.add_document(doc);
        }
        Ok(store)
    }
}

pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }

    let mut dot_product = 0.0f32;
    let mut norm_a = 0.0f32;
    let mut norm_b = 0.0f32;

    for (x, y) in a.iter().zip(b.iter()) {
        dot_product += x * y;
        norm_a += x * x;
        norm_b += y * y;
    }

    let denom = norm_a.sqrt() * norm_b.sqrt();
    if denom == 0.0 {
        0.0
    } else {
        dot_product / denom
    }
}

fn score_keywords(content: &str, keywords: &[String]) -> f32 {
    if keywords.is_empty() {
        return 0.0;
    }

    let lower = content.to_lowercase();
    let matched = keywords
        .iter()
        .filter(|kw| lower.contains(kw.to_lowercase().as_str()))
        .count();

    matched as f32 / keywords.len() as f32
}

#[cfg(test)]
mod tests {
    use super::*;

    fn vec_3d(x: f32, y: f32, z: f32) -> Vec<f32> {
        vec![x, y, z]
    }

    #[test]
    fn test_cosine_similarity_identical() {
        let a = vec_3d(1.0, 0.0, 0.0);
        let b = vec_3d(1.0, 0.0, 0.0);
        assert!((cosine_similarity(&a, &b) - 1.0).abs() < 1e-6);
    }

    #[test]
    fn test_cosine_similarity_orthogonal() {
        let a = vec_3d(1.0, 0.0, 0.0);
        let b = vec_3d(0.0, 1.0, 0.0);
        assert!(cosine_similarity(&a, &b).abs() < 1e-6);
    }

    #[test]
    fn test_cosine_similarity_opposite() {
        let a = vec_3d(1.0, 0.0, 0.0);
        let b = vec_3d(-1.0, 0.0, 0.0);
        assert!((cosine_similarity(&a, &b) + 1.0).abs() < 1e-6);
    }

    #[test]
    fn test_vector_store_add_and_search() {
        let mut store = VectorStore::new();

        store.add_document(VectorDocument {
            doc_id: "doc1".to_string(),
            title: "人工智能".to_string(),
            content: "关于人工智能的文档".to_string(),
            embedding: vec_3d(1.0, 0.0, 0.0),
            metadata: HashMap::new(),
        });

        store.add_document(VectorDocument {
            doc_id: "doc2".to_string(),
            title: "区块链".to_string(),
            content: "关于区块链的文档".to_string(),
            embedding: vec_3d(0.0, 1.0, 0.0),
            metadata: HashMap::new(),
        });

        store.add_document(VectorDocument {
            doc_id: "doc3".to_string(),
            title: "机器学习".to_string(),
            content: "关于机器学习的文档".to_string(),
            embedding: vec_3d(0.9, 0.1, 0.0),
            metadata: HashMap::new(),
        });

        let query = vec_3d(1.0, 0.0, 0.0);
        let results = store.search(&query, 2);

        assert_eq!(results.len(), 2);
        assert_eq!(results[0].doc.doc_id, "doc1");
        assert!(results[0].similarity > 0.99);
        assert_eq!(results[1].doc.doc_id, "doc3");
    }

    #[test]
    fn test_vector_store_remove() {
        let mut store = VectorStore::new();
        store.add_document(VectorDocument {
            doc_id: "doc1".to_string(),
            title: "Test".to_string(),
            content: "Content".to_string(),
            embedding: vec![1.0, 0.0],
            metadata: HashMap::new(),
        });

        assert_eq!(store.len(), 1);
        assert!(store.remove_document("doc1"));
        assert_eq!(store.len(), 0);
        assert!(!store.remove_document("doc1"));
    }

    #[test]
    fn test_hybrid_search() {
        let mut store = VectorStore::new();

        store.add_document(VectorDocument {
            doc_id: "doc1".to_string(),
            title: "人工智能专利".to_string(),
            content: "关于人工智能专利的文档".to_string(),
            embedding: vec_3d(1.0, 0.0, 0.0),
            metadata: HashMap::new(),
        });

        store.add_document(VectorDocument {
            doc_id: "doc2".to_string(),
            title: "区块链技术".to_string(),
            content: "关于区块链技术的文档".to_string(),
            embedding: vec_3d(0.0, 1.0, 0.0),
            metadata: HashMap::new(),
        });

        let query = vec_3d(1.0, 0.0, 0.0);
        let keywords = vec!["专利".to_string()];
        let results = store.hybrid_search(&query, &keywords, 2, 0.5);

        assert_eq!(results.len(), 2);
        assert_eq!(results[0].doc.doc_id, "doc1");
    }

    #[test]
    fn test_json_persistence() {
        let mut store = VectorStore::new();
        store.add_document(VectorDocument {
            doc_id: "doc1".to_string(),
            title: "Test".to_string(),
            content: "Content".to_string(),
            embedding: vec![1.0, 0.0, 0.0],
            metadata: HashMap::new(),
        });

        let json = store.to_json().unwrap();
        let restored = VectorStore::from_json(&json).unwrap();

        assert_eq!(restored.len(), 1);
        assert!(restored.get_document("doc1").is_some());
    }

    #[test]
    fn test_empty_store_search() {
        let store = VectorStore::new();
        let results = store.search(&[1.0, 0.0], 5);
        assert!(results.is_empty());
    }

    #[test]
    fn test_score_keywords() {
        let content = "人工智能和机器学习在专利中的应用";
        let keywords = vec![
            "人工智能".to_string(),
            "专利".to_string(),
            "区块链".to_string(),
        ];
        let score = score_keywords(content, &keywords);
        assert!((score - 0.6666667).abs() < 1e-6);
    }
}
