# Lumen — 소비자 건강 질문 × 판단 엔진 × 브랜드 인텔리전스

해커톤 제출용 통합 프로젝트입니다. 소비자의 건강 질문을 안전하게 구조화해 판단 엔진으로 처리하고, 브랜드 담당자가 질문 흐름·전환·사용자 여정·상품 적격성·결정 이유를 분석하는 B2B 도구까지 연결합니다.

## 바로 보기

- [브랜드 인텔리전스 웹앱](https://lumen-brand-analytics-20261003.snu-chatgpt-5678.chatgpt.site/?view=overview&range=30)
- [판단 엔진 쉬운 설명](https://lumen-brand-analytics-20261003.snu-chatgpt-5678.chatgpt.site/engine-guide)

## 구성

```text
lumen-brand-intelligence/
├── decision-intelligence/   # Next.js 기반 브랜드 분석 제품과 엔진 설명 웹사이트
├── decision-engine/         # 하드 필터, 6가지 판정, 불확실성, 통계 검증 로직
└── docs/                    # 엔진 감사·고도화 보고서
```

Amplitude의 분석 문법을 참고해 `분석 정의 → 차트 → 세부 표 → 고객 그룹/다음 행동` 흐름으로 설계했습니다. UI 조사와 현재 화면 감사 결과는 `decision-intelligence/docs/Amplitude_UI_System_Complete_Audit_v3.md`에 있습니다.

## 실행

브랜드 분석:

```bash
cd decision-intelligence
npm install
npm run dev
```

판단 엔진:

```bash
cd decision-engine
npm install
npm test
npm run demo
```

모든 분석 데이터는 고정 시드로 만든 합성 데이터입니다. 브랜드 화면에는 질문 원문, 약명·용량, 개인 건강 원시값을 저장하지 않습니다.
