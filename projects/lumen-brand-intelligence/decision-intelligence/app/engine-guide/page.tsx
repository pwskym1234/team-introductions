import type { Metadata } from "next";
import EngineGuideApp from "./EngineGuideApp";

export const metadata: Metadata = {
  title: "추천 엔진 이해하기 | Lumen",
  description: "질문이 안전 확인, 변화 계산, 6가지 판단, 상품 필터를 거쳐 최종 답변이 되는 과정을 쉬운 말로 설명합니다.",
};

export default function EngineGuidePage() {
  return <EngineGuideApp />;
}
