/**
 * SAOExtractor - 主谓宾三元组提取器
 *
 * 从专利文本中提取"主语（技术组件）→ 谓语（功能动作）→ 宾语（作用对象）"结构，
 * 基于 TRIZ 创新方法论中的功能分析框架，捕获技术方案的功能性语义。
 *
 * 参考：SAO2Vec (PMC7001927)
 */

/**
 * SAO 三元组接口
 */
export interface SAOTriplet {
  /** 技术组件（如"处理器"、"编码器"） */
  subject: string
  /** 功能动作（如"计算"、"编码"、"传输"） */
  action: string
  /** 作用对象（如"特征向量"、"数据流"） */
  object: string
  /** 原始句子文本 */
  rawText: string
  /** 提取置信度 0-1 */
  confidence: number
}

/**
 * 中文动词标准化映射表
 */
const VERB_NORMALIZATION_MAP: Record<string, string> = {
  '被配置为': '配置',
  '用于': '使用',
  '适用于': '应用',
  '包括': '包含',
  '由...组成': '构成',
  '由...构成': '构成',
  '能够': '可以',
  '具备': '拥有',
  '具有': '拥有',
  '包含': '包含',
  '含有': '包含',
  '被设置': '设置',
  '被定义': '定义',
  '被指定': '指定',
  '被配置': '配置',
  '被分配': '分配',
  '被存储': '存储',
  '被发送': '发送',
  '被传输': '传输',
  '被处理': '处理',
  '被计算': '计算',
  '被分析': '分析',
  '被检测': '检测',
  '被识别': '识别',
  '被优化': '优化',
  '被转换': '转换',
  '被映射': '映射',
  '被提取': '提取',
  '被生成': '生成',
  '被创建': '创建',
  '被构建': '构建',
  '被训练': '训练',
  '被预测': '预测',
  '被评估': '评估',
  '被比较': '比较',
  '被组合': '组合',
  '被整合': '整合',
  '被分割': '分割',
  '被分离': '分离',
  '被合并': '合并',
  '被聚合': '聚合',
  '被排序': '排序',
  '被过滤': '过滤',
  '被搜索': '搜索',
  '被检索': '检索',
  '被匹配': '匹配',
  '被对齐': '对齐',
  '被调整': '调整',
  '被修改': '修改',
  '被更新': '更新',
  '被刷新': '刷新',
  '被加载': '加载',
  '被卸载': '卸载',
  '被保存': '保存',
  '被删除': '删除',
  '被移除': '移除',
  '被添加': '添加',
  '被插入': '插入',
  '被附加': '附加',
  '被连接': '连接',
  '被绑定': '绑定',
  '被解绑': '解绑',
  '被链接': '链接',
  '被断开': '断开',
  '被关闭': '关闭',
  '被打开': '打开',
  '被启动': '启动',
  '被停止': '停止',
  '被暂停': '暂停',
  '被恢复': '恢复',
  '被重置': '重置',
  '被初始化': '初始化',
  '被清空': '清空',
  '被释放': '释放',
  '被销毁': '销毁',
}

/**
 * 技术组件后缀模式（匹配中文技术术语）
 */
const TECH_COMPONENT_SUFFIXES = [
  '器',
  '件',
  '装置',
  '系统',
  '模块',
  '单元',
  '设备',
  '机构',
  '引擎',
  '平台',
  '框架',
  '接口',
  '协议',
  '算法',
  '模型',
  '层',
  '链',
  '树',
  '图',
  '网络',
  '总线',
  '通道',
  '端口',
  '节点',
  '服务器',
  '客户端',
  '代理',
  '服务',
  '中间件',
  '驱动',
  '程序',
  '进程',
  '线程',
  '队列',
  '栈',
  '堆',
  '缓冲区',
  '缓存',
  '寄存器',
  '存储器',
  '存储',
  '数据库',
  '数据表',
  '数据流',
  '数据包',
  '数据块',
  '数据集',
  '数据结构',
  '数据类型',
  '数据格式',
  '数据协议',
  '数据传输',
  '数据处理',
  '数据分析',
  '数据挖掘',
  '数据可视化',
  '数据加密',
  '数据解密',
  '数据压缩',
  '数据解压',
  '数据同步',
  '数据备份',
  '数据恢复',
  '数据迁移',
  '数据导入',
  '数据导出',
  '数据转换',
  '数据校验',
  '数据验证',
  '数据清洗',
  '数据集成',
  '数据融合',
  '数据聚合',
  '数据关联',
  '数据关联分析',
  '数据挖掘分析',
  '数据可视化展示',
]

