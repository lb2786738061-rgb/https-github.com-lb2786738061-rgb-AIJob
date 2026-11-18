from app.db.connection import get_db
from app.services.platform_client import (
    consume_platform_usage,
    get_platform_me,
    has_active_membership_pass,
    wallet_balance,
)

FREE_LIMITS = {
    "resumeDiagnosis": 1,
    "reanalyze": 0,
    "mockInterview": 1,
    "mockInterviewMaxSec": 300,
}


def is_local_auth(auth: dict) -> bool:
    platform_user_id = auth.get("platformUserId") or ""
    return isinstance(platform_user_id, str) and platform_user_id.startswith("local:")


def is_paid_from_me(me: dict) -> bool:
    return has_active_membership_pass(me)


def _get_local_quota_row(user_id: int) -> dict:
    db = get_db()
    row = db.execute(
        "SELECT * FROM usage_quotas WHERE user_id = ?", (user_id,)
    ).fetchone()
    if not row:
        db.execute(
            """INSERT INTO usage_quotas
               (user_id, resume_diagnosis_used, mock_interview_used, reanalyze_used, enterprise_credits)
               VALUES (?, 0, 0, 0, 0)""",
            (user_id,),
        )
        db.commit()
        row = db.execute(
            "SELECT * FROM usage_quotas WHERE user_id = ?", (user_id,)
        ).fetchone()
    return dict(row)


def _is_local_paid(user_id: int) -> bool:
    from app.services.payments import has_active_membership

    return has_active_membership(user_id)


async def is_paid(auth: dict) -> bool:
    if is_local_auth(auth):
        return _is_local_paid(auth["userId"])
    me = await get_platform_me(auth["platformToken"])
    return is_paid_from_me(me)


async def fetch_platform_me(token: str) -> dict:
    return await get_platform_me(token)


def get_local_quota_status(user_id: int) -> dict:
    row = _get_local_quota_row(user_id)
    paid = _is_local_paid(user_id)
    resume_used = row["resume_diagnosis_used"]
    interview_used = row["mock_interview_used"]
    reanalyze_used = row["reanalyze_used"] if "reanalyze_used" in row.keys() else 0
    enterprise_credits = row["enterprise_credits"] if "enterprise_credits" in row.keys() else 0

    return {
        "planTier": "membership_pass" if paid else "free",
        "resumeDiagnosisUsed": resume_used,
        "mockInterviewUsed": interview_used,
        "reanalyzeUsed": reanalyze_used,
        "enterpriseCredits": enterprise_credits,
        "resumeDiagnosisLimit": None if paid else FREE_LIMITS["resumeDiagnosis"],
        "mockInterviewLimit": None if paid else FREE_LIMITS["mockInterview"],
        "mockInterviewMaxSec": None if paid else FREE_LIMITS["mockInterviewMaxSec"],
        "trialBalance": 0,
        "creditBalance": enterprise_credits,
        "entitlements": [],
    }


async def get_quota_status(auth: dict) -> dict:
    if is_local_auth(auth):
        return get_local_quota_status(auth["userId"])
    me = await get_platform_me(auth["platformToken"])
    paid = has_active_membership_pass(me)
    trial = wallet_balance(me, "trial")
    credit = wallet_balance(me, "credit")

    return {
        "planTier": "membership_pass" if paid else "free",
        "resumeDiagnosisUsed": 0 if paid else max(0, 2 - trial),
        "mockInterviewUsed": 0 if paid else max(0, 1 - min(trial, 1)),
        "reanalyzeUsed": 0,
        "enterpriseCredits": credit,
        "resumeDiagnosisLimit": None if paid else FREE_LIMITS["resumeDiagnosis"],
        "mockInterviewLimit": None if paid else FREE_LIMITS["mockInterview"],
        "mockInterviewMaxSec": None if paid else FREE_LIMITS["mockInterviewMaxSec"],
        "trialBalance": trial,
        "creditBalance": credit,
        "entitlements": me.get("entitlements", []),
    }


async def check_resume_quota(auth: dict) -> dict:
    if is_local_auth(auth):
        row = _get_local_quota_row(auth["userId"])
        paid = _is_local_paid(auth["userId"])
        if paid or row["resume_diagnosis_used"] < FREE_LIMITS["resumeDiagnosis"]:
            return {"allowed": True}
        return {
            "allowed": False,
            "message": "免费额度已用完（1 次简历诊断）。升级会员后可无限次使用。",
        }

    me = await get_platform_me(auth["platformToken"])
    if has_active_membership_pass(me) or wallet_balance(me, "trial") >= 1:
        return {"allowed": True, "me": me}
    return {
        "allowed": False,
        "me": me,
        "message": "免费额度已用完（1 次简历诊断）。升级会员后可无限次使用。",
    }


