/**
 * 为专利无效决定生成向量嵌入
 *
 * 功能：
 * 1. 创建 patent_decisions_v2_embeddings 表
 * 2. 分块处理无效决定文档
 * 3. 使用 BGE-M3 生成向量嵌入
 * 4. 批量插入数据库
 */

import { Pool } from 'pg'
import { EmbeddingAdapter } from '@yunpat/core'

// 配置
const CONFIG = {
  pgHost: 'localhost',
  pgPort: 5432,
  pgDatabase: 'legal_world_model',
  pgUser: 'postgres',
  pgPassword: 'nxLVXyZ3e87L0kE8Xqx3AB9NK1z74pwOdjugqpc7hc',

  // 分块配置
  chunkSize: 500, // 每块字符数
  chunkOverlap: 50, // 重叠字符数
  maxChunks: 10, // 每个文档最大分块数

  // 批处理配置
  batchSize: 100, // 每批处理文档数
  delayMs: 1000, // 批次间延迟（毫秒）
}

/**
 * 创建向量表
 */
async function createEmbeddingsTable(pool: Pool) {
  console.log('[Step 1] 创建向量表...')

  await pool.query(`
    CREATE TABLE IF NOT EXISTS patent_decisions_v2_embeddings (
      id SERIAL PRIMARY KEY,
      document_id UUID NOT NULL,
      document_number VARCHAR(255),
      chunk_index INTEGER,
      chunk_text TEXT NOT NULL,
      vector VECTOR(1024) NOT NULL,
      weight DOUBLE PRECISION DEFAULT 1.0,
      created_at TIMESTAMP DEFAULT NOW(),

      CONSTRAINT fk_document
        FOREIGN KEY (document_id)
        REFERENCES patent_decisions_v2(id)
        ON DELETE CASCADE
    );
  `)

  // 创建索引（稍后在数据插入后创建）
  console.log('✅ 向量表创建成功')
}

/**
 * 分块处理文本
 */
function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = []

  // 按段落分割
  const paragraphs = text.split(/\n\n+/)
  let currentChunk = ''

  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length > chunkSize) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim())
        currentChunk = paragraph.slice(-overlap) // 保留重叠部分
      } else {
        // 单个段落太长，强制分割
        for (let i = 0; i < paragraph.length; i += chunkSize - overlap) {
          chunks.push(paragraph.slice(i, i + chunkSize))
        }
      }
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.trim())
  }

  return chunks.slice(0, CONFIG.maxChunks)
}

/**
 * 生成向量嵌入
 */
async function generateEmbeddings(pool: Pool) {
  console.log('[Step 2] 生成向量嵌入...')

  // 1. 初始化 BGE-M3 嵌入模型
  console.log('初始化 BGE-M3 嵌入模型...')
  const embedding = await EmbeddingAdapter.createBGEEmbedding({
    model: 'BAAI/bge-m3',
    encodingFormat: 'float',
  })

  // 2. 查询所有无效决定
  const { rows: documents } = await pool.query(
    'SELECT id, document_number, content FROM patent_decisions_v2 ORDER BY id'
  )

  console.log(`找到 ${documents.length} 个无效决定文档`)

  // 3. 批量处理
  let processed = 0
  let totalChunks = 0

  for (let i = 0; i < documents.length; i += CONFIG.batchSize) {
    const batch = documents.slice(i, i + CONFIG.batchSize)
    console.log(
      `\n处理批次 ${Math.floor(i / CONFIG.batchSize) + 1}/${Math.ceil(documents.length / CONFIG.batchSize)}`
    )

    // 准备批次数据
    const embeddingsData: Array<{
      documentId: string
      documentNumber: string
      chunkIndex: number
      chunkText: string
      vector: number[]
    }> = []

    for (const doc of batch) {
      // 分块
      const chunks = chunkText(doc.content, CONFIG.chunkSize, CONFIG.chunkOverlap)
      console.log(`  文档 ${doc.document_number}: ${chunks.length} 个分块`)

      // 生成向量嵌入
      for (let j = 0; j < chunks.length; j++) {
        try {
          const embedding = await embedding.embedText(chunks[j])

          embeddingsData.push({
            documentId: doc.id,
            documentNumber: doc.document_number,
            chunkIndex: j,
            chunkText: chunks[j],
            vector: embedding,
          })
        } catch (err) {
          console.error(`    ❌ 分块 ${j} 嵌入生成失败:`, err)
        }
      }

      processed++
    }

    // 批量插入数据库
    console.log(`  插入 ${embeddingsData.length} 个向量...`)
    await insertEmbeddingsBatch(pool, embeddingsData)

    totalChunks += embeddingsData.length
    console.log(`✅ 进度: ${processed}/${documents.length} 文档, ${totalChunks} 个向量`)

    // 延迟，避免 API 限流
    if (i + CONFIG.batchSize < documents.length) {
      console.log(`  等待 ${CONFIG.delayMs}ms...`)
      await sleep(CONFIG.delayMs)
    }
  }

  console.log(`\n✅ 向量嵌入生成完成: ${totalChunks} 个向量`)
}

/**
 * 批量插入向量嵌入
 */
async function insertEmbeddingsBatch(
  pool: Pool,
  data: Array<{
    documentId: string
    documentNumber: string
    chunkIndex: number
    chunkText: string
    vector: number[]
  }>
) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    for (const item of data) {
      await client.query(
        `
        INSERT INTO patent_decisions_v2_embeddings
          (document_id, document_number, chunk_index, chunk_text, vector)
        VALUES ($1, $2, $3, $4, $5::vector(1024))
        `,
        [
          item.documentId,
          item.documentNumber,
          item.chunkIndex,
          item.chunkText,
          `[${item.vector.join(',')}]`,
        ]
      )
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/**
 * 创建向量索引
 */
async function createVectorIndex(pool: Pool) {
  console.log('\n[Step 3] 创建向量索引...')

  // 计算索引参数
  const { rows } = await pool.query('SELECT COUNT(*) FROM patent_decisions_v2_embeddings')
  const totalRows = parseInt(rows[0].count)
  const lists = Math.floor(Math.sqrt(totalRows))

  console.log(`总向量数: ${totalRows}, 索引参数: lists = ${lists}`)

  // 创建 IVFFlat 索引
  await pool.query(
    `
    CREATE INDEX IF NOT EXISTS idx_patent_decisions_v2_embeddings_vector
    ON patent_decisions_v2_embeddings
    USING ivfflat (vector vector_cosine_ops)
    WITH (lists = $1);
    `,
    [lists]
  )

  console.log('✅ 向量索引创建成功')
}

/**
 * 主函数
 */
async function main() {
  console.log('========================================')
  console.log('专利无效决定向量嵌入生成器')
  console.log('========================================\n')

  const pool = new Pool({
    host: CONFIG.pgHost,
    port: CONFIG.pgPort,
    database: CONFIG.pgDatabase,
    user: CONFIG.pgUser,
    password: CONFIG.pgPassword,
    max: 10,
  })

  try {
    // Step 1: 创建表
    await createEmbeddingsTable(pool)

    // Step 2: 生成向量嵌入
    await generateEmbeddings(pool)

    // Step 3: 创建索引
    await createVectorIndex(pool)

    console.log('\n========================================')
    console.log('✅ 全部完成！')
    console.log('========================================')

    // 显示统计
    const { rows } = await pool.query('SELECT COUNT(*) FROM patent_decisions_v2_embeddings')
    console.log(`总向量数: ${rows[0].count}`)
  } catch (err) {
    console.error('\n❌ 错误:', err)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

/**
 * 延迟函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// 运行
main()
