# BioSeqMind-AI 设计与技术报告

## 1. 项目概述

BioSeqMind-AI 是一个面向核酸序列识别、证据融合和科研解释的 Web 分析系统。系统支持用户粘贴 DNA/RNA 序列或上传 FASTA 文件，后端完成输入质量检查、geNomad 模型识别、NCBI BLAST/E-utilities 真实数据库查询、综合可信度评分，并调用 DeepSeek 生成中文科研报告和后续问答。

项目的设计目标不是生成演示数据，而是在依赖不可用时明确失败，在依赖可用时输出可追溯的真实分析结果。系统当前定位为科研辅助与课程展示级原型，适合用于快速识别输入序列的潜在来源、查看 BLAST 命中、评估 geNomad 病毒/质粒信号，并由大模型把结构化证据整理成易读报告。

## 2. 需求与设计原则

### 2.1 功能需求

- 支持文本粘贴和 FASTA 文件上传。
- 支持 DNA、RNA 和混合碱基序列的基础统计。
- 支持快速 geNomad 模式和完整 geNomad end-to-end 模式。
- 支持 DeepSeek 前置格式分析开关，由用户决定是否启用。
- 支持 NCBI BLAST 查询与 Top hit 展示。
- 支持 DeepSeek 报告生成和分析结果上下文问答。
- 支持任务历史、Dashboard 指标、可视化图表和 Markdown 报告导出。
- 支持 Windows 本机、内网穿透和生产模式前端运行。

### 2.2 非功能需求

- 真实依赖优先：geNomad、NCBI 或 DeepSeek 不可用时不伪造结果。
- 可解释：每次分析保留 pipeline timeline、证据来源和 warning。
- 可接手：启动脚本、环境变量示例、部署说明和技术报告应能帮助新开发者快速运行。
- 可控成本：默认快速模式，DeepSeek 前置预检默认关闭，全量模式由用户主动选择。
- 安全：API key、SQLite 数据、依赖目录、构建产物和大型数据库不提交到仓库。

## 3. 总体架构

系统采用前后端分离但同源代理的结构：

```text
Browser / SakuraFrp public domain
        |
        v
Next.js frontend :5174
        |
        | same-origin /api proxy
        v
FastAPI backend :8008
        |
        +-- SQLite result repository
        +-- geNomad command line workflow
        +-- NCBI BLAST URL API / E-utilities
        +-- DeepSeek OpenAI-compatible API
```

前端固定监听 `5174`，后端固定监听 `8008`。浏览器端不直接访问后端地址，而是访问 Next.js 的同源 `/api` 路由；Next.js route handler 再转发到 `BIOSEQMIND_BACKEND_INTERNAL_URL`，默认是 `http://127.0.0.1:8008/api`。这样可以避免 Windows、WSL2、虚拟机、内网穿透和浏览器环境中 `localhost` 指向不一致的问题。

## 4. 前端设计

### 4.1 技术栈

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- shadcn/ui 风格组件
- lucide-react 图标
- ECharts 可视化

### 4.2 页面结构

前端核心组件位于 `frontend/src/components/bioseq/workbench.tsx`，使用单页工作台组织各个视图：

- 首页 Dashboard：展示累计任务、平均可信度、当前序列长度、BLAST 命中数。
- 序列上传：粘贴序列、上传 FASTA、选择 geNomad 模式、切换 DeepSeek 前置格式分析。
- 分析进度：展示序列检查、geNomad、NCBI、融合、DeepSeek、报告生成等阶段。
- 结果总览：展示序列统计、候选来源、可信度、风险级别和证据摘要。
- 可视化分析：展示碱基组成、BLAST ranking、可信度仪表盘。
- AI 报告问答：渲染 DeepSeek 报告并支持基于当前分析结果追问。

### 4.3 交互设计

上传页提供三个关键交互控制：

- `快速模式`：默认选中，调用 geNomad `nn-classification + summary`，适合快速分析。
- `全量模式`：开放选择，调用 geNomad `end-to-end`，需要配置完整 geNomad 数据库。
- `DeepSeek 前置格式分析`：默认关闭，开启后提交前先由 DeepSeek 判断输入是否可修复或应拒绝。

