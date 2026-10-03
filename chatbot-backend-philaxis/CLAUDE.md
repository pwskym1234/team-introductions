# 프로젝트 목적

웨어러블·수동 건강 기록을 7일 대 7일로 비교하고, 사용자가 남긴 생활 맥락을 함께 설명하는 재사용 Python 백엔드다.
대화 메모를 자동 저장·즉시 알림·삭제하며, 관련 대화에 한해 가상 건강기능식품 후보를 보여준다.
큰 앱에 통합하기 전 단계의 해커톤 프로토타입이며 키 없이 실행된다.

## 아키텍처 흐름

```text
/chat (기존 user_id, message, history 유지)
 → 정규식 프리필터
 → Jev 2확률 (미설정/미구현/오류 시 휴리스틱)
 → 설정 가능한 밴드 → mid 질문만 Gemini yes/no judge (없으면 휴리스틱)
 → malicious/off_topic 고정 응답
 → in_scope: 자연어 메모 삭제 또는 사실 추출·검증·자동 저장
 → JSON 복사본 조회 → 코드 통계 + 최근 활성 메모 + 코드 추천 공개 이유
 → 응답 LLM / 키 없는 데모 응답 → 출력 가드 → ChatResult

웨어러블/수동 입력 → UserRepository 날짜별 업서트 → 다음 context에서 다시 계산
메모 삭제 → 소유자 저장소에서 하드 삭제 → 대화/주간 리포트/추천에서 제외
```

## 모듈 맵

| 파일 | 역할 |
|---|---|
| `medbot/config.py` | 이력 길이·확률 밴드 설정 |
| `medbot/settings.py` | 메모리 전용 Jev/Gemini 키·정직한 가용성 상태 |
| `medbot/guard_questions.py` | 공개 앱 범위·분류 질문·경계 사례 |
| `medbot/classifiers.py` | ProbabilityClassifier, Jev 스텁, 휴리스틱 |
| `medbot/guard.py`, `text_safety.py` | state, 프리필터, 밴드, 좁은 judge, 데이터 구분자 |
| `medbot/models.py` | 요청·판정·입력·메모·추천·응답 모델 |
| `medbot/context.py` | UserRepository 계약, JSON 복사본 저장, prefill, 7 vs 7 통계 |
| `medbot/memories.py` | 구조화/휴리스틱 사실 추출·검증, 자연어 삭제 후보 |
| `medbot/supplements.py` | SupplementRepository, CSV 로더, 후보 점수·제외·공개 이유 |
| `medbot/data/` | 불변 사용자 샘플, 15개 가상 제품 CSV |
| `medbot/pipeline.py` | ChatService 통합, 원문 없는 감사 로그, 리포트용 메모 함수 |
| `medbot/llm.py`, `responder.py`, `output_guard.py` | Gemini 어댑터, 안전 설명, 누출 검사 |
| `medbot/api.py`, `static/index.html` | FastAPI, 로컬 설정·감사·초기화 API, 3열 반응형 웹 데모 |
| `tests/`, `docs/verification.md` | 네트워크 없는 검증, 실제 curl 결과와 수동 QA |

## 하위 구현 목록

- [x] 웹 데모/키 입력 창구
- [x] 가드(Jev 2확률 인터페이스 + 설정 밴드 + 좁은 LLM judge)
- [x] 생체 데이터 입력(날짜별 배치 업서트·검증·source)
- [x] 수동 입력(+예측값 미리 채움)
- [x] 대화 메모(날짜 기록/즉시 알림/본인 하드 삭제/자연어 삭제)
- [x] 건기식 추천(CSV·코드 점수·복용/주의 제외·공개 이유·고지)
- [ ] Jev 실제 API 연결(TODO: HTTP 계약 확정 후 어댑터 구현)
- [ ] 삼성헬스 export 파서(TODO: 현재는 sample 형식 입력)
- [ ] threshold 튜닝용 라벨링(TODO: 감사 확률/밴드/판정 데이터 이용)

## 원칙

- 숫자는 코드, 설명은 LLM.
- 가드는 추가 방어막이다. 비밀(내부 로직·추천 점수식·키·타 사용자 데이터)은 LLM 컨텍스트에 넣지 않는다.
- 추천 이유는 코드가 조립한 사용자용 설명만 답변 LLM에 전달한다.
- 진단·처방·효능 단정 금지. 상품·가격·리뷰는 가상 샘플이고 구매 링크는 비어 있다.
- 원본 `medbot/data/users.json` 수정 금지. 런타임 `data/users.json` 복사본 또는 설정한 경로에 저장한다.
- 감사에는 해시·확률·밴드·최종 판정만 저장한다. 삭제된 메모 원문을 보관하거나 재사용하지 않는다.
- 클라이언트 history는 가드의 주제 판정 전용이며 답변의 개인 사실 근거는 현재 저장소만 사용한다.
- 테스트는 외부 네트워크 차단. `.venv/bin/pytest -q`와 수동 UI QA를 확인한다.

## 로컬 웹 데모 실행

```bash
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn medbot.api:app --host 127.0.0.1 --port 8000
```

`http://127.0.0.1:8000/` → 상단 설정 → Jev/Gemini password 입력 → 저장/지우기.
또는 `JEV_API_KEY`, `JEV_ENDPOINT`, `GEMINI_API_KEY` 환경변수나 작업 디렉터리 `.env`를 사용한다(환경변수 우선).
웹 키는 서버 메모리만 사용하고 응답에는 마지막 4자만 포함한다. 지우기는 재시작 전까지 환경 기본값도 비활성화한다.
Jev는 키 등록과 무관하게 실제 API 미구현 상태를 표시하고 휴리스틱을 사용한다. Gemini는 기존 SDK로 judge·추출·응답에 연결하며 연결 성공 여부는 미검증으로 표시한다.
`/settings/*`, `/audit`, `/demo`, `/demo/reset`은 client IP loopback 제한의 로컬 데모 전용이며 공개 프록시/다중 worker 배포에 사용하지 않는다.
감사 메시지 앞부분은 현재 브라우저 메모리에서 해시를 연결해 표시하며 파일에는 보관하지 않는다.
초기화는 JSON 런타임 복사본·메모·감사만 되돌리고 키 설정은 유지한다. 실제 UI 수동 QA는 README 체크리스트를 실행한다.
