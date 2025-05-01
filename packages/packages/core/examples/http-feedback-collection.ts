/**
 * HTTP 反馈收集示例
 *
 * 演示如何使用 ApprovalFlow 的 HTTP 模式收集用户反馈
 */

import { ApprovalFlow, ApprovalMode } from '../src/gateway/ApprovalFlow.js'
import type { UserFeedback } from '../src/gateway/ApprovalFlow.js'

async function main() {
  console.log('=== HTTP 反馈收集示例 ===\n')

  // 1. 创建 HTTP 审批流程
  const approvalFlow = new ApprovalFlow(
    {
      mode: ApprovalMode.HTTP,
      defaultTimeout: 60000, // 60 秒超时
      enableLearning: true,
      httpServerConfig: {
        port: 3000,
        host: '0.0.0.0',
        apiPrefix: '/api/v1',
        corsOrigin: '*', // 生产环境应该指定具体的源
        apiKey: process.env.HTTP_API_KEY, // 可选的 API 密钥
      },
    },
    undefined // EventBus（可选）
  )

  // 2. 启动 HTTP 服务器
  await approvalFlow.start()
  console.log('✅ HTTP 审批服务器已启动在 http://0.0.0.0:3000\n')

  // 3. 模拟一个需要审批的结果
  const mockResult = {
    agentName: 'PatentWriterAgent',
    output: '生成的专利文本内容...',
    metadata: {
      confidence: 0.85,
      suggestions: ['建议1', '建议2'],
    },
  }

  const mockContext = {
    agentName: 'PatentWriterAgent',
    executionId: 'exec-123',
    goal: '生成专利申请文件',
    reasoning: '基于用户提供的技术交底书生成专利文本',
  }

  // 4. 请求审批（这会阻塞等待 HTTP API 收到反馈）
  console.log('⏳ 等待用户通过 HTTP API 提供反馈...')
  console.log('📝 请使用以下 API 端点提交反馈：\n')

  console.log('1. 批准:')
  console.log('   POST http://localhost:3000/api/v1/approvals/{approvalId}/approve')
  console.log('   Body: { "approved": true, "feedback": "批准意见" }\n')

  console.log('2. 拒绝:')
  console.log('   POST http://localhost:3000/api/v1/approvals/{approvalId}/approve')
  console.log('   Body: { "approved": false, "feedback": "拒绝原因" }\n')

  console.log('3. 修正:')
  console.log('   POST http://localhost:3000/api/v1/approvals/{approvalId}/correct')
  console.log('   Body: { "corrections": { "field": "new value" }, "feedback": "修正说明" }\n')

  console.log('4. 补充:')
  console.log('   POST http://localhost:3000/api/v1/approvals/{approvalId}/supplement')
  console.log('   Body: { "supplements": { "extra": "info" }, "feedback": "补充说明" }\n')

  console.log('5. 查看待审批列表:')
  console.log('   GET http://localhost:3000/api/v1/approvals\n')

  console.log('6. 查看特定审批详情:')
  console.log('   GET http://localhost:3000/api/v1/approvals/{approvalId}\n')

  try {
    // 请求审批（会阻塞直到收到反馈或超时）
    const response = await approvalFlow.requestApproval(
      mockResult,
      mockContext as any,
      60000 // 60 秒超时
    )

    console.log('\n✅ 收到反馈！')
    console.log('审批ID:', response.approvalId)
    console.log('是否批准:', response.approved)
    console.log('反馈:', JSON.stringify(response.feedback, null, 2))

    // 5. 收集反馈（用于学习）
    const feedback: UserFeedback = await approvalFlow.collectFeedback(response.approvalId)

    console.log('\n📊 收集到的反馈:')
    console.log('类型:', feedback.type)
    console.log('内容:', feedback.content)
    console.log('时间:', feedback.timestamp)

    if (feedback.corrections) {
      console.log('修正:', feedback.corrections)
    }

    if (feedback.supplements) {
      console.log('补充:', feedback.supplements)
    }

    // 6. 从反馈中学习
    await approvalFlow.learnFromFeedback(feedback)

    // 7. 获取统计信息
    const stats = approvalFlow.getStats()
    console.log('\n📈 审批统计:')
    console.log('总审批数:', stats.totalApprovals)
    console.log('批准数:', stats.approvedCount)
    console.log('拒绝数:', stats.rejectedCount)
    console.log('修正数:', stats.correctedCount)
    console.log('补充数:', stats.supplementedCount)
    console.log('准确率:', (stats.accuracy * 100).toFixed(2) + '%')
  } catch (error) {
    console.error('\n❌ 错误:', error)
  } finally {
    // 8. 停止服务器
    await approvalFlow.stop()
    console.log('\n✅ HTTP 审批服务器已停止')
  }
}

// 运行示例
if (require.main === module) {
  main().catch(console.error)
}

export { main }
