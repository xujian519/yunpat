/**
 * deepClone和tags测试
 */

import { deepClone } from '../src/memory/CheckpointManager.js'

// 测试deepClone
const obj1 = {
  tags: ['init'],
  data: 'test',
}

const cloned1 = deepClone(obj1)

console.log('原始对象:', obj1)
console.log('克隆对象:', cloned1)
console.log('tags相等:', obj1.tags === cloned1.tags)
console.log('tags内容相等:', JSON.stringify(obj1.tags) === JSON.stringify(cloned1.tags))
console.log('includes测试:', cloned1.tags.includes('init'))

// 测试检查点结构
const checkpoint = {
  id: 'test-001',
  tags: ['init'],
  agentName: 'TestAgent',
  executionId: 'exec-001',
  timestamp: new Date(),
  iteration: 1,
  memorySnapshot: {},
  contextSnapshot: {},
  stateSnapshot: {},
}

const clonedCheckpoint = deepClone(checkpoint)

console.log('\n检查点克隆:')
console.log('原始tags:', checkpoint.tags)
console.log('克隆tags:', clonedCheckpoint.tags)
console.log('tags includes init:', clonedCheckpoint.tags.includes('init'))
