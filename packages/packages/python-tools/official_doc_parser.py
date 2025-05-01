#!/usr/bin/env python3
"""
YunPat 官文解析器

基于 Docling + GLM-OCR 的专利官文解析方案
支持：审查意见通知书、驳回决定、缴费通知书等
"""

import sys
import json
import argparse
import base64
import requests
from pathlib import Path
from typing import Dict, Any, Optional

try:
    from docling.document_converter import DocumentConverter
    from docling.datamodel.base_models import InputFormat
except ImportError:
    print("Error: Docling未安装。请运行: pip install docling", file=sys.stderr)
    sys.exit(1)


class OfficialDocParser:
    """官文解析器"""

    def __init__(self, ocr_endpoint: str = "http://localhost:8009"):
        self.ocr_endpoint = ocr_endpoint
        self.ocr_api_key = "xj781102@"
        self.converter = DocumentConverter()

    def parse(self, file_path: str) -> Dict[str, Any]:
        """
        使用 Docling 解析文档

        Args:
            file_path: 文件路径

        Returns:
            解析结果（包含 text, markdown, totalPages）
        """
        try:
            result = self.converter.convert(file_path)
            document = result.document

            # 提取文本
            text = document.export_to_markdown()

            # 提取元数据
            metadata = {
                "totalPages": len(document.pages),
                "version": "docling-python",
            }

            return {
                "text": text,
                "markdown": text,
                **metadata,
            }
        except Exception as e:
            return {"error": f"Docling解析失败: {str(e)}"}

    def extract_fields(
        self,
        file_path: str,
        doc_type: str,
        prompt_template: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        使用 GLM-OCR 提取字段

        Args:
            file_path: 文件路径
            doc_type: 文档类型
            prompt_template: 提示词模板（可选）

        Returns:
            提取的字段（JSON格式）
        """
        try:
            # 1. 先用 Docling 解析文本
            parse_result = self.parse(file_path)
            if "error" in parse_result:
                return parse_result

            # 2. 构建提示词
            if not prompt_template:
                prompt_template = self._get_default_prompt(doc_type)

            # 3. 调用 GLM-OCR 提取字段
            # 注意：这里我们直接使用文本，因为 Docling 已经提取了
            # 如果需要图片处理，可以先将PDF转为图片

            # 方法1：直接使用文本提取（推荐）
            fields = self._extract_from_text(
                parse_result["text"], prompt_template
            )

            return fields

        except Exception as e:
            return {"error": f"字段提取失败: {str(e)}"}

    def _extract_from_text(
        self, text: str, prompt: str
    ) -> Dict[str, Any]:
        """
        从文本中提取字段（使用 GLM-OCR 的文本模式）

        Args:
            text: 文本内容
            prompt: 提示词

        Returns:
            提取的字段
        """
        try:
            payload = {
                "model": "GLM-OCR-4bit",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": f"{prompt}\n\n文档内容：\n{text}"}
                        ],
                    }
                ],
                "response_format": {"type": "json_object"},
            }

            headers = {
                "Authorization": f"Bearer {self.ocr_api_key}",
                "Content-Type": "application/json",
            }

            response = requests.post(
                f"{self.ocr_endpoint}/v1/chat/completions",
                json=payload,
                headers=headers,
                timeout=60,
            )

            if response.status_code == 200:
                result = response.json()
                content = result["choices"][0]["message"]["content"]
                return json.loads(content)
            else:
                return {
                    "error": f"GLM-OCR请求失败: {response.status_code} - {response.text}"
                }

        except Exception as e:
            return {"error": f"GLM-OCR调用失败: {str(e)}"}

    def _extract_from_image(
        self, image_path: str, prompt: str
    ) -> Dict[str, Any]:
        """
        从图片中提取字段（使用 GLM-OCR 的图像模式）

        Args:
            image_path: 图片路径
            prompt: 提示词

        Returns:
            提取的字段
        """
        try:
            # 读取图片并编码为 base64
            with open(image_path, "rb") as f:
                image_base64 = base64.b64encode(f.read()).decode()

            payload = {
                "model": "GLM-OCR-4bit",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"},
                            },
                        ],
                    }
                ],
                "response_format": {"type": "json_object"},
            }

            headers = {
                "Authorization": f"Bearer {self.ocr_api_key}",
                "Content-Type": "application/json",
            }

            response = requests.post(
                f"{self.ocr_endpoint}/v1/chat/completions",
                json=payload,
                headers=headers,
                timeout=60,
            )

            if response.status_code == 200:
                result = response.json()
                content = result["choices"][0]["message"]["content"]
                return json.loads(content)
            else:
                return {
                    "error": f"GLM-OCR请求失败: {response.status_code} - {response.text}"
                }

        except Exception as e:
            return {"error": f"GLM-OCR调用失败: {str(e)}"}

    def _get_default_prompt(self, doc_type: str) -> str:
        """获取默认提示词"""
        prompts = {
            "review_opinion": """请从官文中提取以下信息，以JSON格式返回：
{
  "applicationNumber": "申请号",
  "inventionTitle": "发明名称",
  "reviewSummary": "审查意见摘要（100字以内）",
  "responseDeadline": "答复期限（YYYY-MM-DD格式）",
  "examiner": "审查员",
  "referenceDocuments": ["引用文献1", "引用文献2"]
}""",
            "rejection_decision": """请从驳回决定中提取以下信息，以JSON格式返回：
{
  "applicationNumber": "申请号",
  "inventionTitle": "发明名称",
  "rejectionReason": "驳回理由（200字以内）",
  "legalArticles": ["法条1", "法条2"],
  "decisionDate": "决定日期（YYYY-MM-DD格式）"
}""",
            "payment_notice": """请从缴费通知书中提取以下信息，以JSON格式返回：
{
  "applicationNumber": "申请号",
  "feeType": "费用类型（如：年费、申请费）",
  "feeAmount": "缴费金额（数字）",
  "paymentDeadline": "缴费截止日期（YYYY-MM-DD格式）"
}""",
            "grant_decision": """请从授予决定中提取以下信息，以JSON格式返回：
{
  "applicationNumber": "申请号",
  "inventionTitle": "发明名称",
  "decisionDate": "决定日期（YYYY-MM-DD格式）",
  "grantNumber": "授权专利号"
}""",
            "reexamination_decision": """请从复审无效决定中提取以下信息，以JSON格式返回：
{
  "applicationNumber": "申请号或专利号",
  "inventionTitle": "发明名称",
  "decisionType": "决定类型（复审/无效）",
  "decisionResult": "决定结果（维持/撤销/宣告无效）",
  "legalArticles": ["法条1", "法条2"],
  "decisionDate": "决定日期（YYYY-MM-DD格式）"
}""",
        }
        return prompts.get(doc_type, prompts["review_opinion"])


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description="YunPat 官文解析器")
    parser.add_argument(
        "action",
        choices=["parse", "extract"],
        help="操作类型：parse（解析文档）或 extract（提取字段）",
    )
    parser.add_argument("file_path", help="文件路径")
    parser.add_argument(
        "--doc-type",
        default="review_opinion",
        help="文档类型（用于extract）",
    )
    parser.add_argument(
        "--ocr-endpoint",
        default="http://localhost:8009",
        help="GLM-OCR服务端点",
    )

    args = parser.parse_args()

    # 检查文件是否存在
    if not Path(args.file_path).exists():
        print(json.dumps({"error": f"文件不存在: {args.file_path}"}))
        sys.exit(1)

    # 创建解析器
    doc_parser = OfficialDocParser(ocr_endpoint=args.ocr_endpoint)

    try:
        if args.action == "parse":
            # 解析文档
            result = doc_parser.parse(args.file_path)
            print(json.dumps(result, ensure_ascii=False, indent=2))

        elif args.action == "extract":
            # 提取字段
            result = doc_parser.extract_fields(
                args.file_path, args.doc_type
            )
            print(json.dumps(result, ensure_ascii=False, indent=2))

    except Exception as e:
        print(json.dumps({"error": f"处理失败: {str(e)}"}))
        sys.exit(1)


if __name__ == "__main__":
    main()
