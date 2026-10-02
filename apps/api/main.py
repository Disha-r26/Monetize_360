from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Monetize360 Universal Dynamic Pricing API",
    description="Deterministic dynamic pricing operations engine API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {
        "service": "Monetize360 Universal Dynamic Pricing Engine",
        "status": "online",
        "version": "1.0.0",
        "architecture": "domain-agnostic pure decimal engine"
    }

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "engine": "ready",
        "copilot": "offline_ready"
    }
