import os
from fastapi import FastAPI, Depends, HTTPException, status, Query
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List

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
# CONCERTS API (TASK 48)
# ==========================================

@app.get("/api/concerts", response_model=schemas.PaginatedConcertsResponse)
def get_concerts(
    search: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    sort_by: Optional[str] = None,
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    query = db.query(models.Concert)

    # 1. Tìm kiếm theo từ khóa (Title hoặc Artist)
    if search:
        query = query.filter(
            (models.Concert.title.ilike(f"%{search}%")) | 
            (models.Concert.artist.ilike(f"%{search}%"))
        )
    
    # 2. Lọc theo Category và Status
    if category:
        query = query.filter(models.Concert.category == category)
    if status:
        query = query.filter(models.Concert.status == status)
        
    # 3. Sắp xếp (Theo ngày hoặc giá)
    if sort_by == "date":
        query = query.order_by(models.Concert.date)
    elif sort_by == "price":
        query = query.order_by(models.Concert.priceRange)

    # 4. Phân trang
    total = query.count()
    pages = (total + size - 1) // size
    items = query.offset((page - 1) * size).limit(size).all()

    return {
        "items": items,
        "total": total,
        "page": page,
        "size": size,
        "pages": pages
    }

@app.get("/api/concerts/{id}", response_model=schemas.ConcertResponse)
def get_concert(id: str, db: Session = Depends(get_db)):
    concert = db.query(models.Concert).filter(models.Concert.id == id).first()
    
    if not concert:
        raise HTTPException(status_code=404, detail="Concert not found")
        
    return concert
@app.post("/api/concerts/seed")
def seed_concerts(concerts: List[schemas.ConcertResponse], db: Session = Depends(get_db)):
    count = 0
    for c in concerts:
        # Kiểm tra xem concert đã tồn tại chưa để tránh bị lặp
        existing = db.query(models.Concert).filter(models.Concert.id == c.id).first()
        if not existing:
            new_concert = models.Concert(
                id=c.id, title=c.title, artist=c.artist, date=c.date, time=c.time,
                location=c.location, priceRange=c.priceRange, poster=c.poster,
                banner=c.banner, category=c.category, status=c.status,
                ticketsSold=c.ticketsSold, ticketCapacity=c.ticketCapacity,
                description=c.description
            )
            db.add(new_concert)
            
            # Thêm các hạng vé tương ứng
            for t in c.tickets:
                new_ticket = models.TicketClass(
                    concert_id=c.id, type=t.type, price=t.price, status=t.status
                )
                db.add(new_ticket)
            count += 1
            
    db.commit()
    return {"message": f"Successfully seeded {count} concerts into the database!"}


# ==========================================
# 2. SERVE FRONTEND FROM ROOT DIRECTORY
# ==========================================
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
app.mount("/", StaticFiles(directory=BASE_DIR, html=True), name="frontend")