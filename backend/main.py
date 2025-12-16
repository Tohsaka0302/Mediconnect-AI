from fastapi import FastAPI
from database import Base, engine
from routers import patients
from database import init_db

app = FastAPI()

# Create tables
Base.metadata.create_all(bind=engine)
init_db()
# Register routes
app.include_router(patients.router, prefix="/api")
