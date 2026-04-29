use std::collections::HashMap;
use crate::types::*;

/// IPC 分类器（基于关键词匹配）
///
/// 源自 Athena: domains/patents/ipc_vector_database.py
/// 简化版：基于技术领域关键词匹配，不依赖向量数据库
pub struct IpcClassifier {
    /// IPC section 到关键词的映射
    section_keywords: HashMap<String, Vec<String>>,
}

impl IpcClassifier {
    pub fn new() -> Self {
        let mut section_keywords = HashMap::new();

        section_keywords.insert("A".into(), vec![
            "农业".into(), "食品".into(), "服装".into(), "医药".into(), "卫生".into(), "生活".into(), "家具".into(), "运动".into(),
        ]);
        section_keywords.insert("B".into(), vec![
            "加工".into(), "成型".into(), "印刷".into(), "运输".into(), "包装".into(), "分离".into(), "机床".into(), "刀具".into(),
        ]);
        section_keywords.insert("C".into(), vec![
            "化学".into(), "冶金".into(), "玻璃".into(), "水泥".into(), "聚合物".into(), "催化剂".into(), "发酵".into(), "涂料".into(),
        ]);
        section_keywords.insert("D".into(), vec![
            "纺织".into(), "造纸".into(), "纤维".into(), "织物".into(), "纱线".into(),
        ]);
        section_keywords.insert("E".into(), vec![
            "建筑".into(), "采矿".into(), "道路".into(), "桥梁".into(), "锁具".into(), "门窗".into(),
        ]);
        section_keywords.insert("F".into(), vec![
            "发动机".into(), "泵".into(), "阀".into(), "轴承".into(), "齿轮".into(), "照明".into(), "加热".into(), "武器".into(),
        ]);
        section_keywords.insert("G".into(), vec![
            "计算".into(), "测量".into(), "信号".into(), "控制".into(), "仪器".into(), "导航".into(), "物理".into(),
        ]);
        section_keywords.insert("H".into(), vec![
            "电".into(), "通信".into(), "半导体".into(), "电路".into(), "天线".into(), "电池".into(), "光电器件".into(),
        ]);

        Self { section_keywords }
    }

    /// 对文本进行 IPC 分类
    pub fn classify(&self, text: &str) -> Vec<IpcClassification> {
        let text_lower = text.to_lowercase();
        let mut scores: HashMap<&str, f32> = HashMap::new();

        for (section, keywords) in &self.section_keywords {
            let mut count = 0;
            for kw in keywords {
                if text_lower.contains(kw.as_str()) {
                    count += 1;
                }
            }
            if count > 0 {
                scores.insert(section, count as f32 / keywords.len() as f32);
            }
        }

        let mut results: Vec<IpcClassification> = scores
            .into_iter()
            .filter(|(_, score)| *score > 0.0)
            .map(|(section, _)| {
                let description = self.section_description(section);
                IpcClassification {
                    section: section.to_string(),
                    class: String::new(),
                    subclass: String::new(),
                    group: String::new(),
                    description,
                }
            })
            .collect();

        // 按匹配度排序
        results.sort_by(|a, b| {
            let score_a = self.match_score(&text_lower, &a.section);
            let score_b = self.match_score(&text_lower, &b.section);
            score_b.partial_cmp(&score_a).unwrap()
        });

        results
    }

    fn match_score(&self, text: &str, section: &str) -> f32 {
        if let Some(keywords) = self.section_keywords.get(section) {
            keywords.iter().filter(|kw| text.contains(kw.as_str())).count() as f32 / keywords.len() as f32
        } else {
            0.0
        }
    }

    fn section_description(&self, section: &str) -> String {
        match section {
            "A" => "人类生活必需".into(),
            "B" => "作业、运输".into(),
            "C" => "化学、冶金".into(),
            "D" => "纺织、造纸".into(),
            "E" => "固定建筑物".into(),
            "F" => "机械工程、照明、加热、武器、爆破".into(),
            "G" => "物理".into(),
            "H" => "电学".into(),
            _ => "未知".into(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_classify_electronics() {
        let classifier = IpcClassifier::new();
        let results = classifier.classify("本发明涉及一种半导体通信电路装置");
        assert!(!results.is_empty());
        assert!(results[0].section == "H", "电学应排第一，实际: {}", results[0].section);
    }

    #[test]
    fn test_classify_mechanical() {
        let classifier = IpcClassifier::new();
        let results = classifier.classify("一种新型齿轮泵的发动机轴承结构");
        assert!(!results.is_empty());
        assert!(results.iter().any(|r| r.section == "F"), "应包含F部（机械工程）");
    }

    #[test]
    fn test_classify_chemistry() {
        let classifier = IpcClassifier::new();
        let results = classifier.classify("聚合物催化剂涂料组合物");
        assert!(!results.is_empty());
        assert!(results[0].section == "C");
    }

    #[test]
    fn test_classify_empty() {
        let classifier = IpcClassifier::new();
        let results = classifier.classify("随机无意义文本");
        assert!(results.is_empty() || results.len() <= 2);
    }
}
