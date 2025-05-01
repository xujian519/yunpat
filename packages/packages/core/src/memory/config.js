/**
 * 记忆层配置
 *
 * 从环境变量读取配置，提供安全的默认值
 */
/**
 * 获取 BGE-M3 API 密钥
 *
 * 优先级：环境变量 > 配置文件 > 默认值
 */
export function getBGEApiKey() {
  return (
    process.env.BGE_API_KEY || process.env.BGE_M3_API_KEY || process.env.EMBEDDING_API_KEY || ''
  )
}
/**
 * 获取 BGE-M3 服务地址
 */
export function getBGEBaseUrl() {
  return process.env.BGE_BASE_URL || process.env.BGE_M3_BASE_URL || 'http://localhost:8009/v1'
}
/**
 * 获取 PostgreSQL 数据库 URL
 */
export function getDatabaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.MEMORY_DATABASE_URL ||
    'postgres://yunpat:yunpat123@localhost:5432/yunpat'
  )
}
/**
 * 获取向量维度
 */
export function getVectorDimension() {
  const dim = process.env.VECTOR_DIMENSION || process.env.BGE_VECTOR_DIMENSION
  return dim ? parseInt(dim, 10) : 1024
}
/**
 * 获取 Token 窗口最大 Token 数
 */
export function getMaxTokens() {
  const max = process.env.MAX_TOKENS || process.env.TOKEN_WINDOW_SIZE
  return max ? parseInt(max, 10) : 4000
}
/**
 * 从环境变量加载记忆层配置
 */
export function loadMemoryConfig(userConfig) {
  return {
    bgeApiKey: userConfig?.bgeApiKey || getBGEApiKey(),
    bgeBaseUrl: userConfig?.bgeBaseUrl || getBGEBaseUrl(),
    databaseUrl: userConfig?.databaseUrl || getDatabaseUrl(),
    vectorDimension: userConfig?.vectorDimension || getVectorDimension(),
    maxTokens: userConfig?.maxTokens || getMaxTokens(),
    reservedTokens: userConfig?.reservedTokens || 500,
    cacheMaxSize: userConfig?.cacheMaxSize || 1000,
    enableRAG: userConfig?.enableRAG ?? true,
    enableTokenWindow: userConfig?.enableTokenWindow ?? true,
  }
}
/**
 * 验证配置
 */
export function validateMemoryConfig(config) {
  const errors = []
  // 验证 BGE API Key（如果启用 RAG）
  if (config.enableRAG && !config.bgeApiKey) {
    errors.push('BGE_API_KEY is required when RAG is enabled')
  }
  // 验证数据库 URL
  if (!config.databaseUrl) {
    errors.push('DATABASE_URL is required')
  }
  // 验证向量维度
  if (config.vectorDimension && config.vectorDimension <= 0) {
    errors.push('VECTOR_DIMENSION must be positive')
  }
  // 验证 Token 窗口
  if (config.maxTokens && config.maxTokens <= 0) {
    errors.push('MAX_TOKENS must be positive')
  }
  return {
    valid: errors.length === 0,
    errors,
  }
}
