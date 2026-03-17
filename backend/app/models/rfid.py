from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Integer, DateTime, Boolean
from datetime import datetime
from app.db.session import Base

class RFIDBinding(Base):
    __tablename__ = 'rfid_bindings'
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True)
    tag_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    blockchain_id: Mapped[str] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    active: Mapped[bool] = mapped_column(Boolean, default=True)

class RFIDScan(Base):
    __tablename__ = 'rfid_scans'
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tag_id: Mapped[str] = mapped_column(String(64), index=True)
    valid: Mapped[bool] = mapped_column(Boolean, default=False)
    user_id: Mapped[int] = mapped_column(Integer, nullable=True)
    tourist_uuid: Mapped[str] = mapped_column(String(64), nullable=True)
    scanned_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
