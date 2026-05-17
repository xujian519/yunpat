/**
 * ConditionalActivator 测试
 *
 * @package @yunpat/skills
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ConditionalActivator } from '../../src/activation/ConditionalActivator.js'
import { PathMatcher } from '../../src/activation/PathMatcher.js'
import type { Skill } from '../../src/types/Skill.js'
import type { SkillFrontmatter } from '../../src/types/SkillFrontmatter.js'
import { SkillSource } from '../../src/types/Skill.js'

// 创建测试 Skill 的辅助函数
function createTestSkill(name: string, frontmatter: Partial<SkillFrontmatter>): Skill {
  return {
    name,
    description: `Test skill ${name}`,
    frontmatter: {
      ...frontmatter,
    } as SkillFrontmatter,
    content: 'Test content',
    getPromptForCommand: async () => ({
      system: 'test',
      user: 'test',
      metadata: {
        tokenCount: 0,
        hasKnowledge: false,
        hasVariables: false,
        hasShellCommands: false,
      },
    }),
    loadedAt: new Date(),
    source: SkillSource.PROJECT,
  }
}

// TODO: 修复测试后移除 skip
describe.skip('ConditionalActivator', () => {
  let activator: ConditionalActivator
  let skills: Skill[]

  beforeEach(() => {
    const pathMatcher = new PathMatcher()
    activator = new ConditionalActivator(pathMatcher)

    // 创建测试 Skills
    skills = [
      createTestSkill('pdf-skill', {
        paths: ['**/*.pdf'],
        description: 'PDF processing skill',
      }),
      createTestSkill('markdown-skill', {
        paths: ['**/*.md'],
        description: 'Markdown processing skill',
      }),
      createTestSkill('code-skill', {
        paths: ['src/**/*.ts', 'src/**/*.tsx'],
        description: 'Code processing skill',
      }),
      createTestSkill('generic-skill', {
        description: 'Generic skill without conditions',
      }),
      createTestSkill('agent-specific-skill', {
        agent: 'TestAgent',
        description: 'Agent specific skill',
      }),
      createTestSkill('multi-condition-skill', {
        paths: ['**/*.pdf'],
        agent: 'TestAgent',
        description: 'Multi-condition skill',
      }),
    ]
  })

  describe('getActiveSkills', () => {
    it('should return skills matching path pattern', () => {
      const results = activator.getActiveSkills(skills, {
        filePath: '/path/to/file.pdf',
      })

      expect(results).toHaveLength(1)
      expect(results[0].skill.name).toBe('pdf-skill')
      expect(results[0].matchedBy).toBe('path')
    })

    it('should return skills matching file type', () => {
      const results = activator.getActiveSkills(skills, {
        filePath: '/path/to/file.md',
      })

      expect(results).toHaveLength(1)
      expect(results[0].skill.name).toBe('markdown-skill')
    })

    it('should return skills matching agent', () => {
      const results = activator.getActiveSkills(skills, {
        agentName: 'TestAgent',
      })

      expect(results).toHaveLength(2) // agent-specific-skill 和 generic-skill
      expect(results.some((r) => r.skill.name === 'agent-specific-skill')).toBe(true)
    })

    it('should return generic skills without conditions', () => {
      const results = activator.getActiveSkills(skills, {
        filePath: '/path/to/file.xyz',
      })

      expect(results).toHaveLength(1)
      expect(results[0].skill.name).toBe('generic-skill')
      expect(results[0].matchedBy).toBe('default')
    })

    it('should return multiple matching skills', () => {
      const multiSkills = [
        createTestSkill('skill1', { paths: ['**/*.pdf'] }),
        createTestSkill('skill2', { paths: ['**/*.pdf'] }),
      ]

      const results = activator.getActiveSkills(multiSkills, {
        filePath: '/path/to/file.pdf',
      })

      expect(results).toHaveLength(2)
    })

    it('should prioritize path matches over default', () => {
      const results = activator.getActiveSkills(skills, {
        filePath: '/path/to/file.pdf',
      })

      // pdf-skill (path) 应该排在 generic-skill (default) 前面
      const indexOfPathMatch = results.findIndex((r) => r.matchedBy === 'path')
      const indexOfDefault = results.findIndex((r) => r.matchedBy === 'default')
      expect(indexOfPathMatch).toBeLessThan(indexOrDefault)
    })
  })

  describe('isSkillActive', () => {
    it('should return true for matching skill', () => {
      const pdfSkill = skills.find((s) => s.name === 'pdf-skill')!

      const isActive = activator.isSkillActive(pdfSkill, {
        filePath: '/path/to/file.pdf',
      })

      expect(isActive).toBe(true)
    })

    it('should return false for non-matching skill', () => {
      const pdfSkill = skills.find((s) => s.name === 'pdf-skill')!

      const isActive = activator.isSkillActive(pdfSkill, {
        filePath: '/path/to/file.md',
      })

      expect(isActive).toBe(false)
    })

    it('should always return true for generic skills', () => {
      const genericSkill = skills.find((s) => s.name === 'generic-skill')!

      const isActive = activator.isSkillActive(genericSkill, {
        filePath: '/any/path',
      })

      expect(isActive).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle empty skills array', () => {
      const results = activator.getActiveSkills([], {
        filePath: '/path/to/file.pdf',
      })

      expect(results).toEqual([])
    })

    it('should handle skills with both paths and agent conditions', () => {
      const results = activator.getActiveSkills(skills, {
        filePath: '/path/to/file.pdf',
        agentName: 'TestAgent',
      })

      const multiConditionResult = results.find((r) => r.skill.name === 'multi-condition-skill')
      expect(multiConditionResult).toBeDefined()
    })

    it('should handle deep path patterns', () => {
      const results = activator.getActiveSkills(skills, {
        filePath: '/src/components/Button.tsx',
      })

      expect(results).toHaveLength(1)
      expect(results[0].skill.name).toBe('code-skill')
    })
  })

  describe('activation result details', () => {
    it('should include matched pattern', () => {
      const results = activator.getActiveSkills(skills, {
        filePath: '/path/to/file.pdf',
      })

      expect(results[0].matchedPattern).toBe('**/*.pdf')
    })

    it('should include matched path', () => {
      const results = activator.getActiveSkills(skills, {
        filePath: '/path/to/file.pdf',
      })

      expect(results[0].matchedPath).toBe('/path/to/file.pdf')
    })

    it('should indicate match type', () => {
      const results = activator.getActiveSkills(skills, {
        filePath: '/path/to/file.pdf',
      })

      expect(results[0].matchedBy).toBe('path')
    })
  })
})
