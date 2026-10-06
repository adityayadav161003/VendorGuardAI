"""
API Quality Middleware: Request ID tracing, consistent error envelope, and pagination utilities.
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from math import ceil

from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id

        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


def create_error_envelope(
    status_code: int,
    message: str,
    request_id: Optional[str] = None,
    error_code: Optional[str] = None,
    details: Optional[Any] = None,
) -> Dict[str, Any]:
    """Generates the standardized error response envelope."""
    code_names = {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        409: "CONFLICT",
        410: "GONE",
        422: "UNPROCESSABLE_ENTITY",
        429: "TOO_MANY_REQUESTS",
        500: "INTERNAL_SERVER_ERROR",
    }
    return {
        "error": {
            "code": error_code or code_names.get(status_code, "ERROR"),
            "message": message,
            "request_id": request_id,
            "details": details,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    }


def paginate(query, page: int = 1, page_size: int = 20) -> Dict[str, Any]:
    """Applies standardized pagination to an arbitrary SQLAlchemy query."""
    page = max(1, page)
    page_size = max(1, min(100, page_size))
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    total_pages = ceil(total / page_size) if total > 0 else 1

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "has_next": page < total_pages,
        "has_prev": page > 1,
    }
