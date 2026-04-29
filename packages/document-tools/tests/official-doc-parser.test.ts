/**
 * 官文解析工具测试
 */

import { OfficialDocParserTool, OfficialDocType } from '../src/tools/OfficialDocParser.js';

async function testOfficialDocParser() {
  console.log('🧪 测试官文解析工具...\n');

  const parser = new OfficialDocParserTool();

  // 测试 1：解析审查意见通知书
  console.log('📋 测试 1：解析审查意见通知书');
  try {
    const result = await parser.execute(
      {
        filePath: '/path/to/review_opinion.pdf', // 替换为实际路径
        docType: OfficialDocType.REVIEW_OPINION,
        useOcr: true,
        ocrEndpoint: 'http://localhost:8009',
      },
      {} // ToolContext
    );

    console.log('✅ 解析成功！');
    console.log('申请号:', result.fields.applicationNumber);
    console.log('发明名称:', result.fields.inventionTitle);
    console.log('审查意见:', result.fields.reviewSummary);
    console.log('答复期限:', result.fields.responseDeadline);
    console.log('引用文献:', result.fields.referenceDocuments);
    console.log('解析时间:', result.metadata.parseTime, 'ms');
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }

  // 测试 2：解析驳回决定
  console.log('\n📋 测试 2：解析驳回决定');
  try {
    const result = await parser.execute(
      {
        filePath: '/path/to/rejection_decision.pdf', // 替换为实际路径
        docType: OfficialDocType.REJECTION_DECISION,
        useOcr: true,
      },
      {}
    );

    console.log('✅ 解析成功！');
    console.log('申请号:', result.fields.applicationNumber);
    console.log('驳回理由:', result.fields.rejectionReason);
    console.log('法律条款:', result.fields.legalArticles);
    console.log('决定日期:', result.fields.decisionDate);
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }

  // 测试 3：解析缴费通知书
  console.log('\n📋 测试 3：解析缴费通知书');
  try {
    const result = await parser.execute(
      {
        filePath: '/path/to/payment_notice.pdf', // 替换为实际路径
        docType: OfficialDocType.PAYMENT_NOTICE,
        useOcr: true,
      },
      {}
    );

    console.log('✅ 解析成功！');
    console.log('申请号:', result.fields.applicationNumber);
    console.log('费用类型:', result.fields.feeType);
    console.log('缴费金额:', result.fields.feeAmount);
    console.log('截止日期:', result.fields.paymentDeadline);
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }

  console.log('\n✨ 所有测试完成！');
}

// 运行测试
testOfficialDocParser().catch(console.error);
