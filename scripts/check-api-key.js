#!/usr/bin/env node

/**
 * DeepSeek API Key 余额检查脚本
 *
 * 使用方法：
 * 1. 设置环境变量：export DEEPSEEK_API_KEY=your-key-here
 * 2. 运行脚本：node scripts/check-api-key.js
 */

import https from 'https'

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY

if (!DEEPSEEK_API_KEY) {
  console.error('❌ 错误：未设置 DEEPSEEK_API_KEY 环境变量')
  console.error('\n请先设置 API Key：')
  console.error('  export DEEPSEEK_API_KEY=your-key-here')
  console.error('\n或者在 .env 文件中设置：')
  console.error('  DEEPSEEK_API_KEY=your-key-here')
  process.exit(1)
}

// 验证 API Key 格式
if (!DEEPSEEK_API_KEY.startsWith('sk-')) {
  console.error('❌ 错误：API Key 格式不正确')
  console.error('DeepSeek API Key 应该以 "sk-" 开头')
  process.exit(1)
}

console.log('🔑 正在验证 DeepSeek API Key...\n')

// 发送一个简单的测试请求
const options = {
  hostname: 'api.deepseek.com',
  port: 443,
  path: '/v1/chat/completions',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
  },
  timeout: 10000, // 10秒超时
}

const testRequest = {
  model: 'deepseek-chat',
  messages: [
    {
      role: 'user',
      content: 'Hi', // 最简单的测试消息
    },
  ],
  max_tokens: 1, // 只需要1个token来验证
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
        console.log('💡 提示：')
        console.log('  - 如果后续遇到余额问题，请访问 DeepSeek 控制台充值')
        console.log('  - 控制台地址：https://platform.deepseek.com/')
        console.log('  - 查看余额和用量：https://platform.deepseek.com/usage')
      } catch (e) {
        console.log('⚠️  无法解析响应，但状态码正常')
      }
    } else if (res.statusCode === 401) {
      console.error('❌ API Key 无效或已过期')
      console.error('\n📋 响应状态：', res.statusCode, 'Unauthorized')
      console.error('\n💡 解决方案：')
      console.error('  1. 检查 API Key 是否正确')
      console.error('  2. 访问 https://platform.deepseek.com/ 获取新的 API Key')
    } else if (res.statusCode === 429) {
      console.error('❌ API 调用频率超限或余额不足')
      console.error('\n📋 响应状态：', res.statusCode, 'Too Many Requests')
      console.error('\n💡 解决方案：')
      console.error('  1. 检查账户余额是否充足')
      console.error('  2. 访问 https://platform.deepseek.com/usage 查看用量')
      console.error('  3. 如需充值：https://platform.deepseek.com/topup')
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
  console.error('  2. DeepSeek API 服务暂时不可用')
  console.error('  3. 防火墙阻止了请求')
  console.error('\n🔧 建议操作：')
  console.error('  1. 检查网络连接')
  console.error('  2. 稍后重试')
  console.error('  3. 访问 https://status.deepseek.com/ 查看服务状态')
  process.exit(1)
})

req.on('timeout', () => {
  console.error('❌ 请求超时')
  console.error('\n💡 可能的原因：')
  console.error('  1. 网络延迟过高')
  console.error('  2. DeepSeek API 响应缓慢')
  console.error('\n🔧 建议操作：')
  console.error('  1. 检查网络连接')
  console.error('  2. 稍后重试')
  req.destroy()
  process.exit(1)
})

req.write(JSON.stringify(testRequest))
req.end()
