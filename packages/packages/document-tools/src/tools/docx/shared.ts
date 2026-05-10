/**
 * 专利文档生成工具 - 共享模块
 */

// 动态导入 docx
let docx: any
let docxPacker: any

export async function loadDocx() {
  if (!docx) {
    const module = await import('docx')
    docx = module
    docxPacker = module.Packer
  }
  return { docx, docxPacker }
}

export interface PatentApplicationData {
  inventionTitle: string
  technicalField: string
  backgroundArt: string
  inventionContent: string
  drawingsDescription?: string
  embodiment?: string
  claims: Array<{
    type: 'independent' | 'dependent'
    number: number
    content: string
    dependsOn?: number
  }>
  abstract: string
  applicant?: {
    name: string
    address: string
  }
  inventors?: Array<{
    name: string
    address: string
  }>
}

export interface ResponseStatementData {
  applicationNumber: string
  inventionTitle: string
  reviewOpinionSummary: string
  responsePoints: Array<{
    examinerView: string
    applicantResponse: string
    legalBasis?: string
  }>
  amendments?: Array<{
    location: string
    originalContent: string
    newContent: string
    reason: string
  }>
  applicant?: {
    name: string
    address: string
  }
  date?: string
}
