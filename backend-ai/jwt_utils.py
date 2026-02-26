from jose import JWTError, jwt
from fastapi import HTTPException, Header
from datetime import datetime, timedelta
import os

# Load from env or use a strong default (change in production!)
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "mediconnect-super-secret-jwt-key-2024")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 12

def create_access_token(data: dict) -> str:
    """Create a signed JWT with an expiry."""
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(authorization: str = Header(...)):
    """
    FastAPI dependency — extracts and verifies the Bearer token.
    Usage: user = Depends(get_current_user)
    """
    credentials_error = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not authorization or not authorization.startswith("Bearer "):
        raise credentials_error
    token = authorization[len("Bearer "):]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_error
        return payload  # { sub, role, exp }
    except JWTError:
        raise credentials_error

def require_admin(authorization: str = Header(...)):
    """Dependency that requires the user to be an admin."""
    user = get_current_user(authorization)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
