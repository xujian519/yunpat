use serde::{Deserialize, Serialize};
use tokio_postgres::Client;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatentDbRecord {
    pub id: String,
    pub patent_name: String,
    pub patent_type: Option<String>,
    pub abstract_text: Option<String>,
    pub claims: Option<String>,
    pub applicant: Option<String>,
    pub inventor: Option<String>,
    pub ipc_code: Option<String>,
    pub ipc_main_class: Option<String>,
    pub publication_number: Option<String>,
    pub application_number: Option<String>,
    pub publication_date: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatentDbSearchResult {
    pub patents: Vec<PatentDbRecord>,
    pub total: i64,
    pub page: i32,
    pub page_size: i32,
}

pub struct PatentDatabase {
    client: Client,
}

const SELECT_COLUMNS: &str = "id, patent_name, patent_type, abstract, claims, applicant, inventor, ipc_code, ipc_main_class, publication_number, application_number, publication_date, created_at";

impl PatentDatabase {
    pub async fn connect(connection_string: &str) -> anyhow::Result<Self> {
        let (client, connection) =
            tokio_postgres::connect(connection_string, tokio_postgres::NoTls).await?;

        tokio::spawn(async move {
            if let Err(e) = connection.await {
                eprintln!("数据库连接错误: {}", e);
            }
        });

        Ok(Self { client })
    }

    pub async fn search_fulltext(
        &self,
        keyword: &str,
        page: i32,
        page_size: i32,
    ) -> anyhow::Result<PatentDbSearchResult> {
        let offset = (page - 1) * page_size;

        let count_sql =
            "SELECT COUNT(*) FROM patents WHERE search_vector @@ plainto_tsquery('chinese', $1)";
        let row = self.client.query_one(count_sql, &[&keyword]).await?;
        let total: i64 = row.get(0);

        let query_sql = format!(
            "SELECT {} FROM patents WHERE search_vector @@ plainto_tsquery('chinese', $1) ORDER BY publication_date DESC NULLS LAST LIMIT $2 OFFSET $3",
            SELECT_COLUMNS
        );
        let rows = self
            .client
            .query(
                &query_sql,
                &[&keyword, &i64::from(page_size), &i64::from(offset)],
            )
            .await?;

        Ok(PatentDbSearchResult {
            patents: rows.iter().map(Self::row_to_record).collect(),
            total,
            page,
            page_size,
        })
    }

    pub async fn search_by_keyword(
        &self,
        keyword: &str,
        page: i32,
        page_size: i32,
    ) -> anyhow::Result<PatentDbSearchResult> {
        self.search_by_field(
            "patent_name ILIKE $1 OR abstract ILIKE $1",
            &format!("%{keyword}%"),
            page,
            page_size,
        )
        .await
    }

    pub async fn search_by_ipc(
        &self,
        ipc_code: &str,
        page: i32,
        page_size: i32,
    ) -> anyhow::Result<PatentDbSearchResult> {
        self.search_by_field(
            "ipc_code ILIKE $1 OR ipc_main_class ILIKE $1",
            &format!("%{ipc_code}%"),
            page,
            page_size,
        )
        .await
    }

    pub async fn search_by_applicant(
        &self,
        applicant: &str,
        page: i32,
        page_size: i32,
    ) -> anyhow::Result<PatentDbSearchResult> {
        self.search_by_field(
            "applicant ILIKE $1",
            &format!("%{applicant}%"),
            page,
            page_size,
        )
        .await
    }

    async fn search_by_field(
        &self,
        where_clause: &str,
        pattern: &str,
        page: i32,
        page_size: i32,
    ) -> anyhow::Result<PatentDbSearchResult> {
        let offset = (page - 1) * page_size;

        let count_sql = format!("SELECT COUNT(*) FROM patents WHERE {}", where_clause);
        let row = self.client.query_one(&count_sql, &[&pattern]).await?;
        let total: i64 = row.get(0);

        let query_sql = format!(
            "SELECT {} FROM patents WHERE {} ORDER BY publication_date DESC NULLS LAST LIMIT $2 OFFSET $3",
            SELECT_COLUMNS, where_clause
        );
        let rows = self
            .client
            .query(
                &query_sql,
                &[&pattern, &i64::from(page_size), &i64::from(offset)],
            )
            .await?;

        Ok(PatentDbSearchResult {
            patents: rows.iter().map(Self::row_to_record).collect(),
            total,
            page,
            page_size,
        })
    }

    pub async fn get_patent_by_publication_number(
        &self,
        pub_number: &str,
    ) -> anyhow::Result<Option<PatentDbRecord>> {
        let sql = format!(
            "SELECT {} FROM patents WHERE publication_number = $1",
            SELECT_COLUMNS
        );
        let row = self.client.query_opt(&sql, &[&pub_number]).await?;

        Ok(row.as_ref().map(Self::row_to_record))
    }

    fn row_to_record(row: &tokio_postgres::Row) -> PatentDbRecord {
        let id: uuid::Uuid = row.get("id");
        PatentDbRecord {
            id: id.to_string(),
            patent_name: row.get("patent_name"),
            patent_type: row.get("patent_type"),
            abstract_text: row.get("abstract"),
            claims: row.get("claims"),
            applicant: row.get("applicant"),
            inventor: row.get("inventor"),
            ipc_code: row.get::<_, Option<String>>("ipc_code"),
            ipc_main_class: row.get::<_, Option<String>>("ipc_main_class"),
            publication_number: row.get::<_, Option<String>>("publication_number"),
            application_number: row.get::<_, Option<String>>("application_number"),
            publication_date: row
                .get::<_, Option<chrono::NaiveDate>>("publication_date")
                .map(|d| d.to_string()),
            created_at: row
                .get::<_, Option<chrono::NaiveDateTime>>("created_at")
                .map(|d| d.to_string()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_patent_db_record_serialization() {
        let record = PatentDbRecord {
            id: "CN123456789A".to_string(),
            patent_name: "测试专利".to_string(),
            patent_type: Some("发明专利".to_string()),
            abstract_text: Some("这是一个测试专利的摘要".to_string()),
            claims: Some("1. 一种测试方法...".to_string()),
            applicant: Some("测试公司".to_string()),
            inventor: Some("张三".to_string()),
            ipc_code: Some("G06N".to_string()),
            ipc_main_class: Some("G06N".to_string()),
            publication_number: Some("CN123456789A".to_string()),
            application_number: Some("202410000000".to_string()),
            publication_date: Some("2024-01-01".to_string()),
            created_at: Some("2024-01-01T00:00:00".to_string()),
        };

        let json = serde_json::to_string(&record).expect("序列化失败");
        assert!(json.contains("测试专利"));
        assert!(json.contains("CN123456789A"));
    }

    #[test]
    fn test_patent_db_search_result_serialization() {
        let result = PatentDbSearchResult {
            patents: vec![],
            total: 0,
            page: 1,
            page_size: 10,
        };

        let json = serde_json::to_string(&result).expect("序列化失败");
        assert!(json.contains("\"total\":0"));
    }

    #[tokio::test]
    #[ignore = "需要本地 PostgreSQL 专利数据库"]
    async fn test_local_patent_db_search() {
        let db = PatentDatabase::connect("host=localhost port=5432 dbname=patent_db user=xujian")
            .await
            .expect("连接数据库失败");

        let result = db.search_fulltext("人工智能", 1, 5).await;
        assert!(result.is_ok(), "搜索失败: {:?}", result.err());

        let search_result = result.expect("已验证 is_ok");
        println!("找到 {} 条专利", search_result.total);
        assert!(search_result.total >= 0);
    }
}
