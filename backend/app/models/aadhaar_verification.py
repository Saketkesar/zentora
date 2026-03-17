from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Integer, DateTime
from datetime import datetime
from app.db.session import Base

class AadhaarVerification(Base):
    __tablename__ = 'aadhaar_verifications'
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    front_path: Mapped[str] = mapped_column(String(255))
    back_path: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(16), default='pending')  # pending/approved/rejected
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
