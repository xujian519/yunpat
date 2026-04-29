// 源自 Athena: prompts/skills/patent-retrieval/
// 转换日期: 2026-04-29

export const PATENT_SEARCH_PROMPT = `
# 专利检索技能

## 检索类型
1. 关键词检索 - 使用技术关键词组合
2. IPC分类检索 - 按国际专利分类号
3. 申请人检索 - 按申请人/发明人
4. 全文检索 - 语义相似度匹配

## 检索策略
- 构建布尔表达式：(关键词A OR 同义词A) AND (关键词B OR 同义词B)
- 使用IPC分类号缩小范围
- 注意同义词和近义词扩展
`;

export function renderPatentSearchPrompt(params: {
  query: string;
  techField?: string;
  ipcCodes?: string[];
  applicant?: string;
}): string {
  return `${PATENT_SEARCH_PROMPT}

## 检索需求
${params.query}

${params.techField ? `## 技术领域\n${params.techField}` : ''}
${params.ipcCodes?.length ? `## IPC分类\n${params.ipcCodes.join(', ')}` : ''}
${params.applicant ? `## 申请人\n${params.applicant}` : ''}

请构建最优检索策略。
`;
}
