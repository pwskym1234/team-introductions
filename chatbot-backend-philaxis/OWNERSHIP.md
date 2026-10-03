# philaxis 담당 모듈: 건강 챗봇 백엔드 일부

담당자: **philaxis (김주혁)** · 위치: **`chatbot-backend-philaxis/`**

조장 **pwskym1234**가 여러 팀원 결과물을 조립할 때 사용할 독립 Python 모듈입니다. 이 폴더는 전체 서비스가 아니라 챗봇 백엔드 일부와 이를 확인하는 로컬 웹 데모입니다. 원본 작업의 `f913adc` 기준 추적 파일을 가져왔으며 내부 계획 문서, 키, 런타임 데이터는 포함하지 않았습니다.

## 담당 범위

| 기능 | 포함 내용 |
|---|---|
| 입력 가드 | 건강 관련성·내부 로직 추출 시도를 각각 판정하는 Jev 2확률 인터페이스, low/mid/high 밴드, mid 질문에 대한 Gemini judge, 휴리스틱 폴백 |
| 생체·수동 데이터 입력 | 날짜별 수면·걸음·운동 입력, 체중·섭취·체감·메모 입력, 미리 채움, 7일 대 7일 통계 |
| 대화 메모 | 날짜 기록, 저장 직후 알림, 목록 조회, 본인 메모 삭제 및 자연어 삭제, 삭제 후 대화·추천·리포트용 조회에서 제외 |
| 건기식 추천 | 가정한 CSV 스키마로 가상 상품 후보 선택, 복용·주의사항 필터, 공개 추천 근거와 고지 |
| 로컬 웹 데모 | 사용자 선택, 그래프·입력·채팅·메모·추천 카드, 판정 확인, 메모리 전용 키 설정 패널 |

## 범위 밖: 다른 팀원 담당 또는 미정

- 리텐션·게이미피케이션.
- 실제 건기식 DB: **다른 팀원 담당**이며, 이 모듈의 CSV 컬럼은 통합 전 **가정**입니다.
- 프런트 앱: 이 폴더의 HTML은 백엔드 동작 확인용 로컬 데모입니다.
- 리포트 화면 및 리포트 생성기: 날짜 구간 메모 조회 함수만 제공합니다.

## 가짜 데이터와 미완성 항목

- **Jev 실제 HTTP 연결 TODO**: 인증·요청·응답 계약이 미정이며 키를 넣어도 현재는 휴리스틱 폴백입니다.
- **삼성헬스 export 파서 TODO**: 현재는 `samsung_health_sample` 형식으로 입력합니다.
- **샘플 사용자·건강 기록·상품·가격·리뷰는 전부 가상**입니다. `medbot/data/`는 실행에 필요한 불변 샘플이며 런타임 저장소와 구분합니다.
- **쿠팡 링크는 자리만** 있습니다. 샘플 CSV의 구매 URL은 비어 있으며 실제 판매·제휴 연결은 별도 작업입니다.
- 실제 Jev/Gemini 응답 품질과 확률 임계값 튜닝은 별도 검증 대상입니다. 자동 테스트는 외부 호출을 막고 fake 클라이언트를 사용합니다.

## 통합 지점

| 지점 | 조립 시 연결할 내용 |
|---|---|
| [`ChatService`](medbot/pipeline.py) | `handle(user_id, message, history)`가 중심 진입점이며 저장소·분류기·LLM 클라이언트를 생성자에 주입 |
| [`UserRepository`](medbot/context.py) | `get_user`, `user_ids`, `upsert_wearable`, `upsert_daily`, `list_memories`, `save_memories`, `delete_memory`, `get_memories_for_report` 계약에 맞춰 팀 DB 구현으로 교체 |
| [`SupplementRepository`](medbot/supplements.py) | `list_products() -> list[Supplement]`를 실제 팀 건기식 DB에 연결 |
| [`ProbabilityClassifier`](medbot/classifiers.py) | 실제 Jev HTTP 계약을 확정한 뒤 어댑터 구현 |
| [`create_app(service)`](medbot/api.py) | 교체한 `ChatService`를 FastAPI 앱에 주입 |

