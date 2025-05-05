/**
 * ProjectScanTool 测试
 *
 * 测试目录扫描、官文检测、阶段推断、systemPromptContext 生成
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { ProjectScanTool } from '../src/tools/ProjectScanTool.js'

// 测试用的临时目录
let tempDir: string

beforeAll(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yunpat-scan-test-'))
})

afterAll(() => {
  fs.rmSync(tempDir, { recursive: true, force: true })
})

/** 创建测试文件 */
function createTestFile(filename: string, content: string): string {
  const filePath = path.join(tempDir, filename)
  fs.writeFileSync(filePath, content, 'utf-8')
  return filePath
}

// ─── 官文检测测试 ─────────────────────────────────────────────

describe('CNIPA 官文检测', () => {
  it('通过文件名识别审查意见通知书', async () => {
    createTestFile(
      '审查意见通知书.pdf.txt',
      '国家知识产权局\n审查意见通知书\n申请号：2023101234567\n发明名称：一种XX方法'
    )
    const tool = new ProjectScanTool()
    const result = await tool.execute({ workingDirectory: tempDir })

    expect(result.success).toBe(true)
    const doc = result.data!.documents.find((d) => d.filename === '审查意见通知书.pdf.txt')
    expect(doc).toBeDefined()
    expect(doc!.category).toBe('official_doc')
    expect(doc!.officialDocType).toBe('review_opinion')
    expect(doc!.extractedFields?.applicationNumber).toBe('2023101234567')
    expect(doc!.extractedFields?.inventionTitle).toBe('一种XX方法')
  })

  it('通过内容识别驳回决定', async () => {
    const subDir = path.join(tempDir, 'content-test')
    fs.mkdirSync(subDir, { recursive: true })
    fs.writeFileSync(
      path.join(subDir, 'document1.txt'),
      '国家知识产权局\n驳回决定\n申请号：2022109876543\n发明名称：智能控制系统'
    )

    const tool = new ProjectScanTool()
    const result = await tool.execute({ workingDirectory: subDir })

    expect(result.success).toBe(true)
    expect(result.data!.documents.some((d) => d.officialDocType === 'rejection_decision')).toBe(
      true
    )
  })

  it('非官文文档不被误判', async () => {
    const subDir = path.join(tempDir, 'non-official')
    fs.mkdirSync(subDir, { recursive: true })
    fs.writeFileSync(path.join(subDir, '普通文档.txt'), '这是一份普通的会议记录')

    const tool = new ProjectScanTool()
    const result = await tool.execute({ workingDirectory: subDir })

    expect(result.success).toBe(true)
    expect(result.data!.documents.every((d) => d.category !== 'official_doc')).toBe(true)
  })
})

// ─── 非官文分类测试 ───────────────────────────────────────────

describe('非官文文档分类', () => {
  it('识别技术交底书', async () => {
    const subDir = path.join(tempDir, 'tech-disclosure')
    fs.mkdirSync(subDir, { recursive: true })
    fs.writeFileSync(
      path.join(subDir, '交底书.txt'),
      '技术交底书\n发明人：张三\n技术领域：人工智能\n技术方案：...\n具体实施方式：...\n有益效果：...'
    )

    const tool = new ProjectScanTool()
    const result = await tool.execute({ workingDirectory: subDir })

    expect(result.success).toBe(true)
    expect(result.data!.documents.some((d) => d.category === 'technical_disclosure')).toBe(true)
  })

  it('识别对比文件', async () => {
    const subDir = path.join(tempDir, 'comparison')
    fs.mkdirSync(subDir, { recursive: true })
    fs.writeFileSync(path.join(subDir, '对比文件分析.txt'), '对比文件1与对比文件2的特征对比分析')

    const tool = new ProjectScanTool()
    const result = await tool.execute({ workingDirectory: subDir })

    expect(result.success).toBe(true)
    expect(result.data!.documents.some((d) => d.category === 'comparison_doc')).toBe(true)
  })
})

// ─── 阶段推断测试 ─────────────────────────────────────────────

