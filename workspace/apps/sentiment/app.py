"""
Crypto Strategy Lab — Sentiment Analysis Service
Owner: Thuan

FastAPI service for ML-based sentiment analysis.
Called internally by the NestJS backend via POST http://localhost:8000/analyze
Never exposed to the frontend directly.
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from analyzer import SentimentAnalyzer

app = FastAPI(title="Crypto Strategy Lab — Sentiment Service", version="0.1.0")
analyzer = SentimentAnalyzer()


class AnalyzeRequest(BaseModel):
    text: str


class AnalyzeResponse(BaseModel):
    score: float  # -1.0 to 1.0
    label: str  # POSITIVE | NEGATIVE | NEUTRAL


@app.get("/health")
def health_check():
    return {"status": "ok", "model": "VADER"}


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze_text(request: AnalyzeRequest):
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="Text must not be empty")
    result = analyzer.analyze(request.text)
    return AnalyzeResponse(score=result["score"], label=result["label"])
