from fastapi import APIRouter, Depends, HTTPException

from app.middleware.auth import get_auth_context
from app.services import catalog as catalog_service
from app.utils import row_to_camel

router = APIRouter()


@router.get("/catalog/industries")
async def admin_list_industries(auth: dict = Depends(get_auth_context)):
    rows = catalog_service.list_industries(active_only=False)
    return {"industries": [row_to_camel(r) for r in rows]}


@router.post("/catalog/industries")
async def admin_upsert_industry(body: dict, auth: dict = Depends(get_auth_context)):
    if not body.get("id") or not body.get("name"):
        raise HTTPException(status_code=400, detail={"error": "id and name required"})
    saved = catalog_service.upsert_industry(body)
    return {"industry": row_to_camel(saved)}


@router.get("/catalog/enterprise")
async def admin_list_enterprise(auth: dict = Depends(get_auth_context)):
    rows = catalog_service.list_enterprise_companies(public_only=False)
    return {
        "companies": [
            row_to_camel({k: v for k, v in r.items() if k != "questions_json"})
            for r in rows
        ]
    }


@router.post("/catalog/enterprise")
async def admin_upsert_enterprise(body: dict, auth: dict = Depends(get_auth_context)):
    if not body.get("id") or not body.get("name"):
        raise HTTPException(status_code=400, detail={"error": "id and name required"})
    saved = catalog_service.upsert_enterprise(body)
    payload = {k: v for k, v in saved.items() if k != "questions_json"}
    return {"company": row_to_camel(payload)}
