import { describe, it, expect } from 'vitest'
import {
  PatentType,
  ApplicantType,
  ClaimType,
  InventionType,
  ObjectionType,
  ResponseStrategy,
  TechnicalFeatureSchema,
  IndependentClaimParamsSchema,
  ClaimDraftSchema,
  ObjectionSchema,
} from '../../src/types/patent.js'

describe('Patent Enums', () => {
  it('PatentType has correct values', () => {
    expect(PatentType.INVENTION).toBe('invention')
    expect(PatentType.UTILITY_MODEL).toBe('utility_model')
    expect(PatentType.DESIGN).toBe('design')
  })

  it('ApplicantType has correct values', () => {
    expect(ApplicantType.ENTERPRISE).toBe('enterprise')
    expect(ApplicantType.INDIVIDUAL).toBe('individual')
    expect(ApplicantType.UNIVERSITY).toBe('university')
    expect(ApplicantType.INSTITUTE).toBe('institute')
  })

  it('ClaimType has correct values', () => {
    expect(ClaimType.INDEPENDENT).toBe('independent')
    expect(ClaimType.DEPENDENT).toBe('dependent')
  })

  it('InventionType has correct values', () => {
    expect(InventionType.DEVICE).toBe('device')
    expect(InventionType.METHOD).toBe('method')
    expect(InventionType.SYSTEM).toBe('system')
    expect(InventionType.COMPOSITION).toBe('composition')
  })

  it('ObjectionType has correct values', () => {
    expect(ObjectionType.NOVELTY).toBe('novelty')
    expect(ObjectionType.INVENTIVE_STEP).toBe('inventive_step')
    expect(ObjectionType.CLARITY).toBe('clarity')
    expect(ObjectionType.SUPPORT).toBe('support')
    expect(ObjectionType.FORMALITY).toBe('formality')
    expect(ObjectionType.UNITY).toBe('unity')
  })

  it('ResponseStrategy has correct values', () => {
    expect(ResponseStrategy.ARGUE_NOVELTY).toBe('argue_novelty')
    expect(ResponseStrategy.ARGUE_INVENTIVE_STEP).toBe('argue_inventive_step')
    expect(ResponseStrategy.AMEND_CLAIMS).toBe('amend_claims')
    expect(ResponseStrategy.COMBINE).toBe('combine')
  })
})

describe('Zod Schemas', () => {
  it('TechnicalFeatureSchema validates correct input', () => {
    const valid = { text: '一种装置', isEssential: true, category: '结构' }
    expect(() => TechnicalFeatureSchema.parse(valid)).not.toThrow()
    const result = TechnicalFeatureSchema.parse(valid)
    expect(result).toEqual(valid)
  })

  it('TechnicalFeatureSchema rejects invalid input', () => {
    expect(() => TechnicalFeatureSchema.parse({ text: 123, isEssential: true })).toThrow()
    expect(() => TechnicalFeatureSchema.parse({ text: '一种装置' })).toThrow()
  })

  it('IndependentClaimParamsSchema validates correct input', () => {
    const valid = {
      inventionType: InventionType.DEVICE,
      coreFeatures: [{ text: '特征1', isEssential: true }],
    }
    expect(() => IndependentClaimParamsSchema.parse(valid)).not.toThrow()
  })

  it('IndependentClaimParamsSchema rejects missing coreFeatures', () => {
    expect(() =>
      IndependentClaimParamsSchema.parse({ inventionType: InventionType.DEVICE })
    ).toThrow()
  })

  it('ClaimDraftSchema validates correct input', () => {
    const valid = {
      claimNumber: 1,
      claimType: ClaimType.INDEPENDENT,
      text: '一种装置，其特征在于...',
      dependsOn: [1],
    }
    expect(() => ClaimDraftSchema.parse(valid)).not.toThrow()
  })

  it('ObjectionSchema validates correct input', () => {
    const valid = {
      type: ObjectionType.NOVELTY,
      description: '不具备新颖性',
      severity: 'high' as const,
      citedReferences: ['CN123456789A'],
    }
    expect(() => ObjectionSchema.parse(valid)).not.toThrow()
  })

  it('ObjectionSchema rejects invalid severity', () => {
    expect(() =>
      ObjectionSchema.parse({
        type: ObjectionType.NOVELTY,
        description: '不具备新颖性',
        severity: 'critical',
      })
    ).toThrow()
  })
})
