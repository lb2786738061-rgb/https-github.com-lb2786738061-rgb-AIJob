import asyncio
import json
import logging
import re
import ssl
from typing import Any, TypedDict

import httpx

from app.config import (
    LLM_CONNECT_TIMEOUT,
    LLM_READ_TIMEOUT,
    LLM_RESUME_READ_TIMEOUT,
    OPENAI_API_KEY,
    OPENAI_BASE_URL,
    OPENAI_MODEL,
)

logger = logging.getLogger(__name__)

LLM_TIMEOUT = httpx.Timeout(LLM_CONNECT_TIMEOUT, read=LLM_READ_TIMEOUT)
RESUME_LLM_TIMEOUT = httpx.Timeout(
    LLM_CONNECT_TIMEOUT, read=LLM_RESUME_READ_TIMEOUT
)


class TokenUsage(TypedDict):
    promptTokens: int
    completionTokens: int
    totalTokens: int


class LlmJsonResult(TypedDict):
    data: Any
    tokenUsage: TokenUsage | None


def _get_ssl_context() -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    try:
        ctx.maximum_version = ssl.TLSVersion.TLSv1_2
    except Exception:
        pass
    return ctx


def _chat_completions_url() -> str:
    base = OPENAI_BASE_URL.rstrip("/")
    if base.endswith("/chat/completions"):
        base = base[: -len("/chat/completions")]
    return f"{base}/chat/completions"


def is_llm_available() -> bool:
    return bool(OPENAI_API_KEY)


def uses_longcat() -> bool:
    blob = f"{OPENAI_MODEL} {OPENAI_BASE_URL}".lower()
    return "longcat" in blob


def parse_llm_json(text: str) -> Any:
    cleaned = text.strip()
    fence_match = re.match(r"^```(?:json)?\s*\n?(.*?)\n?```\s*$", cleaned, re.DOTALL)
    if fence_match:
        cleaned = fence_match.group(1).strip()
    return json.loads(cleaned)


def parse_token_usage(data: dict) -> TokenUsage | None:
    usage = data.get("usage")
    if not isinstance(usage, dict):
        return None
    prompt = usage.get("prompt_tokens")
    completion = usage.get("completion_tokens")
    total = usage.get("total_tokens")
    if prompt is None and completion is None and total is None:
        return None
    prompt_tokens = int(prompt or 0)
    completion_tokens = int(completion or 0)
    total_tokens = int(total or (prompt_tokens + completion_tokens))
    return {
        "promptTokens": prompt_tokens,
        "completionTokens": completion_tokens,
        "totalTokens": total_tokens,
    }


def _message_content(data: dict) -> str:
    choices = data.get("choices") or []
    if not choices:
        return ""
    message = choices[0].get("message") or {}
    content = message.get("content")
    if isinstance(content, str) and content.strip():
        return content
    return ""


def _build_chat_body(
    *,
    messages: list[dict[str, str]],
    temperature: float,
    json_mode: bool,
    disable_thinking: bool,
) -> dict:
    body: dict[str, Any] = {
        "model": OPENAI_MODEL,
        "messages": messages,
        "temperature": temperature,
    }
    if json_mode and not uses_longcat():
        body["response_format"] = {"type": "json_object"}
    if disable_thinking:
        body["thinking"] = {"type": "disabled"}
    return body


