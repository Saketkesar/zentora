from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Integer, DateTime, Text, String
from datetime import datetime
from app.db.session import Base


class ItineraryPlan(Base):
    __tablename__ = 'itinerary_plans'
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(200))
    # JSON as text to avoid DB-specific JSON dependency; store shape:
    # {
    #   "start": {"lat": float, "lng": float},
    #   "end": {"lat": float, "lng": float},
    #   "path": [{"lat": float, "lng": float}],
    #   "checkpoints": [{"name": str, "lat": float, "lng": float}]
    # }
    data: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
