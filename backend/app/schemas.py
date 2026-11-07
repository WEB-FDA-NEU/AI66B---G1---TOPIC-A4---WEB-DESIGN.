from typing import List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field
class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    phone_number: str  # New field added
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters")

class UserLogin(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    phone_number: str  # New field added
    role: str
    is_active: bool

    class Config:
        from_attributes = True
class TicketClassResponse(BaseModel):
    type: str
    price: str
    status: str

    model_config = ConfigDict(from_attributes=True)

class ConcertResponse(BaseModel):
    id: str
    title: str
    artist: str
    date: str
    time: str
    location: str
    priceRange: str
    poster: str
    banner: str
    category: str
    status: str
    ticketsSold: int
    ticketCapacity: int
    description: str
    tickets: List[TicketClassResponse] = []

    model_config = ConfigDict(from_attributes=True)

class PaginatedConcertsResponse(BaseModel):
    items: List[ConcertResponse]
    total: int
    page: int
    size: int
    pages: int