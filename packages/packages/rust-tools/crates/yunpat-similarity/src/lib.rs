/**
 * YunPat Similarity - 高性能向量相似度计算
 */

use std::ffi::c_double;
use std::os::raw::c_int;

#[repr(C)]
pub struct SimilarityResult {
    pub index: u32,
    pub score: f64,
}

pub fn cosine_similarity(vec1: &[f64], vec2: &[f64]) -> f64 {
    let dot_product: f64 = vec1.iter().zip(vec2.iter()).map(|(a, b)| a * b).sum();
    let norm1: f64 = vec1.iter().map(|x| x * x).sum::<f64>().sqrt();
    let norm2: f64 = vec2.iter().map(|x| x * x).sum::<f64>().sqrt();
    
    if norm1 == 0.0 || norm2 == 0.0 {
        return 0.0;
    }
    
    dot_product / (norm1 * norm2)
}

#[no_mangle]
pub extern "C" fn calculate_similarity(
    vec1: *const c_double,
    vec2: *const c_double,
    len: c_int,
) -> f64 {
    unsafe {
        // 空指针验证和长度检查：防止段错误和内存访问越界
        if vec1.is_null() || vec2.is_null() || len <= 0 {
            return 0.0;
        }

        let slice1 = std::slice::from_raw_parts(vec1, len as usize);
        let slice2 = std::slice::from_raw_parts(vec2, len as usize);
        cosine_similarity(slice1, slice2)
    }
}
