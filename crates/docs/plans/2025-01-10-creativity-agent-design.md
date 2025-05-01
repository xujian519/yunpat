# 创造性判断智能体设计文档

## 1. 概述

**目标**：构建一个专注于专利创造性（inventive step）判断的辅助论证智能体。该智能体不直接给出"具有/不具有创造性"的结论，而是帮助专利代理人梳理论证逻辑、生成可用于答复审查意见、复审请求、无效宣告等场景中的创造性论述段落。

**适用场景**：
- 审查意见答复（OA Response）— 针对审查员关于创造性的驳回理由进行反驳论证
- 复审程序 — 构建完整的创造性论证体系
- 无效宣告 — 从请求人角度论证专利不具有创造性，或从专利权人角度论证具有创造性
- 任何涉及专利创造性三步法分析的业务

## 2. 核心设计原则

1. **辅助论证，不代结论**：智能体提供分析框架和论证素材，最终判断由代理人/审查员做出
2. **遵循中国专利审查指南**：严格按照"三步法"（确定最接近现有技术→确定区别特征→判断是否显而易见）进行
3. **多角度论证**：提供多个论证角度供代理人选择（技术启示、组合动机、预料不到的技术效果、商业成功等）
4. **可复用性**：作为独立 Agent，可被 OA Response、复审、无效等其他 Agent 调用
5. **LLM 增强**：在 LLM 可用时进行深度分析，模板回退保证离线可用

## 3. 工作流阶段设计

### 阶段 1：输入解析（parse_input）
- 解析用户输入，提取权利要求书、对比文件（D1/D2）、技术领域描述
- 支持多种输入格式（纯文本、结构化 JSON）
- 输出：结构化的输入数据（claims, prior_art, tech_field）
- approval: false

### 阶段 2：技术领域确定（determine_tech_field）
- 分析 D1 与本申请是否属于相同/相近技术领域
- 判断 D1 作为最接近现有技术的合理性
- 若 D1 领域不相关，提示可能需重新选择对比文件
- approval: true（需要用户确认技术领域判断）

### 阶段 3：区别技术特征识别（identify_distinguishing_features）
- 将权利要求与 D1 进行逐特征比对
- 识别区别技术特征（结构区别、功能区别、效果区别）
- 输出：区别特征清单及对应技术效果
- approval: true（需要用户确认区别特征识别结果）

### 阶段 4：技术效果分析（analyze_technical_effects）
- 分析每个区别特征带来的技术效果
- 区分"预料不到的技术效果"和"本领域技术人员可预期的效果"
- 评估技术效果是否被对比文件公开或启示
- approval: true

### 阶段 5：显而易见性论证（obviousness_analysis）
- 从多个角度进行显而易见性论证：
  - 角度 A：D1 是否给出技术启示（teaching away / 相反教导）
  - 角度 B：D2 与 D1 的组合动机（是否存在结合启示）
  - 角度 C：区别特征是否属于公知常识
  - 角度 D：是否存在预料不到的技术效果
  - 角度 E：商业成功、长期悬而未决的需求等辅助因素
- 对每个角度提供"支持创造性"和"反对创造性"的双向分析
- approval: true（选择论证角度）

### 阶段 6：论证段落生成（generate_argument_paragraphs）
- 根据用户选择的角度，生成可直接用于答复/复审/无效文本的论述段落
- 支持多种输出格式：
  - 审查意见答复书段落
  - 复审请求书段落
  - 无效宣告请求书/答复书段落
- approval: false

### 阶段 7：质量检查（quality_check）
- 检查论证逻辑的一致性
- 验证法律依据（专利法第 22 条第 3 款）引用准确性
- 检查是否存在循环论证或自相矛盾
- approval: true

## 4. 数据结构

```rust
/// 对比文件信息
pub struct PriorArt {
    pub doc_id: String,
    pub doc_type: PriorArtType, // D1, D2, etc.
    pub title: String,
    pub abstract_text: String,
    pub claims: Vec<String>,
    pub description: String,
    pub tech_field: String,
}

/// 区别技术特征
pub struct DistinguishingFeature {
    pub feature_id: String,
    pub claim_feature: String,
    pub prior_art_feature: Option<String>,
    pub difference_type: DifferenceType, // Structural, Functional, Effect
    pub technical_effect: String,
    pub is_unexpected: Option<bool>,
}

/// 论证角度
pub struct ArgumentAngle {
    pub angle_id: String,
    pub angle_name: String,
    pub pro_inventive: Vec<String>,
    pub con_inventive: Vec<String>,
    pub applicable: bool,
}

/// 创造性分析结果
pub struct CreativityAnalysis {
    pub tech_field_assessment: TechFieldAssessment,
    pub distinguishing_features: Vec<DistinguishingFeature>,
    pub technical_effects: Vec<TechnicalEffect>,
    pub argument_angles: Vec<ArgumentAngle>,
    pub selected_angles: Vec<String>,
    pub argument_paragraphs: Vec<String>,
}
```

## 5. 与现有系统集成

### 5.1 Agent 注册
- 添加到 `lib.rs` 的 `pub mod` 列表
- 在 `AgentRegistry` 中注册
- agent_id: `"creativity"`

### 5.2 TUI 命令
- 命令: `/creativity`
- 别名: `/inv`, `/inventive`
- 参数: 支持直接粘贴权利要求+对比文件文本

### 5.3 被其他 Agent 调用
- OA Response Agent 可在"驳回理由深度分析"阶段调用 Creativity Agent
- 复审 Agent 可在"创造性论证构建"阶段调用
- 无效 Agent 可在"创造性无效理由分析"阶段调用

## 6. 模板内容设计

每个阶段在 LLM 不可用时提供中文模板输出，包含：
- 结构化分析框架
- 示例论证逻辑
- 法律依据引用提示
- 用户可填写的占位符

## 7. 测试策略

至少 5 个测试：
1. `test_creativity_agent_basic` — 基本工作流验证
2. `test_tech_field_determination` — 技术领域确定
3. `test_distinguishing_features` — 区别特征识别
4. `test_argument_angle_selection` — 论证角度选择
5. `test_argument_paragraph_generation` — 论证段落生成
6. `test_quality_check` — 质量检查
7. `test_integration_with_oa_response` — 与 OA Response 集成

## 8. 实现顺序

1. 创建 `creativity.rs` 模块
2. 实现核心数据结构
3. 实现 7 个阶段
4. 添加模板生成函数
5. 添加单元测试
6. 注册到 `lib.rs` 和 `AgentRegistry`
7. 添加 TUI 命令
8. 更新本地化
9. 运行测试验证
