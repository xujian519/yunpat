/**
 * IPC 分类器 Fallback 实现 (TypeScript)
 * 当 Rust CLI 不可用时使用
 */

export interface IpcClassification {
  section: string;
  class: string;
  subclass: string;
  group: string;
  description: string;
}

/**
 * IPC 分类器 (基于关键词匹配)
 * 简化版实现，对应 Rust 版本的核心功能
 */
export class IpcClassifier {
  private sectionKeywords: Map<string, string[]>;

  constructor() {
    this.sectionKeywords = new Map([
      ["A", ["农业", "食品", "服装", "医药", "卫生", "生活", "家具", "运动"]],
      ["B", ["加工", "成型", "印刷", "运输", "包装", "分离", "机床", "刀具"]],
      ["C", ["化学", "冶金", "玻璃", "水泥", "聚合物", "催化剂", "发酵", "涂料"]],
      ["D", ["纺织", "造纸", "纤维", "织物", "纱线"]],
      ["E", ["建筑", "采矿", "道路", "桥梁", "锁具", "门窗"]],
      ["F", ["发动机", "泵", "阀", "轴承", "齿轮", "照明", "加热", "武器"]],
      ["G", ["计算", "测量", "信号", "控制", "仪器", "导航", "物理"]],
      ["H", ["电", "通信", "半导体", "电路", "天线", "电池", "光电器件"]]
    ]);
  }

  /**
   * 对文本进行 IPC 分类
   */
  classify(text: string): IpcClassification[] {
    const textLower = text.toLowerCase();
    const scores = new Map<string, number>();

    // 计算每个部的匹配分数
    for (const [section, keywords] of this.sectionKeywords.entries()) {
      let matchCount = 0;
      for (const keyword of keywords) {
        if (textLower.includes(keyword.toLowerCase())) {
          matchCount++;
        }
      }
      if (matchCount > 0) {
        scores.set(section, matchCount / keywords.length);
      }
    }

    // 转换为结果数组并排序
    const results: IpcClassification[] = Array.from(scores.entries())
      .filter(([_, score]) => score > 0)
      .map(([section, _]) => ({
        section,
        class: "",
        subclass: "",
        group: "",
        description: this.getSectionDescription(section)
      }))
      .sort((a, b) => {
        const scoreA = this.getMatchScore(textLower, a.section);
        const scoreB = this.getMatchScore(textLower, b.section);
        return scoreB - scoreA;
      });

    return results;
  }

  private getMatchScore(text: string, section: string): number {
    const keywords = this.sectionKeywords.get(section);
    if (!keywords) return 0;
    
    return keywords.filter(kw => text.includes(kw.toLowerCase())).length / keywords.length;
  }

  private getSectionDescription(section: string): string {
    const descriptions: Record<string, string> = {
      "A": "人类生活必需",
      "B": "作业、运输",
      "C": "化学、冶金",
      "D": "纺织、造纸",
      "E": "固定建筑物",
      "F": "机械工程、照明、加热、武器、爆破",
      "G": "物理",
      "H": "电学"
    };
    return descriptions[section] || "未知";
  }
}

/**
 * IPC 分类 Fallback 函数
 */
export async function classifyIpcFallback(text: string): Promise<{
  classifications: IpcClassification[];
}> {
  const classifier = new IpcClassifier();
  const classifications = classifier.classify(text);
  return { classifications };
}
