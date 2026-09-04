# Data Model: news-general-tagging-clean

## Entity Relationship

```
+------------------------------------+
|            TradingPair             |
+------------------------------------+
| id          : Int (PK)             |
| symbol      : String (Unique)      |
| baseAsset   : String (e.g. BTC)    |
| quoteAsset  : String (e.g. USDT)   |
| isActive    : Boolean              |
+------------------------------------+
                  |
                  | extracts active baseAssets
                  v
+------------------------------------+
|            NewsArticle             |
+------------------------------------+
| id             : String (PK)       |
| title          : String            |
| content        : String            |
| source         : String            |
| url            : String (Unique)   |
| publishedAt    : DateTime          |
| crawledAt      : DateTime          |
| relatedCoins   : String[]          |  <-- ['BTC'], ['ETH'], or ['GENERAL']
| sentimentScore : Float?            |
| sentimentLabel : String?           |
+------------------------------------+
```

## Schema Changes
No database schema alterations required.
`relatedCoins: String[]` supports `['GENERAL']` out-of-the-box in PostgreSQL.
Indexed by `@@index([relatedCoins])`.
