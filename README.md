# Mediconnect-AI

## Run

Start the FastAPI backend:

```bash
cd backend-ai
uvicorn main:app --reload --port 5000
```

Start the React frontend:

```bash
cd frontend
npm start
```

The frontend and hospital apps use MediConnect API routes on `http://localhost:5000`; that port should now be served by FastAPI instead of the old Node backend.
