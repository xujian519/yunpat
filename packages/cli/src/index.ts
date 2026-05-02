#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { createAgentFramework, runAgent, listAgents, draftPatent, searchPatents, generateClaims, analyzePatent, generateSpecification, checkPatent, fullPatentWorkflow } from './commands.js';

const program = new Command();

// CLI 信息
program.name('yunpat').description('YunPat 智能体框架 CLI').version('0.1.0');

// 初始化框架
program
  .command('init')
  .description('初始化智能体框架')
  .option('-m, --model <model>', 'LLM 模型名称', 'gpt-4')
  .option('-k, --api-key <key>', 'API 密钥')
  .action(createAgentFramework);

// 运行智能体
program
  .command('run')
  .description('运行智能体')
  .argument('<agent>', '智能体名称 (writer/researcher)')
  .option('-t, --task <task>', '任务描述')
  .option('-i, --input <file>', '输入文件 (JSON)')
  .option('-o, --output <file>', '输出文件')
  .action(runAgent);

// 列出智能体
program.command('list').description('列出所有可用智能体').action(listAgents);

// 交互式对话
program
  .command('chat')
  .description('启动交互式对话')
  .argument('<agent>', '智能体名称')
  .action(async (agent: string) => {
    console.log(chalk.blue(`启动 ${agent} 智能体...`));
    console.log(chalk.gray('交互式对话功能即将推出'));
  });

// 专利撰写
program
  .command('draft')
  .description('专利撰写（发明理解阶段）')
  .requiredOption('--title <title>', '发明名称')
  .requiredOption('--field <field>', '技术领域')
  .requiredOption('--disclosure <file>', '技术交底书文件路径')
  .option('-o, --output <file>', '输出报告文件路径')
  .action(async (options) => {
    const fs = await import('fs/promises');
    const path = await import('path');

    let disclosure: string;
    try {
      const resolvedPath = path.resolve(options.disclosure);
      disclosure = await fs.readFile(resolvedPath, 'utf-8');
    } catch (err) {
      console.error(
        chalk.red(
          `读取技术交底书失败: ${err instanceof Error ? err.message : String(err)}`
        )
      );
      process.exit(1);
    }

    await draftPatent({
      title: options.title,
      field: options.field,
      disclosure,
      output: options.output,
    });
  });

program
  .command('search')
  .description('专利检索（发明理解 + 检索策略 + 执行）')
  .requiredOption('--title <title>', '发明名称')
  .requiredOption('--field <field>', '技术领域')
  .requiredOption('--disclosure <file>', '技术交底书文件路径')
  .option('-o, --output <file>', '输出检索报告文件路径 (JSON)')
  .action(async (options) => {
    const fs = await import('fs/promises');
    const path = await import('path');

    let disclosure: string;
    try {
      const resolvedPath = path.resolve(options.disclosure);
      disclosure = await fs.readFile(resolvedPath, 'utf-8');
    } catch (err) {
      console.error(
        chalk.red(
          `读取技术交底书失败: ${err instanceof Error ? err.message : String(err)}`
        )
      );
      process.exit(1);
    }

    await searchPatents({
      title: options.title,
      field: options.field,
      disclosure,
      output: options.output,
    });
  });

program
  .command('claims')
  .description('权利要求生成（发明理解 + 权利要求撰写）')
  .requiredOption('--title <title>', '发明名称')
  .requiredOption('--field <field>', '技术领域')
  .requiredOption('--disclosure <file>', '技术交底书文件路径')
  .option('-o, --output <file>', '输出权利要求报告文件路径 (JSON)')
  .action(async (options) => {
    const fs = await import('fs/promises');
    const path = await import('path');

    let disclosure: string;
    try {
      const resolvedPath = path.resolve(options.disclosure);
      disclosure = await fs.readFile(resolvedPath, 'utf-8');
    } catch (err) {
      console.error(
        chalk.red(
          `读取技术交底书失败: ${err instanceof Error ? err.message : String(err)}`
        )
      );
      process.exit(1);
    }

    await generateClaims({
      title: options.title,
      field: options.field,
      disclosure,
      output: options.output,
    });
  });

