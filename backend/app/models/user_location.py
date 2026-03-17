from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Integer, Float, DateTime
from datetime import datetime
from app.db.session import Base

class UserLocation(Base):
    __tablename__ = 'user_locations'
    user_id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
