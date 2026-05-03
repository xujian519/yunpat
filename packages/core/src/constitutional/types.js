/**
 * Constitutional AI - 类型定义
 *
 * 定义原则集、合规检查、自动纠正的核心类型
 */
/**
 * 原则类别
 */
export var PrincipleCategory;
(function (PrincipleCategory) {
    PrincipleCategory["CLARITY"] = "clarity";
    PrincipleCategory["BREVITY"] = "brevity";
    PrincipleCategory["SUPPORT"] = "support";
    PrincipleCategory["COMPLETENESS"] = "completeness";
    PrincipleCategory["NOVELTY"] = "novelty";
    PrincipleCategory["ENABLEMENT"] = "enablement";
    PrincipleCategory["BEST_MODE"] = "best_mode";
    PrincipleCategory["DEFINITENESS"] = "definiteness";
})(PrincipleCategory || (PrincipleCategory = {}));
/**
 * 违规严重程度
 */
export var ViolationSeverity;
(function (ViolationSeverity) {
    ViolationSeverity["CRITICAL"] = "critical";
    ViolationSeverity["MAJOR"] = "major";
    ViolationSeverity["MINOR"] = "minor";
})(ViolationSeverity || (ViolationSeverity = {}));
/**
 * 纠正策略
 */
export var CorrectionStrategy;
(function (CorrectionStrategy) {
    CorrectionStrategy["RULE_BASED"] = "rule_based";
    CorrectionStrategy["LLM_BASED"] = "llm_based";
    CorrectionStrategy["HYBRID"] = "hybrid";
})(CorrectionStrategy || (CorrectionStrategy = {}));
