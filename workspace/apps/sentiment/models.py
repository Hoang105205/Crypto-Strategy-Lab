"""
Pydantic Request and Response Models for Sentiment Micro-service
Sourced from kb/contracts/news.yaml and contracts/news-api.md
Owner: Thuan
"""

from pydantic import BaseModel, Field


class AnalyzeRequest(BaseModel):
    text: str = Field(..., description="Text content or title to analyze for sentiment")


class AnalyzeResponse(BaseModel):
    score: float = Field(..., description="Compound sentiment score ranging from -1.0 to 1.0")
    label: str = Field(..., description="Classification label: POSITIVE | NEGATIVE | NEUTRAL")
