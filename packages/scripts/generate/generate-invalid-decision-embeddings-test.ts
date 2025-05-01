/**
 * 测试版：为专利无效决定生成向量嵌入
 *
 * 只处理前 10 个文档，用于验证脚本是否正常工作
 */

import { Pool } from 'pg'
import { EmbeddingAdapter } from '@yunpat/core'

// 测试配置
const CONFIG = {
  pgHost: 'localhost',
  pgPort: 5432,
  pgDatabase: 'legal_world_model',
  pgUser: 'postgres',
  pgPassword: 'nxLVXyZ3e87L0kE8Xqx3AB9NK1z74pwOdjugqpc7hc',

  // 测试模式：只处理前 N 个文档
  testMode: true,
  maxDocuments: 10,

  // 分块配置
  chunkSize: 500,
  chunkOverlap: 50,
  maxChunks: 10,
}

async function main() {
  console.log('========================================')
  console.log('专利无效决定向量嵌入生成器（测试版）')
  console.log('========================================\n')
  console.log(`测试模式: 只处理前 ${CONFIG.maxDocuments} 个文档\n`)

  const pool = new Pool({
    host: CONFIG.pgHost,
    port: CONFIG.pgPort,
    database: CONFIG.pgDatabase,
    user: CONFIG.pgUser,
    password: CONFIG.pgPassword,
    max: 10,
  })

  try {
    // 1. 创建表
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
        created_at TIMESTAMP DEFAULT NOW()
      );
    `)
    console.log('✅ 向量表创建成功')

    // 2. 初始化嵌入模型
    console.log('\n[Step 2] 初始化 BGE-M3 嵌入模型...')
    const embedding = await EmbeddingAdapter.createBGEEmbedding({
      model: 'BAAI/bge-m3',
      encodingFormat: 'float',
    })
    console.log('✅ BGE-M3 模型初始化成功')

    // 3. 查询文档
    console.log('\n[Step 3] 查询文档...')
    const limit = CONFIG.testMode ? CONFIG.maxDocuments : 9562
    const { rows: documents } = await pool.query(
      `SELECT id, document_number, content
       FROM patent_decisions_v2
       ORDER BY id
       LIMIT $1`,
      [limit]
    )
    console.log(`✅ 找到 ${documents.length} 个文档`)

    // 4. 生成向量嵌入
    console.log('\n[Step 4] 生成向量嵌入...')
    let totalChunks = 0

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i]
      console.log(`\n处理文档 ${i + 1}/${documents.length}: ${doc.document_number}`)

      // 分块
      const chunks = chunkText(doc.content, CONFIG.chunkSize, CONFIG.chunkOverlap)
      console.log(`  分块数: ${chunks.length}`)

      // 限制分块数
      const limitedChunks = chunks.slice(0, CONFIG.maxChunks)

      // 生成向量嵌入
      for (let j = 0; j < limitedChunks.length; j++) {
        try {
          console.log(`    生成向量 ${j + 1}/${limitedChunks.length}...`)
          const vector = await embedding.embedText(limitedChunks[j])

          // 插入数据库
          const vectorStr = `[${vector.join(',')}]`
          await pool.query(
            `
            INSERT INTO patent_decisions_v2_embeddings
              (document_id, document_number, chunk_index, chunk_text, vector)
            VALUES ($1, $2, $3, $4, $5::vector(1024))
            `,
            [doc.id, doc.document_number, j, limitedChunks[j], vectorStr]
          )

          totalChunks++
          console.log(`    ✅ 完成`)
        } catch (err) {
          console.error(`    ❌ 失败:`, err.message)
        }
      }
    }

    console.log(`\n✅ 向量嵌入生成完成: ${totalChunks} 个向量`)

    // 5. 显示统计
    const { rows } = await pool.query('SELECT COUNT(*) FROM patent_decisions_v2_embeddings')
    console.log(`\n总向量数: ${rows[0].count}`)

    console.log('\n========================================')
    console.log('✅ 测试完成！')
    console.log('========================================')
  } catch (err) {
    console.error('\n❌ 错误:', err)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = []
  const paragraphs = text.split(/\n\n+/)
  let currentChunk = ''

  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length > chunkSize) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim())
        currentChunk = paragraph.slice(-overlap)
      } else {
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

main()
