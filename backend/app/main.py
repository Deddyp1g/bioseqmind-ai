from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse

from app.config import get_settings, refresh_settings
from app.models.analysis import AnalysisResult, ChatRequest, ChatResponse
from app.repository import AnalysisRepository
from app.services.deepseek import answer_question
from app.services.errors import ExternalDependencyError
from app.services.pipeline import run_analysis
from app.services.sequence import SequenceValidationError



@asynccontextmanager
async def lifespan(_: FastAPI):
    refresh_settings()
    _repository().init()
    yield


app = FastAPI(title="BioSeqMind-AI API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _repository() -> AnalysisRepository:
    settings = get_settings()
    return AnalysisRepository(settings.resolved_db_path())


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "BioSeqMind-AI"}


@app.get("/api/dashboard")
def dashboard() -> dict[str, object]:
    repo = _repository()
    repo.init()
    return repo.stats()


@app.get("/api/analyses")
def list_analyses() -> list[dict[str, object]]:
    repo = _repository()
    repo.init()
    return repo.list_recent()


@app.post("/api/analyses", response_model=AnalysisResult)
async def create_analysis(
    sequence_text: str = Form(default=""),
    file: UploadFile | None = File(default=None),
) -> AnalysisResult:
    payload = sequence_text
    if file is not None:
        payload = (await file.read()).decode("utf-8")
    try:
        settings = get_settings()
        repo = _repository()
        repo.init()
        return await run_analysis(payload, settings, repo)
    except SequenceValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ExternalDependencyError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/api/analyses/{analysis_id}", response_model=AnalysisResult)
def get_analysis(analysis_id: str) -> AnalysisResult:
    repo = _repository()
    repo.init()
    analysis = repo.get(analysis_id)
    if analysis is None:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return analysis


@app.post("/api/analyses/{analysis_id}/chat", response_model=ChatResponse)
async def chat(analysis_id: str, request: ChatRequest) -> ChatResponse:
    repo = _repository()
    repo.init()
    analysis = repo.get(analysis_id)
    if analysis is None:
        raise HTTPException(status_code=404, detail="Analysis not found")
    try:
        answer, source, model = await answer_question(analysis, request.message, get_settings())
        return ChatResponse(answer=answer, source=source, model=model)
    except ExternalDependencyError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/api/analyses/{analysis_id}/report.md", response_class=PlainTextResponse)
def report_markdown(analysis_id: str) -> str:
    analysis = get_analysis(analysis_id)
    return analysis.report.markdown
