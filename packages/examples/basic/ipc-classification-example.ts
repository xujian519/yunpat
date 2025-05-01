/**
 * IPC 分类功能使用示例
 * 演示如何在专利撰写流程中使用 IPC 分类
 */

import { classifyIpc } from '../patents/core/PatentCoreBridge.js'

async function main() {
  console.log('=== IPC 分类功能使用示例 ===\n')

  // 示例 1: 电子技术发明
  console.log('1️⃣ 电子技术发明:')
  const electronics = await classifyIpc(
    '本发明涉及一种半导体通信电路装置，包括晶体管放大器、' +
      '集成电路和信号处理模块，用于提高无线通信的传输效率'
  )
  console.log(
    `   主要分类: ${electronics.classifications[0].section} - ${electronics.classifications[0].description}`
  )
  console.log(`   是否使用 Fallback: ${electronics.fallback ? '是' : '否'}\n`)

  // 示例 2: 机械技术发明
  console.log('2️⃣ 机械技术发明:')
  const mechanical = await classifyIpc(
    '一种新型齿轮泵的发动机轴承结构，采用高强度合金材料，' +
      '适用于工业机械传动系统，具有耐磨和低噪音特性'
  )
  console.log(
    `   主要分类: ${mechanical.classifications[0].section} - ${mechanical.classifications[0].description}`
  )
  console.log(`   是否使用 Fallback: ${mechanical.fallback ? '是' : '否'}\n`)

  // 示例 3: 化学技术发明
  console.log('3️⃣ 化学技术发明:')
  const chemical = await classifyIpc(
    '聚合物催化剂涂料组合物的制备方法，包括纳米填料分散工艺，' + '用于提高涂层的耐候性和附着力'
  )
  console.log(
    `   主要分类: ${chemical.classifications[0].section} - ${chemical.classifications[0].description}`
  )
  console.log(`   是否使用 Fallback: ${chemical.fallback ? '是' : '否'}\n`)

  // 示例 4: 计算机技术发明
  console.log('4️⃣ 计算机技术发明:')
  const computer = await classifyIpc(
    '基于人工智能算法的数据处理系统，包括神经网络模型训练模块，' +
      '用于大规模数据分析和智能决策支持'
  )
  console.log(
    `   主要分类: ${computer.classifications[0].section} - ${computer.classifications[0].description}`
  )
  console.log(`   是否使用 Fallback: ${computer.fallback ? '是' : '否'}\n`)

  // 示例 5: 多领域交叉发明
  console.log('5️⃣ 多领域交叉发明:')
  const multiDomain = await classifyIpc(
    '智能传感器网络通信与机械传动系统的集成控制方法，' + '结合了电子信号处理和机械结构设计'
  )
  console.log(`   分类结果:`)
  multiDomain.classifications.forEach((c, i) => {
    console.log(`   ${i + 1}. ${c.section} - ${c.description}`)
  })
  console.log(`   是否使用 Fallback: ${multiDomain.fallback ? '是' : '否'}\n`)

  console.log('=== 使用建议 ===')
  console.log('• IPC 分类可用于专利申请时的技术领域定位')
  console.log('• 在专利撰写流程中，建议在发明理解阶段进行 IPC 分类')
  console.log('• 分类结果可以帮助确定检索策略和权利要求撰写重点')
  console.log('• 如 Rust CLI 不可用，会自动降级到 TypeScript 实现')
}

main().catch(console.error)
