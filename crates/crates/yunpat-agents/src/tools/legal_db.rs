//! Legal World Model database — queries against `legal_world_model` PostgreSQL.
//!
//! Tables:
//! - `legal_articles_v2` — 法律条文（295K+ 条）
//! - `legal_documents` — 法律文书
//! - `openclaw_kg_nodes` / `openclaw_kg_edges` — 知识图谱

use serde::{Deserialize, Serialize};
use tokio_postgres::Client;

// === Data types ===

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LegalArticle {
    pub article_id: String,
    pub law_id: Option<String>,
    pub law_title: Option<String>,
    pub law_importance: Option<String>,
    pub article_number: Option<String>,
    pub article_title: Option<String>,
    pub content: Option<String>,
    pub category: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LegalDocument {
    pub id: String,
    pub title: String,
    pub document_type: Option<String>,
    pub domain: Option<String>,
    pub issuing_authority: Option<String>,
    pub effective_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KgNode {
    pub node_id: String,
    pub node_type: String,
    pub name: String,
    pub title: String,
    pub content: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LegalSearchResult {
    pub articles: Vec<LegalArticle>,
    pub documents: Vec<LegalDocument>,
    pub kg_nodes: Vec<KgNode>,
    pub total_articles: i64,
}

// === Database ===

pub struct LegalDatabase {
    client: Client,
}

impl LegalDatabase {
    pub async fn connect(connection_string: &str) -> anyhow::Result<Self> {
        let (client, connection) =
            tokio_postgres::connect(connection_string, tokio_postgres::NoTls).await?;

        tokio::spawn(async move {
            if let Err(e) = connection.await {
                eprintln!("legal_world_model 连接错误: {}", e);
            }
        });

        Ok(Self { client })
    }

    /// Full-text search across legal articles using Chinese tsvector.
    pub async fn search_articles(
        &self,
        keyword: &str,
        page: i32,
        page_size: i32,
    ) -> anyhow::Result<(Vec<LegalArticle>, i64)> {
        let offset = (page - 1) * page_size;

        let count_sql =
            "SELECT COUNT(*) FROM legal_articles_v2 WHERE to_tsvector('chinese', content) @@ plainto_tsquery('chinese', $1)
             OR law_title ILIKE $2 OR article_title ILIKE $2";
        let pattern = format!("%{keyword}%");
        let row = self.client.query_one(count_sql, &[&keyword, &pattern]).await?;
        let total: i64 = row.get(0);

        let query_sql = "SELECT article_id, law_id, law_title, law_importance, article_number, \
             article_title, content, category \
             FROM legal_articles_v2 \
             WHERE to_tsvector('chinese', content) @@ plainto_tsquery('chinese', $1) \
             OR law_title ILIKE $2 OR article_title ILIKE $2 \
             ORDER BY law_importance NULLS LAST, article_order NULLS LAST \
             LIMIT $3 OFFSET $4";
        let rows = self
            .client
            .query(
                query_sql,
                &[
                    &keyword,
                    &pattern,
                    &i64::from(page_size),
                    &i64::from(offset),
                ],
            )
            .await?;

        let articles = rows.iter().map(Self::row_to_article).collect();
        Ok((articles, total))
    }

    /// Search legal documents by title or content keyword.
    pub async fn search_documents(
        &self,
        keyword: &str,
        limit: i32,
    ) -> anyhow::Result<Vec<LegalDocument>> {
        let pattern = format!("%{keyword}%");
        let sql = "SELECT id, title, document_type, domain, issuing_authority, effective_date \
             FROM legal_documents \
             WHERE title ILIKE $1 \
             ORDER BY effective_date DESC NULLS LAST \
             LIMIT $2";
        let rows = self.client.query(sql, &[&pattern, &i64::from(limit)]).await?;
        Ok(rows.iter().map(Self::row_to_document).collect())
    }

    /// Search knowledge graph nodes by name or content.
    pub async fn search_kg_nodes(&self, keyword: &str, limit: i32) -> anyhow::Result<Vec<KgNode>> {
        let pattern = format!("%{keyword}%");
        let sql = "SELECT node_id, node_type, name, title, content \
             FROM openclaw_kg_nodes \
             WHERE name ILIKE $1 OR title ILIKE $1 \
             LIMIT $2";
        let rows = self.client.query(sql, &[&pattern, &i64::from(limit)]).await?;
        Ok(rows.iter().map(Self::row_to_kg_node).collect())
    }

    /// Combined search across all legal data sources.
    pub async fn search_all(
        &self,
        keyword: &str,
        article_limit: i32,
        doc_limit: i32,
        kg_limit: i32,
    ) -> anyhow::Result<LegalSearchResult> {
        let (articles, total_articles) = self.search_articles(keyword, 1, article_limit).await?;
        let documents = self.search_documents(keyword, doc_limit).await?;
        let kg_nodes = self.search_kg_nodes(keyword, kg_limit).await?;

        Ok(LegalSearchResult {
            articles,
            documents,
            kg_nodes,
            total_articles,
        })
    }

    fn row_to_article(row: &tokio_postgres::Row) -> LegalArticle {
        LegalArticle {
            article_id: row.get("article_id"),
            law_id: row.get("law_id"),
            law_title: row.get("law_title"),
            law_importance: row.get("law_importance"),
            article_number: row.get("article_number"),
            article_title: row.get("article_title"),
            content: row.get::<_, Option<String>>("content").map(|c| c.chars().take(500).collect()),
            category: row.get("category"),
        }
    }

    fn row_to_document(row: &tokio_postgres::Row) -> LegalDocument {
        let id: uuid::Uuid = row.get("id");
        LegalDocument {
            id: id.to_string(),
            title: row.get("title"),
            document_type: row.get("document_type"),
            domain: row.get("domain"),
            issuing_authority: row.get("issuing_authority"),
            effective_date: row
                .get::<_, Option<chrono::NaiveDate>>("effective_date")
                .map(|d| d.to_string()),
        }
    }

    fn row_to_kg_node(row: &tokio_postgres::Row) -> KgNode {
        KgNode {
            node_id: row.get("node_id"),
            node_type: row.get("node_type"),
            name: row.get("name"),
            title: row.get("title"),
            content: row.get::<_, Option<String>>("content").map(|c| c.chars().take(300).collect()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_legal_article_serialization() {
        let article = LegalArticle {
            article_id: "patent_law_22".to_string(),
            law_id: Some("专利法".to_string()),
            law_title: Some("中华人民共和国专利法".to_string()),
            law_importance: Some("法律".to_string()),
            article_number: Some("第二十二条".to_string()),
            article_title: Some("创造性".to_string()),
            content: Some("创造性，是指与现有技术相比...".to_string()),
            category: Some("实体条件".to_string()),
        };
        let json = serde_json::to_string(&article).expect("序列化失败");
        assert!(json.contains("专利法"));
        assert!(json.contains("创造性"));
    }

    #[tokio::test]
    #[ignore = "需要本地 PostgreSQL legal_world_model 数据库"]
    async fn test_local_legal_db_search() {
        let db =
            LegalDatabase::connect("host=localhost port=5432 dbname=legal_world_model user=xujian")
                .await
                .expect("连接数据库失败");

        let result = db.search_all("创造性", 5, 3, 3).await;
        assert!(result.is_ok(), "搜索失败: {:?}", result.err());

        let search_result = result.expect("已验证 is_ok");
        println!(
            "条文: {}, 文书: {}, 知识图谱: {}",
            search_result.total_articles,
            search_result.documents.len(),
            search_result.kg_nodes.len()
        );
        assert!(search_result.total_articles >= 0);
    }
}
