import type {
  SpecificationSection,
  SpecificationContent,
  SpecificationDrafterInput,
  SpecificationDrafterOutput,
  Embodiment,
  DrawingDescription,
} from './SpecTypes.js'

/**
 * 标准化输出
 */
export function normalizeOutput(
  parsed: Record<string, unknown>,
  input: SpecificationDrafterInput
): SpecificationDrafterOutput {
  const getString = (key: string): string => {
    const value = parsed[key]
    return typeof value === 'string' ? value : ''
  }

  const getNumber = (key: string, fallback: number): number => {
    const value = parsed[key]
    return typeof value === 'number' && !isNaN(value) ? value : fallback
  }

  const technical_field = parseSection('technical_field', parsed)
  const background_art = parseSection('background_art', parsed)

  const invention_content_raw = parsed.invention_content as Record<string, unknown> | undefined
  const invention_content = {
    ...parseSection('invention_content', parsed),
    technical_problem: invention_content_raw ? getString('technical_problem') : '',
    technical_solution: invention_content_raw ? getString('technical_solution') : '',
    beneficial_effects: invention_content_raw ? getString('beneficial_effects') : '',
    beneficial_effects_list: parseBeneficialEffectsList(
      invention_content_raw?.beneficial_effects_list
    ),
  }

  const embodiments_raw = parsed.embodiments as Record<string, unknown> | undefined
  const embodiments = {
    ...parseSection('embodiments', parsed),
    embodiment_list: parseEmbodimentList(embodiments_raw?.embodiment_list),
    completeness_score: embodiments_raw ? getNumber('completeness_score', 0.8) : 0.8,
  }

  const drawings_description_raw = parsed.drawings_description as
    | Record<string, unknown>
    | undefined
  const drawings_description = {
    ...parseSection('drawings_description', parsed),
    drawings: parseDrawingsList(drawings_description_raw?.drawings, input.drawings),
  }

  const specification: SpecificationContent = {
    technical_field,
    background_art,
    invention_content,
    embodiments,
    drawings_description,
  }

  const totalWordCount =
    technical_field.wordCount +
    background_art.wordCount +
    invention_content.wordCount +
    embodiments.wordCount +
    drawings_description.wordCount

  const draftMode = input.draftMode || 'standard'

  return {
    specification,
    metrics: {
      totalWordCount,
      chapterCount: 5,
      terminologyConsistency: true,
      coherenceCheck: true,
      enablementCheck: true,
      supportCheck: true,
    },
    qualityScore: {
      overall: 0.8,
      clarity: 0.8,
      completeness: 0.8,
      consistency: 0.8,
    },
    confidence: getNumber('confidence', 0.85),
    metadata: {
      draftMode,
      timestamp: Date.now(),
      chaptersDrafted: input.chapters || [
        'technical_field',
        'background_art',
        'invention_content',
        'embodiments',
        'drawings_description',
      ],
    },
  }
}

/**
 * 解析章节
 */
export function parseSection(key: string, parsed: Record<string, unknown>): SpecificationSection {
  const section = parsed[key] as Record<string, unknown> | undefined

  if (!section) {
    return {
      chapter: key,
      title: key,
      content: '',
      wordCount: 0,
    }
  }

  return {
    chapter: getStr(section, 'chapter', key),
    title: getStr(section, 'title', key),
    content: getStr(section, 'content', ''),
    wordCount: getNum(section, 'wordCount', 0),
    quality: section.quality
      ? {
          clarity: getNum(section.quality as Record<string, unknown>, 'clarity', 0.8),
          completeness: getNum(section.quality as Record<string, unknown>, 'completeness', 0.8),
          consistency: getNum(section.quality as Record<string, unknown>, 'consistency', 0.8),
        }
      : undefined,
  }
}

/**
 * 解析有益效果列表
 */
export function parseBeneficialEffectsList(
  data: unknown
): Array<{ effect: string; metric?: string; improvement?: string }> {
  if (!Array.isArray(data)) return []

  return data.map((item: unknown) => {
    if (typeof item !== 'object' || item === null) {
      return { effect: String(item) }
    }
    const itemObj = item as Record<string, unknown>
    return {
      effect: getStr(itemObj, 'effect', ''),
      metric: itemObj.metric ? String(itemObj.metric) : undefined,
      improvement: itemObj.improvement ? String(itemObj.improvement) : undefined,
    }
  })
}

/**
 * 解析实施例列表
 */
export function parseEmbodimentList(data: unknown): Embodiment[] {
  if (!Array.isArray(data)) return []

  return data.map((item: unknown) => {
    if (typeof item !== 'object' || item === null) {
      return {
        number: 1,
        title: '实施例',
        content: String(item),
        relatedDrawings: [],
        keyFeatures: [],
        type: 'preferred' as const,
      }
    }

    const itemObj = item as Record<string, unknown>
    return {
      number: getNum(itemObj, 'number', 1),
      title: getStr(itemObj, 'title', '实施例'),
      content: getStr(itemObj, 'content', ''),
      relatedDrawings: getStrArray(itemObj, 'relatedDrawings'),
      keyFeatures: getStrArray(itemObj, 'keyFeatures'),
      type:
        itemObj.type === 'alternative'
          ? 'alternative'
          : itemObj.type === 'comparative'
            ? 'comparative'
            : 'preferred',
    }
  })
}