async def _post_chat_completion(
    body: dict,
    *,
    timeout: httpx.Timeout | None = None,
) -> tuple[str, TokenUsage | None]:
    if not is_llm_available():
        raise RuntimeError("LLM_NOT_CONFIGURED")

    payload = dict(body)
    max_retries = 2
    last_error: Exception | None = None

    for attempt in range(max_retries + 1):
        try:
            async with httpx.AsyncClient(
                verify=_get_ssl_context(),
                timeout=timeout or LLM_TIMEOUT,
            ) as client:
                response = await client.post(
                    _chat_completions_url(),
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {OPENAI_API_KEY}",
                    },
                    json=payload,
                )
                if not response.is_success:
                    text = response.text
                    if (
                        response.status_code == 400
                        and "thinking" in payload
                        and attempt < max_retries
                    ):
                        logger.warning("接口不支持 thinking 字段，去掉后重试")
                        payload = {key: value for key, value in payload.items() if key != "thinking"}
                        continue
                    raise RuntimeError(
                        f"大模型接口请求失败: {response.status_code} {text}"
                    )
                data = response.json()
                content = _message_content(data)
                return content, parse_token_usage(data)
        except httpx.TimeoutException as exc:
            last_error = exc
            if attempt < max_retries:
                logger.warning(
                    "大模型请求超时 (%s)，正在进行第 %d 次重试: %s",
                    type(exc).__name__,
                    attempt + 1,
                    exc,
                )
                await asyncio.sleep(1.0)
                continue
            raise RuntimeError(f"大模型请求超时 ({type(exc).__name__})") from exc
        except (httpx.TransportError, ssl.SSLError) as exc:
            last_error = exc
            if attempt < max_retries:
                logger.warning(
                    "大模型请求发生网络或安全连接异常 (%s)，正在进行第 %d 次重试: %s",
                    type(exc).__name__,
                    attempt + 1,
                    exc,
                )
                await asyncio.sleep(1.0)
                continue
            raise RuntimeError(f"大模型连接失败: {exc}") from exc

    raise RuntimeError(f"大模型请求失败: {last_error}")


async def chat_completion(
    system_prompt: str,
    user_prompt: str,
    json_mode: bool = False,
    *,
    timeout: httpx.Timeout | None = None,
    disable_thinking: bool = False,
) -> str:
    body = _build_chat_body(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.7,
        json_mode=json_mode,
        disable_thinking=disable_thinking,
    )
    content, _usage = await _post_chat_completion(body, timeout=timeout)
    return content


async def chat_completion_with_usage(
    system_prompt: str,
    user_prompt: str,
    json_mode: bool = False,
    *,
    timeout: httpx.Timeout | None = None,
    disable_thinking: bool = False,
) -> tuple[str, TokenUsage | None]:
    body = _build_chat_body(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.7,
        json_mode=json_mode,
        disable_thinking=disable_thinking,
    )
    return await _post_chat_completion(body, timeout=timeout)


async def chat_completion_json_with_usage(
    system_prompt: str,
    user_prompt: str,
    *,
    timeout: httpx.Timeout | None = None,
) -> LlmJsonResult:
    """Request JSON from the LLM; return parsed data and token usage."""
    effective_timeout = timeout or RESUME_LLM_TIMEOUT
    total_usage: TokenUsage | None = None
    use_json_mode = not uses_longcat()
    prompt = system_prompt
    if not use_json_mode:
        prompt = (
            system_prompt
            + "\n\n重要：只输出合法 JSON 对象，不要 markdown 代码块、思考过程或额外说明。"
        )

    try:
        content, usage = await chat_completion_with_usage(
            prompt,
            user_prompt,
            json_mode=use_json_mode,
            timeout=effective_timeout,
            disable_thinking=True,
        )
        if usage:
            total_usage = usage
        return {"data": parse_llm_json(content), "tokenUsage": total_usage}
    except RuntimeError as exc:
        msg = str(exc)
        if "response_format" not in msg and "400" not in msg:
            raise
        fallback_prompt = (
            system_prompt
            + "\n\n重要：只输出合法 JSON 对象，不要 markdown 代码块或额外说明。"
        )
        content, usage = await chat_completion_with_usage(
            fallback_prompt,
            user_prompt,
            json_mode=False,
            timeout=effective_timeout,
            disable_thinking=True,
        )
        if usage:
            total_usage = usage
        return {"data": parse_llm_json(content), "tokenUsage": total_usage}


async def chat_completion_json(
    system_prompt: str,
    user_prompt: str,
    *,
    timeout: httpx.Timeout | None = None,
) -> Any:
    result = await chat_completion_json_with_usage(
        system_prompt, user_prompt, timeout=timeout
    )
    return result["data"]


async def chat_with_history(
    system_prompt: str,
    messages: list[dict[str, str]],
) -> str:
    body = _build_chat_body(
        messages=[
            {"role": "system", "content": system_prompt},
            *messages,
        ],
        temperature=0.8,
        json_mode=False,
        disable_thinking=False,
    )
    content, _usage = await _post_chat_completion(body, timeout=LLM_TIMEOUT)
    return content
