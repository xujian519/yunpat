/**
 * 内置答复模板数据
 *
 * 包含 CN/PCT/US 多地区、多驳回类型的专用模板
 * @module template/BuiltInTemplates
 */

import type { ResponseTemplate } from '../types/index.js'
import { RejectionType, ResponseStrategy } from '../types/index.js'

export const BUILT_IN_TEMPLATES: ResponseTemplate[] = [
  // CN - 新颖性模板
  {
    id: 'cn-novelty-argue',
    name: 'CN新颖性争辩模板',
    applicableRejections: [RejectionType.NOVELTY],
    applicableStrategies: [ResponseStrategy.ARGUE, ResponseStrategy.BOTH],
    content: {
      opening:
        '尊敬的审查员：\n\n申请人收到贵局于{notificationDate}发出的关于申请号{applicationNumber}的审查意见通知书。现针对审查意见中指出的新颖性问题，陈述意见如下：\n',
      argumentTemplates: [
        {
          category: '区别技术特征',
          template:
            '一、关于权利要求{claimNumbers}的新颖性\n\n1. 对比文件{referenceNumber}公开的技术内容\n   {referenceContent}\n\n2. 本申请权利要求{claimNumbers}与对比文件{referenceNumber}的区别技术特征\n   经对比分析，本申请权利要求{claimNumbers}与对比文件{referenceNumber}相比，至少存在以下区别技术特征：\n   {distinguishingFeatures}\n\n3. 关于区别技术特征的说明\n   上述区别技术特征在对比文件{referenceNumber}中并未公开，也不属于本领域的公知常识。',
          placeholders: [
            'claimNumbers',
            'referenceNumber',
            'referenceContent',
            'distinguishingFeatures',
          ],
        },
        {
          category: '技术效果对比',
          template:
            '二、区别技术特征带来的技术效果\n\n本申请通过上述区别技术特征的设置，实现了{technicalEffect}的技术效果，而对比文件{referenceNumber}无法实现该技术效果。',
          placeholders: ['technicalEffect', 'referenceNumber'],
        },
      ],
      closing:
        '\n综上所述，本申请权利要求{claimNumbers}相对于对比文件{referenceNumber}具备《专利法》第22条第2款规定的新颖性。\n\n此致\n敬礼！\n\n{responseDate}',
    },
    tags: ['cn', 'novelty', 'argue'],
    usageCount: 0,
    successRate: 0.65,
  },

  // CN - 创造性模板
  {
    id: 'cn-inventiveness-argue',
    name: 'CN创造性争辩模板',
    applicableRejections: [RejectionType.INVENTIVENESS],
    applicableStrategies: [ResponseStrategy.ARGUE, ResponseStrategy.BOTH],
    content: {
      opening:
        '尊敬的审查员：\n\n申请人收到贵局于{notificationDate}发出的关于申请号{applicationNumber}的审查意见通知书。现针对审查意见中指出的创造性问题，陈述意见如下：\n',
      argumentTemplates: [
        {
          category: '最接近现有技术',
          template:
            '一、最接近的现有技术\n\n对比文件{referenceNumber}公开了{referenceContent}，其与本申请属于相同的技术领域，可作为最接近的现有技术。',
          placeholders: ['referenceNumber', 'referenceContent'],
        },
        {
          category: '区别技术特征',
          template:
            '二、区别技术特征的确定\n\n权利要求{claimNumbers}与对比文件{referenceNumber}相比，具有以下区别技术特征：\n{distinguishingFeatures}',
          placeholders: ['claimNumbers', 'distinguishingFeatures'],
        },
        {
          category: '技术问题',
          template:
            '三、实际解决的技术问题\n\n根据上述区别技术特征，本申请实际解决的技术问题是：{technicalProblem}。',
          placeholders: ['technicalProblem'],
        },
        {
          category: '非显而易见性',
          template:
            '四、关于显而易见性的分析\n\n1. 对比文件{referenceNumber}未给出技术启示\n   对比文件{referenceNumber}虽然涉及相关技术，但并未给出将上述区别技术特征应用于最接近现有技术以解决上述技术问题的任何技术启示。\n\n2. 不存在技术动机\n   本领域技术人员在面对上述技术问题时，没有动机将对比文件{referenceNumber}与最接近现有技术相结合。\n\n3. 技术障碍的存在\n   在将上述区别技术特征应用于最接近现有技术时，存在{technicalObstacle}的技术障碍，而本申请成功克服了该障碍。',
          placeholders: ['referenceNumber', 'technicalObstacle'],
        },
        {
          category: '预料不到的技术效果',
          template:
            '五、预料不到的技术效果\n\n本申请通过上述区别技术特征的设置，实现了{unexpectedEffect}的技术效果，这对于本领域技术人员来说是预料不到的，进一步证明了本申请的创造性。',
          placeholders: ['unexpectedEffect'],
        },
      ],
      closing:
        '\n综上所述，本申请权利要求{claimNumbers}相对于对比文件{referenceNumber}具备突出的实质性特点和显著的进步，符合《专利法》第22条第3款关于创造性的规定。\n\n此致\n敬礼！\n\n{responseDate}',
    },
    tags: ['cn', 'inventiveness', 'argue'],
    usageCount: 0,
    successRate: 0.6,
  },

  // CN - 充分公开模板
  {
    id: 'cn-support-amend',
    name: 'CN充分公开修改模板',
    applicableRejections: [RejectionType.SUPPORT],
    applicableStrategies: [ResponseStrategy.AMEND, ResponseStrategy.BOTH],
    content: {
      opening:
        '尊敬的审查员：\n\n申请人收到贵局于{notificationDate}发出的关于申请号{applicationNumber}的审查意见通知书。现针对审查意见中指出的充分公开问题，陈述意见并进行修改如下：\n',
      argumentTemplates: [
        {
          category: '说明书公开内容',
          template:
            '一、说明书的公开内容\n\n说明书在第{section}段中对{feature}进行了详细描述，公开内容包括：\n{disclosureContent}\n\n本领域技术人员根据说明书公开的内容，完全能够实现该技术方案。',
          placeholders: ['section', 'feature', 'disclosureContent'],
        },
        {
          category: '修改说明',
          template:
            '二、权利要求的修改说明\n\n根据说明书的公开内容，申请人对权利要求{claimNumbers}进行了修改，将{feature}进一步限定为：{amendedContent}\n\n该修改内容直接来源于说明书第{section}段的记载，未超出原说明书和权利要求书记载的范围。',
          placeholders: ['claimNumbers', 'feature', 'amendedContent', 'section'],
        },
      ],
      closing:
        '\n综上所述，通过上述修改，本申请已经符合《专利法》第26条第3款关于充分公开的规定。\n\n此致\n敬礼！\n\n{responseDate}',
    },
    tags: ['cn', 'support', 'amend'],
    usageCount: 0,
    successRate: 0.8,
  },

  // PCT - 新颖性模板
  {
    id: 'pct-novelty-argue',
    name: 'PCT Novelty Response Template',
    applicableRejections: [RejectionType.NOVELTY],
    applicableStrategies: [ResponseStrategy.ARGUE, ResponseStrategy.BOTH],
    content: {
      opening:
        'Dear Examiner,\n\nThe Applicant received the Office Action dated {notificationDate} regarding application No. {applicationNumber}. We would like to respond to the novelty objections as follows:\n',
      argumentTemplates: [
        {
          category: 'Distinguishing Features',
          template:
            '1. Distinguishing Features over {referenceNumber}\n\nClaim {claimNumbers} differs from {referenceNumber} in at least the following aspects:\n{distinguishingFeatures}\n\nThese distinguishing features are not disclosed in {referenceNumber}, nor do they belong to the common general knowledge in the art.',
          placeholders: ['referenceNumber', 'claimNumbers', 'distinguishingFeatures'],
        },
        {
          category: 'Technical Effects',
          template:
            '2. Technical Effects of Distinguishing Features\n\nThe distinguishing features mentioned above provide the following technical effects:\n{technicalEffects}\n\nThese technical effects are not achieved by {referenceNumber}.',
          placeholders: ['technicalEffects', 'referenceNumber'],
        },
      ],
      closing:
        '\nIn conclusion, claim {claimNumbers} is novel over {referenceNumber} in accordance with the requirements of Article 16(2) of the PCT.\n\nSincerely,\n\n{responseDate}',
    },
    tags: ['pct', 'novelty', 'argue'],
    usageCount: 0,
    successRate: 0.65,
  },

  // PCT - 创造性模板
  {
    id: 'pct-inventiveness-argue',
    name: 'PCT Inventive Step Response Template',
    applicableRejections: [RejectionType.INVENTIVENESS],
    applicableStrategies: [ResponseStrategy.ARGUE, ResponseStrategy.BOTH],
    content: {
      opening:
        'Dear Examiner,\n\nThe Applicant received the Office Action dated {notificationDate} regarding application No. {applicationNumber}. We would like to respond to the inventive step objections as follows:\n',
      argumentTemplates: [
        {
          category: 'Closest Prior Art',
          template:
            '1. Closest Prior Art\n\n{referenceNumber} discloses {referenceContent} and belongs to the same technical field as the claimed invention. It can be considered as the closest prior art.',
          placeholders: ['referenceNumber', 'referenceContent'],
        },
        {
          category: 'Distinguishing Features',
          template:
            '2. Distinguishing Features\n\nThe claimed invention differs from {referenceNumber} in the following aspects:\n{distinguishingFeatures}',
          placeholders: ['referenceNumber', 'distinguishingFeatures'],
        },
        {
          category: 'Technical Problem',
          template:
            '3. Technical Problem\n\nThe technical problem actually solved by the claimed invention in view of the closest prior art is: {technicalProblem}.',
          placeholders: ['technicalProblem'],
        },
        {
          category: 'Non-obviousness',
          template:
            '4. Non-obviousness\n\n{referenceNumber} does not suggest the combination of the distinguishing features with the closest prior art to solve the technical problem mentioned above. A person skilled in the art would not have had a motive to make such combination, especially considering the existence of the following technical obstacles:\n{technicalObstacles}',
          placeholders: ['referenceNumber', 'technicalObstacles'],
        },
        {
          category: 'Unexpected Technical Effects',
          template:
            '5. Unexpected Technical Effects\n\nThe claimed invention achieves the following unexpected technical effects:\n{unexpectedEffects}\n\nThis further demonstrates the inventive step of the claimed invention.',
          placeholders: ['unexpectedEffects'],
        },
      ],
      closing:
        '\nIn conclusion, the claimed invention involves an inventive step in accordance with the requirements of Article 16(3) of the PCT.\n\nSincerely,\n\n{responseDate}',
    },
    tags: ['pct', 'inventiveness', 'argue'],
    usageCount: 0,
    successRate: 0.6,
  },

  // US - 新颖性模板
  {
    id: 'us-novelty-argue',
    name: 'US Novelty Response Template',
    applicableRejections: [RejectionType.NOVELTY],
    applicableStrategies: [ResponseStrategy.ARGUE, ResponseStrategy.BOTH],
    content: {
      opening:
        'Dear Examiner,\n\nApplicant acknowledges receipt of the Office Action dated {notificationDate} regarding application No. {applicationNumber}. In response to the novelty rejection under 35 U.S.C. § 102, Applicant submits the following remarks:\n',
      argumentTemplates: [
        {
          category: 'Anticipation Analysis',
          template:
            '1. Analysis of Anticipation\n\nThe examiner argues that {referenceNumber} anticipates claim {claimNumbers}. However, claim {claimNumbers} differs from {referenceNumber} in the following aspects:\n{distinguishingFeatures}\n\nThese distinguishing features are not disclosed in {referenceNumber}. Therefore, {referenceNumber} does not anticipate claim {claimNumbers}.',
          placeholders: ['referenceNumber', 'claimNumbers', 'distinguishingFeatures'],
        },
      ],
      closing:
        '\nBased on the foregoing, claim {claimNumbers} is novel over {referenceNumber} in accordance with 35 U.S.C. § 102.\n\nRespectfully submitted,\n\n{responseDate}',
    },
    tags: ['us', 'novelty', 'argue'],
    usageCount: 0,
    successRate: 0.65,
  },

  // US - 创造性模板
  {
    id: 'us-inventiveness-argue',
    name: 'US Non-obviousness Response Template',
    applicableRejections: [RejectionType.INVENTIVENESS],
    applicableStrategies: [ResponseStrategy.ARGUE, ResponseStrategy.BOTH],
    content: {
      opening:
        'Dear Examiner,\n\nApplicant acknowledges receipt of the Office Action dated {notificationDate} regarding application No. {applicationNumber}. In response to the obviousness rejection under 35 U.S.C. § 103, Applicant submits the following remarks:\n',
      argumentTemplates: [
        {
          category: 'Graham Analysis',
          template:
            '1. Graham Factor Analysis\n\n(a) Scope and Content of Prior Art\n{referenceNumber} discloses {referenceContent}.\n\n(b) Differences Between Prior Art and Claims at Issue\nClaim {claimNumbers} differs from the prior art in the following aspects:\n{distinguishingFeatures}\n\n(c) Level of Ordinary Skill in the Art\nBased on the complexity of the technology, a person having ordinary skill in the art (PHOSITA) would have...\n\n(d) Secondary Considerations\nThe claimed invention provides the following unexpected technical effects:\n{unexpectedEffects}',
          placeholders: [
            'referenceNumber',
            'referenceContent',
            'claimNumbers',
            'distinguishingFeatures',
            'unexpectedEffects',
          ],
        },
        {
          category: 'TSM Test',
          template:
            '2. Teaching, Suggestion, or Motivation (TSM) Test\n\n{referenceNumber} does not teach, suggest, or motivate a person of ordinary skill in the art to modify the prior art to arrive at the claimed invention. In particular:\n- There is no teaching in {referenceNumber} to make the proposed modification\n- There is no suggestion in the prior art to combine the references\n- There is no motivation to arrive at the claimed invention',
          placeholders: ['referenceNumber'],
        },
      ],
      closing:
        '\nBased on the foregoing, claim {claimNumbers} is non-obvious in accordance with 35 U.S.C. § 103.\n\nRespectfully submitted,\n\n{responseDate}',
    },
    tags: ['us', 'inventiveness', 'argue'],
    usageCount: 0,
    successRate: 0.6,
  },

  // 通用 - 修改权利要求模板
  {
    id: 'general-amend-claims',
    name: '通用权利要求修改模板',
    applicableRejections: [
      RejectionType.NOVELTY,
      RejectionType.INVENTIVENESS,
      RejectionType.CLARITY,
      RejectionType.SCOPE,
    ],
    applicableStrategies: [ResponseStrategy.AMEND, ResponseStrategy.BOTH],
    content: {
      opening: '',
      argumentTemplates: [
        {
          category: '修改说明',
          template:
            '权利要求{claimNumber}的修改说明：\n\n原权利要求{claimNumber}：\n{originalText}\n\n修改后的权利要求{claimNumber}：\n{amendedText}\n\n修改依据：说明书第{section}段记载了"{basis}"。\n\n修改理由：通过添加"{addedFeature}"技术特征，进一步限定了{limitedAspect}，使权利要求{claimNumber}的保护范围更加清晰明确。',
          placeholders: [
            'claimNumber',
            'originalText',
            'amendedText',
            'section',
            'basis',
            'addedFeature',
            'limitedAspect',
          ],
        },
      ],
      closing: '',
    },
    tags: ['general', 'amend'],
    usageCount: 0,
    successRate: 0.7,
  },
]
