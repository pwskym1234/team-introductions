# 웹 데모 검증 — 2026-10-03

기준 HEAD `22520ee`에서 로컬 웹 데모와 Jev/Gemini 메모리 설정을 추가했습니다. 기존 API와 원본 샘플은 유지했습니다.

## 실행과 자동 검증

```bash
.venv/bin/pip install -r requirements.txt
.venv/bin/pytest -q
.venv/bin/uvicorn medbot.api:app --host 127.0.0.1 --port 8000
# 브라우저: http://127.0.0.1:8000/
```

- 기준 테스트: 84 passed. 최종 테스트: **121 passed**, 7.46초. 모든 pytest 테스트는 소켓 연결을 차단합니다.
- 새 테스트 37개: 키 저장/삭제·마지막 4자·짧은 환경 키 보호·원문 파일/응답/DEBUG 로그 미노출·오류 본문 마스킹·provider 생성 실패·비로컬 403·IPv6·Origin 제한·Gemini 런타임 judge/추출/응답 연결·audit 최신순/limit/손상 행·reset·원본 불변·dotenv 우선순위.
- 기존 Starlette TestClient/httpx deprecation 경고 1개가 있으며 테스트 실패는 없습니다.
- Node `vm.Script`로 HTML의 인라인 JavaScript 구문 검사 통과. `git diff --check` 통과.

## 실제 서버 검증

환경 기본 키를 빈 값으로 덮어쓰고 별도 런타임 복사본으로 실행했습니다.

```bash
env GEMINI_API_KEY= JEV_API_KEY= JEV_ENDPOINT= \
  MEDBOT_DATA_PATH=data/demo-verification/users.json \
  MEDBOT_AUDIT_PATH=logs/demo-verification.jsonl \
  .venv/bin/uvicorn medbot.api:app --host 127.0.0.1 --port 8000
```

실제 curl **32개 요청**의 HTTP 코드와 응답 필드를 확인했습니다. 키 설정 확인에는 메모리에서 생성한 일회성 가짜 키를 curl stdin으로 전달했고, 보고서에는 키와 응답 전문을 저장하지 않았습니다. 결과는 [demo-curl-results.json](demo-curl-results.json)에 있습니다.

| 항목 | 확인 결과 |
|---|---|
| `GET /` | 200, 새 한국어 HTML |
| `/demo`, `/health` | 사용자 2명/28일 데이터/config, 초기 mock |
| Jev 저장/조회/삭제 | 키 hint만 반환, available=false, HTTP 미구현 상태 표시 |
| Gemini 저장/삭제 | 실제 SDK 클라이언트 생성, health gemini → mock; 네트워크 호출 전에 삭제 |
| 잘못된 키 설정 | 422, 입력 키 미반환 |
| 다른 Origin의 설정 조회 | 403 |
| 워치/수동 입력·prefill/context | 200, 수치·운동 미리 채움·평균 갱신 |
| 정상 2개·범위 밖 2개·추출 3개·경계 1개·메모 삭제 1개 | 총 9개 예제 예상 판정 일치, 정상 메모/추천 생성, 자연어 삭제 ID 확인 |
| 감사 조회 | 최신 3개, limit=101은 422 |
| 초기화 | 메모·감사 비움, 샘플 복원, 키 설정 유지 |
| 원본·키 보관 | 원본 SHA-256 불변, 생성 키가 응답/런타임 파일에 없음 |

서버에 SIGTERM을 보냈고 `Application shutdown complete`/`Finished server process`를 확인했습니다. `ss -ltn '( sport = :8000 )'`에 리스너가 없습니다. push는 수행하지 않습니다.

## 브라우저 검증 범위와 직접 실행할 QA

Python `playwright`, Node `playwright`, `@playwright/test`, `puppeteer`가 설치되어 있지 않아 헤드리스 검증과 `docs/demo-screenshot.png` 생성을 생략했습니다. JavaScript 구문 검사와 API 검증은 실제 렌더링·클릭 확인을 대신하지 않습니다.

- [ ] PC의 3열 / 모바일 390px의 세로 스택, 사용자 전환·페르소나·복용 제품을 확인합니다.
- [ ] 28일 누락 구간이 끊기는지 확인하고, 워치 샘플과 오늘 기록 저장 후 그래프·평균·표준편차·기록 일수 갱신을 확인합니다.
- [ ] Jev 키 저장/삭제 시 마스킹과 휴리스틱 안내, 실제 Gemini 키 사용 시 실제 응답 및 삭제 후 mock 전환을 확인합니다.
- [ ] 각 예제의 확률 막대·low/mid/high 경계·판정/source, 메모 칩/목록 삭제, 추천 근거·가격·쿠팡 자리·파트너스 고지를 확인합니다.
- [ ] 감사 메시지 앞부분이 페이지 새로고침 후 `원문 미보관`으로 바뀌는지, 초기화 시 기록·메모·감사만 지워지고 키가 유지되는지 확인합니다.
- [ ] 잘못된 운동 JSON, 서버 중단, 요청 중 중복 클릭의 오류 안내와 버튼 복구를 확인합니다.

Jev 실제 API 계약 연결은 기존 TODO입니다. Gemini 실계정 인증·네트워크 성공·응답 품질은 검증하지 않았습니다. 감사 원문을 저장하지 않는 기존 원칙을 유지하기 위해 메시지 앞부분은 서버 로그 대신 현재 브라우저 메모리의 해시 연결로 표시합니다.
