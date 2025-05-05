//! 宪法引擎 — 专利领域的不可绕过安全约束层。
//!
//! 五条宪法原则按优先级裁决，最严格的结果生效。
//! 即使在 YOLO 模式下，宪法层仍然强制执行。

use serde::{Deserialize, Serialize};

/// 宪法裁决结果（按严格程度递增）
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConstitutionalVerdict {
    /// 通过 — 无约束触发
    Pass,
    /// 路由到本地模型 — 数据主权保护
    RouteToLocal { reason: String },
    /// 需要人工审批 — 不可逆操作
    RequireHuman { reason: String },
    /// 硬拒绝 — 禁止执行
    HardDeny { reason: String },
}

impl ConstitutionalVerdict {
    /// 严格程度排序值（越高越严格）
    pub fn severity(&self) -> u8 {
        match self {
            Self::Pass => 0,
            Self::RouteToLocal { .. } => 1,
            Self::RequireHuman { .. } => 2,
            Self::HardDeny { .. } => 3,
        }
    }

    /// 合并两个裁决，返回更严格的那个
    pub fn merge(self, other: Self) -> Self {
        if other.severity() > self.severity() {
            other
        } else {
            self
        }
    }

    pub fn is_pass(&self) -> bool {
        matches!(self, Self::Pass)
    }
}

/// 审计级别
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuditLevel {
    Info,
    Warning,
    Critical,
}

/// 审计记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEntry {
    pub principle: String,
    pub verdict: ConstitutionalVerdict,
    pub audit_level: AuditLevel,
    pub tool_name: String,
    pub timestamp_ms: u64,
}

/// 宪法原则 trait — 每条原则独立实现
pub trait ConstitutionalPrinciple: Send + Sync {
    /// 原则名称
    fn name(&self) -> &'static str;

    /// 检查工具调用是否违反此原则
    fn check(&self, tool_name: &str, params: &serde_json::Value) -> ConstitutionalVerdict;
}

/// 宪法引擎 — 持有所有原则并执行裁决
pub struct ConstitutionalEngine {
    principles: Vec<Box<dyn ConstitutionalPrinciple>>,
}

impl ConstitutionalEngine {
    pub fn new(principles: Vec<Box<dyn ConstitutionalPrinciple>>) -> Self {
        Self { principles }
    }

    /// 带有全部五条默认原则的引擎
    pub fn with_default_principles() -> Self {
        use crate::principles::*;
        Self::new(vec![
            Box::new(DataSovereigntyPrinciple),
            Box::new(IrreversibleActionPrinciple),
            Box::new(ClaimIntegrityPrinciple),
            Box::new(BulkExportDenyPrinciple),
            Box::new(SubmissionAuditPrinciple),
        ])
    }

    /// 对工具调用执行全量裁决，返回最严格结果和审计记录
    pub fn adjudicate(
        &self,
        tool_name: &str,
        params: &serde_json::Value,
    ) -> (ConstitutionalVerdict, Vec<AuditEntry>) {
        let mut final_verdict = ConstitutionalVerdict::Pass;
        let mut audit = Vec::new();

        for principle in &self.principles {
            let verdict = principle.check(tool_name, params);
            let level = match &verdict {
                ConstitutionalVerdict::Pass => AuditLevel::Info,
                ConstitutionalVerdict::RouteToLocal { .. } => AuditLevel::Warning,
                ConstitutionalVerdict::RequireHuman { .. } => AuditLevel::Critical,
                ConstitutionalVerdict::HardDeny { .. } => AuditLevel::Critical,
            };

            audit.push(AuditEntry {
                principle: principle.name().to_string(),
                verdict: verdict.clone(),
                audit_level: level,
                tool_name: tool_name.to_string(),
                timestamp_ms: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as u64,
            });

            final_verdict = final_verdict.merge(verdict);
        }

        (final_verdict, audit)
    }

    pub fn principle_count(&self) -> usize {
        self.principles.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn verdict_severity_ordering() {
        assert!(
            ConstitutionalVerdict::HardDeny {
                reason: String::new()
            }
            .severity()
                > ConstitutionalVerdict::RequireHuman {
                    reason: String::new()
                }
                .severity()
        );
        assert!(
            ConstitutionalVerdict::RequireHuman {
                reason: String::new()
            }
            .severity()
                > ConstitutionalVerdict::RouteToLocal {
                    reason: String::new()
                }
                .severity()
        );
        assert!(
            ConstitutionalVerdict::RouteToLocal {
                reason: String::new()
            }
            .severity()
                > ConstitutionalVerdict::Pass.severity()
        );
    }

    #[test]
    fn verdict_merge_takes_stricter() {
        let v = ConstitutionalVerdict::Pass.merge(ConstitutionalVerdict::RouteToLocal {
            reason: "test".into(),
        });
        assert!(matches!(v, ConstitutionalVerdict::RouteToLocal { .. }));

        let v = ConstitutionalVerdict::RequireHuman { reason: "a".into() }
            .merge(ConstitutionalVerdict::RouteToLocal { reason: "b".into() });
        assert!(matches!(v, ConstitutionalVerdict::RequireHuman { .. }));
    }

    #[test]
    fn verdict_serde_round_trip() {
        let verdict = ConstitutionalVerdict::HardDeny {
            reason: "bulk export".into(),
        };
        let json = serde_json::to_string(&verdict).unwrap();
        let back: ConstitutionalVerdict = serde_json::from_str(&json).unwrap();
        assert_eq!(verdict, back);
    }

    /// 空引擎对所有调用返回 Pass
    #[allow(dead_code)]
    struct DummyPrinciple;
    impl ConstitutionalPrinciple for DummyPrinciple {
        fn name(&self) -> &'static str {
            "dummy"
        }
        fn check(&self, _tool: &str, _params: &serde_json::Value) -> ConstitutionalVerdict {
            ConstitutionalVerdict::Pass
        }
    }

    #[test]
    fn engine_with_no_principles_passes() {
        let engine = ConstitutionalEngine::new(vec![]);
        let (verdict, audit) = engine.adjudicate("any_tool", &json!({}));
        assert!(verdict.is_pass());
        assert!(audit.is_empty());
    }

    #[test]
    fn engine_with_default_principles() {
        let engine = ConstitutionalEngine::with_default_principles();
        assert_eq!(engine.principle_count(), 5);
        // 普通工具应通过
        let (verdict, _) = engine.adjudicate("file_read", &json!({"path": "/tmp/test.txt"}));
        assert!(verdict.is_pass());
    }
}
