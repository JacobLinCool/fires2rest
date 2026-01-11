---
"fires2rest": minor
---

Add Firebase Emulator support with `Firestore.useEmulator()` static factory method

- New `useEmulator()` method for connecting to local Firebase emulator
- Refactored authentication to use `Auth` interface with `ServiceAccountAuth` and `NoAuth` implementations  
- New `useServiceAccount()` static factory method for cleaner API
- Updated internal methods to use configurable API base URL
- Fixed document reads within transactions to use batchGet for proper transactional consistency
