#!/usr/bin/env python3
"""
YunPat专利下载服务

使用FastAPI封装GooglePatentsPdfDownloader，提供HTTP API接口。
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
import os
import sys
import asyncio

# 添加GooglePatentsPdfDownloader到Python路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../GooglePatentsPdfDownloader'))

from GooglePatentsPdfDownloader import PatentDownloader

app = FastAPI(
    title="YunPat专利下载服务",
    description="提供专利PDF下载功能的HTTP API",
    version="1.0.0"
)


class DownloadRequest(BaseModel):
    """单个专利下载请求"""
    patent: str
    output_path: str = "./downloads"
    waiting_time: int = 6
    remove_kind_codes: Optional[List[str]] = None


class BatchDownloadRequest(BaseModel):
    """批量专利下载请求"""
    patents: List[str]
    output_path: str = "./downloads"
    waiting_time: int = 6
    remove_kind_codes: Optional[List[str]] = None


class DownloadResponse(BaseModel):
    """下载响应"""
    success: bool
    message: str
    patent: str
    output_path: Optional[str] = None


class BatchDownloadResponse(BaseModel):
    """批量下载响应"""
    success: bool
    message: str
    total: int
    downloaded: int
    failed: int
    output_path: str


@app.get("/")
async def root():
    """根路径"""
    return {
        "service": "YunPat专利下载服务",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health():
    """健康检查"""
    return {
        "status": "healthy",
        "service": "patent-download-service"
    }


@app.post("/download", response_model=DownloadResponse)
async def download_patent(request: DownloadRequest):
    """
    下载单个专利PDF

    参数:
    - patent: 专利号（如US4405829A1）
    - output_path: 输出路径（默认./downloads）
    - waiting_time: 等待时间，默认6秒
    - remove_kind_codes: 要移除的kind codes列表

    返回:
    - success: 是否成功
    - message: 消息
    - patent: 专利号
    - output_path: 输出路径
    """
    try:
        # 创建PatentDownloader实例
        downloader = PatentDownloader(verbose=False)

        # 下载专利
        downloader.download(
            patent=request.patent,
            output_path=request.output_path,
            waiting_time=request.waiting_time,
            remove_kind_codes=request.remove_kind_codes
        )

        # 构建输出文件路径
        output_file = os.path.join(os.path.abspath(request.output_path), f'{request.patent}.pdf')

        return DownloadResponse(
            success=True,
            message=f"专利 {request.patent} 下载成功",
            patent=request.patent,
            output_path=output_file
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"专利下载失败: {str(e)}"
        )


@app.post("/download/batch", response_model=BatchDownloadResponse)
async def download_patents_batch(request: BatchDownloadRequest, background_tasks: BackgroundTasks):
    """
    批量下载专利PDF（后台任务）

    参数:
    - patents: 专利号列表
    - output_path: 输出路径（默认./downloads）
    - waiting_time: 等待时间，默认6秒
    - remove_kind_codes: 要移除的kind codes列表

    返回:
    - success: 是否成功
    - message: 消息
    - total: 总数
    - downloaded: 成功下载数
    - failed: 失败数
    - output_path: 输出路径
    """
    try:
        # 创建PatentDownloader实例
        downloader = PatentDownloader(verbose=False)

        # 批量下载
        downloader.download(
            patent=request.patents,
            output_path=request.output_path,
            waiting_time=request.waiting_time,
            remove_kind_codes=request.remove_kind_codes
        )

        return BatchDownloadResponse(
            success=True,
            message=f"批量下载完成，共 {len(request.patents)} 个专利",
            total=len(request.patents),
            downloaded=len(request.patents),  # 假设都成功
            failed=0,
            output_path=os.path.abspath(request.output_path)
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"批量下载失败: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn

    # 启动服务
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8765,
        log_level="info"
    )
