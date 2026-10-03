import socket

import pytest


@pytest.fixture(autouse=True)
def no_network(monkeypatch, tmp_path):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("JEV_API_KEY", raising=False)
    monkeypatch.delenv("JEV_ENDPOINT", raising=False)
    monkeypatch.setenv("MEDBOT_DATA_PATH", str(tmp_path / "users.json"))
    def forbidden(*args, **kwargs):
        raise AssertionError("테스트에서는 실제 네트워크 연결을 금지합니다.")
    monkeypatch.setattr(socket.socket, "connect", forbidden)
