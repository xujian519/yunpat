/**
 * 质量检查纯函数
 *
 * 包含内容质量检查的纯函数，不依赖类实例状态。
 */

import type { QualityRequirements, QualityReport } from './ResultValidatorTypes.js'

/**
 * 内容质量检查
 */
export function checkQuality(content: string, requirements: QualityRequirements): QualityReport {
  const lengthCheck = checkLength(content, requirements)
  const keywordCheck = checkKeywords(content, requirements)
  const completenessCheck = checkCompleteness(content, requirements)

  const passed = lengthCheck.passed && keywordCheck.passed && completenessCheck.passed

  return {
    passed,
    lengthCheck,
    keywordCheck,
    completenessCheck,
  }
}

/**
 * 长度检查
 */
function checkLength(
  content: string,
  requirements: QualityRequirements
): QualityReport['lengthCheck'] {
  const actualLength = content.length
  const minLength = requirements.minLength
  const maxLength = requirements.maxLength

  const passed =
    (!minLength || actualLength >= minLength) && (!maxLength || actualLength <= maxLength)

  return {
    passed,
    actualLength,
    minLength,
    maxLength,
  }
}

/**
 * 关键词检查
 */
function checkKeywords(
  content: string,
  requirements: QualityRequirements
): QualityReport['keywordCheck'] {
  const missingRequired: string[] = []
  const foundForbidden: string[] = []

  // 检查必需关键词
  if (requirements.requiredKeywords) {
    for (const keyword of requirements.requiredKeywords) {
      if (!content.includes(keyword)) {
        missingRequired.push(keyword)
      }
    }
  }

  // 检查禁止关键词
  if (requirements.forbiddenKeywords) {
    for (const keyword of requirements.forbiddenKeywords) {
      if (content.includes(keyword)) {
        foundForbidden.push(keyword)
      }
    }
  }

  const passed = missingRequired.length === 0 && foundForbidden.length === 0

  return {
    passed,
    missingRequired,
    foundForbidden,
  }
}

/**
 * 完整性检查
 */
function checkCompleteness(
  content: string,
  requirements: QualityRequirements
): QualityReport['completenessCheck'] {
  if (!requirements.mustBeComplete) {
    return {
      passed: true,
      isTruncated: false,
    }
  }

  const truncationMarkers = requirements.truncationMarkers || [
    '...',
    '（未完）',
    '(未完)',
    '待续',
    'To be continued',
    '[TRUNCATED]',
    '[INCOMPLETE]',
  ]

  const trimmedContent = content.trim()
  for (const marker of truncationMarkers) {
    if (trimmedContent.endsWith(marker)) {
      return {
        passed: false,
        isTruncated: true,
        truncationMarker: marker,
      }
    }
  }

  return {
    passed: true,
    isTruncated: false,
  }
}
