from datetime import date as Date
from pathlib import Path
from ipaddress import ip_address
from threading import RLock
from typing import Literal
from urllib.parse import urlsplit

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator

from medbot.llm import client_from_env
from medbot.models import ChatResult, DailyInput, HistoryMessage, WearableBatch
from medbot.pipeline import ChatService
from medbot.settings import JevKeyInput, KeyInput, RuntimeSettings


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    user_id: str = Field(min_length=1, max_length=100)
    message: str = Field(min_length=1, max_length=4000)
    history: list[HistoryMessage] = Field(default_factory=list, max_length=40)

    @field_validator("message")
    @classmethod
    def non_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("빈 메시지는 보낼 수 없습니다.")
        return value


def create_app(service: ChatService | None = None) -> FastAPI:
    if service is None:
        load_dotenv(Path.cwd() / ".env", override=False)
    service = service if service is not None else ChatService(client=client_from_env())
    settings = RuntimeSettings(service)
    mutation_lock = RLock()  # 키 교체/초기화와 진행 중인 대화를 한 프로세스 안에서 직렬화.
    app = FastAPI(title="Medbot prototype")
    app.state.chat_service = service

    @app.middleware("http")
    async def local_demo_only(request: Request, call_next):
        # 로컬 데모 전용. 프록시 뒤에 배포하지 말고 127.0.0.1에 바인딩한다.
        local_route = request.url.path.startswith(("/settings/", "/audit", "/demo"))
        if local_route:
            try:
                local = bool(request.client) and ip_address(request.client.host).is_loopback
                origin = request.headers.get("origin")
                if origin:
                    local = local and urlsplit(origin).netloc == request.url.netloc
            except ValueError:
                local = False
            if not local:
                return JSONResponse({"detail": "로컬 데모에서만 사용할 수 있습니다."}, status_code=403)
        response = await call_next(request)
        if local_route:
            response.headers["Cache-Control"] = "no-store"
        return response

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, error):
        if request.url.path.startswith("/settings/"):
            # FastAPI 기본 422의 input/ctx에는 키 원문이 들어갈 수 있다.
            return JSONResponse({"detail": "키 또는 엔드포인트 형식을 확인하세요."}, status_code=422)
        return await request_validation_exception_handler(request, error)

    @app.get("/settings/{provider}")
    def get_settings(provider: Literal["jev", "gemini"]):
        with mutation_lock:
            return settings.status(provider)

    def save_settings(provider, payload):
        with mutation_lock:
            try:
                return settings.update(provider, payload.api_key, getattr(payload, "endpoint", None))
            except ValueError:
                raise HTTPException(422, "키 또는 엔드포인트 형식을 확인하세요.") from None
            except Exception:
                raise HTTPException(503, "공급자 설정을 적용하지 못했습니다.") from None

    @app.post("/settings/jev")
    def set_jev(payload: JevKeyInput):
        return save_settings("jev", payload)

    @app.post("/settings/gemini")
    def set_gemini(payload: KeyInput):
        return save_settings("gemini", payload)

    @app.delete("/settings/{provider}")
    def clear_settings(provider: Literal["jev", "gemini"]):
        with mutation_lock:
            return settings.clear(provider)

    @app.get("/audit")
    def audit(limit: int = Query(default=20, ge=1, le=100)):
        return service.recent_audit(limit)

    @app.get("/demo")
    def demo_data():
        with mutation_lock:
            users = [service.repository.get_user(uid) for uid in service.repository.user_ids()]
            return {"users": [{"profile": user["profile"], "products": user.get("products", []),
                               "daily_logs": user.get("daily_logs", [])} for user in users],
                    "guard_config": service.guard.config.model_dump()}

    @app.post("/demo/reset")
    def reset_demo():
        with mutation_lock:
            try:
                service.reset_demo()
            except ValueError:
                raise HTTPException(409, "이 저장소는 데모 초기화를 지원하지 않습니다.") from None
        return {"reset": True}

    @app.get("/")
    def index():
        return FileResponse(Path(__file__).parent / "static/index.html")

    @app.get("/health")
    def health():
        return {"status": "ok", "mode": "gemini" if service.guard.client else "mock"}

    @app.get("/users/{user_id}/context")
    def context(user_id: str):
        try:
            return service.get_context(user_id)
        except KeyError:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.") from None

    @app.post("/users/{user_id}/wearable")
    def wearable(user_id: str, batch: WearableBatch):
        try:
            with mutation_lock:
                return {"records": service.ingest_wearable(user_id, batch)}
        except KeyError:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.") from None

    @app.post("/users/{user_id}/daily")
    def daily(user_id: str, entry: DailyInput):
        try:
            with mutation_lock:
                return service.ingest_daily(user_id, entry)
        except KeyError:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.") from None

    @app.get("/users/{user_id}/daily/prefill")
    def prefill(user_id: str, date: Date):
        try:
            return service.prefill(user_id, date)
        except KeyError:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.") from None

    @app.get("/users/{user_id}/memories")
    def memories(user_id: str):
        try:
            return service.repository.list_memories(user_id)
        except KeyError:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.") from None

    @app.delete("/users/{user_id}/memories/{memory_id}")
    def delete_memory(user_id: str, memory_id: str):
        try:
            with mutation_lock:
                deleted = service.repository.delete_memory(user_id, memory_id)
        except KeyError:
            deleted = False
        if not deleted:
            raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다.")
        return {"deleted_memory_id": memory_id}

    @app.post("/chat", response_model=ChatResult)
    def chat(request: ChatRequest):
        try:
            with mutation_lock:
                return service.handle(request.user_id, request.message, request.history)
        except KeyError:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.") from None

    return app


app = create_app()
