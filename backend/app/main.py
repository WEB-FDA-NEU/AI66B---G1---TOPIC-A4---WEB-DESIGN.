import os
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app import models, schemas, security, deps
from app.database import engine, get_db

# Create database tables automatically
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Concertly API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 1. AUTHENTICATION & USER APIS
# ==========================================

@app.post("/api/auth/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    """Register a new user with email and password."""
    # Check if user already exists
    user = db.query(models.User).filter(models.User.email == user_in.email).first()
    if user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered."
        )
    
    # Hash the password and save to DB
    hashed_password = security.get_password_hash(user_in.password)
    new_user = models.User(
        email=user_in.email,
        full_name=user_in.full_name,
        phone_number=user_in.phone_number,
        hashed_password=hashed_password,
        role="customer"
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@app.post("/api/auth/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Authenticate user and return a JWT token."""
   # Tìm user có email HOẶC phone_number khớp với dữ liệu nhập vào
    user = db.query(models.User).filter(
        or_(
            models.User.email == form_data.username,
            models.User.phone_number == form_data.username
        )
    ).first()
    
    # Check if user exists and password is correct (Return same error for both to enhance security)
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    # Generate JWT Token (60 minutes expiry is set in security.py)
    access_token = security.create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/api/auth/me", response_model=schemas.UserResponse)
def get_my_profile(current_user: models.User = Depends(deps.get_current_user)):
    """Get the profile data of the currently logged-in user."""
    return current_user


@app.get("/api/admin-only")
def admin_data(current_user: models.User = Depends(deps.require_role("admin"))):
    """Test endpoint for Admin role."""
    return {"message": f"Welcome Admin {current_user.full_name}, you have access to this data."}


# ==========================================
# 2. SERVE FRONTEND FROM ROOT DIRECTORY
# ==========================================
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
app.mount("/", StaticFiles(directory=BASE_DIR, html=True), name="frontend")