/**
 * SAO 三元组提取器
 */
export class SAOExtractor {
  /**
   * 从文本中提取 SAO 三元组
   *
   * @param text - 输入文本（专利说明书、权利要求等）
   * @returns SAO 三元组数组，按置信度降序排列
   */
  extract(text: string): SAOTriplet[] {
    const triplets: SAOTriplet[] = []

    // 步骤 1：分句
    const sentences = this.splitSentences(text)

    // 步骤 2：对每个句子进行 SAO 提取
    for (const sentence of sentences) {
      const sentenceTriplets = this.extractFromSentence(sentence)
      triplets.push(...sentenceTriplets)
    }

    // 步骤 3：按置信度降序排序
    triplets.sort((a, b) => b.confidence - a.confidence)

    return triplets
  }

  /**
   * 从权利要求中提取 SAO 三元组
   *
   * 每个权利要求单独处理，聚焦核心技术动作
   *
   * @param claims - 权利要求数组
   * @returns SAO 三元组数组
   */
  extractFromClaims(claims: string[]): SAOTriplet[] {
    const triplets: SAOTriplet[] = []

    for (const claim of claims) {
      // 提取权利要求中的核心技术句子
      const sentences = this.splitSentences(claim)

      // 权利要求通常较短，优先提取第一个句子（主权利要求）
      for (let i = 0; i < sentences.length; i++) {
        const sentenceTriplets = this.extractFromSentence(sentences[i])
        // 权利要求前几句（主权利要求）的置信度加权
        const weightedTriplets = sentenceTriplets.map((triplet) => ({
          ...triplet,
          confidence: triplet.confidence * (1 - i * 0.1), // 每句降权 10%
        }))
        triplets.push(...weightedTriplets)
      }
    }

    return triplets.sort((a, b) => b.confidence - a.confidence)
  }