describe('项目阶段推断', () => {
  it('有审查意见通知书 → response 阶段', async () => {
    const subDir = path.join(tempDir, 'response-phase')
    fs.mkdirSync(subDir, { recursive: true })
    fs.writeFileSync(path.join(subDir, '审查意见通知书.txt'), '审查意见通知书内容')

    const tool = new ProjectScanTool()
    const result = await tool.execute({ workingDirectory: subDir })

    expect(result.success).toBe(true)
    expect(result.data!.projectProfile.phase).toBe('response')
  })

  it('仅有技术交底书 → filing 阶段', async () => {
    const subDir = path.join(tempDir, 'filing-phase')
    fs.mkdirSync(subDir, { recursive: true })
    fs.writeFileSync(
      path.join(subDir, '交底书.txt'),
      '技术交底书\n发明人：李四\n技术方案\n具体实施方式\n有益效果'
    )

    const tool = new ProjectScanTool()
    const result = await tool.execute({ workingDirectory: subDir })

    expect(result.success).toBe(true)
    expect(result.data!.projectProfile.phase).toBe('filing')
  })

  it('空目录 → unknown 阶段', async () => {
    const subDir = path.join(tempDir, 'empty-dir')
    fs.mkdirSync(subDir, { recursive: true })

    const tool = new ProjectScanTool()
    const result = await tool.execute({ workingDirectory: subDir })

    expect(result.success).toBe(true)
    expect(result.data!.projectProfile.phase).toBe('unknown')
  })
})

// ─── 案件类型推断测试 ─────────────────────────────────────────

describe('案件类型推断', () => {
  it('包含商标关键词 → trademark', async () => {
    const subDir = path.join(tempDir, 'trademark')
    fs.mkdirSync(subDir, { recursive: true })
    fs.writeFileSync(
      path.join(subDir, '商标材料.txt'),
      '商标注册申请书\n商品分类：第9类\n商标图样\n注册号：12345678'
    )

    const tool = new ProjectScanTool()
    const result = await tool.execute({ workingDirectory: subDir })

    expect(result.success).toBe(true)
    expect(result.data!.projectProfile.caseType).toBe('trademark')
  })

  it('默认为 invention', async () => {
    const subDir = path.join(tempDir, 'default-case')
    fs.mkdirSync(subDir, { recursive: true })
    fs.writeFileSync(path.join(subDir, '普通文件.txt'), '一些普通内容')

    const tool = new ProjectScanTool()
    const result = await tool.execute({ workingDirectory: subDir })

    expect(result.success).toBe(true)
    expect(result.data!.projectProfile.caseType).toBe('invention')
  })
})

// ─── systemPromptContext 测试 ──────────────────────────────────

describe('systemPromptContext 生成', () => {
  it('包含工作目录和项目信息', async () => {
    const subDir = path.join(tempDir, 'context-test')
    fs.mkdirSync(subDir, { recursive: true })
    fs.writeFileSync(
      path.join(subDir, '审查意见通知书.txt'),
      '审查意见通知书\n申请号：2023101234567'
    )

    const tool = new ProjectScanTool()
    const result = await tool.execute({ workingDirectory: subDir })

    expect(result.success).toBe(true)
    const ctx = result.data!.systemPromptContext
    expect(ctx).toContain('[项目上下文]')
    expect(ctx).toContain(subDir)
    expect(ctx).toContain('审查意见答复')
    expect(ctx).toContain('可能的工作方向')
  })
})

// ─── 目录枚举边界测试 ─────────────────────────────────────────

