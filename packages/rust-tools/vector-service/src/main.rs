use std::collections::HashMap;
use tonic::transport::Server;

pub mod vector {
    tonic::include_proto!("yunpat.vector");
}

use crate::vector::vector_service_server::{VectorService as VectorTrait, VectorServiceServer as VectorServer};
use crate::vector::*;

#[derive(Debug, Default)]
pub struct VectorServiceImpl {
    vectors: HashMap<String, Vec<f32>>,
}

#[tonic::async_trait]
impl VectorTrait for VectorServiceImpl {
    async fn add_vector(
        &self,
        request: tonic::Request<AddVectorRequest>,
    ) -> Result<tonic::Response<AddVectorResponse>, tonic::Status> {
        let req = request.into_inner();
        println!("📝 Adding vector: {}", req.id);

        Ok(tonic::Response::new(AddVectorResponse {
            success: true,
            message: format!("Vector {} added successfully", req.id),
        }))
    }

    async fn add_vectors(
        &self,
        request: tonic::Request<AddVectorsRequest>,
    ) -> Result<tonic::Response<AddVectorsResponse>, tonic::Status> {
        let req = request.into_inner();
        let count = req.vectors.len() as i32;
        println!("📝 Adding {} vectors", count);

        Ok(tonic::Response::new(AddVectorsResponse {
            added_count: count,
            failed_ids: vec![],
        }))
    }

    async fn search(
        &self,
        request: tonic::Request<SearchRequest>,
    ) -> Result<tonic::Response<SearchResponse>, tonic::Status> {
        let req = request.into_inner();
        println!("🔍 Searching vectors: top_k={}", req.top_k);

        let results = vec![
            SearchResult {
                id: "doc-001".to_string(),
                score: 0.95,
                vector: vec![],
                metadata: HashMap::new(),
            },
            SearchResult {
                id: "doc-002".to_string(),
                score: 0.87,
                vector: vec![],
                metadata: HashMap::new(),
            },
        ];

        Ok(tonic::Response::new(SearchResponse {
            results,
            total_count: 2,
            search_time_ms: 10,
        }))
    }

    async fn delete_vector(
        &self,
        request: tonic::Request<DeleteVectorRequest>,
    ) -> Result<tonic::Response<DeleteVectorResponse>, tonic::Status> {
        let req = request.into_inner();
        println!("🗑️  Deleting vector: {}", req.id);

        Ok(tonic::Response::new(DeleteVectorResponse {
            success: true,
            message: format!("Vector {} deleted", req.id),
        }))
    }

    async fn get_vector(
        &self,
        request: tonic::Request<GetVectorRequest>,
    ) -> Result<tonic::Response<GetVectorResponse>, tonic::Status> {
        let req = request.into_inner();
        println!("📖 Getting vector: {}", req.id);

        Ok(tonic::Response::new(GetVectorResponse {
            id: req.id,
            vector: vec![],
            metadata: HashMap::new(),
        }))
    }

    async fn get_index_stats(
        &self,
        _request: tonic::Request<GetIndexStatsRequest>,
    ) -> Result<tonic::Response<GetIndexStatsResponse>, tonic::Status> {
        println!("📊 Getting index stats");

        Ok(tonic::Response::new(GetIndexStatsResponse {
            total_vectors: 0,
            dimension: 768,
            index_size_bytes: 0,
            memory_usage_mb: 0.0,
            metrics: HashMap::new(),
        }))
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let addr = "[::1]:50051".parse()?;
    let vector_service = VectorServiceImpl::default();

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
