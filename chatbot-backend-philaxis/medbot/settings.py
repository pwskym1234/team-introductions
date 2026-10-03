"""로컬 단일 프로세스 데모 전용. 웹 키는 메모리에만 보관한다."""
import os
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator

from medbot.classifiers import JevClassifier
from medbot.llm import GeminiClient


class KeyInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    api_key: SecretStr = Field(min_length=5, max_length=4096)

    @field_validator("api_key")
    @classmethod
    def clean_key(cls, value):
        key = value.get_secret_value().strip()
        if len(key) < 5 or any(c.isspace() for c in key):
            raise ValueError("키 형식 오류")
        return SecretStr(key)


class JevKeyInput(KeyInput):
    endpoint: str | None = Field(default=None, max_length=2048)


def clean_endpoint(value: str) -> str:
    value = value.strip()
    if value:
        parsed = urlsplit(value)
        # 키는 별도 필드로만 받는다. 인증정보/쿼리/fragment를 응답에 반사하지 않는다.
        if (parsed.scheme not in ("http", "https") or not parsed.hostname
                or parsed.username or parsed.password or parsed.query or parsed.fragment
                or any(c.isspace() for c in value)):
            raise ValueError("엔드포인트 형식 오류")
    return value


class RuntimeSettings:
    def __init__(self, service):
        self.service = service
        self.keys = {name: SecretStr(os.getenv(name.upper() + "_API_KEY", "").strip())
                     for name in ("jev", "gemini")}
        try:
            self.endpoint = clean_endpoint(os.getenv("JEV_ENDPOINT", ""))
            if any(key.get_secret_value() and key.get_secret_value() in self.endpoint
                   for key in self.keys.values()):
                self.endpoint = ""
        except ValueError:
            self.endpoint = ""

    def status(self, provider):
        key = self.keys[provider].get_secret_value()
        configured = bool(key)
        if provider == "jev":
            available = False  # HTTP 요청/응답 매핑 TODO: 키 존재와 실제 가용성을 구분한다.
            note = ("키 등록됨 · API 계약 미확정 → 휴리스틱 사용 중" if configured
                    else "키 미등록 · 휴리스틱 사용 중")
        else:
            available = configured and self.service.guard.client is not None
            note = ("키 등록됨 · 실제 Gemini 호출 사용 (연결 미검증, 실패 시 mock 폴백)" if available
                    else "키 미등록 · mock 응답 사용 중")
        # 환경에서 온 너무 짧은 값도 원문 전체를 hint로 되돌려주지 않는다.
        hint = ("…" + key[-4:] if len(key) > 4 else "…") if key else ""
        return {"configured": configured, "key_hint": hint,
                "endpoint": self.endpoint if provider == "jev" else None,
                "available": available, "status_note": note}

    def update(self, provider, key: SecretStr, endpoint: str | None = None):
        raw = key.get_secret_value()
        if provider == "jev":
            target = clean_endpoint(endpoint) if endpoint is not None else self.endpoint
            if any(secret and secret in target for secret in
                   (raw, self.keys["gemini"].get_secret_value())):
                raise ValueError("엔드포인트에 키를 넣을 수 없습니다.")
            self.service.guard.classifier = JevClassifier(api_key=raw, endpoint=target)
            self.endpoint = target
        else:
            if raw and raw in self.endpoint:
                raise ValueError("엔드포인트에 키를 넣을 수 없습니다.")
            client = GeminiClient(raw, os.getenv("GEMINI_MODEL", "gemini-2.5-flash")) if raw else None
            old = self.service.guard.client
            self.service.guard.client = self.service.responder.client = self.service.extractor.client = client
            if hasattr(old, "close"):
                try:
                    old.close()
                except Exception:
                    pass  # 공급자 오류 문자열에 키가 들어갈 수 있으므로 출력하지 않는다.
        self.keys[provider] = key
        return self.status(provider)

    def clear(self, provider):
        return self.update(provider, SecretStr(""), "" if provider == "jev" else None)
