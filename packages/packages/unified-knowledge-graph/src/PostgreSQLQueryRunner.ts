/**
 * PostgreSQL 查询函数 — 所有查询接收 Pool 参数
 *
 * @module unified-knowledge-graph/PostgreSQLQueryRunner
 */

import type { Pool } from 'pg'
import type {
  VectorSearchResult,
  StructuredQueryResult,
  EntityResult,
  InvalidEntityResult,
  CourtResult,
  LawArticleResult,
  JudgmentPatentResult,
  RelationResult,
  LegalDocumentResult,
  JudgmentCaseResult,
  PatentRuleResult,
  PostgreSQLStats,
} from './PostgreSQLTypes.js'

export async function vectorSearch(
  pool: Pool,
  embeddingFn: ((text: string) => Promise<number[]>) | undefined,
  queryText: string,
  topK: number = 5,
  table:
    | 'legal_articles_v2_embeddings'
    | 'judgment_embeddings'
    | 'patent_judgment_vectors'
    | 'patent_decisions_v2_embeddings' = 'legal_articles_v2_embeddings'
): Promise<VectorSearchResult[]> {
  try {
    const tableExists = await pool.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)`,
      [table]
    )
    if (!tableExists.rows[0].exists) {
      console.warn(`[PostgreSQL] 表 ${table} 不存在，跳过向量搜索`)
      return []
    }

    const countResult = await pool.query(`SELECT COUNT(*) FROM ${table}`)
    if (parseInt(countResult.rows[0].count) === 0) {
      console.warn(`[PostgreSQL] 表 ${table} 为空，跳过向量搜索`)
      return []
    }

    if (embeddingFn) {
      try {
        const embedding = await embeddingFn(queryText)
        const embeddingArray = `[${embedding.join(',')}]`

        const result = await pool.query(
          `SELECT id, article_id as "articleId", chunk_type as "chunkType", chunk_text as "chunkText", weight, 1 - (embedding <=> $1::real[]) as similarity FROM ${table} ORDER BY embedding <=> $1::real[] LIMIT $2`,
          [embeddingArray, topK]
        )
        return result.rows
      } catch (embeddingErr) {
        console.warn('[PostgreSQL] 向量嵌入生成失败，回退到文本搜索:', embeddingErr)
      }
    }

    const result = await pool.query(
      `SELECT id, article_id as "articleId", chunk_type as "chunkType", chunk_text as "chunkText", weight, ts_rank_cd(to_tsvector('chinese', chunk_text), query) as similarity FROM ${table}, plainto_tsquery('chinese', $1) query WHERE to_tsvector('chinese', chunk_text) @@ query ORDER BY similarity DESC LIMIT $2`,
      [queryText, topK]
    )
    return result.rows
  } catch (err) {
    console.error('[PostgreSQL] 向量搜索失败:', err)
    return []
  }
}

export async function structuredSearch(
  pool: Pool,
  query: string,
  topK: number = 5,
  includeInvalidDecisions: boolean = true
): Promise<StructuredQueryResult[]> {
  try {
    const results: StructuredQueryResult[] = []
    const limitPerTable = Math.ceil(topK / 4)

    const articlesResult = await pool.query(
      `SELECT article_id as id, article_title as title, content_text as content, 'legal_article' as category FROM legal_articles_v2 WHERE article_title LIKE $1 OR content_text LIKE $1 ORDER BY article_id LIMIT $2`,
      [`%${query}%`, limitPerTable]
    )
    results.push(
      ...articlesResult.rows.map((row: any) => ({
        id: row.id,
        title: row.title,
        content: row.content,
        category: row.category,
      }))
    )

    const rulesResult = await pool.query(
      `SELECT id, title, content, 'patent_rule' as category FROM patent_rules_unified WHERE title LIKE $1 OR content LIKE $1 ORDER BY id LIMIT $2`,
      [`%${query}%`, limitPerTable]
    )
    results.push(
      ...rulesResult.rows.map((row: any) => ({
        id: row.id,
        title: row.title,
        content: row.content,
        category: row.category,
      }))
    )

    if (includeInvalidDecisions) {
      const invalidResult = await queryInvalidDecisions(pool, query, limitPerTable)
      results.push(...invalidResult)
    }

    const judgmentsResult = await pool.query(
      `SELECT judgment_id as id, title, content_text as content, 'patent_judgment' as category FROM patent_judgments WHERE title LIKE $1 OR content_text LIKE $1 LIMIT $2`,
      [`%${query}%`, limitPerTable]
    )
    results.push(
      ...judgmentsResult.rows.map((row: any) => ({
        id: row.id,
        title: row.title,
        content: row.content,
        category: row.category,
      }))
    )

    return results.slice(0, topK)
  } catch (err) {
    console.error('[PostgreSQL] 结构化查询失败:', err)
    return []
  }
}

export async function queryInvalidDecisions(
  pool: Pool,
  query: string,
  topK: number = 5
): Promise<StructuredQueryResult[]> {
  try {
    const result = await pool.query(
      `SELECT id, document_number as title, content, 'invalid_decision' as category, domain, metadata FROM patent_decisions_v2 WHERE document_number LIKE $1 OR title LIKE $1 OR content LIKE $1 ORDER BY id LIMIT $2`,
      [`%${query}%`, topK]
    )
    return result.rows.map((row: any) => ({
      id: row.id,
      title: `无效决定 ${row.title}`,
      content: row.content,
      category: row.category,
      metadata: { domain: row.domain, documentNumber: row.title, ...row.metadata },
    }))
  } catch (err) {
    console.error('[PostgreSQL] 无效决定查询失败:', err)
    return []
  }
}

export async function entitySearch(
  pool: Pool,
  entityText: string,
  entityType?: string,
  topK: number = 5
): Promise<EntityResult[]> {
  try {
    let sql = `SELECT id, judgment_id as "judgmentId", entity_text as "entityText", entity_type as "entityType", confidence, metadata FROM judgment_entities WHERE entity_text LIKE $1`
    const params: any[] = [`%${entityText}%`]
    let paramIndex = 2
    if (entityType) {
      sql += ` AND entity_type = $${paramIndex}`
      params.push(entityType)
      paramIndex++
    }
    sql += ` ORDER BY confidence DESC LIMIT $${paramIndex}`
    params.push(topK)
    const result = await pool.query(sql, params)
    return result.rows
  } catch (err) {
    console.error('[PostgreSQL] 实体查询失败:', err)
    return []
  }
}

export async function searchInvalidEntities(
  pool: Pool,
  params: { entityText?: string; entityType?: string; domain?: string; topK?: number }
): Promise<InvalidEntityResult[]> {
  const { entityText, entityType, domain, topK = 10 } = params
  try {
    let sql = `SELECT id, decision_id as "decisionId", entity_text as "entityText", entity_type as "entityType", domain, confidence, metadata FROM patent_invalid_entities WHERE 1=1`
    const queryParams: any[] = []
    let paramIndex = 1
    if (entityText) {
      sql += ` AND entity_text LIKE $${paramIndex}`
      queryParams.push(`%${entityText}%`)
      paramIndex++
    }
    if (entityType) {
      sql += ` AND entity_type = $${paramIndex}`
      queryParams.push(entityType)
      paramIndex++
    }
    if (domain) {
      sql += ` AND domain = $${paramIndex}`
      queryParams.push(domain)
      paramIndex++
    }
    sql += ` ORDER BY confidence DESC LIMIT $${paramIndex}`
    queryParams.push(topK)
    const result = await pool.query(sql, queryParams)
    return result.rows
  } catch (err) {
    console.error('[PostgreSQL] 无效实体搜索失败:', err)
    return []
  }
}

export async function searchCourts(
  pool: Pool,
  params: { courtName?: string; courtLevel?: string; topK?: number }
): Promise<CourtResult[]> {
  const { courtName, courtLevel, topK = 10 } = params
  try {
    let sql = `SELECT id, judgment_id as "judgmentId", court_name as "courtName", court_level as "courtLevel" FROM judgment_courts WHERE 1=1`
    const queryParams: any[] = []
    let paramIndex = 1
    if (courtName) {
      sql += ` AND court_name LIKE $${paramIndex}`
      queryParams.push(`%${courtName}%`)
      paramIndex++
    }
    if (courtLevel) {
      sql += ` AND court_level = $${paramIndex}`
      queryParams.push(courtLevel)
      paramIndex++
    }
    sql += ` ORDER BY id LIMIT $${paramIndex}`
    queryParams.push(topK)
    const result = await pool.query(sql, queryParams)
    return result.rows
  } catch (err) {
    console.error('[PostgreSQL] 法院搜索失败:', err)
    return []
  }
}

export async function searchLawArticles(
  pool: Pool,
  params: { lawArticleId?: string; judgmentId?: string; topK?: number }
): Promise<LawArticleResult[]> {
  const { lawArticleId, judgmentId, topK = 10 } = params
  try {
    let sql = `SELECT id, judgment_id as "judgmentId", law_article_id as "lawArticleId", law_article_text as "lawArticleText" FROM judgment_law_articles WHERE 1=1`
    const queryParams: any[] = []
    let paramIndex = 1
    if (lawArticleId) {
      sql += ` AND law_article_id = $${paramIndex}`
      queryParams.push(lawArticleId)
      paramIndex++
    }
    if (judgmentId) {
      sql += ` AND judgment_id = $${paramIndex}`
      queryParams.push(judgmentId)
      paramIndex++
    }
    sql += ` ORDER BY id LIMIT $${paramIndex}`
    queryParams.push(topK)
    const result = await pool.query(sql, queryParams)
    return result.rows
  } catch (err) {
    console.error('[PostgreSQL] 法条搜索失败:', err)
    return []
  }
}

export async function searchJudgmentPatents(
  pool: Pool,
  params: { patentNumber?: string; judgmentId?: string; topK?: number }
): Promise<JudgmentPatentResult[]> {
  const { patentNumber, judgmentId, topK = 10 } = params
  try {
    let sql = `SELECT id, judgment_id as "judgmentId", patent_number as "patentNumber", patent_type as "patentType" FROM judgment_patent_numbers WHERE 1=1`
    const queryParams: any[] = []
    let paramIndex = 1
    if (patentNumber) {
      sql += ` AND patent_number LIKE $${paramIndex}`
      queryParams.push(`%${patentNumber}%`)
      paramIndex++
    }
    if (judgmentId) {
      sql += ` AND judgment_id = $${paramIndex}`
      queryParams.push(judgmentId)
      paramIndex++
    }
    sql += ` ORDER BY id LIMIT $${paramIndex}`
    queryParams.push(topK)
    const result = await pool.query(sql, queryParams)
    return result.rows
  } catch (err) {
    console.error('[PostgreSQL] 判决专利号搜索失败:', err)
    return []
  }
}

export async function searchRelations(
  pool: Pool,
  params: { judgmentId?: string; relationType?: string; topK?: number }
): Promise<RelationResult[]> {
  const { judgmentId, relationType, topK = 10 } = params
  try {
    let sql = `SELECT id, judgment_id as "judgmentId", subject_entity as "subjectEntity", relation_type as "relationType", object_entity as "objectEntity", confidence FROM judgment_relations WHERE 1=1`
    const queryParams: any[] = []
    let paramIndex = 1
    if (judgmentId) {
      sql += ` AND judgment_id = $${paramIndex}`
      queryParams.push(judgmentId)
      paramIndex++
    }
    if (relationType) {
      sql += ` AND relation_type = $${paramIndex}`
      queryParams.push(relationType)
      paramIndex++
    }
    sql += ` ORDER BY confidence DESC LIMIT $${paramIndex}`
    queryParams.push(topK)
    const result = await pool.query(sql, queryParams)
    return result.rows
  } catch (err) {
    console.error('[PostgreSQL] 关系搜索失败:', err)
    return []
  }
}

export async function getLegalDocuments(
  pool: Pool,
  params: { category?: string; topK?: number }
): Promise<LegalDocumentResult[]> {
  const { category, topK = 10 } = params
  try {
    let sql = `SELECT id, title, content, category, source, created_at as "createdAt" FROM legal_documents WHERE 1=1`
    const queryParams: any[] = []
    let paramIndex = 1
    if (category) {
      sql += ` AND category = $${paramIndex}`
      queryParams.push(category)
      paramIndex++
    }
    sql += ` ORDER BY created_at DESC LIMIT $${paramIndex}`
    queryParams.push(topK)
    const result = await pool.query(sql, queryParams)
    return result.rows
  } catch (err) {
    console.error('[PostgreSQL] 法律文档查询失败:', err)
    return []
  }
}

export async function searchJudgmentCases(
  pool: Pool,
  params: { caseCause?: string; plaintiff?: string; defendant?: string; topK?: number }
): Promise<JudgmentCaseResult[]> {
  const { caseCause, plaintiff, defendant, topK = 10 } = params
  try {
    let sql = `SELECT judgment_id as "judgmentId", file_name as "fileName", title, file_path as "filePath", case_cause as "caseCause", plaintiff, defendant, entities_count as "entitiesCount", relations_count as "relationsCount", has_embeddings as "hasEmbeddings", processed_at as "processedAt" FROM patent_judgments WHERE 1=1`
    const queryParams: any[] = []
    let paramIndex = 1
    if (caseCause) {
      sql += ` AND case_cause LIKE $${paramIndex}`
      queryParams.push(`%${caseCause}%`)
      paramIndex++
    }
    if (plaintiff) {
      sql += ` AND plaintiff LIKE $${paramIndex}`
      queryParams.push(`%${plaintiff}%`)
      paramIndex++
    }
    if (defendant) {
      sql += ` AND defendant LIKE $${paramIndex}`
      queryParams.push(`%${defendant}%`)
      paramIndex++
    }
    sql += ` ORDER BY processed_at DESC LIMIT $${paramIndex}`
    queryParams.push(topK)
    const result = await pool.query(sql, queryParams)
    return result.rows
  } catch (err) {
    console.error('[PostgreSQL] 判决案例搜索失败:', err)
    return []
  }
}

export async function searchPatentRules(
  pool: Pool,
  embeddingFn: ((text: string) => Promise<number[]>) | undefined,
  params: { query?: string; articleType?: string; hierarchyLevel?: number; topK?: number }
): Promise<PatentRuleResult[]> {
  const { query, articleType, hierarchyLevel, topK = 10 } = params
  try {
    if (embeddingFn && query) {
      const embedding = await embeddingFn(query)
      const embeddingArray = `[${embedding.join(',')}]`

      let sql = `SELECT id::text, article_id as "articleId", article_type as "articleType", hierarchy_level as "hierarchyLevel", full_path as "fullPath", article_number as "articleNumber", title, content, core_principle as "corePrinciple", key_requirements as "keyRequirements", metadata, has_vectors as "hasVectors", 1 - (embedding <=> $1::real[]) as similarity FROM patent_rules_unified WHERE has_vectors = true`
      const queryParams: any[] = [embeddingArray]
      let paramIndex = 2
      if (articleType) {
        sql += ` AND article_type = $${paramIndex}`
        queryParams.push(articleType)
        paramIndex++
      }
      if (hierarchyLevel !== undefined) {
        sql += ` AND hierarchy_level = $${paramIndex}`
        queryParams.push(hierarchyLevel)
        paramIndex++
      }
      sql += ` ORDER BY embedding <=> $1::real[] LIMIT $${paramIndex}`
      queryParams.push(topK)
      const result = await pool.query(sql, queryParams)
      return result.rows
    }

    let sql = `SELECT id::text, article_id as "articleId", article_type as "articleType", hierarchy_level as "hierarchyLevel", full_path as "fullPath", article_number as "articleNumber", title, content, core_principle as "corePrinciple", key_requirements as "keyRequirements", metadata, has_vectors as "hasVectors" FROM patent_rules_unified WHERE 1=1`
    const queryParams: any[] = []
    let paramIndex = 1
    if (query) {
      sql += ` AND (title LIKE $${paramIndex} OR content LIKE $${paramIndex})`
      queryParams.push(`%${query}%`)
      paramIndex++
    }
    if (articleType) {
      sql += ` AND article_type = $${paramIndex}`
      queryParams.push(articleType)
      paramIndex++
    }
    if (hierarchyLevel !== undefined) {
      sql += ` AND hierarchy_level = $${paramIndex}`
      queryParams.push(hierarchyLevel)
      paramIndex++
    }
    sql += ` ORDER BY hierarchy_level, article_number LIMIT $${paramIndex}`
    queryParams.push(topK)
    const result = await pool.query(sql, queryParams)
    return result.rows
  } catch (err) {
    console.error('[PostgreSQL] 专利规则搜索失败:', err)
    return []
  }
}

export async function getStats(pool: Pool): Promise<PostgreSQLStats> {
  try {
    const tablesResult = await pool.query(
      `SELECT tablename, (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = pg_tables.tablename) as column_count FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    )
    const tables: Record<string, number> = {}
    for (const row of tablesResult.rows) {
      const countResult = await pool.query(`SELECT COUNT(*) FROM ${row.tablename}`)
      tables[row.tablename] = parseInt(countResult.rows[0].count)
    }
    return {
      totalRecords: Object.values(tables).reduce((sum, count) => sum + count, 0),
      vectorRecords: tables['legal_articles_v2_embeddings'] || 0,
      entityRecords: tables['judgment_entities'] || 0,
      tables,
    }
  } catch (err) {
    console.error('[PostgreSQL] 获取统计信息失败:', err)
    return { totalRecords: 0, vectorRecords: 0, entityRecords: 0, tables: {} }
  }
}

export async function healthCheck(pool: Pool): Promise<boolean> {
  try {
    const client = await pool.connect()
    await client.query('SELECT 1')
    client.release()
    return true
  } catch (err) {
    console.error('[PostgreSQL] 健康检查失败:', err)
    return false
  }
}
