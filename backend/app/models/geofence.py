from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Integer, Float
from app.db.session import Base

class Geofence(Base):
    __tablename__ = 'geofences'
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    radius_m: Mapped[float] = mapped_column(Float)  # meters
    kind: Mapped[str] = mapped_column(String(20), default='safe')  # safe/unsafe
