//! 数据分析工具
//!
//! 纯 Rust 实现的统计分析，不依赖外部服务

/// 数据点数量上限（防止 DoS）
const MAX_DATA_POINTS: usize = 1_000_000;

/// 统计分析结果
#[derive(Debug)]
pub struct AnalysisResult {
    pub count: usize,
    pub mean: f64,
    pub std: f64,
    pub median: f64,
    pub min: f64,
    pub max: f64,
    pub q1: f64,
    pub q3: f64,
}

/// 对数值数据进行统计分析
pub fn analyze_data(data: &[f64]) -> Result<AnalysisResult, String> {
    let count = data.len();
    if count == 0 {
        return Ok(AnalysisResult {
            count: 0,
            mean: 0.0,
            std: 0.0,
            median: 0.0,
            min: 0.0,
            max: 0.0,
            q1: 0.0,
            q3: 0.0,
        });
    }

    if count > MAX_DATA_POINTS {
        return Err(format!(
            "Data points ({}) exceed limit ({})",
            count, MAX_DATA_POINTS
        ));
    }

    // 检查 NaN/Inf
    if data.iter().any(|x| !x.is_finite()) {
        return Err("Data contains non-finite values (NaN or Inf)".to_string());
    }

    // 排序用于分位数计算
    let mut sorted = data.to_vec();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

    let mean = sorted.iter().sum::<f64>() / count as f64;
    let variance = sorted.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / count as f64;
    let std = variance.sqrt();

    let median = percentile(&sorted, 50.0);
    let q1 = percentile(&sorted, 25.0);
    let q3 = percentile(&sorted, 75.0);

    Ok(AnalysisResult {
        count,
        mean,
        std,
        median,
        min: sorted[0],
        max: sorted[count - 1],
        q1,
        q3,
    })
}

/// 计算百分位数（线性插值法）
fn percentile(sorted: &[f64], p: f64) -> f64 {
    if sorted.len() == 1 {
        return sorted[0];
    }
    let idx = (p / 100.0) * (sorted.len() - 1) as f64;
    let lower = idx.floor() as usize;
    let upper = idx.ceil() as usize;
    let frac = idx - lower as f64;

    if upper >= sorted.len() {
        sorted[sorted.len() - 1]
    } else {
        sorted[lower] * (1.0 - frac) + sorted[upper] * frac
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_stats() {
        let data = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let stats = analyze_data(&data).unwrap();
        assert_eq!(stats.count, 5);
        assert!((stats.mean - 3.0).abs() < 0.001);
        assert!((stats.median - 3.0).abs() < 0.001);
        assert!((stats.min - 1.0).abs() < 0.001);
        assert!((stats.max - 5.0).abs() < 0.001);
    }

    #[test]
    fn test_empty_data() {
        let stats = analyze_data(&[]).unwrap();
        assert_eq!(stats.count, 0);
    }

    #[test]
    fn test_single_value() {
        let stats = analyze_data(&[42.0]).unwrap();
        assert_eq!(stats.count, 1);
        assert!((stats.mean - 42.0).abs() < 0.001);
    }

    #[test]
    fn test_reject_nan() {
        let result = analyze_data(&[1.0, f64::NAN, 3.0]);
        assert!(result.is_err());
    }

    #[test]
    fn test_reject_overflow() {
        let data: Vec<f64> = (0..=MAX_DATA_POINTS).map(|i| i as f64).collect();
        let result = analyze_data(&data);
        assert!(result.is_err());
    }
}
