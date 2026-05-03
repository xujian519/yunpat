#!/usr/bin/env node

/**
 * 智谱 GLM API Key 验证脚本
 *
 * 使用方法：
 * 1. 设置环境变量：export GLM_API_KEY=your-key-here
 * 2. 运行脚本：node scripts/check-glm-api.js
 */

import https from 'https'

const GLM_API_KEY = process.env.GLM_API_KEY
const GLM_MODEL = process.env.GLM_MODEL || 'glm-4.7'

if (!GLM_API_KEY) {
  console.error('❌ 错误：未设置 GLM_API_KEY 环境变量')
  console.error('\n请先设置 API Key：')
  console.error('  export GLM_API_KEY=your-key-here')
  console.error('\n或者在 .env 文件中设置：')
  console.error('  GLM_API_KEY=your-key-here')
  process.exit(1)
}

// 验证 API Key 格式（智谱的格式是 id.secret...）
if (!GLM_API_KEY.includes('.')) {
  console.error('❌ 错误：API Key 格式不正确')
  console.error('智谱 GLM API Key 格式应该是：id.secret...')
  console.error('例如：1234567890.abcdef123456...')
  process.exit(1)
}

console.log('🔑 正在验证智谱 GLM API Key...\n')
console.log(`📋 配置信息：`)
console.log(`   模型：${GLM_MODEL}`)
console.log(`   API Key：${GLM_API_KEY.substring(0, 10)}...${GLM_API_KEY.substring(GLM_API_KEY.length - 6)}`)
console.log('')

// 发送测试请求
const options = {
  hostname: 'open.bigmodel.cn',
  port: 443,
  path: '/api/paas/v4/chat/completions',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${GLM_API_KEY}`,
  },
  timeout: 30000, // 30秒超时
}

const testRequest = {
  model: GLM_MODEL,
  messages: [
    {
      role: 'user',
      content: '你好', // 最简单的测试消息
    },
  ],
  max_tokens: 10, // 只需要10个token来验证
}

const req = https.request(options, (res) => {
  let data = ''

  res.on('data', (chunk) => {
    data += chunk
  })

  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✅ API Key 验证成功！')
      console.log('\n📊 响应状态：', res.statusCode, 'OK')
      console.log('✨ API Key 可以正常使用\n')

      try {
        const response = JSON.parse(data)
        if (response.choices && response.choices.length > 0) {
          console.log('💬 模型回复：')
          console.log(`   "${response.choices[0].message.content.trim()}"`)
          console.log('')
        }

        console.log('💡 提示：')
        console.log('  - 模型已就绪，可以开始使用')
        console.log('  - 查看控制台：https://open.bigmodel.cn/usercenter')
        console.log('  - 查看用量：https://open.bigmodel.cn/usercenter/apikeys')
        console.log('  - 查看文档：https://open.bigmodel.cn/dev/api')
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
      console.error('❌ API Key 无权访问该模型')
      console.error('\n📋 响应状态：', res.statusCode, 'Forbidden')
      console.error('\n💡 可能的原因：')
      console.error('  1. API Key 权限不足')
      console.error('  2. 该模型需要单独授权')
      console.error('  3. 账户未开通该模型服务')
      console.error('\n🔧 解决方案：')
      console.error('  1. 检查账户是否开通该模型')
      console.error('  2. 尝试使用 glm-4-flash 测试')
      console.error('  3. 联系客服：https://open.bigmodel.cn/contact')
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
  console.error('  3. 尝试使用 glm-4-flash（响应更快）')
  req.destroy()
  process.exit(1)
})

req.write(JSON.stringify(testRequest))
req.end()
