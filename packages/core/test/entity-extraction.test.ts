/**
 * 实体关系抽取单元测试
 *
 * 测试实体抽取、关系抽取、归一化等功能
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { EntityExtractor, type Entity } from '../src/memory/long-term/EntityExtractor.js';
import { RelationExtractor, type Relation } from '../src/memory/long-term/RelationExtractor.js';

describe('EntityExtractor', () => {
  let extractor: EntityExtractor;

  beforeAll(() => {
    extractor = new EntityExtractor({
      enableNormalization: true,
      minConfidence: 0.6,
    });
  });

  describe('专利实体抽取', () => {
    it('应该正确抽取申请号', async () => {
      const text = '本专利申请号为CN2023101234567，涉及人工智能技术。';
      const entities = await extractor.extractEntities(text, 'ApplicationNumber');

      expect(entities).toHaveLength(1);
      expect(entities[0].type).toBe('ApplicationNumber');
      expect(entities[0].name).toBe('CN2023101234567');
      expect(entities[0].confidence).toBeGreaterThan(0.9);
    });

    it('应该正确抽取IPC分类号', async () => {
      const text = '本专利属于G06F 40/00分类号，涉及自然语言处理。';
      const entities = await extractor.extractEntities(text, 'IPC');

      expect(entities.length).toBeGreaterThan(0);
      expect(entities[0].type).toBe('IPC');
      expect(entities[0].name).toContain('G06F');
    });

    it('应该正确抽取日期', async () => {
      const text = '本专利申请于2023年01月15日，公开于2023-06-20。';
      const entities = await extractor.extractEntities(text, 'Date');

      expect(entities.length).toBeGreaterThan(0);
      const date = entities.find(e => e.name.includes('2023'));
      expect(date).toBeDefined();
    });

    it('应该正确抽取公司名称', async () => {
      const text = '申请人：北京百度网讯科技有限公司，地址：北京市海淀区。';
      const entities = await extractor.extractEntities(text, 'Organization');

      expect(entities.length).toBeGreaterThan(0);
      expect(entities[0].type).toBe('Organization');
      expect(entities[0].name).toContain('百度');
    });

    it('应该正确抽取人名', async () => {
      const text = '发明人：张三、李四、王五，均为该公司员工。';
      const entities = await extractor.extractEntities(text, 'Person');

      expect(entities.length).toBeGreaterThan(0);
      const hasChineseName = entities.some(e =>
        /^[一-龥]{2,4}$/.test(e.name)
      );
      expect(hasChineseName).toBe(true);
    });
  });

  describe('批量实体抽取', () => {
    it('应该从多个文本中抽取实体', async () => {
      const texts = [
        '申请人：腾讯科技（深圳）有限公司',
        '发明人：马云、刘强东',
        '申请号：CN202310987654.3',
      ];

      const entities = await extractor.extractEntitiesBatch(texts);

      expect(entities).toHaveLength(3);
      expect(entities[0].length).toBeGreaterThan(0);
      expect(entities[1].length).toBeGreaterThan(0);
      expect(entities[2].length).toBeGreaterThan(0);
    });
  });

  describe('实体归一化', () => {
    it('应该归一化公司名称', async () => {
      const entity: Entity = {
        type: 'Organization',
        name: '北京百度网讯科技有限公司',
        confidence: 0.9,
        startOffset: 0,
        endOffset: 15,
      };

      const normalized = extractor.normalizeEntity(entity);

      expect(normalized.name).toContain('公司');
      expect(normalized.properties?.originalName).toBe('北京百度网讯科技有限公司');
    });

    it('应该归一化日期格式', async () => {
      const text = '申请日：2023年01月15日';
      const entities = await extractor.extractEntities(text, 'Date');

      expect(entities.length).toBeGreaterThan(0);
      expect(entities[0].name).toMatch(/\d{4}-\d{1,2}-\d{1,2}/);
    });
  });

  describe('自定义词典', () => {
    it('应该支持添加自定义词典', () => {
      const words = ['深度学习', '神经网络', '自然语言处理'];
      expect(() => extractor.addCustomDictionary(words)).not.toThrow();
    });
  });

  describe('置信度过滤', () => {
    it('应该过滤低置信度实体', async () => {
      const text = '申请号：CN202310123456.7，申请人：某公司';
      const entities = await extractor.extractEntities(text);

      // 所有实体置信度应该 >= 0.6
      entities.forEach(e => {
        expect(e.confidence).toBeGreaterThanOrEqual(0.6);
      });
    });
  });

  describe('边界案例', () => {
    it('应该处理空文本', async () => {
      const entities = await extractor.extractEntities('');
      expect(entities).toHaveLength(0);
    });

    it('应该处理无实体文本', async () => {
      const text = '这是一段没有任何专利实体的普通文本。';
      const entities = await extractor.extractEntities(text);
      expect(entities.length).toBeLessThan(3);
    });

    it('应该处理超长文本', async () => {
      const text = '申请号：CN202310123456.7。'.repeat(1000);
      const entities = await extractor.extractEntities(text, 'ApplicationNumber');

      expect(entities.length).toBeGreaterThan(0);
      expect(entities.length).toBeLessThanOrEqual(1000);
    });
  });
});

describe('RelationExtractor', () => {
  let extractor: RelationExtractor;
  let testEntities: Entity[];

  beforeAll(() => {
    extractor = new RelationExtractor({
      minConfidence: 0.6,
      minWeight: 0.5,
      enableEvidence: true,
    });

    testEntities = [
      { type: 'Organization', name: '百度公司', confidence: 0.9, startOffset: 0, endOffset: 4 },
      { type: 'Person', name: '张三', confidence: 0.8, startOffset: 10, endOffset: 12 },
      { type: 'ApplicationNumber', name: 'CN202310123456.7', confidence: 0.95, startOffset: 20, endOffset: 36 },
    ];
  });

  describe('关系抽取', () => {
    it('应该抽取申请人-发明人关系', async () => {
      const text = '申请人：百度公司，发明人：张三';
      const relations = await extractor.extractRelations(text, testEntities);

      const applicantInventor = relations.find(r => r.relationType === 'applicant-inventor');
      expect(applicantInventor).toBeDefined();
      expect(applicantInventor?.fromEntity).toContain('百度');
      expect(applicantInventor?.toEntity).toContain('张三');
    });

    it('应该抽取引用关系', async () => {
      const text = '本专利引用了CN202210987654.3的技术方案';
      const relations = await extractor.extractRelations(text, testEntities);

      const cites = relations.find(r => r.relationType === 'cites');
      expect(cites).toBeDefined();
      expect(cites?.toEntity).toContain('CN2022');
    });

    it('应该抽取优先权关系', async () => {
      const text = '本专利要求优先权：CN202110123456.7';
      const relations = await extractor.extractRelations(text, testEntities);

      const priority = relations.find(r => r.relationType === 'priority');
      expect(priority).toBeDefined();
      expect(priority?.toEntity).toContain('CN2021');
    });
  });

  describe('关系权重计算', () => {
    it('应该正确计算关系权重', () => {
      const relation: Relation = {
        fromEntity: '百度公司',
        toEntity: '张三',
        relationType: 'applicant-inventor',
        weight: 0.8,
        confidence: 0.85,
        evidence: '申请人：百度公司，发明人：张三',
      };

      const weight = extractor.calculateWeight(relation, '申请人：百度公司，发明人：张三');

      expect(weight).toBeGreaterThan(0.8);
      expect(weight).toBeLessThanOrEqual(1.0);
    });
  });

  describe('关系去重', () => {
    it('应该去除重复关系', async () => {
      const text = '申请人：百度公司，发明人：张三。申请人：百度公司，发明人：张三。';
      const relations = await extractor.extractRelations(text, testEntities);

      const duplicates = relations.filter(r =>
        r.fromEntity === '百度公司' &&
        r.toEntity === '张三' &&
        r.relationType === 'applicant-inventor'
      );

      expect(duplicates.length).toBe(1);
    });
  });

  describe('实体推断', () => {
    it('应该从实体对推断关系', () => {
      const fromEntity: Entity = {
        type: 'Organization',
        name: '腾讯公司',
        confidence: 0.9,
        startOffset: 0,
        endOffset: 4,
      };

      const toEntity: Entity = {
        type: 'Person',
        name: '马化腾',
        confidence: 0.85,
        startOffset: 10,
        endOffset: 14,
      };

      const relation = extractor.inferRelationFromEntities(fromEntity, toEntity);

      expect(relation).toBeDefined();
      expect(relation?.relationType).toBe('applicant-inventor');
    });
  });

  describe('批量关系抽取', () => {
    it('应该从多个文本中抽取关系', async () => {
      const texts = [
        '申请人：百度公司，发明人：张三',
        '本专利引用了CN202210987654.3',
        '申请人：腾讯公司，发明人：李四',
      ];

      const entitiesList = [
        [
          { type: 'Organization', name: '百度公司', confidence: 0.9, startOffset: 0, endOffset: 4 },
          { type: 'Person', name: '张三', confidence: 0.8, startOffset: 14, endOffset: 16 },
        ],
        [
          { type: 'ApplicationNumber', name: 'CN202210987654.3', confidence: 0.95, startOffset: 8, endOffset: 24 },
        ],
        [
          { type: 'Organization', name: '腾讯公司', confidence: 0.9, startOffset: 0, endOffset: 4 },
          { type: 'Person', name: '李四', confidence: 0.8, startOffset: 14, endOffset: 16 },
        ],
      ];

      const relations = await extractor.extractRelationsBatch(texts, entitiesList);

      expect(relations).toHaveLength(3);
      expect(relations[0].length).toBeGreaterThan(0);
    });
  });

  describe('统计信息', () => {
    it('应该生成正确的统计信息', async () => {
      const text = '申请人：百度公司，发明人：张三。本专利引用了CN202210987654.3。';
      const relations = await extractor.extractRelations(text, testEntities);

      const stats = extractor.getStats(relations);

      expect(stats.totalRelations).toBeGreaterThan(0);
      expect(stats.relationTypes).toBeDefined();
      expect(stats.averageConfidence).toBeGreaterThan(0);
      expect(stats.averageWeight).toBeGreaterThan(0);
    });
  });

  describe('边界案例', () => {
    it('应该处理空实体列表', async () => {
      const text = '这是一段测试文本';
      const relations = await extractor.extractRelations(text, []);
      expect(relations).toHaveLength(0);
    });

    it('应该处理空文本', async () => {
      const relations = await extractor.extractRelations('', testEntities);
      expect(relations).toHaveLength(0);
    });

    it('应该处理无关系文本', async () => {
      const text = '这是一段没有任何关系的普通文本。';
      const relations = await extractor.extractRelations(text, testEntities);
      expect(relations.length).toBeLessThan(3);
    });
  });
});

describe('集成测试', () => {
  it('应该完整处理专利文本', async () => {
    const entityExtractor = new EntityExtractor();
    const relationExtractor = new RelationExtractor();

    const patentText = `
      专利名称：基于深度学习的自然语言处理方法
      申请号：CN202310123456.7
      申请人：北京百度网讯科技有限公司
      发明人：张三、李四、王五
      摘要：本发明涉及一种基于深度学习的自然语言处理方法...
      说明书：本专利引用了CN202210987654.3的技术方案，并要求优先权CN202110123456.7。
    `;

    // 1. 抽取实体
    const entities = await entityExtractor.extractEntities(patentText);
    expect(entities.length).toBeGreaterThan(3);

    // 2. 抽取关系
    const relations = await relationExtractor.extractRelations(patentText, entities);
    expect(relations.length).toBeGreaterThan(0);

    // 3. 验证关系类型
    const relationTypes = new Set(relations.map(r => r.relationType));
    expect(relationTypes.size).toBeGreaterThan(0);
  });
});
