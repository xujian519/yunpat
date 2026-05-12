import { Client } from 'pg'
import neo4j from 'neo4j-driver'
import { config } from 'dotenv'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载环境变量
config({ path: path.resolve(__dirname, '../.env') })

async function verifyPostgres(dbName: string, urlStr?: string, hostStr?: string) {
  let client

  if (urlStr) {
    client = new Client({ connectionString: urlStr })
  } else {
    client = new Client({
      host: process.env[`${hostStr}_HOST`] || '127.0.0.1',
      port: parseInt(process.env[`${hostStr}_PORT`] || '6432'),
      database: process.env[`${hostStr}_NAME`] || process.env[`${hostStr}_DATABASE`],
      user: process.env[`${hostStr}_USER`] || 'postgres',
      password: process.env[`${hostStr}_PASSWORD`] || '',
    })
  }

  try {
    await client.connect()
    const res = await client.query('SELECT version()')
    console.log(`✅ PostgreSQL [${dbName}] 连接成功! 版本: ${res.rows[0].version.split(',')[0]}`)
  } catch (err: any) {
    console.error(`❌ PostgreSQL [${dbName}] 连接失败:`, err.message)
  } finally {
    await client.end().catch(() => {})
  }
}

async function verifyNeo4j() {
  const uri = process.env.NEO4J_URI || 'bolt://localhost:7687'
  const user = process.env.NEO4J_USER || 'neo4j'
  const password = process.env.NEO4J_PASSWORD || 'athena_neo4j_2024'

  const driver = neo4j.driver(uri, neo4j.auth.basic(user, password))
  try {
    const serverInfo = await driver.getServerInfo()
    console.log(`✅ Neo4j 图数据库连接成功! 地址: ${serverInfo.address}, 版本: ${serverInfo.agent}`)
  } catch (err: any) {
    console.error(`❌ Neo4j 图数据库连接失败:`, err.message)
  } finally {
    await driver.close()
  }
}

async function verifyQdrant() {
  const url = process.env.QDRANT_URL || 'http://localhost:6333'
  try {
    const response = await fetch(url)
    const data = await response.json()
    if (data.title === 'qdrant - vector search engine') {
      console.log(`✅ Qdrant 向量数据库连接成功! 版本: ${data.version}`)
    } else {
      console.log(`⚠️ Qdrant 连接成功，但返回了意外的数据格式`)
    }
  } catch (err: any) {
    console.error(`❌ Qdrant 向量数据库连接失败:`, err.message)
  }
}

async function verifyKnowledgeBase() {
  let kbPath = process.env.KNOWLEDGE_BASE_PATH || './knowledge-base'

  // 处理相对于当前工作目录的路径和 ~ (用户主目录)
  if (kbPath.startsWith('~/')) {
    const homedir = process.env.HOME || process.env.USERPROFILE || ''
    kbPath = path.join(homedir, kbPath.slice(2))
  } else if (!path.isAbsolute(kbPath)) {
    // 适配项目根目录下的 knowledge-base
    kbPath = path.resolve(__dirname, '../../', kbPath)
  }

  try {
    const stats = await fs.promises.stat(kbPath)
    if (stats.isDirectory()) {
      const files = await fs.promises.readdir(kbPath)
      console.log(`✅ 知识库连接成功! 路径: ${kbPath}, 根目录下有 ${files.length} 个文件/文件夹`)

      // 简单扫描一下包含的 .md 文件数量（只看根目录）
      const mdFiles = files.filter((f) => f.endsWith('.md'))
      if (mdFiles.length > 0) {
        console.log(`   (发现了 ${mdFiles.length} 个 Markdown 文件)`)
      }
    } else {
      console.log(`⚠️ 知识库路径存在，但不是一个目录: ${kbPath}`)
    }
  } catch (err: any) {
    console.error(`❌ 知识库连接失败! 找不到路径: ${kbPath}`)
    console.error(`   错误信息: ${err.message}`)
  }
}

async function runAll() {
  console.log('🔍 开始验证基础设施连通性...\n')

  await verifyPostgres('yunpat应用库 (Drizzle)', process.env.DATABASE_URL)
  await verifyPostgres('patent_db专利库 (PgBouncer)', undefined, 'PATENT_DB')
  await verifyPostgres('legal_world_model法律库 (PgBouncer)', undefined, 'PG')

  await verifyNeo4j()
  await verifyQdrant()
  await verifyKnowledgeBase()

  console.log('\n🏁 验证结束。')
}

runAll().catch(console.error)
