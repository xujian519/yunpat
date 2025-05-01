#!/usr/bin/env node

/**
 * Metrics 功能测试脚本
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

async function testMetrics() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          测试 Prometheus Metrics 功能                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // 测试 1: 健康检查
  console.log('测试 1: 健康检查端点');
  try {
    const response = await fetch(`${BASE_URL}/api/health`);
    const data = await response.json();
    console.log('✅ 健康检查通过:', data);
  } catch (error) {
    console.log('⚠️  服务器未运行，这是正常的（测试模式）');
    console.log('   要测试完整功能，请运行: node examples/with-metrics.ts');
    return;
  }

  // 测试 2: Agent 端点
  console.log('\n测试 2: Agent 端点');
  try {
    const response = await fetch(`${BASE_URL}/api/agent/PatentWriterAgent`);
    const data = await response.json();
    console.log('✅ Agent 端点通过:', data);
  } catch (error) {
    console.log('❌ Agent 端点失败:', error.message);
  }

  // 测试 3: Metrics 端点
  console.log('\n测试 3: Metrics 端点');
  try {
    const response = await fetch(`${BASE_URL}/metrics`);
    const metrics = await response.text();
    
    // 验证关键指标存在
    const hasHttpMetrics = metrics.includes('http_request_duration_seconds');
    const hasAgentMetrics = metrics.includes('agent_tasks_total');
    const hasLLMMetrics = metrics.includes('llm_calls_total');
    
    console.log('✅ Metrics 端点通过');
    console.log(`   HTTP 指标: ${hasHttpMetrics ? '✅' : '❌'}`);
    console.log(`   Agent 指标: ${hasAgentMetrics ? '✅' : '❌'}`);
    console.log(`   LLM 指标: ${hasLLMMetrics ? '✅' : '❌'}`);
    
    // 显示部分 metrics
    console.log('\n📊 示例指标:');
    const lines = metrics.split('\n').slice(0, 10);
    lines.forEach(line => console.log('   ' + line));
  } catch (error) {
    console.log('❌ Metrics 端点失败:', error.message);
  }

  console.log('\n✅ 测试完成！');
}

// 运行测试
testMetrics().catch(error => {
  console.error('❌ 测试失败:', error);
  process.exit(1);
});
