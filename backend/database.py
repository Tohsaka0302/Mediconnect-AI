from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Replace with your real PostgreSQL credentials
DATABASE_URL = "postgresql://mediconnect_user:securepassword123@localhost:5432/mediconnect"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()

# Create tables on app startup
def init_db():
    import models  # This ensures models are registered
    Base.metadata.create_all(bind=engine)
