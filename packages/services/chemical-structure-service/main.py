#!/usr/bin/env python3
"""
YunPat化学结构识别服务

使用Imago (EPAM) 提供化学结构识别功能的HTTP API。
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import base64
import io
from typing import Optional
import sys

# 尝试导入imago，如果未安装则提供友好的错误提示
try:
    from imago import Imago
    IMAGO_AVAILABLE = True
except ImportError:
    IMAGO_AVAILABLE = False
    print("警告: imago未安装。")
    print("请运行: pip install imago")
    print("或访问: https://github.com/epam/imago")

app = FastAPI(
    title="YunPat化学结构识别服务",
    description="提供化学结构识别功能的HTTP API",
    version="1.0.0"
)


class RecognitionRequest(BaseModel):
    """化学结构识别请求"""
    image_data: str  # Base64编码的图片数据
    image_format: str = "png"  # 图片格式（png, jpg等）
    output_format: str = "smiles"  # 输出格式（smiles, molfile等）


class RecognitionResponse(BaseModel):
    """化学结构识别响应"""
    success: bool
    message: str
    structure: Optional[str] = None  # 识别的化学结构
    confidence: Optional[float] = None  # 置信度
    format: str = "smiles"


@app.get("/")
async def root():
    """根路径"""
    return {
        "service": "YunPat化学结构识别服务",
        "version": "1.0.0",
        "status": "running",
        "imago_available": IMAGO_AVAILABLE
    }


@app.get("/health")
async def health():
    """健康检查"""
    return {
        "status": "healthy",
        "service": "chemical-structure-recognition",
        "imago_available": IMAGO_AVAILABLE
    }


@app.post("/recognize", response_model=RecognitionResponse)
async def recognize_structure(request: RecognitionRequest):
    """
    识别化学结构

    参数:
    - image_data: Base64编码的图片数据
    - image_format: 图片格式（默认png）
    - output_format: 输出格式（默认smiles）

    返回:
    - success: 是否成功
    - message: 消息
    - structure: 识别的化学结构（SMILES格式）
    - confidence: 置信度
    - format: 输出格式
    """

    if not IMAGO_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="imago未安装。请运行: pip install imago"
        )

    try:
        # 解码Base64图片数据
        image_bytes = base64.b64decode(request.image_data)
        image_file = io.BytesIO(image_bytes)

        # 使用Imago识别化学结构
        imago = Imago()
        result = imago.recognize(image_file, output_format=request.output_format)

        return RecognitionResponse(
            success=True,
            message="化学结构识别成功",
            structure=result.get("structure"),
            confidence=result.get("confidence", 0.0),
            format=request.output_format
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"化学结构识别失败: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn

    # 启动服务
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8766,
        log_level="info"
    )
