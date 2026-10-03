"""벡터 없이 후보를 선택한다. 점수/사업자 문구는 공개 카드나 LLM에 전달하지 않는다."""
import csv
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol
from urllib.parse import urlparse

from medbot.models import Memory, Recommendation

DISCLOSURE = "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다."


@dataclass(frozen=True)
class Supplement:
    product_id: str
    name: str
    brand: str
    category: str
    ingredients: str
    form: str
    price: int
    coupang_url: str
    seller_claims: str
    review_rating: float
    review_count: int
    review_summary: str
    mfds_function_claim: str
    cautions: str
    tags: tuple[str, ...]
    target_personas: tuple[str, ...]


class SupplementRepository(Protocol):
    def list_products(self) -> list[Supplement]: ...


class CSVSupplementRepository:
    def __init__(self, path: str | Path | None = None):
        self.path = Path(path) if path else Path(__file__).parent / "data/supplements.csv"

    def list_products(self) -> list[Supplement]:
        with self.path.open(encoding="utf-8", newline="") as stream:
            return [Supplement(**(row | {"price": int(row["price"]),
                "review_rating": float(row["review_rating"]), "review_count": int(row["review_count"]),
                "tags": tuple(filter(None, row["tags"].split(";"))),
                "target_personas": tuple(filter(None, row["target_personas"].split(";")))}))
                for row in csv.DictReader(stream)]


TAG_WORDS = {
    "체중": r"체중|다이어트|감량|식단",
    "수면": r"수면|잠|불면",
    "활동": r"운동|활동|걸음|퍼포먼스",
    "피로": r"피로|피곤|야근|교대근무|에너지",
    "건강유지": r"건강|건강유지|영양",
}


def matching_tags(text: str) -> set[str]:
    return {tag for tag, pattern in TAG_WORDS.items() if re.search(pattern, text, re.I)}


def ingredient_names(value: str) -> set[str]:
    return {re.sub(r"\s+", "", part.split(":", 1)[0]).casefold()
            for part in value.split(";") if part.strip()}


def safe_link(value: str) -> str | None:
    parsed = urlparse(value)
    return value if parsed.scheme == "https" and parsed.hostname and (
        parsed.hostname == "coupang.com" or parsed.hostname.endswith(".coupang.com")) else None


def recommend(repository: SupplementRepository, user: dict, message: str,
              memories: list[Memory], threshold: float = 2.6) -> list[Recommendation]:
    # 평범한 기록 조회나 인사는 추천 슬롯을 열지 않는다. 현재 발화에 명시적 관심이 필요하다.
    interested = re.search(r"건기식|영양제|보조제|제품.*추천|추천.*제품|추천.*이유|왜.*추천|"
                           r"잠.*(?:못|안)|수면.*(?:고민|부족|개선)|피곤|피로|감량|체중.*관리", message)
    if not interested or re.search(r"추천.*(?:말|싫|필요 없)|진단|처방|가슴.*통증|호흡곤란", message):
        return []
    active = [m for m in memories if m.status == "active"]
    memory_text = " ".join(m.content for m in active)
    goals = set(user.get("profile", {}).get("goals", []))
    persona = user.get("profile", {}).get("persona", "")
    dialogue_tags = matching_tags(message + " " + memory_text)
    taking = {re.sub(r"\s+", "", i["name"]).casefold()
              for p in user.get("products", []) for i in p.get("ingredients", [])}
    products = repository.list_products()
    for memory in active:
        if memory.category == "medication" and not re.search(r"중단|끊", memory.content):
            taking.update(name for p in products for name in ingredient_names(p.ingredients)
                          if name in re.sub(r"\s+", "", memory.content).casefold())
    personal_context = message + " " + memory_text + " " + " ".join(
        r.get("note") or "" for r in user.get("daily_logs", [])[-7:])
    ranked = []
    for product in products:
        names = ingredient_names(product.ingredients)
        # 원문 리뷰에 질병 치료/효능 보장이 있으면 카드의 근거로 사용하지 않는다.
        if re.search(r"완치|치료|효과.{0,12}(?:보장|확실)|100%|무조건", product.mfds_function_claim + product.review_summary):
            continue
        if names & taking:
            continue
        # 카페인 섭취량이 불명이어도 섭취 기록이 있으면 카페인 포함 후보를 보수적으로 제외.
        if re.search(r"카페인|caffeine", product.ingredients + product.cautions, re.I) and re.search(
                r"카페인|커피|불면|잠.*(?:못|안)", personal_context):
            continue
        caution_tokens = re.findall(r"임신|수유|항응고제|알레르기", product.cautions)
        if any(token in personal_context for token in caution_tokens):
            continue
        tags = set(product.tags)
        matches = tags & (goals | dialogue_tags)
        if not matches:
            continue
        # 사전 평균 3.5에 50개 표본을 부여하여 적은 리뷰 수의 높은 평점 영향 축소.
        adjusted_rating = (product.review_rating * product.review_count + 3.5 * 50) / (product.review_count + 50)
        score = 1.4 * len(tags & goals) + (1. if persona in product.target_personas else 0.)
        score += 1.2 * len(tags & dialogue_tags) + max(0., adjusted_rating - 3.5) * .4
        if score < threshold:
            continue
        lines = []
        if product.mfds_function_claim:
            lines.append("인정 기능성 안내(샘플): " + product.mfds_function_claim)
        if product.review_count:
            # 실제 목표별 평점 데이터가 없으므로 '비슷한 목표의 사용자'라고 꾸미지 않는다.
            lines.append(f"사용자 평점 {product.review_rating:.1f} ({product.review_count}개 리뷰·가상 샘플)")
        if product.review_summary:
            lines.append("리뷰 요약(가상 샘플): " + product.review_summary)
        for memory in active:
            if re.search(r"완치|치료|효과.{0,12}(?:보장|확실)|100%|무조건", memory.content):
                continue
            if matching_tags(memory.content) & matches or (
                    "수면" in tags and re.search(r"카페인|커피", memory.content)):
                lines.append(f"{memory.created_at.month}/{memory.created_at.day} 기록: {memory.content}")
        if not lines:
            continue
        card = Recommendation(product_id=product.product_id, name=product.name, price=product.price,
                              reason_lines=lines, coupang_url=safe_link(product.coupang_url), disclosure=DISCLOSURE)
        ranked.append((score, product.product_id, card, names))
    ranked.sort(key=lambda item: (-item[0], item[1]))
    selected, selected_ingredients = [], set()
    for _, _, card, names in ranked:
        if names & selected_ingredients:
            continue
        selected.append(card)
        selected_ingredients.update(names)
        if len(selected) == 2:
            break
    return selected
