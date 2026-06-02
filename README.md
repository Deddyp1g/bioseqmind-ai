# BioSeqMind-AI 核酸序列智能识别分析系统

BioSeqMind-AI 是一个完整可运行的科研 AI Dashboard 原型：用户上传 DNA/RNA FASTA 后，后端执行序列质控、geNomad 识别、NCBI BLAST/E-utilities 查询、融合评分，并调用 DeepSeek 生成 Markdown 报告和追问回答。

## 技术栈

- 前端：Next.js + TypeScript + Tailwind CSS + shadcn/ui + ECharts
- 后端：Python FastAPI
- 存储：SQLite
- 生物信息：geNomad、NCBI BLAST URL API、NCBI E-utilities
- 大模型：DeepSeek OpenAI-compatible API

## Linux 启动

```bash
git clone https://github.com/Deddyp1g/bioseqmind-ai.git
cd /root/bioseqmind-ai
chmod +x scripts/start-linux.sh
./scripts/start-linux.sh
```

访问：

- 前端：http://localhost:5174
- 后端：http://127.0.0.1:8008/api/health

本项目固定使用前端 `5174`、后端 `8008`，不会占用 `5173`。前端默认使用 `auto` API 模式：浏览器端统一访问同源 `/api`，由 Next Route Handler 转发到 FastAPI，避免宿主机、WSL2、虚拟机和内置浏览器的 `localhost` 指向不一致。

宿主机访问 Linux 虚拟机时，请使用 Linux 的局域网 IP：

```bash
hostname -I
```

然后在宿主机浏览器打开：

```text
http://<linux-ip>:5174/
```

## 真实外部服务配置

复制并编辑：

```bash
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
```

关键配置：

- `BIOSEQMIND_GENOMAD_DB_PATH`：geNomad 数据库目录，例如 `/data/genomad_db`
- `BIOSEQMIND_GENOMAD_MODE`：默认 `fast_nn`，可切换为保留的完整 `end_to_end`
- `BIOSEQMIND_NCBI_MODE`：必须为 `live`
- `DEEPSEEK_API_KEY`：DeepSeek API key
- `NEXT_PUBLIC_API_BASE_URL`：前端请求后端的地址；本地推荐 `auto`
- `BIOSEQMIND_BACKEND_INTERNAL_URL`：Next 服务端同源 `/api` 转发用的后端地址，默认 `http://127.0.0.1:8008/api`

系统只输出真实依赖返回的数据：geNomad、NCBI BLAST/E-utilities 或 DeepSeek 任一环节不可用时，请求会失败并返回错误原因，不会生成替代结果。

## 验证命令

```bash
cd backend
. .venv/bin/activate
pytest -q

cd ../frontend
npm run lint
npm run build
```

## Windows

Windows/GPU 迁移说明见 [docs/windows-gpu-migration.md](docs/windows-gpu-migration.md)。

运行模式、宿主机接手、快速模式和旧版完整 geNomad 模式说明见 [docs/deployment-modes.md](docs/deployment-modes.md)。

详细系统设计、技术架构、分析工作流、安全边界、测试验证和后续路线见 [docs/design-and-technical-report.md](docs/design-and-technical-report.md)。

## 开源内容说明

仓库不会包含本地密钥、SQLite 结果库、geNomad 数据库、虚拟环境、Node 依赖、Next 构建产物和 MMseqs2 二进制。首次接手请按文档复制示例环境文件并重新下载数据库。
