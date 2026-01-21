from pymongo import MongoClient

# Replace with your real MongoDB connection string
MONGODB_URL = "mongodb://localhost:27017"
client = MongoClient(MONGODB_URL)
db = client["mediconnect"]
