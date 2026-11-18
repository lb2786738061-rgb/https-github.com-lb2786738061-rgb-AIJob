import json

from app.constants.enterprise import ENTERPRISE_COMPANIES
from app.constants.industries import INDUSTRIES
from app.db.connection import get_db


def ensure_catalog_seeded() -> None:
    db = get_db()
    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS industry_catalog (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          sort_order INTEGER NOT NULL DEFAULT 0,
          active INTEGER NOT NULL DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS enterprise_catalog (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          industry TEXT,
          description TEXT,
          questions_json TEXT NOT NULL,
          active INTEGER NOT NULL DEFAULT 1
        );
        """
    )

    count = db.execute("SELECT COUNT(*) AS c FROM industry_catalog").fetchone()["c"]
    if count == 0:
        for idx, item in enumerate(INDUSTRIES):
            db.execute(
                "INSERT INTO industry_catalog (id, name, sort_order, active) VALUES (?, ?, ?, 1)",
                (item["id"], item["name"], idx),
            )

    ent_count = db.execute("SELECT COUNT(*) AS c FROM enterprise_catalog").fetchone()["c"]
    if ent_count == 0:
        for company in ENTERPRISE_COMPANIES:
            db.execute(
                """INSERT INTO enterprise_catalog
                   (id, name, industry, description, questions_json, active)
                   VALUES (?, ?, ?, ?, ?, 1)""",
                (
                    company["id"],
                    company["name"],
                    company["industry"],
                    company["description"],
                    json.dumps(company["questions"], ensure_ascii=False),
                ),
            )
    db.commit()


def list_industries(active_only: bool = True) -> list[dict]:
    ensure_catalog_seeded()
    db = get_db()
    if active_only:
        rows = db.execute(
            "SELECT id, name FROM industry_catalog WHERE active = 1 ORDER BY sort_order, name"
        ).fetchall()
    else:
        rows = db.execute(
            "SELECT id, name, sort_order, active FROM industry_catalog ORDER BY sort_order, name"
        ).fetchall()
    return [dict(row) for row in rows]


def list_enterprise_companies(public_only: bool = True) -> list[dict]:
    ensure_catalog_seeded()
    db = get_db()
    query = "SELECT id, name, industry, description, questions_json, active FROM enterprise_catalog"
    if public_only:
        query += " WHERE active = 1"
    query += " ORDER BY name"
    rows = db.execute(query).fetchall()
    result: list[dict] = []
    for row in rows:
        item = dict(row)
        questions = json.loads(item["questions_json"])
        if public_only:
            result.append(
                {
                    "id": item["id"],
                    "name": item["name"],
                    "industry": item["industry"],
                    "description": item["description"],
                }
            )
        else:
            item["questions"] = questions
            result.append(item)
    return result


def get_enterprise_company(company_id: str) -> dict | None:
    ensure_catalog_seeded()
    db = get_db()
    row = db.execute(
        "SELECT * FROM enterprise_catalog WHERE id = ? AND active = 1", (company_id,)
    ).fetchone()
    if not row:
        return None
    data = dict(row)
    data["questions"] = json.loads(data["questions_json"])
    return data


def upsert_industry(item: dict) -> dict:
    ensure_catalog_seeded()
    db = get_db()
    db.execute(
        """INSERT INTO industry_catalog (id, name, sort_order, active)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             sort_order = excluded.sort_order,
             active = excluded.active""",
        (
            item["id"],
            item["name"],
            item.get("sortOrder", 0),
            1 if item.get("active", True) else 0,
        ),
    )
    db.commit()
    row = db.execute(
        "SELECT id, name, sort_order, active FROM industry_catalog WHERE id = ?",
        (item["id"],),
    ).fetchone()
    return dict(row)


def upsert_enterprise(item: dict) -> dict:
    ensure_catalog_seeded()
    db = get_db()
    questions = item.get("questions") or []
    db.execute(
        """INSERT INTO enterprise_catalog
           (id, name, industry, description, questions_json, active)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             industry = excluded.industry,
             description = excluded.description,
             questions_json = excluded.questions_json,
             active = excluded.active""",
        (
            item["id"],
            item["name"],
            item.get("industry", ""),
            item.get("description", ""),
            json.dumps(questions, ensure_ascii=False),
            1 if item.get("active", True) else 0,
        ),
    )
    db.commit()
    row = db.execute(
        "SELECT id, name, industry, description, questions_json, active FROM enterprise_catalog WHERE id = ?",
        (item["id"],),
    ).fetchone()
    data = dict(row)
    data["questions"] = json.loads(data["questions_json"])
    return data