  /**
   * 分句（简单的基于标点符号的分句）
   *
   * @param text - 输入文本
   * @returns 句子数组
   */
  private splitSentences(text: string): string[] {
    // 使用句号、问号、感叹号、分号分句
    const sentences = text
      .split(/[。？！；.?!;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    return sentences
  }

  /**
   * 从单个句子中提取 SAO 三元组
   *
   * @param sentence - 输入句子
   * @returns SAO 三元组数组
   */
  private extractFromSentence(sentence: string): SAOTriplet[] {
    const triplets: SAOTriplet[] = []

    // 模式 1："A 通过/利用/使用 B 对 C 进行 V" → subject=A, action=V, object=C
    const pattern1 = this.matchPattern1(sentence)
    if (pattern1) {
      triplets.push(pattern1)
    }

    // 模式 2："A 将 B V 为/成 C" → subject=A, action=V, object=B
    const pattern2 = this.matchPattern2(sentence)
    if (pattern2) {
      triplets.push(pattern2)
    }

    // 模式 3："A 被 B V" → subject=B, action=V, object=A
    const pattern3 = this.matchPattern3(sentence)
    if (pattern3) {
      triplets.push(pattern3)
    }

    // 模式 4：简单 "主语 + 动词 + 宾语" 模式
    const pattern4 = this.matchPattern4(sentence)
    if (pattern4) {
      triplets.push(pattern4)
    }

    // 如果没有匹配到任何模式，尝试启发式提取
    if (triplets.length === 0) {
      const heuristic = this.extractHeuristic(sentence)
      if (heuristic) {
        triplets.push(heuristic)
      }
    }

    return triplets
  }

  /**
   * 模式 1 匹配："A 通过/利用/使用 B 对 C 进行 V"
   */
  private matchPattern1(sentence: string): SAOTriplet | null {
    // 正则匹配："...通过...对...进行..." 或 "...利用...对...进行..." 或 "...使用...对...进行..."
    const regex = /(.+?)(?:通过|利用|使用)(.+?)对(.+?)进行(.+)/
    const match = sentence.match(regex)

    if (!match) {
      return null
    }

    const [, subject, _, object, action] = match

    // 清洗和标准化
    const cleanedSubject = this.cleanSubject(subject)
    const cleanedAction = this.normalizeVerb(action.trim())
    const cleanedObject = this.cleanObject(object)

    if (!cleanedSubject || !cleanedAction || !cleanedObject) {
      return null
    }

    return {
      subject: cleanedSubject,
      action: cleanedAction,
      object: cleanedObject,
      rawText: sentence,
      confidence: 0.9, // 模式 1 置信度高
    }
  }

  /**
   * 模式 2 匹配："A 将 B V 为/成 C"
   */
  private matchPattern2(sentence: string): SAOTriplet | null {
    // 正则匹配："...将...[动词]为..." 或 "...将...[动词]成..."
    const regex = /(.+?)将(.+?)([^\s]+?)(?:为|成)(.+)/
    const match = sentence.match(regex)

    if (!match) {
      return null
    }

    const [, subject, object, action, _result] = match

    // 清洗和标准化
    const cleanedSubject = this.cleanSubject(subject)
    const cleanedAction = this.normalizeVerb(action.trim())
    const cleanedObject = this.cleanObject(object)

    if (!cleanedSubject || !cleanedAction || !cleanedObject) {
      return null
    }

    return {
      subject: cleanedSubject,
      action: cleanedAction,
      object: cleanedObject,
      rawText: sentence,
      confidence: 0.85, // 模式 2 置信度较高
    }
  }

  /**
   * 模式 3 匹配："A 被 B V"
   */
  private matchPattern3(sentence: string): SAOTriplet | null {
    // 正则匹配："...被...[动词]..."
    const regex = /(.+?)被(.+?)([^\s]+?)(?:[,.，。]|\s|$)/
    const match = sentence.match(regex)

    if (!match) {
      return null
    }

    const [, object, subject, action] = match

    // 清洗和标准化
    const cleanedSubject = this.cleanSubject(subject)
    const cleanedAction = this.normalizeVerb(action.trim())
    const cleanedObject = this.cleanObject(object)

    if (!cleanedSubject || !cleanedAction || !cleanedObject) {
      return null
    }

    return {
      subject: cleanedSubject,
      action: cleanedAction,
      object: cleanedObject,
      rawText: sentence,
      confidence: 0.8, // 模式 3 置信度中等
    }
  }

  /**
   * 模式 4 匹配：简单 "主语 + 动词 + 宾语"
   */
  private matchPattern4(sentence: string): SAOTriplet | null {
    // 正则匹配：技术组件 + 动词 + 作用对象
    // 这是一个启发式匹配，需要进一步验证
    const parts = sentence.split(/[\s,，]+/)
    if (parts.length < 3) {
      return null
    }

    // 尝试找到技术组件作为主语
    let subjectIndex = -1
    for (let i = 0; i < parts.length; i++) {
      if (this.isTechComponent(parts[i])) {
        subjectIndex = i
        break
      }
    }

    if (subjectIndex === -1 || subjectIndex >= parts.length - 2) {
      return null
    }

    // 假设主语后紧跟动词，再后是宾语
    const subject = parts[subjectIndex]
    const action = parts[subjectIndex + 1]
    const object = parts[subjectIndex + 2]

    // 验证动作是否为动词
    if (!this.isLikelyVerb(action)) {
      return null
    }

    // 清洗和标准化
    const cleanedSubject = this.cleanSubject(subject)
    const cleanedAction = this.normalizeVerb(action)
    const cleanedObject = this.cleanObject(object)

    if (!cleanedSubject || !cleanedAction || !cleanedObject) {
      return null
    }

    return {
      subject: cleanedSubject,
      action: cleanedAction,
      object: cleanedObject,
      rawText: sentence,
      confidence: 0.7, // 模式 4 置信度较低（启发式）
    }
  }

  /**
   * 启发式提取：当没有匹配到任何模式时尝试
   */
  private extractHeuristic(sentence: string): SAOTriplet | null {
    // 尝试提取主语（技术组件）
    const subjectMatch = sentence.match(new RegExp(`([^\s,，]+?(?:${TECH_COMPONENT_SUFFIXES.join('|')}))`, 'g'))

    if (!subjectMatch || subjectMatch.length === 0) {
      return null
    }

    const subject = this.cleanSubject(subjectMatch[0])
    if (!subject) {
      return null
    }

    // 尝试提取动词
    const verbMatch = sentence.match(/(?:通过|利用|使用|进行|执行|实施|完成|实现|处理|计算|分析|检测|识别|提取|生成|创建|构建|训练|预测|评估|比较|组合|整合|分割|合并|排序|过滤|搜索|匹配|调整|修改|更新|加载|保存|删除|添加|插入|连接|打开|关闭|启动|停止|初始化|配置|设置|定义|指定|分配|存储|发送|传输|优化|转换|映射)/)

    if (!verbMatch) {
      return null
    }

    const action = this.normalizeVerb(verbMatch[0])
    if (!action) {
      return null
    }

    // 尝试提取宾语（从主语和动词之后的文本中）
    const subjectIndex = sentence.indexOf(subjectMatch[0])
    const verbIndex = sentence.indexOf(verbMatch[0])
    const startIndex = Math.max(subjectIndex, verbIndex) + Math.max(subjectMatch[0].length, verbMatch[0].length)
    const remainingText = sentence.slice(startIndex).trim()

    if (remainingText.length === 0) {
      return null
    }

    const object = this.cleanObject(remainingText.split(/[,.，。]/)[0])
    if (!object) {
      return null
    }

    return {
      subject,
      action,
      object,
      rawText: sentence,
      confidence: 0.6, // 启发式置信度最低
    }
  }

  /**
   * 清洗主语（技术组件）
   */
  private cleanSubject(subject: string): string | null {
    // 移除常见的修饰词
    let cleaned = subject
      .replace(/^(?:该|所述|一个|一种|多个|若干|此|本|其|上述|如下)/, '')
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '')
      .trim()

    // 验证是否为技术组件
    if (!this.isTechComponent(cleaned)) {
      return null
    }

    return cleaned
  }

  /**
   * 清洗宾语（作用对象）
   */
  private cleanObject(object: string): string | null {
    // 移除标点符号和空格
    let cleaned = object.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').trim()

    // 过滤过短的宾语
    if (cleaned.length < 2) {
      return null
    }

    return cleaned
  }

  /**
   * 标准化动词
   */
  private normalizeVerb(verb: string): string | null {
    // 检查是否为可能的动词
    if (!this.isLikelyVerb(verb)) {
      return null
    }

    // 应用标准化映射
    const normalized = VERB_NORMALIZATION_MAP[verb] ?? verb

    // 移除常见的动词修饰词
    return normalized.replace(/(?:进行|实施|执行)/g, '').trim()
  }

  /**
   * 判断是否为技术组件
   */
  private isTechComponent(text: string): boolean {
    if (text.length < 2) {
      return false
    }

    // 检查是否以技术组件后缀结尾
    return TECH_COMPONENT_SUFFIXES.some((suffix) => text.endsWith(suffix))
  }

  /**
   * 判断是否可能为动词
   */
  private isLikelyVerb(text: string): boolean {
    if (text.length < 1) {
      return false
    }

    // 常见动词列表（简单启发式）
    const commonVerbs = new Set([
      '计算',
      '分析',
      '处理',
      '执行',
      '实施',
      '完成',
      '实现',
      '检测',
      '识别',
      '提取',
      '生成',
      '创建',
      '构建',
      '训练',
      '预测',
      '评估',
      '比较',
      '组合',
      '整合',
      '分割',
      '合并',
      '排序',
      '过滤',
      '搜索',
      '匹配',
      '调整',
      '修改',
      '更新',
      '加载',
      '保存',
      '删除',
      '添加',
      '插入',
      '连接',
      '打开',
      '关闭',
      '启动',
      '停止',
      '初始化',
      '配置',
      '设置',
      '定义',
      '指定',
      '分配',
      '存储',
      '发送',
      '传输',
      '优化',
      '转换',
      '映射',
      '编码',
      '解码',
      '加密',
      '解密',
      '压缩',
      '解压',
      '同步',
      '备份',
      '恢复',
      '迁移',
      '导入',
      '导出',
      '校验',
      '验证',
      '清洗',
      '集成',
      '融合',
      '聚合',
      '关联',
      '挖掘',
      '可视化',
    ])

    // 检查是否包含在常见动词列表中
    if (commonVerbs.has(text)) {
      return true
    }

    // 检查是否以动词常见字结尾
    const verbEndings = ['化', '算', '析', '测', '别', '取', '成', '建', '练', '测', '估', '比', '合', '并', '序', '滤', '索', '配', '整', '改', '新', '载', '存', '除', '加', '入', '接', '开', '关', '动', '止', '化', '置', '义', '配', '储', '送', '输', '化', '换', '射']

    return verbEndings.some((ending) => text.endsWith(ending))
  }
}