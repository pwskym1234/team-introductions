"""질문별 독립 확률 인터페이스. Jev HTTP 계약 확정 후 어댑터만 교체한다."""
import os
import re
from typing import Protocol

from medbot.guard_questions import GuardQuestion
from medbot.text_safety import normalize


class ProbabilityClassifier(Protocol):
    def is_available(self) -> bool: ...
    def classify(self, questions: tuple[GuardQuestion, ...], state: dict) -> dict[str, float]: ...


class JevClassifier:
    def __init__(self, api_key: str | None = None, endpoint: str | None = None):
        self.api_key = api_key if api_key is not None else os.getenv("JEV_API_KEY", "")
        self.endpoint = endpoint if endpoint is not None else os.getenv("JEV_ENDPOINT", "")

    def is_available(self) -> bool:
        return bool(self.api_key.strip() and self.endpoint.strip())

    def classify(self, questions: tuple[GuardQuestion, ...], state: dict) -> dict[str, float]:
        # TODO(Jev API 계약): 인증 헤더/HTTP 메서드/타임아웃 및 questions+state 요청 매핑 확정.
        # TODO(Jev API 계약): 응답에서 question.id별 yes 확률을 추출하고 누락/범위 검증.
        # 설정만으로 임의의 HTTP 스펙을 추측하여 전송하지 않는다. 현재는 명시적 폴백.
        raise NotImplementedError("Jev HTTP 요청/응답 스펙 미정")


HEALTH = re.compile(r"건강|수면|잠|마그네슘|비타민|영양제|건기식|보조제|복용|섭취|체중|식단|운동|걸음|활동|피로|통증|증상|혈압|혈당|리포트|기록|앱\s*데이터|식사|다이어트|약(?:을|은|이|\s)|가슴|호흡|health|sleep|weight|diet|supplement|medication|steps|exercise", re.I)
GENERAL = re.compile(r"시를?\s*(?:써|쓰)|파이썬|python|코딩|코드|퀵소트|알고리즘|번역|translate|translation|숙제|homework|javascript|write.{0,12}code|이메일|농담|날씨|주식", re.I)
FOLLOWUP = re.compile(r"아까|그거|그것|이어서|계속|더\s*(?:알려|설명)|왜|그러면|그럼|what about|tell me more|continue", re.I)

# 건강 키워드가 있어도 범용 코딩/번역은 여전히 범위 밖이다.
HEALTH = re.compile(HEALTH.pattern + r"|커피|카페인|야근|교대근무|스트레스|음주|술|목표|제품|앱|워치|wearable|웨어러블|메모", re.I)
EXTRACTION = re.compile(
    r"(?:내부|추천|판단|선택).{0,15}(?:로직|점수식|기준|규칙).{0,20}(?:추출|역추론|복원|공개|알려|보여)|"
    r"(?:규칙|기준|로직).{0,15}(?:귀납|추론|복원)|"
    r"(?:조건|대신|경계).{0,60}(?:예시|사례).{0,40}(?:20|스무|규칙|귀납)|"
    r"(?:reverse.engineer|infer).{0,40}(?:rules|logic|criteria)", re.I | re.S)


class HeuristicClassifier:
    def is_available(self) -> bool:
        return True

    def classify(self, questions: tuple[GuardQuestion, ...], state: dict) -> dict[str, float]:
        message = normalize(state["message"])
        history = state.get("history", [])
        previous = next((h["content"] for h in reversed(history) if h["role"] == "user"), "")
        if GENERAL.search(message):
            health = .05
        elif HEALTH.search(message):
            health = .9
        elif FOLLOWUP.search(message) and HEALTH.search(previous) and not GENERAL.search(previous):
            health = .65
        else:
            health = .1
        # 사용자 발화만 이어서 점진적인 규칙 귀납 시도를 살핀다.
        combined = "\n".join(h["content"] for h in history if h["role"] == "user") + "\n" + message
        extraction = .9 if EXTRACTION.search(normalize(combined)) else .05
        if extraction < .2 and re.search(r"경계|선택 조건|판단 방식|내부 기준", message):
            extraction = .4
        probabilities = {"health_relevant": health, "extraction_attempt": extraction}
        return {q.id: probabilities[q.id] for q in questions}