describe('目录枚举边界', () => {
  it('跳过隐藏文件', async () => {
    const subDir = path.join(tempDir, 'hidden-test')
    fs.mkdirSync(subDir, { recursive: true })
    fs.writeFileSync(path.join(subDir, '.hidden'), '隐藏文件')
    fs.writeFileSync(path.join(subDir, 'visible.txt'), '可见文件')

    const tool = new ProjectScanTool()
    const result = await tool.execute({ workingDirectory: subDir })

    expect(result.success).toBe(true)
    expect(result.data!.documents.every((d) => !d.filename.startsWith('.'))).toBe(true)
    expect(result.data!.documents.length).toBe(1)
  })

  it('maxFiles 限制生效', async () => {
    const subDir = path.join(tempDir, 'max-files-test')
    fs.mkdirSync(subDir, { recursive: true })
    for (let i = 0; i < 10; i++) {
      fs.writeFileSync(path.join(subDir, `file${i}.txt`), `内容 ${i}`)
    }

    const tool = new ProjectScanTool()
    const result = await tool.execute({ workingDirectory: subDir, maxFiles: 5 })

    expect(result.success).toBe(true)
    expect(result.data!.documents.length).toBeLessThanOrEqual(5)
  })

  it('目录不存在时报错', async () => {
    const tool = new ProjectScanTool()
    const result = await tool.execute({ workingDirectory: '/nonexistent/directory' })

    expect(result.success).toBe(false)
    expect(result.error).toContain('目录不存在')
  })

  it('拒绝扫描系统敏感目录', async () => {
    const tool = new ProjectScanTool()
    const result = await tool.execute({ workingDirectory: '/etc/passwd' })

    expect(result.success).toBe(false)
    expect(result.error).toContain('访问被拒绝')
  })

  it('跳过符号链接', async () => {
    const subDir = path.join(tempDir, 'symlink-test')
    const targetDir = path.join(tempDir, 'symlink-target')
    fs.mkdirSync(subDir, { recursive: true })
    fs.mkdirSync(targetDir, { recursive: true })
    fs.writeFileSync(path.join(targetDir, 'target.txt'), '目标文件')
    // 创建符号链接
    try {
      fs.symlinkSync(targetDir, path.join(subDir, 'link'))
    } catch {
      // 某些环境不允许创建符号链接，跳过
      return
    }
    fs.writeFileSync(path.join(subDir, 'real.txt'), '真实文件')

    const tool = new ProjectScanTool()
    const result = await tool.execute({ workingDirectory: subDir })

    expect(result.success).toBe(true)
    // 符号链接目录应被跳过，不应包含 target.txt
    expect(result.data!.documents.every((d) => d.filename !== 'target.txt')).toBe(true)
    expect(result.data!.documents.some((d) => d.filename === 'real.txt')).toBe(true)
  })

  it('深度限制生效', async () => {
    const subDir = path.join(tempDir, 'depth-test')
    // 创建 6 层嵌套
    let current = subDir
    for (let i = 0; i < 6; i++) {
      current = path.join(current, `level${i}`)
      fs.mkdirSync(current, { recursive: true })
    }
    fs.writeFileSync(path.join(current, 'deep.txt'), '深层文件')

    const tool = new ProjectScanTool()
    const result = await tool.execute({ workingDirectory: subDir })

    expect(result.success).toBe(true)
    // 超过 maxDepth=5 的文件不应被发现
    expect(result.data!.documents.every((d) => d.filename !== 'deep.txt')).toBe(true)
  })
})

// ─── 综合场景测试 ─────────────────────────────────────────────

describe('综合场景', () => {
  it('完整的复审案件目录', async () => {
    const subDir = path.join(tempDir, 'reexamination-case')
    fs.mkdirSync(subDir, { recursive: true })

    // 模拟复审案件目录结构
    fs.writeFileSync(
      path.join(subDir, '驳回决定.txt'),
      '国家知识产权局\n驳回决定\n申请号：2023101234567\n发明名称：一种数据处理方法'
    )
    fs.writeFileSync(
      path.join(subDir, '技术交底书.txt'),
      '技术交底书\n发明人：王五\n技术方案\n具体实施方式\n有益效果'
    )
    fs.writeFileSync(path.join(subDir, '对比文件1.txt'), '对比文件分析报告')
    fs.writeFileSync(path.join(subDir, '截图.png'), '') // 空文件模拟图片
    fs.writeFileSync(path.join(subDir, '参考资料.zip'), '') // 空文件模拟压缩包

    const tool = new ProjectScanTool()
    const result = await tool.execute({ workingDirectory: subDir })

    expect(result.success).toBe(true)
    const data = result.data!

    // 验证摘要
    expect(data.summary.officialDocs).toBeGreaterThanOrEqual(1)
    expect(data.summary.archiveFiles).toBe(1)
    expect(data.summary.mediaFiles).toBeGreaterThanOrEqual(1)

    // 验证阶段推断
    expect(data.projectProfile.phase).toBe('reexamination')
    expect(data.projectProfile.applicationNumbers).toContain('2023101234567')
    expect(data.projectProfile.caseType).toBe('invention')

    // 验证 systemPromptContext
    expect(data.systemPromptContext).toContain('复审')
    expect(data.systemPromptContext).toContain('2023101234567')
    expect(data.systemPromptContext).toContain('一种数据处理方法')
  })
})
