"""
VADER Sentiment Intensity Analyzer
Sourced from research.md D1 & kb/ADR/0009-sentiment-service-as-separate-process.md
Owner: Thuan
"""

from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

_vader = SentimentIntensityAnalyzer()

# Sentiment Labels (matching kb/contracts/news.yaml & SentimentLabel enum)
LABEL_POSITIVE = "POSITIVE"
LABEL_NEGATIVE = "NEGATIVE"
LABEL_NEUTRAL = "NEUTRAL"

# VADER Compound Score Thresholds (matching workspace/libs/shared/src/constants/news.constants.ts)
VADER_POSITIVE_THRESHOLD = 0.05
VADER_NEGATIVE_THRESHOLD = -0.05


class SentimentAnalyzer:
    """
    VADER Sentiment Analyzer computing compound scores in range [-1.0, 1.0]
    and classifying into POSITIVE, NEGATIVE, or NEUTRAL.
    """

    @staticmethod
    def analyze(text: str) -> dict:
        if not text or not text.strip():
            return {"score": 0.0, "label": LABEL_NEUTRAL}

        scores = _vader.polarity_scores(text)
        compound = scores["compound"]

        if compound >= VADER_POSITIVE_THRESHOLD:
            label = LABEL_POSITIVE
        elif compound <= VADER_NEGATIVE_THRESHOLD:
            label = LABEL_NEGATIVE
        else:
            label = LABEL_NEUTRAL

        return {"score": round(float(compound), 4), "label": label}
