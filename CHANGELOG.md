# fires2rest

## 0.2.0

### Minor Changes

- [#8](https://github.com/JacobLinCool/fires2rest/pull/8) [`a10ad0b`](https://github.com/JacobLinCool/fires2rest/commit/a10ad0b907ce6a90b5097e420e6c2b16e0dd4f05) Thanks [@JacobLinCool](https://github.com/JacobLinCool)! - Add comprehensive query support for collections
    - New `Query` class with fluent API for building Firestore queries
    - Filter methods: `where()` with operators `==`, `!=`, `<`, `<=`, `>`, `>=`, `array-contains`, `in`, `not-in`, `array-contains-any`
    - Order methods: `orderBy()` with ascending/descending direction
    - Limit methods: `limit()`, `limitToLast()`, `offset()`
    - Cursor pagination: `startAt()`, `startAfter()`, `endAt()`, `endBefore()`
    - Field projection: `select()`
    - Query execution: `get()` returns `QuerySnapshot`, `count()` returns aggregate count
    - `CollectionReference` now extends `Query` and inherits all query methods

## 0.1.3

### Patch Changes

- [#6](https://github.com/JacobLinCool/fires2rest/pull/6) [`cd2e38d`](https://github.com/JacobLinCool/fires2rest/commit/cd2e38d6f4957733179880347a91cbfb87ce11a9) Thanks [@JacobLinCool](https://github.com/JacobLinCool)! - Add user-provided token support

    Introduces TokenConfig to allow Firestore clients to authenticate using a user-provided token function, in addition to service account credentials.

## 0.1.2

### Patch Changes

- [#4](https://github.com/JacobLinCool/fires2rest/pull/4) [`1e13275`](https://github.com/JacobLinCool/fires2rest/commit/1e132753f68c37403bffcb224ec569d0fe7e1b7d) Thanks [@JacobLinCool](https://github.com/JacobLinCool)! - Fix field path quoting for dot-notation keys with multiple segments

## 0.1.1

### Patch Changes

- [#2](https://github.com/JacobLinCool/fires2rest/pull/2) [`3c18364`](https://github.com/JacobLinCool/fires2rest/commit/3c183647f0e6e67944bcf587121e84df5b6d636d) Thanks [@JacobLinCool](https://github.com/JacobLinCool)! - Fix field path quoting for segments with special characters

    Field paths containing segments with special characters (like hyphens, spaces, or characters that don't match the pattern `[a-zA-Z_][a-zA-Z_0-9]*`) are now properly quoted with backticks as required by the Firestore REST API.

    This fixes errors like:

    ```
    Invalid property path "itemsSold.item-001". Unquoted property paths must match regex...
    ```

    Added utility functions `quoteFieldPathSegment` and `quoteFieldPath` to handle proper escaping, and updated `getFieldPaths`, `extractFieldTransforms`, `extractDeleteFields`, and `extractTransformFields` to use them.

## 0.1.0

### Minor Changes

- [`f9f5432`](https://github.com/JacobLinCool/fires2rest/commit/f9f543250e0dfcfb1bc416ef10d8e7682b3190f7) Thanks [@JacobLinCool](https://github.com/JacobLinCool)! - First release from GitHub Actions

### Patch Changes

- [`d6fbbe1`](https://github.com/JacobLinCool/fires2rest/commit/d6fbbe18cbb173c0cbac873f26b8135565a04b53) Thanks [@JacobLinCool](https://github.com/JacobLinCool)! - Export all types