系统顶部按钮在上传页会直接触发分析，在其他页面则切换到上传页。上传页卡片头部和底部也提供启动分析按钮，避免用户滚动后找不到入口。

### 4.4 Markdown 渲染

DeepSeek 报告和 AI 问答原始输出通常是 Markdown。为了避免前端直接显示 Markdown 源码，工作台实现了轻量 Markdown renderer，支持：

- 一级、二级、三级标题
- 无序列表
- 引用块
- 行内加粗
- 行内代码
- 简单 Markdown 表格

这使报告在 Web 页面中更接近科研摘要和结果卡片，而不是纯文本源码。

## 5. 后端设计

### 5.1 技术栈

- Python 3.11
- FastAPI
- Uvicorn
- Pydantic / pydantic-settings
- SQLite
- httpx
- python-multipart

### 5.2 API 设计

主要接口：

- `GET /api/health`：健康检查。
- `GET /api/dashboard`：统计总任务数、平均可信度和最近任务。
- `GET /api/analyses`：列出最近分析。
- `POST /api/analyses`：提交序列或 FASTA 文件进行分析。
- `GET /api/analyses/{analysis_id}`：读取指定分析结果。
- `POST /api/analyses/{analysis_id}/chat`：基于分析结果问答。
- `GET /api/analyses/{analysis_id}/report.md`：导出 Markdown 报告。

`POST /api/analyses` 支持表单字段：

- `sequence_text`：文本输入。
- `file`：FASTA 文件。
- `analysis_mode`：`fast_nn` 或 `end_to_end`。
- `deepseek_precheck`：`true` 或 `false`。

### 5.3 配置管理

后端配置集中在 `backend/app/config.py`，通过 `.env` 和环境变量加载。关键配置包括：

- `BIOSEQMIND_DB_PATH`
- `BIOSEQMIND_CORS_ORIGINS`
- `BIOSEQMIND_GENOMAD_COMMAND`
- `BIOSEQMIND_GENOMAD_DB_PATH`
- `BIOSEQMIND_GENOMAD_MODE`
- `BIOSEQMIND_GENOMAD_THREADS`
- `BIOSEQMIND_NCBI_MODE`
- `BIOSEQMIND_NCBI_EMAIL`
- `DEEPSEEK_API_KEY`
- `BIOSEQMIND_DEEPSEEK_MODEL`

DeepSeek key 同时支持未加前缀的 `DEEPSEEK_API_KEY` 和加前缀的 `BIOSEQMIND_DEEPSEEK_API_KEY`。

## 6. 分析工作流

核心 pipeline 位于 `backend/app/services/pipeline.py`。

### 6.1 标准流程

```text
输入 payload
  |
  | optional
  v
DeepSeek 输入预检
  |
  v
FASTA / plain sequence 解析
  |
  v
相同序列缓存查询
  |
  +-- hit --> 复用历史真实结果
  |
  +-- miss
        |
        +-- geNomad 识别
        +-- NCBI BLAST / E-utilities 查询
        |
        v
结果融合
        |
        v
DeepSeek 报告生成
        |
        v
SQLite 保存并返回
```

### 6.2 DeepSeek 前置格式分析

前置分析由 `backend/app/services/deepseek.py` 中的 `normalize_sequence_input()` 实现。它只做输入预检，不做生物学结论。

启用条件：

- 前端开关打开。
- `deepseek_precheck=true` 被提交到后端。
- 后端配置了 DeepSeek API key。

模型输出被要求为 JSON：

```json
{
  "accept": true,
  "corrected_fasta": ">sequence_name\nATGC...",
  "reason": "一句中文说明"
}
```

后端不会完全信任模型输出。DeepSeek 返回后，系统会再次调用严格的 `parse_sequence()` 检查，只允许 `A/T/G/C/U/N` 等核酸字符。若模型拒绝、未返回 FASTA、返回 JSON 无效或规范化后仍非法，后端会返回 `422`，不会进入耗时分析。

### 6.3 序列解析

序列解析位于 `backend/app/services/sequence.py`。解析逻辑支持：

