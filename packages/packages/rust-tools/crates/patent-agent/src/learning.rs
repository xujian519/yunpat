//! 学习引擎

use crate::agent::TaskResult;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::fs;

/// 赫布学习引擎
///
/// 从成功的任务路径中学习，强化成功的决策模式
#[derive(Debug, Clone)]
pub struct HebbianLearner {
    /// 连接权重
    connections: HashMap<(String, String), HebbianConnection>,
    /// 学习率
    learning_rate: f64,
    /// 衰减率
    decay_rate: f64,
}

/// 赫布连接
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HebbianConnection {
    /// 权重
    pub weight: f64,
    /// 激活次数
    pub activation_count: usize,
    /// 最后激活时间
    pub last_activation: u64,
}

impl HebbianLearner {
    /// 创建新的学习引擎
    pub fn new(learning_rate: f64, decay_rate: f64) -> Self {
        Self {
            connections: HashMap::new(),
            learning_rate,
            decay_rate,
        }
    }

    /// 从任务结果中学习
    pub fn learn_from_result(
        &mut self,
        task_path: &TaskPath,
        result: &TaskResult,
    ) {
        let success = self.is_success(result);

        for (from, to) in &task_path.nodes {
            let key = (from.clone(), to.clone());
            let connection = self.connections.entry(key).or_insert(HebbianConnection {
                weight: 0.0,
                activation_count: 0,
                last_activation: 0,
            });

            if success {
                // 成功：强化连接
                connection.weight += self.learning_rate;
                connection.activation_count += 1;
                connection.last_activation = Self::current_timestamp();
            } else {
                // 失败：弱化连接
                connection.weight -= self.learning_rate * 0.5;
            }
        }

        // 应用衰减
        self.decay();
    }

    /// 预测任务成功率
    pub fn predict_success(&self, task_path: &TaskPath) -> f64 {
        let mut total_weight = 0.0;
        let mut count = 0;

        for (from, to) in &task_path.nodes {
            if let Some(connection) = self.connections.get(&(from.clone(), to.clone())) {
                total_weight += connection.weight;
                count += 1;
            }
        }

        if count == 0 {
            return 0.5; // 默认概率
        }

        // sigmoid 激活
        let avg_weight = total_weight / count as f64;
        1.0 / (1.0 + (-avg_weight).exp())
    }

    /// 获取建议的下一步
    pub fn suggest_next_step(&self, current_state: &str) -> Option<String> {
        let mut candidates: Vec<(String, f64)> = self
            .connections
            .iter()
            .filter(|((from, _), _)| from == current_state)
            .map(|((_, to), conn)| (to.clone(), conn.weight))
            .collect();

        candidates.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());

        candidates.first().map(|(step, _)| step.clone())
    }

    /// 保存学习结果
    pub fn save<P: AsRef<Path>>(&self, path: P) -> Result<(), String> {
        let json = serde_json::to_string_pretty(&self.connections)
            .map_err(|e| format!("序列化失败: {}", e))?;
        fs::write(path, json).map_err(|e| format!("写入失败: {}", e))?;
        Ok(())
    }

    /// 加载学习结果
    pub fn load<P: AsRef<Path>>(&mut self, path: P) -> Result<(), String> {
        let json = fs::read_to_string(path).map_err(|e| format!("读取失败: {}", e))?;
        self.connections = serde_json::from_str(&json)
            .map_err(|e| format!("反序列化失败: {}", e))?;
        Ok(())
    }

    /// 判断任务是否成功
    fn is_success(&self, result: &TaskResult) -> bool {
        match result {
            TaskResult::WritePatent(output) => {
                output.quality_assessment.overall_score >= 70.0
            }
            TaskResult::RespondToOfficeAction(_) => true, // TODO: 更详细的判断
            TaskResult::AnalyzePatent(_) => true,
            TaskResult::ManagePatent(_) => true,
        }
    }

    /// 应用衰减
    fn decay(&mut self) {
        for connection in self.connections.values_mut() {
            connection.weight *= 1.0 - self.decay_rate;
        }
    }

    /// 获取当前时间戳
    fn current_timestamp() -> u64 {
        use std::time::{SystemTime, UNIX_EPOCH};
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs()
    }
}

impl Default for HebbianLearner {
    fn default() -> Self {
        Self::new(0.1, 0.01)
    }
}

/// 任务路径
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskPath {
    /// 路径节点
    pub nodes: Vec<(String, String)>,
    /// 任务类型
    pub task_type: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_learn_from_result() {
        let mut learner = HebbianLearner::default();

        let task_path = TaskPath {
            nodes: vec![
                ("start".to_string(), "plan".to_string()),
                ("plan".to_string(), "act".to_string()),
            ],
            task_type: "write_patent".to_string(),
        };

        let result = TaskResult::WritePatent(crate::agent::WritePatentOutput {
            claims: vec![],
            quality_assessment: patent_tools::QualityAssessment {
                overall_score: 85.0,
                clarity_score: 90.0,
                support_score: 80.0,
                breadth_score: 85.0,
                issues: vec![],
            },
            specification: "测试".to_string(),
        });

        learner.learn_from_result(&task_path, &result);

        // 验证连接已创建
        assert_eq!(learner.connections.len(), 2);
    }

    #[test]
    fn test_predict_success() {
        let mut learner = HebbianLearner::default();

        let task_path = TaskPath {
            nodes: vec![("start".to_string(), "plan".to_string())],
            task_type: "write_patent".to_string(),
        };

        // 初始预测
        let prediction = learner.predict_success(&task_path);
        assert_eq!(prediction, 0.5);

        // 学习后预测
        let result = TaskResult::WritePatent(crate::agent::WritePatentOutput {
            claims: vec![],
            quality_assessment: patent_tools::QualityAssessment {
                overall_score: 85.0,
                clarity_score: 90.0,
                support_score: 80.0,
                breadth_score: 85.0,
                issues: vec![],
            },
            specification: "测试".to_string(),
        });

        learner.learn_from_result(&task_path, &result);
        let prediction_after = learner.predict_success(&task_path);
        assert!(prediction_after > 0.5);
    }
}
