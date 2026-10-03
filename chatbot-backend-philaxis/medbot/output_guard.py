import re

from medbot.guard import normalize
from medbot.responder import CANARY, SYSTEM_PROMPT

SAFE_REPLY = "응답의 안전성을 확인할 수 없어 표시하지 않았습니다. 본인의 건강 기록에 대해 다시 질문해 주세요."


def check_output(reply: str, user_id: str, known_user_ids: list[str]) -> tuple[str, str | None]:
    text = normalize(reply).casefold()
    compact = re.sub(r"\s+", "", text)
    if CANARY.casefold() in text:
        return SAFE_REPLY, "canary_leak"
    for line in SYSTEM_PROMPT.splitlines():
        phrase = re.sub(r"\s+", "", line.casefold())
        if len(phrase) >= 24 and any(phrase[i:i+24] in compact for i in range(len(phrase)-23)):
            return SAFE_REPLY, "system_prompt_leak"
    ids = set(re.findall(r"\buser_[a-z0-9]+\b", text))
    if ids - {user_id.casefold()} or any(
        uid != user_id and re.search(r"(?<!\w)" + re.escape(uid.casefold()) + r"(?!\w)", text)
        for uid in known_user_ids
    ):
        return SAFE_REPLY, "other_user_id"
    return reply, None