- 标准 FASTA。
- 原始 DNA/RNA 文本。
- 字面量 `\n`、`\r\n` 转换为真实换行。
- 空格和 tab 清理。
- DNA/RNA/Mixed 类型判断。
- GC 含量、碱基计数、碱基比例和质量分计算。

如果输入为空或包含非法字符，会抛出 `SequenceValidationError`。

### 6.4 geNomad 模式

geNomad 调用位于 `backend/app/services/genomad.py`。

快速模式：

```text
genomad nn-classification --cleanup --restart --threads <n> [--single-window] query.fna output
genomad summary query.fna output
```

特点：

- 默认模式。
- 不依赖完整 geNomad 数据库路径。
- 适合快速得到病毒/质粒倾向。

全量模式：

```text
genomad end-to-end --cleanup --splits <n> query.fna output genomad_db
```

特点：

- 需要 `BIOSEQMIND_GENOMAD_DB_PATH` 指向真实数据库。
- 运行更慢，但结果更完整。
- 若数据库未配置，会返回真实依赖错误。

### 6.5 NCBI 查询

NCBI 服务位于 `backend/app/services/ncbi.py`。系统设计为 live mode：

- 不使用 mock BLAST hit。
- 网络或 NCBI 不可用时返回错误或 warning。
- BLAST hit 会用于后续融合评分和报告生成。

### 6.6 结果融合

融合逻辑位于 `backend/app/services/fusion.py`。融合输入包括：

- 序列质量和长度。
- geNomad label、confidence、virus_score、plasmid_score。
- BLAST Top hits。

融合输出包括：

- `candidate_source`
- `confidence_score`
- `risk_level`
- `requires_validation`
- `reasoning`

该层是把模型证据和数据库证据转成前端可读结论的核心。

## 7. 数据模型与存储

主要数据模型定义于 `backend/app/models/analysis.py`：

- `SequenceStats`
- `GenomadPrediction`
- `BlastHit`
- `FusionResult`
- `ReportResult`
- `PipelineStep`
- `AnalysisResult`
- `ChatRequest`
- `ChatResponse`

SQLite repository 位于 `backend/app/repository.py`。数据库表 `analyses` 保存：

- id
- created_at
- status
- sequence_name
- sequence_type
- confidence_score
- candidate_source
- payload

完整分析结果以 Pydantic JSON 存储在 `payload` 字段中。这种设计简化了原型阶段的数据演进，避免每次新增字段都迁移复杂表结构。

系统还实现了相同序列缓存：若一个已完成任务的标准化序列与当前输入完全一致，则直接复用历史真实结果，并生成新的 analysis id。这可以显著降低重复测试时的等待时间。

## 8. 部署与运行

### 8.1 Windows 本机运行

Windows 启动脚本：

```powershell
.\scripts\start-windows.ps1
```

脚本会：

- 创建 `logs` 和 `.tmp`。
- 创建或复用 `backend/.venv`。
- 安装后端依赖。
- 安装前端依赖。
- 启动 FastAPI `8008`。
- 构建并以生产模式启动 Next.js `5174`。

生产模式前端比开发模式更适合 SakuraFrp 或其他内网穿透场景，因为它避免了 dev HMR WebSocket 在公网代理下导致页面交互异常。

### 8.2 前端生产命令

```powershell
npm run build --prefix frontend
npm run start --prefix frontend
```

前端监听：

```text
http://127.0.0.1:5174/
```

### 8.3 后端启动命令

```powershell
cd backend
.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8008
```

健康检查：

```text
http://127.0.0.1:8008/api/health
```

### 8.4 内网穿透

项目当前支持通过 SakuraFrp 将前端 `5174` 暴露到公网域名。公网用户访问前端后，前端仍通过同源 `/api` 代理访问后端，因此公网只需要访问前端域名，不需要单独暴露后端端口。

## 9. 安全与合规边界

### 9.1 密钥管理

以下内容不得提交到 GitHub：

- `backend/.env`
- `frontend/.env.local`
- DeepSeek API key
- GitHub token
- SakuraFrp 账号凭证
- SQLite 运行数据

