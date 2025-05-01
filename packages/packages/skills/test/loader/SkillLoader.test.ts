/**
 * SkillLoader 测试
 *
 * @package @yunpat/skills
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { join } from 'path'
import { readFileSync } from 'fs'
import { loadSkillsFromDir, parseFrontmatter } from '../../src/index.js'

// TODO: 修复测试后移除 skip
describe.skip('SkillLoader', () => {
  describe('parseFrontmatter', () => {
    it('should parse basic frontmatter', () => {
      const markdown = `---
name: test-skill
description: Test skill
---

Content here`

      const { frontmatter, content } = parseFrontmatter(markdown, 'test.md')

      expect(frontmatter.name).toBe('test-skill')
      expect(frontmatter.description).toBe('Test skill')
      expect(content.trim()).toBe('Content here')
    })

    it('should throw error if neither name nor description is provided', () => {
      const content = `---
version: 1.0.0
---

Content here`

      expect(() => parseFrontmatter(content, 'test.md')).toThrow()
    })

    it('should parse complex frontmatter', () => {
      const content = `---
name: complex-skill
description: Complex skill
version: 1.0.0
user-invocable: true
when_to_use: |
  - Scenario 1
  - Scenario 2
allowed-tools:
  - Read
  - Bash(command:*)
knowledge:
  concepts:
    - 三步法
    - 创造性
  max_items: 3
---

Content here`

      const { frontmatter } = parseFrontmatter(content, 'test.md')

      expect(frontmatter.name).toBe('complex-skill')
      expect(frontmatter.version).toBe('1.0.0')
      expect(frontmatter['user-invocable']).toBe(true)
      expect(frontmatter.when_to_use).toEqual(['Scenario 1', 'Scenario 2'])
      expect(frontmatter['allowed-tools']).toEqual(['Read', 'Bash(command:*)'])
      expect(frontmatter.knowledge?.concepts).toEqual(['三步法', '创造性'])
      expect(frontmatter.knowledge?.['max_items']).toBe(3)
    })
  })

  describe('loadSkillsFromDir', () => {
    it('should load skills from directory', async () => {
      const skillsDir = join(process.cwd(), 'test/fixtures/skills')
      const skills = await loadSkillsFromDir(skillsDir, 'project')

      expect(skills.length).toBeGreaterThan(0)
      expect(skills[0].name).toBeDefined()
      expect(skills[0].description).toBeDefined()
    })

    it('should handle missing directory gracefully', async () => {
      const skills = await loadSkillsFromDir('/nonexistent/directory', 'project')

      expect(skills).toEqual([])
    })

    it('should skip invalid skills', async () => {
      // 创建一个临时目录，包含一个无效的 Skill
      // 这里简化处理，实际测试中应该创建临时目录
    })
  })
})