program
  .command('analyze')
  .description('专利深度分析（发明理解 + 检索 + 对比分析 + 交底书再分析）')
  .requiredOption('--title <title>', '发明名称')
  .requiredOption('--field <field>', '技术领域')
  .requiredOption('--disclosure <file>', '技术交底书文件路径')
  .option('-o, --output <file>', '输出分析报告文件路径 (JSON)')
  .action(async (options) => {
    const fs = await import('fs/promises');
    const path = await import('path');

    let disclosure: string;
    try {
      const resolvedPath = path.resolve(options.disclosure);
      disclosure = await fs.readFile(resolvedPath, 'utf-8');
    } catch (err) {
      console.error(
        chalk.red(
          `读取技术交底书失败: ${err instanceof Error ? err.message : String(err)}`
        )
      );
      process.exit(1);
    }

    await analyzePatent({
      title: options.title,
      field: options.field,
      disclosure,
      output: options.output,
    });
  });

program
  .command('spec')
  .description('说明书撰写（发明理解 + 权利要求 + 说明书）')
  .requiredOption('--title <title>', '发明名称')
  .requiredOption('--field <field>', '技术领域')
  .requiredOption('--disclosure <file>', '技术交底书文件路径')
  .option('-o, --output <file>', '输出说明书报告文件路径 (JSON)')
  .action(async (options) => {
    const fs = await import('fs/promises');
    const path = await import('path');

    let disclosure: string;
    try {
      const resolvedPath = path.resolve(options.disclosure);
      disclosure = await fs.readFile(resolvedPath, 'utf-8');
    } catch (err) {
      console.error(
        chalk.red(
          `读取技术交底书失败: ${err instanceof Error ? err.message : String(err)}`
        )
      );
      process.exit(1);
    }

    await generateSpecification({
      title: options.title,
      field: options.field,
      disclosure,
      output: options.output,
    });
  });

program
  .command('check')
  .description('质量检查（发明理解 + 权利要求 + 说明书 + 质量检查）')
  .requiredOption('--title <title>', '发明名称')
  .requiredOption('--field <field>', '技术领域')
  .requiredOption('--disclosure <file>', '技术交底书文件路径')
  .option('-o, --output <file>', '输出质量检查报告文件路径 (JSON)')
  .action(async (options) => {
    const fs = await import('fs/promises');
    const path = await import('path');

    let disclosure: string;
    try {
      const resolvedPath = path.resolve(options.disclosure);
      disclosure = await fs.readFile(resolvedPath, 'utf-8');
    } catch (err) {
      console.error(
        chalk.red(
          `读取技术交底书失败: ${err instanceof Error ? err.message : String(err)}`
        )
      );
      process.exit(1);
    }

    await checkPatent({
      title: options.title,
      field: options.field,
      disclosure,
      output: options.output,
    });
  });

program
  .command('full')
  .description('完整专利撰写工作流 v1.1（发明理解 + 检索 + 权利要求 + 说明书 + 质量检查）')
  .requiredOption('--title <title>', '发明名称')
  .requiredOption('--field <field>', '技术领域')
  .requiredOption('--disclosure <file>', '技术交底书文件路径')
  .option('-o, --output <file>', '输出完整专利文件路径 (JSON)')
  .action(async (options) => {
    const fs = await import('fs/promises');
    const path = await import('path');

    let disclosure: string;
    try {
      const resolvedPath = path.resolve(options.disclosure);
      disclosure = await fs.readFile(resolvedPath, 'utf-8');
    } catch (err) {
      console.error(
        chalk.red(
          `读取技术交底书失败: ${err instanceof Error ? err.message : String(err)}`
        )
      );
      process.exit(1);
    }

    await fullPatentWorkflow({
      title: options.title,
      field: options.field,
      disclosure,
      output: options.output,
    });
  });

program
  .command('logs')
  .description('查看执行日志')
  .option('-n, --lines <number>', '显示行数', '50')
  .action(() => {
    console.log(chalk.gray('日志功能即将推出'));
  });

program.parse();
