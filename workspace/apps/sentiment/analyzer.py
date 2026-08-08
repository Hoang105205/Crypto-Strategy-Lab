"""
Sentiment analyzer using VADER.
Swappable for transformer-based models in the future.
"""

from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

_vader = SentimentIntensityAnalyzer()

_LABEL_POSITIVE = "POSITIVE"
_LABEL_NEGATIVE = "NEGATIVE"
_LABEL_NEUTRAL = "NEUTRAL"


class SentimentAnalyzer:
    @staticmethod
    def analyze(text: str) -> dict:
        scores = _vader.polarity_scores(text)
        compound = scores["compound"]

        if compound >= 0.05:
            label = _LABEL_POSITIVE
        elif compound <= -0.05:
            label = _LABEL_NEGATIVE
        else:
            label = _LABEL_NEUTRAL

        return {"score": round(compound, 4), "label": label}