async def check_reanalyze_quota(auth: dict) -> dict:
    if is_local_auth(auth):
        paid = _is_local_paid(auth["userId"])
        if paid:
            return {"allowed": True}
        return {
            "allowed": False,
            "message": "免费用户不支持重新分析，升级会员后可针对不同时段 JD 无限次精修。",
        }

    me = await get_platform_me(auth["platformToken"])
    if has_active_membership_pass(me):
        return {"allowed": True, "me": me}
    return {
        "allowed": False,
        "me": me,
        "message": "免费用户不支持重新分析，升级会员后可针对不同时段 JD 无限次精修。",
    }


async def check_enterprise_quota(auth: dict) -> dict:
    if is_local_auth(auth):
        row = _get_local_quota_row(auth["userId"])
        credits = row["enterprise_credits"] if "enterprise_credits" in row.keys() else 0
        if credits >= 1:
            return {"allowed": True}
        return {
            "allowed": False,
            "message": "请先购买名企定向冲刺包（199元/次）",
        }

    me = await get_platform_me(auth["platformToken"])
    if wallet_balance(me, "credit") >= 1:
        return {"allowed": True, "me": me}
    return {
        "allowed": False,
        "me": me,
        "message": "请先购买名企定向冲刺包（199元/次）",
    }


async def check_interview_quota(auth: dict) -> dict:
    if is_local_auth(auth):
        row = _get_local_quota_row(auth["userId"])
        paid = _is_local_paid(auth["userId"])
        if paid or row["mock_interview_used"] < FREE_LIMITS["mockInterview"]:
            return {"allowed": True}
        return {
            "allowed": False,
            "message": "免费额度已用完（1 场模拟面试）。升级会员后可无限次使用。",
        }

    me = await get_platform_me(auth["platformToken"])
    if has_active_membership_pass(me) or wallet_balance(me, "trial") >= 1:
        return {"allowed": True, "me": me}
    return {
        "allowed": False,
        "me": me,
        "message": "免费额度已用完（1 场模拟面试）。升级会员后可无限次使用。",
    }


async def consume_resume_diagnose(
    auth: dict, resume_id: int, me: dict | None = None
) -> None:
    if is_local_auth(auth):
        db = get_db()
        if not _is_local_paid(auth["userId"]):
            db.execute(
                "UPDATE usage_quotas SET resume_diagnosis_used = resume_diagnosis_used + 1 WHERE user_id = ?",
                (auth["userId"],),
            )
            db.commit()
        return

    profile = me or await get_platform_me(auth["platformToken"])
    paid = has_active_membership_pass(profile)
    await consume_platform_usage(
        auth["platformToken"],
        {
            "featureCode": "resume.diagnose",
            "costCredits": 0 if paid else 1,
            "allowTrial": not paid,
            "refType": "resume",
            "refId": str(resume_id),
        },
    )


async def consume_reanalyze(auth: dict, resume_id: int) -> None:
    if is_local_auth(auth):
        db = get_db()
        db.execute(
            "UPDATE usage_quotas SET reanalyze_used = reanalyze_used + 1 WHERE user_id = ?",
            (auth["userId"],),
        )
        db.commit()
        return

    await consume_platform_usage(
        auth["platformToken"],
        {
            "featureCode": "resume.reanalyze",
            "costCredits": 0,
            "refType": "resume",
            "refId": str(resume_id),
        },
    )


async def consume_interview_session(
    auth: dict, session_id: int, me: dict | None = None
) -> None:
    if is_local_auth(auth):
        db = get_db()
        if not _is_local_paid(auth["userId"]):
            db.execute(
                "UPDATE usage_quotas SET mock_interview_used = mock_interview_used + 1 WHERE user_id = ?",
                (auth["userId"],),
            )
            db.commit()
        return

    profile = me or await get_platform_me(auth["platformToken"])
    paid = has_active_membership_pass(profile)
    await consume_platform_usage(
        auth["platformToken"],
        {
            "featureCode": "interview.session",
            "costCredits": 0 if paid else 1,
            "allowTrial": not paid,
            "refType": "session",
            "refId": str(session_id),
        },
    )


async def consume_enterprise_session(auth: dict, session_id: int) -> None:
    if is_local_auth(auth):
        db = get_db()
        db.execute(
            "UPDATE usage_quotas SET enterprise_credits = enterprise_credits - 1 WHERE user_id = ? AND enterprise_credits >= 1",
            (auth["userId"],),
        )
        db.commit()
        return

    await consume_platform_usage(
        auth["platformToken"],
        {
            "featureCode": "enterprise.session",
            "costCredits": 1,
            "allowTrial": False,
            "refType": "session",
            "refId": str(session_id),
        },
    )
