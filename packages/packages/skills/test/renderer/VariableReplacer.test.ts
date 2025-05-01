/**
 * VariableReplacer 测试
 *
 * @package @yunpat/skills
 */

import { describe, it, expect } from 'vitest'
import {
  replaceVariables,
  getTemplateVariables,
  validateRequiredVariables,
} from '../../src/index.js'

describe('VariableReplacer', () => {
  describe('replaceVariables', () => {
    it('should replace simple variables', () => {
      const template = 'Hello, {{name}}!'
      const vars = { name: 'World' }

      const result = replaceVariables(template, vars)

      expect(result).toBe('Hello, World!')
    })

    it('should replace nested variables', () => {
      const template = 'Hello, {{user.name}}!'
      const vars = { user: { name: 'Alice' } }

      const result = replaceVariables(template, vars)

      expect(result).toBe('Hello, Alice!')
    })

    it('should replace condition variables (true)', () => {
      const template = '{{#if show}}Show this{{/if}}'
      const vars = { show: true }

      const result = replaceVariables(template, vars)

      expect(result).toBe('Show this')
    })

    it('should replace condition variables (false)', () => {
      const template = '{{#if show}}Show this{{/if}}'
      const vars = { show: false }

      const result = replaceVariables(template, vars)

      expect(result).toBe('')
    })

    it('should keep unreplaced variables', () => {
      const template = 'Hello, {{name}}!'
      const vars = {}

      const result = replaceVariables(template, vars)

      expect(result).toBe('Hello, {{name}}!')
    })

    it('should replace loop variables', () => {
      const template = '{{#each items}}- {{this}}\n{{/each}}'
      const vars = { items: ['apple', 'banana', 'cherry'] }

      const result = replaceVariables(template, vars)

      expect(result).toBe('- apple\n- banana\n- cherry\n')
    })
  })

  describe('getTemplateVariables', () => {
    it('should extract simple variables', () => {
      const template = 'Hello, {{name}}! Your role is {{role}}.'

      const variables = getTemplateVariables(template)

      expect(variables).toEqual(['name', 'role'])
    })

    it('should extract nested variables', () => {
      const template = 'Hello, {{user.name}}! Your role is {{config.role}}.'

      const variables = getTemplateVariables(template)

      expect(variables).toEqual(['user', 'config'])
    })

    it('should ignore control variables', () => {
      const template = '{{#if show}}{{name}}{{/if}}'

      const variables = getTemplateVariables(template)

      expect(variables).toEqual(['name'])
    })
  })

  describe('validateRequiredVariables', () => {
    it('should pass when all required variables are present', () => {
      const template = 'Hello, {{name}}!'
      const vars = { name: 'World' }
      const required = ['name']

      const result = validateRequiredVariables(template, vars, required)

      expect(result.valid).toBe(true)
      expect(result.missing).toEqual([])
    })

    it('should fail when required variables are missing', () => {
      const template = 'Hello, {{name}}! Your role is {{role}}.'
      const vars = { name: 'World' }
      const required = ['name', 'role']

      const result = validateRequiredVariables(template, vars, required)

      expect(result.valid).toBe(false)
      expect(result.missing).toEqual(['role'])
    })

    it('should fail when variable is null', () => {
      const template = 'Hello, {{name}}!'
      const vars = { name: null }
      const required = ['name']

      const result = validateRequiredVariables(template, vars, required)

      expect(result.valid).toBe(false)
      expect(result.missing).toEqual(['name'])
    })
  })
})
