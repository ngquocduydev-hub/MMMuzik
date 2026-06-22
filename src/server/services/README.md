# server/services — Application logic (placeholder)

Application **use-cases / services** live here in later phases: the functions
that orchestrate a command or query (load aggregate → apply domain rule →
persist → broadcast/invalidate). They depend only on repositories and
infrastructure ports, and are invoked by **both** REST route handlers and
Socket.IO event handlers — never duplicate business logic across transports.

Phase 1: intentionally empty. No business implementation.

See `docs/ARCHITECTURE.md` §8.2 and `docs/REALTIME_ENGINE.md` §4.
