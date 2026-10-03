# 검증 결과 — 2026-10-03 확장

## 자동 검증

- 기준 커밋 `5519af8`의 기존 테스트: **36 passed** 확인 후 구현.
- 최종 `.venv/bin/pytest -q`: **84 passed**, 외부 소켓 연결 차단, fake 분류기·LLM 사용.
- 경고 1개: 기존 Starlette TestClient의 httpx 사용 중단 예고. 테스트 실패 없음.
- UI JavaScript를 추출해 `node --check --input-type=commonjs`로 구문 검사 성공.
- 격리 wheel 빌드(`pip wheel . --no-deps --no-cache-dir --wheel-dir logs/wheels`) 성공; wheel 내 사용자 JSON·제품 CSV·정적 HTML 포함 확인. 최초 `--no-build-isolation` 시도는 가상환경의 setuptools 미설치로 실패하여 pyproject의 기본 격리 빌드로 재검증했습니다.
- Python `compileall` 성공; 실제 브라우저 클릭/레이아웃 검증은 아래 수동 QA 대상.

| 영역 | 확인한 동작 |
|---|---|
| 가드 | 두 질문의 low/mid/high 및 경계값, 질문 하나만 judge, 두 mid 순차 판정, 설정 밴드 변경 |
| 폴백·프리필터 | Jev 미설정/HTTP 스텁/잘못된 확률, LLM 오류 폴백, 공격 시 분류기·LLM 호출 없음 |
| 분류 자료 | 질문별 긍정/부정 5개 이상, canary·답변 지침 미포함, 4턴 state, 점진적 규칙 귀납 차단 |
| 입력 | 수면/걸음/체중/체감/운동 범위, 날짜 병합, null, prefill, context 변경, 원본 불변과 파일 재조회 |
| 메모 | 구조화/휴리스틱 추출, 날짜·4종 category, 중복 방지, 즉시 saved_memories, 잘못된 발췌·타 사용자·지침 누출 거부 |
| 삭제 | 타 사용자 경로 404, 하드 삭제, 자연어 주제 삭제, 삭제 부정·질문 무실행, 삭제 후 context/리포트/추천·과거 이력 재입력에서 사실 제거 |
| 추천 | 15개 CSV, 현재 대화 관련성, 추천 거절, 임계값 미달, 복용 성분·메모 속 복용 시작 성분 제외, 카페인 충돌, 파트너스 고지 |
| 공개 데이터 | 점수/사업자 문구/비밀이 응답 LLM에 없음, 안전 URL만 카드 표시, 치료 표현 리뷰 제외 |

## 키 없는 실제 uvicorn + curl

다음 명령으로 별도 복사본에서 서버를 실행했습니다. `GEMINI_API_KEY`, `JEV_API_KEY`, `JEV_ENDPOINT`를 제거했습니다.

```bash
env -u GEMINI_API_KEY -u JEV_API_KEY -u JEV_ENDPOINT \
  MEDBOT_DATA_PATH=data/curl-verification/users.json \
  MEDBOT_AUDIT_PATH=logs/curl-verification.jsonl \
  .venv/bin/uvicorn medbot.api:app --host 127.0.0.1 --port 8766
```

실제 `curl --request ... --data ... --write-out '\n%{http_code}'`를 호출해 **18개 요청**의 상태·응답을 확인했습니다. 응답 전문은 [curl-results.json](curl-results.json)에 저장했고 모두 가상 사용자 자료입니다. 검증 후 서버 종료를 확인했습니다.

| 요청 | 실제 결과 |
|---|---|
| GET /health | 200, `mode=mock` |
| 초기 context 조회 | 200, 최근 평균 체중 77.4kg |
| wearable: 10/3, 수면 6시간, 6,000걸음, 걷기 30분 | 200, source=samsung_health_sample, 날짜 업서트 |
| daily: 10/3, 체중 72.5kg, 평소대로, 체감 3 | 200, 워치 데이터 보존 |
| prefill: 10/3 | 200, 체중 72.5kg·섭취 평소대로·걷기 30분·체감 3 |
| daily: 체중 10kg | 422 |
| “요즘 야근 때문에 커피를 하루 3잔 마셔요, 잠을 잘 못 자요” | 200, in_scope/heuristic, 메모 **3개**, 추천 카드 **2개** |
| 저장 후 context | 최근 평균 체중 **75.79kg**, 날짜 메모 3개 포함 |
| 다른 사용자 경로에서 카페인 ID 삭제 | 404, 삭제되지 않음 |
| 본인 경로 DELETE | 200, 삭제 ID 반환 |
| 메모 목록 + context 재조회 | 메모 2개, 카페인 ID/사실 없음 |
| 이전 커피 대화를 history에 넣고 수면 추천 이유 질문 | 메모 재저장 없음, 답변·추천 근거에서 카페인 사실 없음 |
| 커피 사실 새로 전송 → “아까 기록한 카페인 지워줘” | 새 메모 저장 후 자연어 삭제 1개 |
| 수면 관련 파이썬 코드 | off_topic/heuristic, 메모·추천 없음 |
| 시스템 프롬프트 공개 요청 | malicious/prefilter, 메모·추천 없음 |
| 예시 20개로 내부 규칙 귀납 요청 | malicious/heuristic, 메모·추천 없음 |

샘플 원본 `medbot/data/users.json`의 전후 SHA-256이 동일했습니다. 삭제 이후 저장소·컨텍스트에 카페인 메모가 남지 않았고, 모든 추천 카드에 파트너스 고지가 포함됐습니다. 감사는 확률·밴드·판정/해시만 저장하고 대화 원문을 보관하지 않습니다. 위 검증 JSON은 재현 증거용 가상 자료이며 실서비스 메모 저장소가 아닙니다.

## 직접 실행할 수동 QA

- [ ] 키 없는 서버의 `/`에서 체중 관리형 선택 → 워치 샘플 입력 → 예측값 미리 채움 → 체중 수정/저장 → 다음 답변 통계 확인.
- [ ] 커피·야근·수면 발화 전송 → 날짜 메모 칩 3개와 카드 1~2개, 샘플 표시·공개 근거·쿠팡 파트너스 고지 확인.
- [ ] 카페인 칩의 삭제 클릭 → 저장 메모 새로고침 → 수면 추천 질문: 삭제 사실/카드 근거가 없고 이전 카드가 제거되는지 확인.
- [ ] 새 커피 메모 저장 → 자연어 삭제: 삭제 알림, 메모 칩 제거 확인; “삭제하지 마”는 보존 확인.
- [ ] 범용 코딩·프롬프트 공개 요청의 차단 배지와 메모·카드 미생성 확인.
- [ ] 사용자 전환 시 이력/입력 초기화, 응답 중 중복 조작 비활성화, 좁은 화면, HTML 입력 안전 렌더 확인.
- [ ] 잘못된 운동 JSON·422·서버 종료 상황에서 오류 문구와 버튼 복구 확인.

Jev 실제 HTTP 연동, 실제 Gemini 품질·의료 적합성, 실제 삼성헬스 export, 실상품 기능성 검증, threshold 라벨링은 이번 테스트에서 확인하지 않았습니다. Jev/삼성헬스/라벨링은 요청 범위대로 TODO이며 로그인 소유권 연결과 다중 프로세스 저장소는 큰 앱 통합 책임입니다.
