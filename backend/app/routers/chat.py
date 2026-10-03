import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from pymongo.database import Database

from app.db.mongo import get_mongo
from app.deps import get_current_user
from app.models.sql import User
from app.schemas import ChatIn
from app.services.rag import answer

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("")
def chat(body: ChatIn, user: User = Depends(get_current_user), mongo: Database = Depends(get_mongo)) -> dict:
    session_id = body.session_id or uuid.uuid4().hex
    past = list(mongo.chat_history.find({"user_id": user.id, "session_id": session_id}).sort("created_at", 1).limit(20))
    context = body.context
    if context is None:
        latest = mongo.risk_assessments.find_one({"user_id": user.id}, sort=[("created_at", -1)])
        context = latest["result"] if latest else None
    reply = answer(body.message, body.lang, context, [{"role": m["role"], "content": m["content"]} for m in past])
    now = datetime.now(timezone.utc)
    mongo.chat_history.insert_many(
        [
            {
                "user_id": user.id,
                "session_id": session_id,
                "role": "user",
                "content": body.message,
                "lang": body.lang,
                "created_at": now,
            },
            {
                "user_id": user.id,
                "session_id": session_id,
                "role": "assistant",
                "content": reply["answer"],
                "lang": reply["lang"],
                "sources": reply["sources"],
                "mode": reply["mode"],
                "created_at": now + timedelta(milliseconds=1),
            },
        ]
    )
    return {**reply, "session_id": session_id}


@router.get("/history")
def history(
    session_id: str | None = None, user: User = Depends(get_current_user), mongo: Database = Depends(get_mongo)
) -> list:
    q: dict = {"user_id": user.id}
    if session_id:
        q["session_id"] = session_id
    cur = mongo.chat_history.find(q).sort("created_at", -1).limit(50)
    return [
        {
            "role": d["role"],
            "content": d["content"],
            "session_id": d["session_id"],
            "sources": d.get("sources", []),
            "created_at": d["created_at"].isoformat(),
        }
        for d in reversed(list(cur))
    ]