건기식 CSV의 가정한 컬럼과 형식은 [README의 건기식 CSV와 추천](README.md#건기식-csv와-추천), 예시는 [`medbot/data/supplements.csv`](medbot/data/supplements.csv)에 있습니다. 다른 팀원의 실제 DB 스키마와 매핑을 먼저 합의해야 합니다. 상품별 기능성 문구·함량·주의사항도 실제 DB 연결 전에 검증해야 합니다.

### API 목록 요약

| 메서드·경로 | 용도 |
|---|---|
| `POST /chat` | `user_id`, `message`, `history?` 입력; 답변·가드 판정·저장 메모·삭제 ID·추천 반환 |
| `GET /users/{user_id}/context` | 날짜별 통계와 현재 활성 메모 |
| `POST /users/{user_id}/wearable` | 날짜별 웨어러블 배치 업서트 |
| `POST /users/{user_id}/daily` | 날짜별 수동 기록 저장 |
| `GET /users/{user_id}/daily/prefill?date=YYYY-MM-DD` | 수동 입력 미리 채움; 자동 저장하지 않음 |
| `GET /users/{user_id}/memories` | 활성 메모 목록 |
| `DELETE /users/{user_id}/memories/{memory_id}` | 본인 메모 삭제 |
| `GET /health` | 상태 및 Gemini 설정 유무에 따른 모드 |
| `GET /`, `GET /docs` | 웹 데모 및 OpenAPI 요청·응답 명세 |
| `GET /demo`, `POST /demo/reset`, `GET /audit?limit=20` | 로컬 데모 샘플 조회·런타임 초기화·감사 조회 |
| `GET /settings/{provider}`, `DELETE /settings/{provider}` | `jev` 또는 `gemini`의 설정 상태 조회·키 삭제 |
| `POST /settings/jev`, `POST /settings/gemini` | 서버 메모리에 키 저장 |

통합 시 `user_id`를 팀 앱의 인증 세션에 연결하세요. 현재 JSON 저장소는 단일 프로세스 프로토타입용이며, 다중 worker/서버에는 DB 구현이 필요합니다. `/settings/*`, `/demo*`, `/audit`는 loopback 전용이고 공개 배포용 인증·설정 API가 아닙니다. 메모 삭제 후 대화·리포트·추천에서도 삭제 내용이 제외되는 계약을 유지해야 합니다.

## 실행과 키 설정

Python **3.12 이상**에서 저장소 루트 기준으로 실행합니다.

```bash
cd chatbot-backend-philaxis
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/pytest -q
.venv/bin/uvicorn medbot.api:app --host 127.0.0.1 --port 8000
```

브라우저에서 `http://127.0.0.1:8000/`를 엽니다. 실행 작업 디렉터리는 이 모듈 폴더입니다. 런타임 기록은 기본 `data/users.json`, 감사는 `logs/guard_audit.jsonl`에 생성되며 Git에서 제외됩니다. 경로는 `MEDBOT_DATA_PATH`, `MEDBOT_AUDIT_PATH`로 바꿀 수 있습니다.

`JEV_API_KEY`와 `GEMINI_API_KEY`는 [`.env.example`](.env.example)을 참고하여 로컬 `.env`에 넣거나 데모 **설정** 패널에서 입력합니다. **실제 키·토큰과 `.env`는 커밋 금지**입니다. 웹 패널의 키는 서버 메모리에만 유지됩니다. 키 없이도 휴리스틱·템플릿 데모가 동작합니다. Gemini 키를 설정하면 대화와 현재 사용자 건강 기록·메모가 Gemini로 전송되므로 가상 샘플로 확인하세요.

## 조장·리뷰어 수동 QA 체크리스트

- [ ] 이 폴더의 담당 범위와 다른 팀원의 실제 DB·프런트·리포트 담당 범위를 맞춘다.
- [ ] 위 명령으로 새 가상환경을 만들고 `pytest`를 실행한다.
- [ ] `/`에서 사용자 전환, PC/좁은 화면 배치, 날짜별 수동·워치 입력과 통계 갱신을 확인한다.
- [ ] 건강 질문·범위 밖 질문·내부 지침 추출 요청의 판정과 메모·추천 유무를 확인한다.
- [ ] 생활 맥락을 입력해 날짜 메모 알림을 확인하고, 칩/자연어로 삭제한 뒤 목록·후속 답변·추천에서 제외되는지 확인한다.
- [ ] 추천의 가상 상품 표시·공개 근거·파트너스 고지·비어 있는 구매 링크를 확인한다.
- [ ] 설정 패널에서 키 저장·삭제, Jev 미구현 안내, Gemini 실호출 여부를 별도로 확인한다.

더 자세한 동작과 수동 QA는 [README](README.md)에 있습니다. `docs/verification.md`와 `docs/demo-verification.md`는 원본 작업의 검증 기록이며, 이 PR에서 새로 실행한 테스트 결과는 PR 본문에 별도로 기록합니다.
