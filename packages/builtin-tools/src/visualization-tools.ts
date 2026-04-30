/**
 * 可视化工具集
 *
 * 生成专利相关的图表和可视化内容
 */

import * as fs from 'fs';
import { z } from 'zod';
import { EnhancedBaseTool, ToolCategory, ToolContext } from '@yunpat/core';

/**
 * Mermaid 图表生成工具
 */
export class MermaidChartTool extends EnhancedBaseTool<any, any> {
  readonly metadata = {
    name: 'mermaid_chart',
    description: '生成 Mermaid 图表（流程图、时序图、类图等）',
    category: 'utility' as any,
    isConcurrencySafe: true,
    inputSchema: z.object({
      chartType: z
        .enum(['flowchart', 'sequence', 'class', 'state', 'gantt', 'pie', 'mindmap'])
        .describe('图表类型'),
      data: z.any().describe('图表数据'),
      title: z.string().optional().describe('图表标题'),
      orientation: z.enum(['TD', 'BT', 'LR', 'RL']).optional().describe('方向'),
      outputFormat: z.enum(['svg', 'png', 'markdown']).optional().describe('输出格式'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      chart: z.string().describe('生成的图表代码'),
      format: z.string(),
    }),
    permissions: [],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  async execute(
    input: {
      chartType: 'flowchart' | 'sequence' | 'class' | 'state' | 'gantt' | 'pie' | 'mindmap';
      data: any;
      title?: string;
      orientation?: 'TD' | 'BT' | 'LR' | 'RL';
      outputFormat?: 'svg' | 'png' | 'markdown';
    },
    _context: ToolContext
  ): Promise<{ success: boolean; chart: string; format: string }> {
    const mermaidCode = this.generateMermaidCode(
      input.chartType,
      input.data,
      input.title,
      input.orientation || 'TD'
    );

    return {
      success: true,
      chart: mermaidCode,
      format: input.outputFormat || 'markdown',
    };
  }

  /**
   * 生成 Mermaid 代码
   */
  private generateMermaidCode(
    chartType: string,
    data: any,
    title?: string,
    orientation: string = 'TD'
  ): string {
    let code = '';

    switch (chartType) {
      case 'flowchart':
        code = this.generateFlowchart(data, title, orientation);
        break;
      case 'sequence':
        code = this.generateSequence(data, title);
        break;
      case 'class':
        code = this.generateClass(data, title);
        break;
      case 'mindmap':
        code = this.generateMindmap(data, title);
        break;
      default:
        code = `${chartType} not implemented yet`;
    }

    return `\`\`\`mermaid\n${code}\n\`\`\``;
  }

  /**
   * 生成流程图
   */
  private generateFlowchart(data: any, title?: string, orientation: string = 'TD'): string {
    let code = `flowchart ${orientation}\n`;

    if (title) {
      code += `    title[${title}]\n`;
    }

    // 生成节点
    if (data.nodes) {
      for (const node of data.nodes) {
        const shape = node.shape || 'rect';
        const id = node.id;
        const label = node.label;

        switch (shape) {
          case 'rect':
            code += `    ${id}[${label}]\n`;
            break;
          case 'rhombus':
            code += `    ${id}{${label}}\n`;
            break;
          case 'stadium':
            code += `    ${id}([${label}])\n`;
            break;
          case 'cylinder':
            code += `    ${id}[(${label})]\n`;
            break;
          case 'circle':
            code += `    ${id}(((${label})))\n`;
            break;
          default:
            code += `    ${id}[${label}]\n`;
        }
      }
    }

    // 生成连线
    if (data.edges) {
      for (const edge of data.edges) {
        const from = edge.from;
        const to = edge.to;
        const label = edge.label || '';
        code += `    ${from} -->${label ? '|' + label + '|' : ''} ${to}\n`;
      }
    }

    return code;
  }

  /**
   * 生成时序图
   */
  private generateSequence(data: any, title?: string): string {
    let code = 'sequenceDiagram\n';

    if (title) {
      code += `    title ${title}\n`;
    }

    // 生成参与者
    if (data.participants) {
      for (const participant of data.participants) {
        code += `    actor ${participant.id} as ${participant.name}\n`;
      }
    }

    // 生成消息
    if (data.messages) {
      for (const msg of data.messages) {
        const from = msg.from;
        const to = msg.to;
        const text = msg.text;
        const type = msg.type || 'sync'; // sync, async, reply, self

        switch (type) {
          case 'async':
            code += `    ${from} ->> ${to}: ${text}\n`;
            break;
          case 'reply':
            code += `    ${to} -->> ${from}: ${text}\n`;
            break;
          case 'self':
            code += `    ${from} ->> ${from}: ${text}\n`;
            break;
          default:
            code += `    ${from} ->> ${to}: ${text}\n`;
        }
      }
    }

    return code;
  }

  /**
   * 生成类图
   */
  private generateClass(data: any, title?: string): string {
    let code = 'classDiagram\n';

    if (title) {
      code += `    title ${title}\n`;
    }

    // 生成类
    if (data.classes) {
      for (const cls of data.classes) {
        code += `    class ${cls.name} {\n`;
        if (cls.properties) {
          for (const prop of cls.properties) {
            code += `        ${prop.visibility || 'public'} ${prop.name}${prop.type ? ': ' + prop.type : ''}\n`;
          }
        }
        if (cls.methods) {
          for (const method of cls.methods) {
            code += `        ${method.visibility || 'public'} ${method.name}()\n`;
          }
        }
        code += '    }\n';
      }
    }

    // 生成关系
    if (data.relationships) {
      for (const rel of data.relationships) {
        const from = rel.from;
        const to = rel.to;
        const type = rel.type || '--';
        const label = rel.label || '';
        code += `    ${from} ${type} ${to}${label ? ': ' + label : ''}\n`;
      }
    }

    return code;
  }

  /**
   * 生成思维导图
   */
  private generateMindmap(data: any, title?: string): string {
    let code = 'mindmap\n';

    if (title) {
      code += `  root((${title}))\n`;
    }

    // 生成节点
    if (data.branches) {
      for (const branch of data.branches) {
        code += `    ${branch.name}\n`;
        if (branch.children) {
          for (const child of branch.children) {
            code += `      ${child}\n`;
          }
        }
      }
    }

    return code;
  }
}

/**
 * 专利权利要求结构图生成工具
 */
export class PatentClaimsStructureTool extends EnhancedBaseTool<
  {
    claims: Array<{
      number: number;
      content: string;
      type: 'independent' | 'dependent';
      dependsOn?: number;
    }>;
    title?: string;
  },
  {
    success: boolean;
    chart: string;
  }
> {
  readonly metadata = {
    name: 'patent_claims_structure',
    description: '生成专利权利要求结构图',
    category: 'utility' as any,
    isConcurrencySafe: true,
    inputSchema: z.object({
      claims: z
        .array(
          z.object({
            number: z.number(),
            content: z.string(),
            type: z.enum(['independent', 'dependent']),
            dependsOn: z.number().optional(),
          })
        )
        .describe('权利要求数组'),
      title: z.string().optional().describe('图表标题'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      chart: z.string(),
    }),
    permissions: [],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  async execute(
    input: {
      claims: Array<{
        number: number;
        content: string;
        type: 'independent' | 'dependent';
        dependsOn?: number;
      }>;
      title?: string;
    },
    _context: ToolContext
  ): Promise<{ success: boolean; chart: string }> {
    // 构建思维导图数据
    const branches = input.claims
      .filter((c) => c.type === 'independent')
      .map((claim) => ({
        name: `权利要求${claim.number}`,
        children: this.getDependentClaims(claim.number, input.claims),
      }));

    const mermaidTool = new MermaidChartTool();
    const result = await mermaidTool.execute(
      {
        chartType: 'mindmap',
        data: { branches },
        title: input.title || '权利要求结构',
        outputFormat: 'markdown',
      },
      {} as any
    );

    return {
      success: true,
      chart: result.chart,
    };
  }

  /**
   * 获取从属权利要求
   */
  private getDependentClaims(
    parentNumber: number,
    allClaims: Array<{
      number: number;
      content: string;
      type: 'independent' | 'dependent';
      dependsOn?: number;
    }>
  ): string[] {
    const directChildren = allClaims.filter((c) => c.dependsOn === parentNumber);

    const result: string[] = [];

    for (const child of directChildren) {
      const label = `权利要求${child.number}`;
      result.push(label);

      // 递归获取子权利要求
      const grandChildren = this.getDependentClaims(child.number, allClaims);
      if (grandChildren.length > 0) {
        result.push(...grandChildren);
      }
    }

    return result;
  }
}

/**
 * 专利流程图生成工具
 */
export class PatentProcessChartTool extends EnhancedBaseTool<
  {
    steps: Array<{
      id: string;
      label: string;
      type: 'start' | 'process' | 'decision' | 'end';
    }>;
    flows: Array<{
      from: string;
      to: string;
      label?: string;
    }>;
    title?: string;
  },
  {
    success: boolean;
    chart: string;
  }
> {
  readonly metadata = {
    name: 'patent_process_chart',
    description: '生成专利申请/审查流程图',
    category: 'utility' as any,
    isConcurrencySafe: true,
    inputSchema: z.object({
      steps: z
        .array(
          z.object({
            id: z.string(),
            label: z.string(),
            type: z.enum(['start', 'process', 'decision', 'end']),
          })
        )
        .describe('流程步骤'),
      flows: z
        .array(
          z.object({
            from: z.string(),
            to: z.string(),
            label: z.string().optional(),
          })
        )
        .describe('流程连线'),
      title: z.string().optional().describe('图表标题'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      chart: z.string(),
    }),
    permissions: [],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  async execute(
    input: {
      steps: Array<{
        id: string;
        label: string;
        type: 'start' | 'process' | 'decision' | 'end';
      }>;
      flows: Array<{
        from: string;
        to: string;
        label?: string;
      }>;
      title?: string;
    },
    _context: ToolContext
  ): Promise<{ success: boolean; chart: string }> {
    // 转换为流程图数据格式
    const nodes = input.steps.map((step) => {
      let shape = 'rect';
      if (step.type === 'start' || step.type === 'end') {
        shape = 'stadium';
      } else if (step.type === 'decision') {
        shape = 'rhombus';
      }

      return {
        id: step.id,
        label: step.label,
        shape,
      };
    });

    const edges = input.flows.map((flow) => ({
      from: flow.from,
      to: flow.to,
      label: flow.label || '',
    }));

    const mermaidTool = new MermaidChartTool();
    const result = await mermaidTool.execute(
      {
        chartType: 'flowchart',
        data: { nodes, edges },
        title: input.title || '专利流程',
        outputFormat: 'markdown',
      },
      {} as any
    );

    return {
      success: true,
      chart: result.chart,
    };
  }
}
