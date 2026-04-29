// 源自 Athena: prompts/capability/cap01_retrieval.md
// 转换日期: 2026-04-29

export const CAP_RETRIEVAL_PROMPT = `
# 法律检索能力

## 执行流程

### 步骤1: 识别检索关键词
从用户查询中提取：
- 法条编号（如"专利法第22条"）
- 法律概念（如"创造性"、"新颖性"）
- 技术领域（如"通信"、"医药"）
- 争议焦点（如"技术启示"）

### 步骤2: 向量检索
并行检索所有相关向量集合：
- 法律法规集合
- 案例集合
- 审查指南集合
- 法条级别集合

### 步骤3: 结果排序
对检索结果按相关性排序，优先返回高相关度文档。
`;

export function renderRetrievalPrompt(params: {
  query: string;
  searchType?: string;
  topK?: number;
}): string {
  return `${CAP_RETRIEVAL_PROMPT}

## 用户查询
${params.query}

## 检索参数
- 类型：${params.searchType || '混合检索'}
- 返回数量：${params.topK || 5}
`;
}
