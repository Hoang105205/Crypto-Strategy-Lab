"""
Crypto Strategy Lab — Sentiment Analysis Micro-Service
Owner: Thuan

FastAPI service for ML-based VADER sentiment analysis.
Called internally by NestJS SentimentClient via POST http://localhost:8000/analyze
Process Isolation per ADR-0009.
"""

from fastapi import FastAPI, HTTPException
from models import AnalyzeRequest, AnalyzeResponse
from analyzer import SentimentAnalyzer

app = FastAPI(
    title="Crypto Strategy Lab — Sentiment Service",
    description="Python FastAPI VADER ML Sentiment Analysis Process",
    version="1.0.0",
)

analyzer = SentimentAnalyzer()


@app.get("/health")
def health_check():
    """Health check endpoint for process monitoring and readiness probes"""
    return {"status": "ok", "service": "sentiment-fastapi", "model": "VADER"}


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze_text(request: AnalyzeRequest):
    """
    Analyze sentiment score (-1.0 to 1.0) and label (POSITIVE, NEGATIVE, NEUTRAL) for text content
    """
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="Text must not be empty")

    try:
        result = analyzer.analyze(request.text)
        return AnalyzeResponse(score=result["score"], label=result["label"])
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Sentiment processing failed: {str(err)}")
