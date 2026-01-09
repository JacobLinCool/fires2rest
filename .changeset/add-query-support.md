---
"fires2rest": minor
---

Add comprehensive query support for collections

- New `Query` class with fluent API for building Firestore queries
- Filter methods: `where()` with operators `==`, `!=`, `<`, `<=`, `>`, `>=`, `array-contains`, `in`, `not-in`, `array-contains-any`
- Order methods: `orderBy()` with ascending/descending direction
- Limit methods: `limit()`, `limitToLast()`, `offset()`
- Cursor pagination: `startAt()`, `startAfter()`, `endAt()`, `endBefore()`
- Field projection: `select()`
- Query execution: `get()` returns `QuerySnapshot`, `count()` returns aggregate count
- `CollectionReference` now extends `Query` and inherits all query methods
