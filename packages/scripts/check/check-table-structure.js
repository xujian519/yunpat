/**
 * 检查 legal_world_model 数据库的表结构
 */

import { Pool } from 'pg'

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'legal_world_model',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
})

async function checkTables() {
  console.log('检查数据库表结构...\n')

  // 检查 legal_articles_v2
  try {
    const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'legal_articles_v2'
      ORDER BY ordinal_position
    `)
    console.log('legal_articles_v2 表结构:')
    result.rows.forEach((row) => {
      console.log(`  - ${row.column_name}: ${row.data_type}`)
    })
  } catch (err) {
    console.error('查询 legal_articles_v2 失败:', err.message)
  }

  // 检查 patent_rules_v2
  try {
    const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'patent_rules_v2'
      ORDER BY ordinal_position
    `)
    console.log('\npatent_rules_v2 表结构:')
    result.rows.forEach((row) => {
      console.log(`  - ${row.column_name}: ${row.data_type}`)
    })
  } catch (err) {
    console.error('查询 patent_rules_v2 失败:', err.message)
  }

  // 检查 patent_decisions_v2
  try {
    const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'patent_decisions_v2'
      ORDER BY ordinal_position
    `)
    console.log('\npatent_decisions_v2 表结构:')
    result.rows.forEach((row) => {
      console.log(`  - ${row.column_name}: ${row.data_type}`)
    })
  } catch (err) {
    console.error('查询 patent_decisions_v2 失败:', err.message)
  }

  // 检查所有表
  try {
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `)
    console.log('\n所有表:')
    result.rows.forEach((row) => {
      console.log(`  - ${row.table_name}`)
    })
  } catch (err) {
    console.error('查询表列表失败:', err.message)
  }

  await pool.end()
}

checkTables()
