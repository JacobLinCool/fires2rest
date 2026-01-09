# fires2rest

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
