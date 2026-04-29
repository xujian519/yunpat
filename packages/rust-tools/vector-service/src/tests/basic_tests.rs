#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vector_service_creation() {
        let service = VectorService::default();
        assert!(service.vectors.is_empty());
    }
}
