use tonic::transport::Server;
use vector_service::vector_service_server::{Vector as VectorTrait, VectorServer};
use vector_service::{SearchRequest, SearchResponse, SearchResult, AddVectorRequest, AddVectorResponse};

pub mod vector {
    tonic::include_proto!("yunpat.vector");
}

#[derive(Debug, Default)]
pub struct VectorService {
    // 存储向量数据
    vectors: std::collections::HashMap<String, Vec<f32>>,
}

#[tonic::async_trait]
impl VectorTrait for VectorService {
    async fn add_vector(
        &self,
        request: tonic::Request<AddVectorRequest>,
    ) -> Result<tonic::Response<AddVectorResponse>, tonic::Status> {
        let req = request.into_inner();

        println!("📝 Adding vector: {}", req.id);

        // 模拟添加向量
        // 实际实现应该使用 HNSW 或其他向量索引

        Ok(tonic::Response::new(AddVectorResponse {
            success: true,
            message: format!("Vector {} added successfully", req.id),
        }))
    }

    async fn search(
        &self,
        request: tonic::Request<SearchRequest>,
    ) -> Result<tonic::Response<SearchResponse>, tonic::Status> {
        let req = request.into_inner();

        println!("🔍 Searching vectors: top_k={}", req.top_k);

        // 模拟搜索结果
        let results = vec![
            SearchResult {
                id: "doc-001".to_string(),
                score: 0.95,
                vector: vec![],
                metadata: vec![],
            },
            SearchResult {
                id: "doc-002".to_string(),
                score: 0.87,
                vector: vec![],
                metadata: vec![],
            },
        ];

        Ok(tonic::Response::new(SearchResponse {
            results,
            total_count: 2,
            search_time_ms: 10,
        }))
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let addr = "[::1]:50051".parse()?;
    let vector_service = VectorService::default();

    println!("╔════════════════════════════════════════╗");
    println!("║  YunPat Vector Service (Rust)          ║");
    println!("╚════════════════════════════════════════╝\n");
    println!("🚀 Vector Service starting on {}...\n", addr);

    Server::builder()
        .add_service(VectorServer::new(vector_service))
        .serve(addr)
        .await?;

    Ok(())
}
