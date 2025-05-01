import { config } from 'dotenv'

const result = config()
if (result.error) {
  console.error('❌ .env 加载失败:', result.error.message)
  process.exit(1)
}

const required = ['DEEPSEEK_API_KEY', 'KNOWLEDGE_BASE_PATH', 'PROMPT_TEMPLATES_DIR']
const missing = required.filter((key) => !process.env[key])

if (missing.length > 0) {
  console.error('❌ 缺少必需的环境变量:', missing.join(', '))
  process.exit(1)
}

console.log('✅ 环境变量配置正确')
console.log('✅ DEEPSEEK_API_KEY:', process.env.DEEPSEEK_API_KEY?.substring(0, 10) + '...')
console.log('✅ KNOWLEDGE_BASE_PATH:', process.env.KNOWLEDGE_BASE_PATH)
console.log('✅ PROMPT_TEMPLATES_DIR:', process.env.PROMPT_TEMPLATES_DIR)
