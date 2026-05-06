from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URI") or os.getenv("MONGODB_URL") or "mongodb://localhost:27017"
client = MongoClient(MONGODB_URL, serverSelectionTimeoutMS=5000)
db = client["mediconnect"]
