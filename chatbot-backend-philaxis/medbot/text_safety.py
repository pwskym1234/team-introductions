import json
import re
import unicodedata
import uuid

# 매칭 내용은 거절 답변에 반영하지 않는다.
RULES = {
    "prompt_injection": [r"(?:이전|앞선|모든|위의|기존).{0,24}(?:지시|지침|명령|규칙).{0,18}(?:무시|잊|버려)",
                         r"(?:ignore|disregard|forget).{0,40}(?:instructions?|rules?|prompts?)"],
    "prompt_leak": [r"(?:시스템|개발자).{0,12}(?:프롬프트|지침|메시지|규칙).{0,24}(?:보여|공개|출력|알려|덤프)",
                    r"(?:print|reveal|show|repeat|dump).{0,35}(?:system|developer|rules|instructions)",
                    r"(?:system|developer)\s*(?:prompt|instructions).{0,25}(?:reveal|print|show)"],
    "data_exfiltration": [r"(?:다른|타|전체|모든)\s*(?:사용자|유저|회원)",
                          r"(?:other|all)\s*(?:users?|patients?).{0,30}(?:data|records?|info)",
                          r"(?:\bdb\b|database|데이터베이스|\brag\b).{0,30}(?:덤프|원문|전체|dump|raw)",
                          r"(?:dump|raw).{0,25}(?:database|\bdb\b|\brag\b)"],
    "jailbreak": [r"\bdan\b", r"(?:제한\s*없|제한\s*해제|탈옥|jailbreak|unrestricted)",
                  r"(?:pretend|roleplay).{0,40}(?:no\s*rules|unfiltered)"],
    "other": [r"(?:base64|rot13|인코딩|encoded|encoding|유니코드|hex).{0,50}(?:우회|해독|디코드|decode|지시|프롬프트|bypass)",
              r"(?:decode|디코드|해독).{0,30}(?:base64|rot13|hex|인코딩)"],
}
def normalize(text: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKC", text) if unicodedata.category(c) != "Cf")


def data_envelope(data: dict) -> str:
    marker = "UNTRUSTED_DATA_" + uuid.uuid4().hex
    return f"BEGIN_{marker}\n{json.dumps(data, ensure_ascii=False)}\nEND_{marker}"


def prefilter(message: str, user_id: str) -> list[str]:
    normalized = normalize(message)
    attacks = [kind for kind, patterns in RULES.items()
               if any(re.search(p, normalized, re.I | re.S) for p in patterns)]
    if any(uid != user_id.lower() for uid in re.findall(r"\buser_[a-z0-9]+\b", normalized.lower())):
        attacks.append("data_exfiltration")
    return sorted(set(attacks))
