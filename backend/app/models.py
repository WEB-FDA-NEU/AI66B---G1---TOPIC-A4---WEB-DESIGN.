from sqlalchemy import Column, Integer, String, Boolean, Date, Time, Text, ForeignKey, Float
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    phone_number = Column(String(20), nullable=False)  # New field added
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), default="customer")
    is_active = Column(Boolean, default=True)
class Concert(Base):
    __tablename__ = "concerts"

    id = Column(String(50), primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    artist = Column(String(255), nullable=False)
    date = Column(String(50), nullable=False)
    time = Column(String(50), nullable=False)
    location = Column(String(255), nullable=False)
    priceRange = Column(String(100))
    poster = Column(Text)
    banner = Column(Text)
    category = Column(String(100))
    status = Column(String(50))
    ticketsSold = Column(Integer, default=0)
    ticketCapacity = Column(Integer, default=0)
    description = Column(Text)

    tickets = relationship("TicketClass", back_populates="concert", cascade="all, delete-orphan")

class TicketClass(Base):
    __tablename__ = "ticket_classes"

    id = Column(Integer, primary_key=True, index=True)
    concert_id = Column(String(50), ForeignKey("concerts.id"), nullable=False)
    type = Column(String(100), nullable=False)
    price = Column(String(50), nullable=False)
    status = Column(String(50), nullable=False)
    
    concert = relationship("Concert", back_populates="tickets")