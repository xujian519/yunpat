#!/usr/bin/env python3
"""
YunPat数学公式识别服务

使用Pix2Text 提供数学公式识别功能的HTTP API。
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import base64
import io
from typing import Optional

# 尝试导入pix2tex，如果未安装则提供友好的错误提示
try:
    from pix2tex.cli import LatexOCR
    PIX2TEX_AVAILABLE = True
except ImportError:
    PIX2TEX_AVAILABLE = False
    print("警告: pix2tex未安装。")
    print("请运行: pip install pix2tex")
    print("或访问: https://github.com/breezedeus/Pix2Text")

app = FastAPI(
    title="YunPat数学公式识别服务",
    description="提供数学公式识别功能的HTTP API",
    version="1.0.0"
)


class RecognitionRequest(BaseModel):
    """数学公式识别请求"""
    image_data: str  # Base64编码的图片数据
    image_format: str = "png"  # 图片格式（png, jpg等）


class RecognitionResponse(BaseModel):
    """数学公式识别响应"""
    success: bool
    message: str
    latex: Optional[str] = None  # 识别的LaTeX公式
    confidence: Optional[float] = None  # 置信度


@app.get("/")
async def root():
    """根路径"""
    return {
        "service": "YunPat数学公式识别服务",
        "version": "1.0.0",
        "status": "running",
        "pix2tex_available": PIX2TEX_AVAILABLE
    }


@app.get("/health")
async def health():
    """健康检查"""
    return {
        "status": "healthy",
        "service": "math-formula-recognition",
        "pix2tex_available": PIX2TEX_AVAILABLE
    }


@app.post("/recognize", response_model=RecognitionResponse)
async def recognize_formula(request: RecognitionRequest):
    """
    识别数学公式

    参数:
    - image_data: Base64编码的图片数据
    - image_format: 图片格式（默认png）

    返回:
    - success: 是否成功
    - message: 消息
    - latex: 识别的LaTeX公式
    - confidence: 置信度
    """

    if not PIX2TEX_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="pix2tex未安装。请运行: pip install pix2tex"
        )

    try:
        # 解码Base64图片数据
        image_bytes = base64.b64decode(request.image_data)

        # 保存到临时文件
        import tempfile
        import os

        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{request.image_format}") as tmp_file:
            tmp_file.write(image_bytes)
            tmp_file_path = tmp_file.name

        try:
            # 使用Pix2Text识别数学公式
            model = LatexOCR()
            latex_code = model(tmp_file_path)

            return RecognitionResponse(
                success=True,
                message="数学公式识别成功",
                latex=latex_code,
                confidence=0.9  # Pix2Text不提供置信度，使用默认值
            )

        finally:
            # 删除临时文件
            if os.path.exists(tmp_file_path):
                os.unlink(tmp_file_path)

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"数学公式识别失败: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn

    # 启动服务
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8767,
        log_level="info"
    )
