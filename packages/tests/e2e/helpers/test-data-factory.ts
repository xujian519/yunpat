/**
 * E2E 测试数据工厂
 *
 * 集中生成一致的测试数据，替代各测试文件中的临时 fixture
 */

// ========== 技术交底书 ==========

export interface SampleDisclosure {
  title: string
  field: string
  disclosure: string
  expectedKeyFeatures: string[]
}

export function createSampleDisclosure(
  variant: 'thermal' | 'ai' | 'mechanical' = 'thermal'
): SampleDisclosure {
  const disclosures: Record<string, SampleDisclosure> = {
    thermal: {
      title: '一种基于相变材料的高效散热装置',
      field: '电子设备散热技术',
      disclosure: `
本发明涉及一种基于相变材料的高效散热装置。

技术背景：随着电子设备性能不断提升，芯片功耗和发热量大幅增加。
传统的风冷散热在高温环境下效率不足，液冷散热则存在体积大、成本高的问题。

技术方案：本发明采用相变材料作为散热介质，配置多层复合散热结构，
并集成智能温控调节模块。相变材料在相变过程中吸收大量热量，
能够在无需额外能耗的情况下实现高效散热。

具体实施方式：散热装置包括散热基板、相变材料层和智能温控模块。
相变材料层采用石蜡基复合材料，填充在散热基板与外壳之间。
智能温控模块通过温度传感器实时监测散热状态，
当温度超过阈值时启动辅助风扇。

技术效果：散热效率提高60%，工作温度范围扩大至-40°C至120°C，
整体能耗降低30%。`.trim(),
      expectedKeyFeatures: ['相变材料', '智能温控', '多层复合结构'],
    },
    ai: {
      title: '一种基于深度学习的语音识别方法',
      field: '人工智能语音技术',
      disclosure: `
本发明涉及一种基于深度学习的语音识别方法。

技术背景：现有语音识别系统在噪声环境下准确率低，
对远场语音和多人说话场景处理能力不足。

技术方案：本发明采用注意力机制增强的Transformer模型，
结合多尺度特征提取和自适应噪声抑制模块。
模型通过端到端训练，直接从原始音频波形生成文本输出。

具体实施方式：系统包括预处理模块、特征提取模块、
Transformer编码器和解码器模块。预处理模块对输入音频进行
分帧和加窗处理。特征提取模块使用多层卷积提取多尺度特征。
Transformer编码器使用多头自注意力机制捕获长距离依赖。

技术效果：在噪声环境下识别准确率达到95%以上，
相比传统方法提升15%，推理延迟降低至50ms以下。`.trim(),
      expectedKeyFeatures: ['Transformer', '注意力机制', '噪声抑制'],
    },
    mechanical: {
      title: '一种自适应减震悬挂系统',
      field: '机械工程车辆悬挂',
      disclosure: `
本发明涉及一种自适应减震悬挂系统。

技术背景：传统被动悬挂系统无法根据路况实时调整阻尼力，
导致车辆在不同路况下舒适性和操控性难以兼顾。

技术方案：本发明采用磁流变液阻尼器配合路况预测算法，
通过传感器实时采集路况数据，利用模糊PID控制器
动态调整阻尼力大小，实现悬挂特性的自适应调节。

具体实施方式：系统包括磁流变液阻尼器、加速度传感器阵列、
控制器单元和电源管理模块。传感器采集车身和车轮加速度信号，
控制器根据信号计算目标阻尼力，通过调节电流控制磁流变液粘度。

技术效果：车身振动幅度降低40%，悬挂响应时间缩短至10ms，
在不同路况下均能保持良好的舒适性和操控性。`.trim(),
      expectedKeyFeatures: ['磁流变液', '模糊PID', '自适应调节'],
    },
  }

  return disclosures[variant]
}

// ========== OA 文档 ==========

export interface SampleOfficeAction {
  applicationNumber: string
  patentTitle: string
  oaContent: string
  expectedRejectionTypes: string[]
}

export function createSampleOfficeAction(
  variant: 'first-oa-inventiveness' | 'second-oa-clarity' = 'first-oa-inventiveness'
): SampleOfficeAction {
  const actions: Record<string, SampleOfficeAction> = {
    'first-oa-inventiveness': {
      applicationNumber: 'CN202310000001.0',
      patentTitle: '一种基于相变材料的高效散热装置',
      oaContent: `
第一次审查意见通知书

申请号：CN202310000001.0
申请人：XX科技有限公司
发明名称：一种基于相变材料的高效散热装置

审查意见：

一、关于创造性（专利法第22条第3款）

权利要求1相对于对比文件1（CN1234567A，一种电子设备散热器）
结合对比文件2（CN2345678A，智能温控系统）不具备创造性。

对比文件1公开了使用散热基板和散热介质的散热装置，
对比文件2公开了通过温度传感器监测并控制散热的技术方案。
权利要求1的技术方案是上述两篇对比文件的简单组合，
属于本领域的常规技术手段，没有产生预料不到的技术效果。

权利要求2-5的附加技术特征也被对比文件1或2公开，
或属于本领域常规技术手段的有限选择。

二、关于说明书充分公开（专利法第26条第3款）

说明书中记载了"散热效率提高60%"等技术效果，
但未提供实验数据证明该效果。建议补充实验数据。

请申请人在收到本通知之日起四个月内予以答复。`.trim(),
      expectedRejectionTypes: ['inventiveness', 'disclosure'],
    },
    'second-oa-clarity': {
      applicationNumber: 'CN202310000001.0',
      patentTitle: '一种基于相变材料的高效散热装置',
      oaContent: `
第二次审查意见通知书

申请号：CN202310000001.0
申请人：XX科技有限公司
发明名称：一种基于相变材料的高效散热装置

审查意见：

一、关于权利要求的清楚性（专利法第26条第4款）

修改后的权利要求1中"多层复合散热结构"的含义不清楚，
未清楚地限定权利要求的保护范围。
建议将"多层复合散热结构"修改为具体的结构特征。

二、关于权利要求得到说明书支持（专利法第26条第4款）

权利要求3中"智能温控调节模块"的范围过于宽泛，
说明书中仅公开了通过温度传感器控制风扇的实施方式，
不能支持所有类型的智能温控调节模块。

请申请人在收到本通知之日起两个月内予以答复。`.trim(),
      expectedRejectionTypes: ['clarity', 'support'],
    },
  }

  return actions[variant]
}

