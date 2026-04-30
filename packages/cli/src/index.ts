#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { createAgentFramework, runAgent, listAgents } from './commands.js';

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

// 查看日志
program
  .command('logs')
  .description('查看执行日志')
  .option('-n, --lines <number>', '显示行数', '50')
  .action(() => {
    console.log(chalk.gray('日志功能即将推出'));
  });

program.parse();
