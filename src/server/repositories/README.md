# server/repositories — Data access (placeholder)

**Repositories** encapsulate all Prisma/database access in later phases.
Application services reach the database only through repositories — no raw
Prisma queries leak into use-cases (and the chat soft-delete filter lives here,
centralized).

Phase 1: intentionally empty. No business implementation.

See `docs/ARCHITECTURE.md` §8.2 and `docs/DATABASE.md`.
