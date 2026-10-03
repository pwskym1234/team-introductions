"""테스트는 이 Protocol을 fake로 교체하며 SDK 네트워크 호출을 하지 않는다."""
import os
from typing import Protocol

from pydantic import BaseModel


class LLMClient(Protocol):
    def generate(self, *, system: str, prompt: str,
                 schema: type[BaseModel] | None = None) -> str: ...


class GeminiClient:
    def __init__(self, api_key: str, model: str):
        from google import genai
        from google.genai import types
        self.client = genai.Client(api_key=api_key, http_options=types.HttpOptions(timeout=20000))
        self.model = model

    def close(self):
        self.client.close()

    def generate(self, *, system: str, prompt: str,
                 schema: type[BaseModel] | None = None) -> str:
        from google.genai import types
        config = types.GenerateContentConfig(
            system_instruction=system, temperature=0,
            response_mime_type="application/json" if schema else "text/plain",
            response_schema=schema,
        )
        response = self.client.models.generate_content(model=self.model, contents=prompt, config=config)
        if not response.text:
            raise ValueError("Empty model response")
        return response.text


def client_from_env() -> LLMClient | None:
    key = os.getenv("GEMINI_API_KEY", "").strip()
    return GeminiClient(key, os.getenv("GEMINI_MODEL", "gemini-2.5-flash")) if key else None
