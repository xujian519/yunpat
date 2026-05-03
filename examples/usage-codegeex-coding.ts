/**
 * CodeGeeX 编程套餐使用示例
 *
 * CodeGeeX 是智谱AI专门针对代码任务的模型，使用编程端点：
 * https://open.bigmodel.cn/api/coding/paas/v4
 *
 * 适用场景：
 * - 代码生成和补全
 * - 代码理解和分析
 * - 代码审查和优化
 * - Bug 修复建议
 */

import { createZhipuCodingModel, NativeModel } from '../packages/core/src/llm/NativeLLMAdapter.js'

/**
 * 示例1：代码生成
 */
async function example1_CodeGeneration() {
  console.log('\n=== 示例1：代码生成 ===\n')

  const llm = createZhipuCodingModel(process.env.GLM_API_KEY!, NativeModel.CODEGEEX_4)

  const response = await llm.chat(
    [
      {
        role: 'user',
        content: '请用Python写一个二叉树的中序遍历函数，要求包含注释和类型提示',
      },
    ],
    {
      temperature: 0.2, // 代码生成建议使用较低温度
      max_tokens: 500,
    }
  )

  console.log('生成的代码：')
  console.log('─'.repeat(60))
  console.log(response.content)
  console.log('─'.repeat(60))
  console.log('\n')
}

/**
 * 示例2：代码理解和分析
 */
async function example2_CodeUnderstanding() {
  console.log('\n=== 示例2：代码理解 ===\n')

  const llm = createZhipuCodingModel(process.env.GLM_API_KEY!, NativeModel.CODEGEEX_4)

  const codeSnippet = `
def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quicksort(left) + middle + quicksort(right)
  `

  const response = await llm.chat([
    {
      role: 'user',
      content: `请分析以下代码的功能、时间复杂度和空间复杂度：\n\n${codeSnippet}`,
    },
  ])

  console.log('代码分析：')
  console.log(response.content)
  console.log('\n---\n')
}

/**
 * 示例3：代码审查和优化
 */
async function example3_CodeReview() {
  console.log('\n=== 示例3：代码审查 ===\n')

  const llm = createZhipuCodingModel(process.env.GLM_API_KEY!, NativeModel.CODEGEEX_4)

  const codeToReview = `
def find_duplicate(arr):
    for i in range(len(arr)):
        for j in range(i+1, len(arr)):
            if arr[i] == arr[j]:
                return arr[i]
    return None
  `

  const response = await llm.chat([
    {
      role: 'user',
      content: `请审查以下代码，指出潜在问题并提供优化建议：\n\n${codeToReview}`,
    },
  ])

  console.log('审查结果：')
  console.log(response.content)
  console.log('\n---\n')
}

/**
 * 示例4：Bug 修复
 */
async function example4_BugFix() {
  console.log('\n=== 示例4：Bug 修复 ===\n')

  const llm = createZhipuCodingModel(process.env.GLM_API_KEY!, NativeModel.CODEGEEX_4)

  const buggyCode = `
def fibonacci(n):
    if n <= 0:
        return 0
    elif n == 1:
        return 1
    else:
        return fibonacci(n-1) + fibonacci(n-2)

# 问题：性能太慢，n=50时需要很长时间
  `

  const response = await llm.chat([
    {
      role: 'user',
      content: `以下代码存在性能问题，请修复并提供优化后的版本：\n\n${buggyCode}`,
    },
  ])

  console.log('修复方案：')
  console.log(response.content)
  console.log('\n---\n')
}

/**
 * 示例5：代码注释生成
 */
async function example5_CodeDocumentation() {
  console.log('\n=== 示例5：代码注释 ===\n')

  const llm = createZhipuCodingModel(process.env.GLM_API_KEY!, NativeModel.CODEGEEX_4)

  const codeWithoutComments = `
class Node:
    def __init__(self, val):
        self.val = val
        self.left = None
        self.right = None

def max_depth(root):
    if not root:
        return 0
    return 1 + max(max_depth(root.left), max_depth(root.right))
  `

  const response = await llm.chat([
    {
      role: 'user',
      content: `请为以下代码添加详细的注释和文档字符串：\n\n${codeWithoutComments}`,
    },
  ])

  console.log('带注释的代码：')
  console.log('─'.repeat(60))
  console.log(response.content)
  console.log('─'.repeat(60))
  console.log('\n')
}

/**
 * 示例6：多语言代码转换
 */
async function example6_CodeTranslation() {
  console.log('\n=== 示例6：代码转换 ===\n')

  const llm = createZhipuCodingModel(process.env.GLM_API_KEY!, NativeModel.CODEGEEX_4)

  const pythonCode = `
def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1
  `

  const response = await llm.chat([
    {
      role: 'user',
      content: `请将以下Python代码转换为JavaScript，保持相同的逻辑和功能：\n\n${pythonCode}`,
    },
  ])

  console.log('转换后的JavaScript代码：')
  console.log('─'.repeat(60))
  console.log(response.content)
  console.log('─'.repeat(60))
  console.log('\n')
}

/**
 * 主函数
 */
async function main() {
  // 检查环境变量
  if (!process.env.GLM_API_KEY) {
    console.error('❌ 错误：未设置 GLM_API_KEY 环境变量')
    console.error('\n请先设置 API Key：')
    console.error('  export GLM_API_KEY=your-key-here')
    console.error('\n或者运行验证脚本：')
    console.error('  node scripts/check-codegeex-api.js')
    process.exit(1)
  }

  console.log('🚀 CodeGeeX 编程套餐示例')
  console.log('========================')
  console.log('端点：https://open.bigmodel.cn/api/coding/paas/v4')

  try {
    // 运行所有示例
    await example1_CodeGeneration()
    await example2_CodeUnderstanding()
    await example3_CodeReview()
    await example4_BugFix()
    await example5_CodeDocumentation()
    await example6_CodeTranslation()

    console.log('\n✅ 所有示例运行完成！')
    console.log('\n💡 提示：')
    console.log('  - CodeGeeX 专门针对代码任务优化')
    console.log('  - 建议温度设置：0.2-0.4（代码需要确定性）')
    console.log('  - 支持多种编程语言')
    console.log('  - 更多配置选项请参考：docs/guides/CODEGEEX-SETUP.md')
  } catch (error) {
    console.error('\n❌ 运行出错：', error)
    console.error('\n💡 可能的原因：')
    console.error('  1. API Key 无效或未开通编程套餐')
    console.error('  2. 网络连接问题')
    console.error('  3. 模型名称不正确')
    console.error('\n🔧 建议操作：')
    console.error('  1. 运行验证：npm run api:check-codegeex')
    console.error('  2. 确认已开通编程套餐')
    console.error('  3. 查看：https://open.bigmodel.cn/product/coding')
    process.exit(1)
  }
}

// 运行主函数
main()