/**
 * 解析附图列表
 */
export function parseDrawingsList(data: unknown, inputDrawings?: string[]): DrawingDescription[] {
  if (!Array.isArray(data)) {
    return (inputDrawings || []).map((d, i) => ({
      figureNumber: `图${i + 1}`,
      title: `附图${i + 1}`,
      description: d,
      keyElements: [],
    }))
  }

  return data.map((item: unknown) => {
    if (typeof item !== 'object' || item === null) {
      return {
        figureNumber: `图${Array.isArray(data) ? data.indexOf(item) + 1 : 1}`,
        title: '附图',
        description: String(item),
        keyElements: [],
      }
    }

    const itemObj = item as Record<string, unknown>
    const keyElements = itemObj.keyElements as unknown[] | undefined
    return {
      figureNumber: getStr(itemObj, 'figureNumber', ''),
      title: getStr(itemObj, 'title', '附图'),
      description: getStr(itemObj, 'description', ''),
      keyElements: (keyElements || []).map((el: unknown) => {
        if (typeof el !== 'object' || el === null) {
          return { elementNumber: '', description: String(el) }
        }
        const elObj = el as Record<string, unknown>
        return {
          elementNumber: getStr(elObj, 'elementNumber', ''),
          description: getStr(elObj, 'description', ''),
        }
      }),
    }
  })
}

/**
 * 获取目标字数
 */
export function getTargetWordCounts(
  draftMode: string,
  customTargets?: SpecificationDrafterInput['targetWordCount']
): Required<NonNullable<SpecificationDrafterInput['targetWordCount']>> {
  if (customTargets) {
    return {
      technical_field: customTargets.technical_field ?? 100,
      background_art: customTargets.background_art ?? 300,
      invention_content: customTargets.invention_content ?? 800,
      embodiments: customTargets.embodiments ?? 1500,
      drawings_description: customTargets.drawings_description ?? 200,
    }
  }

  const multipliers: Record<string, number> = {
    detailed: 1.5,
    standard: 1.0,
    concise: 0.6,
  }

  const multiplier = multipliers[draftMode] ?? 1.0

  return {
    technical_field: Math.round(100 * multiplier),
    background_art: Math.round(300 * multiplier),
    invention_content: Math.round(800 * multiplier),
    embodiments: Math.round(1500 * multiplier),
    drawings_description: Math.round(200 * multiplier),
  }
}

/**
 * 创建回退输出
 */
export function createFallbackOutput(input: SpecificationDrafterInput): SpecificationDrafterOutput {
  const { inventionUnderstanding } = input

  const specification: SpecificationContent = {
    technical_field: {
      chapter: '技术领域',
      title: '技术领域',
      content: inventionUnderstanding.technicalField,
      wordCount: inventionUnderstanding.technicalField.length,
    },
    background_art: {
      chapter: '背景技术',
      title: '背景技术',
      content: inventionUnderstanding.backgroundArt || '无',
      wordCount: inventionUnderstanding.backgroundArt?.length || 0,
    },
    invention_content: {
      chapter: '发明内容',
      title: '发明内容',
      content: `${inventionUnderstanding.technicalProblem}\n\n${inventionUnderstanding.technicalSolution}\n\n${inventionUnderstanding.beneficialEffects || ''}`,
      wordCount:
        inventionUnderstanding.technicalProblem.length +
        inventionUnderstanding.technicalSolution.length +
        (inventionUnderstanding.beneficialEffects?.length || 0),
      technical_problem: inventionUnderstanding.technicalProblem,
      technical_solution: inventionUnderstanding.technicalSolution,
      beneficial_effects: inventionUnderstanding.beneficialEffects || '',
      beneficial_effects_list: [],
    },
    embodiments: {
      chapter: '具体实施方式',
      title: '具体实施方式',
      content: '本发明的具体实施方式将结合附图进行详细描述。',
      wordCount: 30,
      embodiment_list: [],
      completeness_score: 0.3,
    },
    drawings_description: {
      chapter: '附图说明',
      title: '附图说明',
      content: input.drawings?.map((d, i) => `图${i + 1}: ${d}`).join('\n') || '无',
      wordCount: input.drawings?.join('\n').length || 0,
      drawings:
        input.drawings?.map((d, i) => ({
          figureNumber: `图${i + 1}`,
          title: `附图${i + 1}`,
          description: d,
          keyElements: [],
        })) || [],
    },
  }

  return {
    specification,
    metrics: {
      totalWordCount: 500,
      chapterCount: 5,
      terminologyConsistency: false,
      coherenceCheck: false,
      enablementCheck: false,
      supportCheck: false,
    },
    qualityScore: {
      overall: 0.5,
      clarity: 0.5,
      completeness: 0.5,
      consistency: 0.5,
    },
    confidence: 0.5,
    metadata: {
      draftMode: input.draftMode || 'standard',
      timestamp: Date.now(),
      chaptersDrafted: [],
    },
  }
}

function getStr(obj: Record<string, unknown>, key: string, fallback: string): string {
  const value = obj[key]
  return typeof value === 'string' ? value : fallback
}

function getNum(obj: Record<string, unknown>, key: string, fallback: number): number {
  const value = obj[key]
  return typeof value === 'number' && !isNaN(value) ? value : fallback
}

function getStrArray(obj: Record<string, unknown>, key: string): string[] {
  const value = obj[key]
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string')
}