`.gitignore` 已排除本地 secrets、runtime data、logs、node_modules、虚拟环境、Next 构建产物和大型工具目录。

### 9.2 真实结果边界

系统不会在依赖不可用时伪造结果。错误包括：

- geNomad 命令不可用。
- geNomad 数据库未配置。
- NCBI 网络或 live 查询失败。
- DeepSeek key 缺失或 API 调用失败。
- 输入不是有效核酸序列。

这些错误在科研系统中是保护机制，而不是演示缺陷。

### 9.3 科研解释边界

DeepSeek 报告只基于系统已有结构化证据生成解释。报告中应保留来源、可信度和局限性，不应把模型解释当作最终实验结论。正式科研用途仍需要实验验证、数据库复核和人工审阅。

## 10. 测试与验证

### 10.1 后端测试

后端测试位于 `backend/tests`，覆盖：

- 配置读取。
- FASTA 和 plain sequence 解析。
- 字面量换行解析。
- 融合评分。
- FastAPI 分析接口。
- Chat 问答接口。
- 真实依赖模式下的失败保护。

运行：

```powershell
cd backend
..\\backend\\.venv\\Scripts\\python.exe -m pytest -q
```

当前验证结果：

```text
15 passed
```

### 10.2 前端构建验证

运行：

```powershell
pnpm --dir frontend build
```

当前验证结果：

```text
Compiled successfully
```

### 10.3 服务验证

运行后应检查：

```powershell
curl http://127.0.0.1:8008/api/health
curl -I http://127.0.0.1:5174/
```

预期：

- 后端返回 `{"status":"ok","service":"BioSeqMind-AI"}`。
- 前端返回 HTTP 200。

## 11. 已实现的关键优化

- 前端改为生产模式运行，提升内网穿透下的稳定性。
- 移除右侧端口说明栏，减少干扰。
- 快速模式默认启用，全量模式开放但由用户主动选择。
- DeepSeek 前置格式分析改为前端可控开关，避免默认增加耗时。
- DeepSeek 报告和 AI 问答使用美化 Markdown 渲染。
- 序列解析支持字面量 `\n`，修复复制文本导致后端误判为空的问题。
- geNomad 和 NCBI 阶段并行运行，降低总等待时间。
- 相同序列命中缓存时复用历史真实分析结果。
- API 错误信息改为更完整地展示后端 detail。

## 12. 当前限制

- 全量 geNomad 模式需要本机配置完整 `genomad_db`。
- NCBI live 查询耗时受网络和 NCBI 队列影响。
- DeepSeek 前置格式分析依赖 API key 和远程服务可用性。
- SQLite 适合原型和单机部署，高并发生产环境建议迁移到 PostgreSQL。
- 当前 Markdown renderer 是轻量实现，不等价于完整 Markdown 解析器。
- 本地 GPU 不会加速 NCBI 和 DeepSeek 远程 API；geNomad 是否使用 GPU 取决于其安装方式和底层依赖。

## 13. 后续路线

建议后续迭代：

- 增加任务队列和异步进度轮询，避免长请求阻塞浏览器。
- 引入 Celery/RQ 或 FastAPI background task 管理耗时流程。
- 将 SQLite 迁移为 PostgreSQL，增加索引和审计字段。
- 为 geNomad 数据库配置增加 UI 状态检查。
- 为 NCBI 查询增加更细粒度的错误分类和重试策略。
- 引入成熟 Markdown 渲染库并做 XSS 安全过滤。
- 增加 Playwright 端到端测试，覆盖上传、模式切换、前置预检和报告问答。
- 增加导出 PDF/HTML 报告能力。
- 增加项目级 Docker Compose，统一前后端和环境变量。

## 14. 结论

BioSeqMind-AI 已形成一个可运行、可解释、可接手的核酸序列智能分析系统。它把传统生物信息学工具、远程数据库和大模型解释能力组合到同一个 Web 工作台中，同时保持真实依赖边界：有证据才输出，依赖失败就明确报错。当前版本适合本地 Windows 运行、内网穿透展示和继续扩展为更完整的科研分析平台。
