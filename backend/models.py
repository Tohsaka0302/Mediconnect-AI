from sqlalchemy import Column, Integer, String, Date
from database import Base

class Patient(Base):
    __tablename__ = 'patients'
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    gender = Column(String)
    dob = Column(Date)
