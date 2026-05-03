#!/usr/bin/env node

/**
 * 智谱 CodeGeeX 编程套餐 API Key 验证脚本
 *
 * 编程套餐专门用于代码相关任务：
 * - 代码生成和补全
 * - 代码理解和分析
 * - 代码审查和优化
 * - Bug 修复建议
 *
 * 使用方法：
 * 1. 设置环境变量：export GLM_API_KEY=your-key-here
 * 2. 运行脚本：node scripts/check-codegeex-api.js
 */

import https from 'https'

const GLM_API_KEY = process.env.GLM_API_KEY
const CODEGEEX_MODEL = process.env.CODEGEEX_MODEL || 'codegeex-4'

if (!GLM_API_KEY) {
  console.error('❌ 错误：未设置 GLM_API_KEY 环境变量')
  console.error('\n请先设置 API Key：')
  console.error('  export GLM_API_KEY=your-key-here')
  console.error('\n或者在 .env 文件中设置：')
  console.error('  GLM_API_KEY=your-key-here')
  process.exit(1)
}

// 验证 API Key 格式
if (!GLM_API_KEY.includes('.')) {
  console.error('❌ 错误：API Key 格式不正确')
  console.error('智谱 GLM API Key 格式应该是：id.secret...')
  console.error('例如：1234567890.abcdef123456...')
  process.exit(1)
}

console.log('🔑 正在验证智谱 CodeGeeX 编程套餐 API Key...\n')
console.log(`📋 配置信息：`)
console.log(`   端点：https://open.bigmodel.cn/api/coding/paas/v4`)
console.log(`   模型：${CODEGEEX_MODEL}`)
console.log(`   API Key：${GLM_API_KEY.substring(0, 10)}...${GLM_API_KEY.substring(GLM_API_KEY.length - 6)}`)
console.log('')

// 发送测试请求到编程端点
const options = {
  hostname: 'open.bigmodel.cn',
  port: 443,
  path: '/api/coding/paas/v4/chat/completions',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${GLM_API_KEY}`,
  },
  timeout: 30000, // 30秒超时
}

// 测试代码生成任务
const testRequest = {
  model: CODEGEEX_MODEL,
  messages: [
    {
      role: 'user',
      content: '请用Python写一个计算斐波那契数列的函数',
    },
  ],
  max_tokens: 100, // 只需要100个token来验证
}

const req = https.request(options, (res) => {
  let data = ''

  res.on('data', (chunk) => {
    data += chunk
  })

  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✅ CodeGeeX API Key 验证成功！')
      console.log('\n📊 响应状态：', res.statusCode, 'OK')
      console.log('✨ 编程套餐可以正常使用\n')

      try {
        const response = JSON.parse(data)
        if (response.choices && response.choices.length > 0) {
          console.log('💬 代码生成示例：')
          console.log('─'.repeat(60))
          console.log(response.choices[0].message.content.trim())
          console.log('─'.repeat(60))
          console.log('')
        }

        console.log('💡 提示：')
        console.log('  - CodeGeeX 编程套餐已就绪')
        console.log('  - 专门用于代码生成、理解、分析等任务')
        console.log('  - 查看控制台：https://open.bigmodel.cn/usercenter')
        console.log('  - 查看用量：https://open.bigmodel.cn/usercenter/apikeys')
        console.log('  - 查看文档：https://open.bigmodel.cn/dev/api#cgeex')
      } catch (e) {
        console.log('⚠️  无法解析响应，但状态码正常')
      }
    } else if (res.statusCode === 401) {
      console.error('❌ API Key 无效或已过期')
      console.error('\n📋 响应状态：', res.statusCode, 'Unauthorized')
      console.error('\n💡 解决方案：')
      console.error('  1. 检查 API Key 是否正确')
      console.error('  2. 确认格式为：id.secret...')
      console.error('  3. 访问 https://open.bigmodel.cn/usercenter/apikeys 重新生成')
    } else if (res.statusCode === 403) {
      console.error('❌ API Key 无权访问 CodeGeeX 编程套餐')
      console.error('\n📋 响应状态：', res.statusCode, 'Forbidden')
      console.error('\n💡 可能的原因：')
      console.error('  1. API Key 权限不足')
      console.error('  2. 未开通 CodeGeeX 编程套餐')
      console.error('  3. 需要单独申请编程套餐权限')
      console.error('\n🔧 解决方案：')
      console.error('  1. 确认是否已开通编程套餐')
      console.error('  2. 访问 https://open.bigmodel.cn/product/coding 了解详情')
      console.error('  3. 联系客服：https://open.bigmodel.cn/contact')
    } else if (res.statusCode === 404) {
      console.error('❌ 模型不存在或端点错误')
      console.error('\n📋 响应状态：', res.statusCode, 'Not Found')
      console.error('\n💡 可能的原因：')
      console.error('  1. 模型名称不正确')
      console.error('  2. 未开通编程套餐')
      console.error('  3. 端点地址已变更')
      console.error('\n🔧 解决方案：')
      console.error('  1. 确认模型名称：codegeex-4 / codegeex-4-all / codegeex-turbo')
      console.error('  2. 确认已开通编程套餐')
      console.error('  3. 尝试使用通用模型：npm run api:check-glm')
    } else if (res.statusCode === 429) {
      console.error('❌ API 调用频率超限')
      console.error('\n📋 响应状态：', res.statusCode, 'Too Many Requests')
      console.error('\n💡 解决方案：')
      console.error('  1. 稍后重试')
      console.error('  2. 检查并发请求限制')
      console.error('  3. 考虑升级套餐')
    } else {
      console.error('❌ API 请求失败')
      console.error('\n📋 响应状态：', res.statusCode, res.statusMessage)
      console.error('\n📄 响应内容：', data)
    }

    process.exit(res.statusCode === 200 ? 0 : 1)
  })
})

req.on('error', (error) => {
  console.error('❌ 网络错误：', error.message)
  console.error('\n💡 可能的原因：')
  console.error('  1. 网络连接问题')
  console.error('  2. 智谱 API 服务暂时不可用')
  console.error('  3. 防火墙阻止了请求')
  console.error('\n🔧 建议操作：')
  console.error('  1. 检查网络连接')
  console.error('  2. 稍后重试')
  console.error('  3. 访问 https://open.bigmodel.cn/ 查看服务状态')
  console.error('  4. 尝试使用通用端点：npm run api:check-glm')
  process.exit(1)
})

req.on('timeout', () => {
  console.error('❌ 请求超时')
  console.error('\n💡 可能的原因：')
  console.error('  1. 网络延迟过高')
  console.error('  2. 智谱 API 响应缓慢')
  console.error('\n🔧 建议操作：')
  console.error('  1. 检查网络连接')
  console.error('  2. 稍后重试')
  console.error('  3. 尝试使用 codegeex-turbo（响应更快）')
  req.destroy()
  process.exit(1)
})

req.write(JSON.stringify(testRequest))
req.end()
