import type { Metadata } from "next";
import ProductApp from "./ProductApp";

export const metadata: Metadata = {
  title: "Lumen 브랜드 분석",
  description: "고객 질문, 사용자 여정, 적격 상품 노출과 행동을 한곳에서 분석합니다.",
};

export default function Home() {
  return <ProductApp />;
}
