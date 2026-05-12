/**
 * @file 会话状态管理（多轮对话状态追踪）
 * @description Phase 2: Intent Stack + 意图修正检测 + 省略继承
 */

use crate::models::IntentFrame;

/// 修正信号词：用户可能在纠正上一轮的意图
const CORRECTION_SIGNALS: &[&str] = &[
    "不对",
    "错了",
    "不是",
    "改",
    "换成",
    "我要的是",
    "其实是",
    "更正",
    "重新",
    "别",
    "不要这个",
    "换",
];

/// 省略信号：短句、无主语，可能继承上一轮意图
const ELLIPSIS_MAX_LEN: usize = 20;

/// 多轮状态分析结果
#[derive(Debug, Clone)]
pub struct MultiTurnAnalysis {
    /// 是否检测到修正意图
    pub is_correction: bool,
    /// 建议继承的意图（如果是省略句）
    pub inherited_intent: Option<String>,
    /// 当前输入是否是短句/省略句
    pub is_ellipsis: bool,
}

/// 分析多轮对话状态
pub fn analyze_multi_turn(
    user_input: &str,
    intent_history: &[IntentFrame],
) -> MultiTurnAnalysis {
    let lower = user_input.trim();

    // 1. 检测修正信号
    let is_correction = CORRECTION_SIGNALS.iter().any(|sig| lower.contains(sig));

    // 2. 检测省略句（按字符数计算，避免中文字符字节数过大）
    let is_ellipsis = lower.chars().count() < ELLIPSIS_MAX_LEN
        && !lower.contains('?')
        && !lower.starts_with('/')
        && intent_history.len() >= 1;

    // 3. 如果是省略句，建议继承上一轮意图（如果未被修正过）
    let inherited_intent = if is_ellipsis && !is_correction {
        intent_history
            .last()
            .filter(|frame| !frame.corrected)
            .map(|frame| frame.intent.clone())
    } else {
        None
    };

    MultiTurnAnalysis {
        is_correction,
        inherited_intent,
        is_ellipsis,
    }
}

/// 记录意图帧到历史栈
pub fn push_intent_frame(
    history: &mut Vec<IntentFrame>,
    intent: String,
    confidence: f64,
    user_input: String,
    corrected: bool,
) {
    // 限制栈深度，避免内存无限增长
    const MAX_STACK_DEPTH: usize = 10;
    if history.len() >= MAX_STACK_DEPTH {
        history.remove(0);
    }

    history.push(IntentFrame {
        intent,
        confidence,
        timestamp: chrono::Utc::now().timestamp(),
        corrected,
        user_input,
    });
}

/// 获取上一轮的非修正意图（用于上下文关联）
pub fn get_last_stable_intent(intent_history: &[IntentFrame]) -> Option<&IntentFrame> {
    intent_history.iter().rev().find(|f| !f.corrected)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_frame(intent: &str, corrected: bool) -> IntentFrame {
        IntentFrame {
            intent: intent.to_string(),
            confidence: 0.9,
            timestamp: 0,
            corrected,
            user_input: "test".to_string(),
        }
    }

    #[test]
    fn test_correction_detection() {
        let history = vec![make_frame("DRAFT_FULL", false)];
        let analysis = analyze_multi_turn("不对，我要先检索", &history);
        assert!(analysis.is_correction);
    }

    #[test]
    fn test_ellipsis_inheritance() {
        let history = vec![make_frame("DRAFT_FULL", false)];
        let analysis = analyze_multi_turn("要关于人工智能的", &history);
        assert!(analysis.is_ellipsis);
        assert_eq!(analysis.inherited_intent, Some("DRAFT_FULL".to_string()));
    }

    #[test]
    fn test_no_inheritance_after_correction() {
        let history = vec![
            make_frame("DRAFT_FULL", true), // 上一轮已被修正
            make_frame("SEARCH", false),
        ];
        // 省略句不应继承被修正的意图
        let analysis = analyze_multi_turn("继续", &history);
        assert_eq!(analysis.inherited_intent, Some("SEARCH".to_string()));
    }
}
