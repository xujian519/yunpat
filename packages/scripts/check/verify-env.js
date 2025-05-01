// 简单的环境变量验证脚本（不依赖 dotenv）
const fs = require('fs')
const path = require('path')

// 读取 .env 文件
const envPath = path.join(process.cwd(), '.env')
if (!fs.existsSync(envPath)) {
  console.error('❌ .env 文件不存在')
  process.exit(1)
}

// 解析环境变量
const envContent = fs.readFileSync(envPath, 'utf-8')
const envVars = {}
envContent.split('\n').forEach((line) => {
  const [key, ...valueParts] = line.split('=')
  if (key && !key.startsWith('#') && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim()
  }
})

// 验证必需的环境变量
const required = ['DEEPSEEK_API_KEY', 'KNOWLEDGE_BASE_PATH', 'PROMPT_TEMPLATES_DIR']
const missing = required.filter((key) => !envVars[key])

if (missing.length > 0) {
  console.error('❌ 缺少必需的环境变量:', missing.join(', '))
  process.exit(1)
}

console.log('✅ 环境变量配置正确')
console.log('✅ DEEPSEEK_API_KEY:', envVars.DEEPSEEK_API_KEY?.substring(0, 10) + '...')
console.log('✅ KNOWLEDGE_BASE_PATH:', envVars.KNOWLEDGE_BASE_PATH)
console.log('✅ PROMPT_TEMPLATES_DIR:', envVars.PROMPT_TEMPLATES_DIR)
