//! YunPat 文本相似度计算
//!
//! 提供多种文本相似度算法：余弦相似度、Jaccard 相似度、编辑距离

/// 计算两个向量的余弦相似度
///
/// 返回值范围 [-1.0, 1.0]，1.0 表示完全相同
pub fn cosine_similarity(a: &[f64], b: &[f64]) -> f64 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }
    let dot: f64 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let norm_a: f64 = a.iter().map(|v| v * v).sum::<f64>().sqrt();
    let norm_b: f64 = b.iter().map(|v| v * v).sum::<f64>().sqrt();
    if norm_a == 0.0 || norm_b == 0.0 {
        return 0.0;
    }
    dot / (norm_a * norm_b)
}

/// 计算 Jaccard 相似度（基于字符集合）
///
/// 返回值范围 [0.0, 1.0]
pub fn jaccard_similarity(a: &str, b: &str) -> f64 {
    use std::collections::HashSet;

    let set_a: HashSet<char> = a.chars().collect();
    let set_b: HashSet<char> = b.chars().collect();

    if set_a.is_empty() && set_b.is_empty() {
        return 1.0;
    }

    let intersection = set_a.intersection(&set_b).count();
    let union = set_a.union(&set_b).count();

    if union == 0 {
        return 0.0;
    }

    intersection as f64 / union as f64
}

/// 计算编辑距离（Levenshtein distance）
pub fn edit_distance(a: &str, b: &str) -> usize {
    let a_len = a.chars().count();
    let b_len = b.chars().count();

    if a_len == 0 {
        return b_len;
    }
    if b_len == 0 {
        return a_len;
    }

    let a_chars: Vec<char> = a.chars().collect();
    let b_chars: Vec<char> = b.chars().collect();

    // 使用两行 DP 优化空间
    let mut prev = vec![0usize; b_len + 1];
    let mut curr = vec![0usize; b_len + 1];

    for j in 0..=b_len {
        prev[j] = j;
    }

    for i in 1..=a_len {
        curr[0] = i;
        for j in 1..=b_len {
            let cost = if a_chars[i - 1] == b_chars[j - 1] { 0 } else { 1 };
            curr[j] = (prev[j] + 1) // deletion
                .min(curr[j - 1] + 1) // insertion
                .min(prev[j - 1] + cost); // substitution
        }
        std::mem::swap(&mut prev, &mut curr);
    }

    prev[b_len]
}

/// 基于编辑距离的归一化相似度
///
/// 返回值范围 [0.0, 1.0]，1.0 表示完全相同
pub fn normalized_edit_similarity(a: &str, b: &str) -> f64 {
    let a_len = a.chars().count();
    let b_len = b.chars().count();
    let max_len = a_len.max(b_len);

    if max_len == 0 {
        return 1.0;
    }

    1.0 - edit_distance(a, b) as f64 / max_len as f64
}

/// TF-IDF 文本相似度（基于词频）
///
/// 简化实现：使用 Jaccard 加权
pub fn text_similarity(a: &str, b: &str) -> f64 {
    // 综合多种相似度
    let jaccard = jaccard_similarity(a, b);
    let edit_sim = normalized_edit_similarity(a, b);

    // 加权平均：Jaccard 30% + 编辑距离 70%
    0.3 * jaccard + 0.7 * edit_sim
}

#[cfg(test)]
mod tests {
    use super::*;

    // ===== 余弦相似度测试 =====

    #[test]
    fn test_cosine_identical() {
        let vec = vec![1.0, 2.0, 3.0];
        let sim = cosine_similarity(&vec, &vec);
        assert!((sim - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_cosine_orthogonal() {
        let a = vec![1.0, 0.0];
        let b = vec![0.0, 1.0];
        let sim = cosine_similarity(&a, &b);
        assert!((sim - 0.0).abs() < 0.001);
    }

    #[test]
    fn test_cosine_opposite() {
        let a = vec![1.0, 0.0];
        let b = vec![-1.0, 0.0];
        let sim = cosine_similarity(&a, &b);
        assert!((sim - (-1.0)).abs() < 0.001);
    }

    #[test]
    fn test_cosine_different_lengths() {
        let a = vec![1.0, 2.0];
        let b = vec![1.0];
        let sim = cosine_similarity(&a, &b);
        assert_eq!(sim, 0.0);
    }

    #[test]
    fn test_cosine_empty() {
        let a: Vec<f64> = vec![];
        let b: Vec<f64> = vec![];
        let sim = cosine_similarity(&a, &b);
        assert_eq!(sim, 0.0);
    }

    #[test]
    fn test_cosine_zero_vectors() {
        let a = vec![0.0, 0.0];
        let b = vec![1.0, 2.0];
        let sim = cosine_similarity(&a, &b);
        assert_eq!(sim, 0.0);
    }

    // ===== Jaccard 相似度测试 =====

    #[test]
    fn test_jaccard_identical() {
        let sim = jaccard_similarity("hello", "hello");
        assert!((sim - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_jaccard_no_overlap() {
        let sim = jaccard_similarity("abc", "xyz");
        assert!((sim - 0.0).abs() < 0.001);
    }

    #[test]
    fn test_jaccard_empty() {
        let sim = jaccard_similarity("", "");
        assert!((sim - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_jaccard_partial() {
        let sim = jaccard_similarity("专利申请", "专利审查");
        // 共享字符: 专, 利
        assert!(sim > 0.0 && sim < 1.0);
    }

    // ===== 编辑距离测试 =====

    #[test]
    fn test_edit_distance_identical() {
        assert_eq!(edit_distance("hello", "hello"), 0);
    }

    #[test]
    fn test_edit_distance_empty() {
        assert_eq!(edit_distance("", "hello"), 5);
        assert_eq!(edit_distance("hello", ""), 5);
        assert_eq!(edit_distance("", ""), 0);
    }

    #[test]
    fn test_edit_distance_insertion() {
        assert_eq!(edit_distance("abc", "abdc"), 1);
    }

    #[test]
    fn test_edit_distance_deletion() {
        assert_eq!(edit_distance("abdc", "abc"), 1);
    }

    #[test]
    fn test_edit_distance_substitution() {
        assert_eq!(edit_distance("abc", "axc"), 1);
    }

    #[test]
    fn test_edit_distance_chinese() {
        assert_eq!(edit_distance("专利申请", "专利审查"), 2);
    }

    // ===== 归一化编辑相似度测试 =====

    #[test]
    fn test_normalized_edit_identical() {
        let sim = normalized_edit_similarity("测试", "测试");
        assert!((sim - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_normalized_edit_empty() {
        let sim = normalized_edit_similarity("", "");
        assert!((sim - 1.0).abs() < 0.001);
    }

    // ===== 文本相似度综合测试 =====

    #[test]
    fn test_text_similarity_identical() {
        let sim = text_similarity("专利申请文件", "专利申请文件");
        assert!((sim - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_text_similarity_similar() {
        let sim = text_similarity("专利申请", "专利审查");
        assert!(sim >= 0.4); // 应该有一定相似度
    }

    #[test]
    fn test_text_similarity_different() {
        let sim = text_similarity("专利申请", "机器学习");
        assert!(sim < 0.5); // 差异较大
    }
}
