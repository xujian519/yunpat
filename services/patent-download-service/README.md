# YunPat专利下载服务

基于FastAPI的专利PDF下载HTTP服务，封装了GooglePatentsPdfDownloader。

## 安装依赖

```bash
cd services/patent-download-service
pip install -r requirements.txt
```

## 启动服务

```bash
python main.py
```

服务将在 `http://127.0.0.1:8765` 启动。

## API接口

### 1. 下载单个专利

**POST** `/download`

```json
{
  "patent": "US4405829A1",
  "output_path": "./downloads",
  "waiting_time": 6,
  "remove_kind_codes": null
}
```

**响应**:

```json
{
  "success": true,
  "message": "专利 US4405829A1 下载成功",
  "patent": "US4405829A1",
  "output_path": "/path/to/downloads/US4405829A1.pdf"
}
```

### 2. 批量下载专利

**POST** `/download/batch`

```json
{
  "patents": ["US4405829A1", "EP0551921B1"],
  "output_path": "./downloads",
  "waiting_time": 6,
  "remove_kind_codes": null
}
```

**响应**:

```json
{
  "success": true,
  "message": "批量下载完成，共 2 个专利",
  "total": 2,
  "downloaded": 2,
  "failed": 0,
  "output_path": "/path/to/downloads"
}
```

### 3. 健康检查

**GET** `/health`

**响应**:

```json
{
  "status": "healthy",
  "service": "patent-download-service"
}
```

## 技术栈

- FastAPI: 轻量级Web框架
- Selenium: 浏览器自动化
- BeautifulSoup: HTML解析
- GooglePatentsPdfDownloader: 专利下载核心逻辑

## 注意事项

1. 需要安装Chrome或Brave浏览器
2. 首次运行会自动下载ChromeDriver
3. 下载速度取决于网络和waiting_time参数
4. 建议在服务器环境中使用headless模式（已默认启用）