// ========== 专利文档 ==========

export interface SamplePatent {
  publicationNumber: string
  title: string
  abstract: string
  claims: string[]
  technicalField: string
}

export function createSamplePatent(
  type: 'cn-invention' | 'cn-utility' = 'cn-invention'
): SamplePatent {
  return {
    publicationNumber: type === 'cn-invention' ? 'CN202310000001.0' : 'CN202320000001.0',
    title: '一种电子设备散热器',
    abstract:
      '本发明公开了一种电子设备散热器，包括散热基板、导热管和散热鳍片。散热基板与电子元件接触，导热管将热量传递至散热鳍片，散热鳍片增大散热面积提高散热效率。',
    claims: [
      '1. 一种电子设备散热器，其特征在于，包括：散热基板；导热管，与所述散热基板热耦合连接；散热鳍片，设置在所述导热管上。',
      '2. 根据权利要求1所述的散热器，其特征在于，所述导热管为热管或均温板。',
      '3. 根据权利要求1所述的散热器，其特征在于，所述散热鳍片为铝制鳍片。',
    ],
    technicalField: '电子设备散热技术',
  }
}

// ========== 敏感内容（触发 CON-01）==========

export function createSensitiveDisclosure(): string {
  return `
技术交底书

发明人：张三、李四
申请单位：XX科技有限公司

一、技术领域
本发明涉及一种基于相变材料的高效散热装置，属于电子设备热管理技术领域。

二、背景技术
现有设备在高温环境下散热效率低，无法满足高性能芯片的散热需求。
传统的风冷散热在高温环境下效率不足，液冷散热则存在体积大、成本高的问题。
随着5G通信和人工智能技术的发展，芯片功耗持续增长，散热问题日益突出。

三、发明内容
本发明的技术方案包括：
1. 采用相变材料作为散热介质，利用相变潜热吸收大量热量
2. 配置多层复合散热结构，提升热传导效率
3. 集成智能温控调节模块，实现动态热管理

四、具体实施方式
实施例1：散热装置包括散热基板、相变材料层和温控模块。
相变材料采用石蜡基复合材料，填充在散热基板与外壳之间。
温控模块通过温度传感器实时监测散热状态，自动调节散热策略。

实施例2：在实施例1的基础上，增加辅助风扇，
当温度超过80°C时启动风扇进行辅助散热，实现主动与被动散热结合。

五、实验数据
在环境温度60°C条件下测试：
- 传统散热器：芯片温度95°C，散热效率65%
- 本发明装置：芯片温度72°C，散热效率92%
- 散热效率提高：42%

六、技术效果
散热效率提高60%，工作温度范围扩大至-40°C至120°C，
整体能耗降低30%，使用寿命延长50%以上。`.trim()
}

export function createNormalContent(): string {
  return '请帮我查询一下关于电子设备散热方面的专利信息。'
}

// ========== 编排器输入 ==========

export interface SampleOrchestratorInput {
  sessionId: string
  userId: string
  message: string
  attachments?: unknown[]
  context?: Record<string, unknown>
}

export function createDraftIntent(): SampleOrchestratorInput {
  return {
    sessionId: 'test-session-draft-001',
    userId: 'test-user-001',
    message: '请帮我撰写一份关于"基于相变材料的高效散热装置"的专利申请',
  }
}

export function createOAIntent(): SampleOrchestratorInput {
  return {
    sessionId: 'test-session-oa-001',
    userId: 'test-user-001',
    message: '我收到了一份审查意见通知书，需要帮我分析并撰写答复',
    attachments: [{ type: 'office-action', content: createSampleOfficeAction().oaContent }],
  }
}

export function createSearchIntent(): SampleOrchestratorInput {
  return {
    sessionId: 'test-session-search-001',
    userId: 'test-user-001',
    message: '检索一下关于电子设备散热的现有专利',
  }
}

export function createChitchatIntent(): SampleOrchestratorInput {
  return {
    sessionId: 'test-session-chat-001',
    userId: 'test-user-001',
    message: '你好，今天天气怎么样？',
  }
}

export function createAmbiguousIntent(): SampleOrchestratorInput {
  return {
    sessionId: 'test-session-ambiguous-001',
    userId: 'test-user-001',
    message: '帮我处理一下这个专利的事情',
  }
}

// ========== 搜索结果 ==========

export function createSearchResults() {
  return {
    results: [
      {
        publicationNumber: 'CN1234567A',
        title: '一种电子设备散热器',
        applicant: 'XX电子科技公司',
        filingDate: '2022-01-15',
        abstract: '本发明公开了一种电子设备散热器...',
        relevanceScore: 0.85,
        source: 'patent_db',
      },
      {
        publicationNumber: 'CN2345678A',
        title: '智能温控散热系统',
        applicant: 'YY科技公司',
        filingDate: '2022-06-20',
        abstract: '本发明公开了一种智能温控散热系统...',
        relevanceScore: 0.72,
        source: 'google_patents',
      },
    ],
    totalResults: 2,
    searchStrategy: ['关键词: 散热 电子设备', 'IPC: H01L23/367'],
  }
}
