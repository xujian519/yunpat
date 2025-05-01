/**
 * 专利数据库适配器
 * Patent Database Adapter
 *
 * 统一接口访问多个专利数据源：
 * - patent_db (PostgreSQL) - 7500万中国专利
 * - Google Patents (在线API) - 全球专利
 *
 * @package @yunpat/patent-database
 */

// 导出类型定义
export type {
  PatentRecord,
  PatentQuery,
  PatentStatistics,
  PatentFamilyMember,
  PatentCitation,
  PatentDataSource,
  PatentDBConfig,
  GooglePatentsConfig,
} from './types.js'

// 导出数据源
export { PatentDBDataSource } from './sources/PatentDBDataSource.js'
export { GooglePatentsDataSource } from './sources/GooglePatentsDataSource.js'

// 导出适配器
export { PatentDatabaseAdapter, type DataSourceConfig } from './PatentDatabaseAdapter.js'

// 版本信息
export const VERSION = '0.1.0'
export const DATABASE_VERSION = '1.0.0'
