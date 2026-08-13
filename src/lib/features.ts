/**
 * Feature flags — single source of truth.
 *
 * Read at module scope ONLY for compile-time constants like this one.
 * Never put anything here that reads process.env at module scope; that is the
 * bug class that has broken /admin, /login and /portal in this codebase.
 */

/**
 * AI Studio — DISABLED 13 Aug 2026.
 *
 * Rationale (decisions log): real user feedback confirmed AI Studio is
 * redundant with the brief form. It was intended to be held as a
 * "coming soon" surface, but the 12 Aug git recovery deployed a build that
 * predates the hide, so both routes reappeared in production.
 *
 * This flag hides EVERYTHING:
 *   - /ai-studio            (public marketing page)  -> 404
 *   - /portal/ai-studio     (client-facing tool)     -> 404
 *   - the NavBar link
 *   - the portal CTA banner and the per-project "Ask AI Assistant" button
 *   - the profile-menu "Projects" entry
 *
 * The three /api/ai-studio/* routes are deliberately LEFT IN PLACE but are
 * unreachable from the UI. They are guarded at the route level so a direct
 * POST also fails closed. No key is required while this flag is false, so
 * ANTHROPIC/DEEPSEEK/OPENROUTER credentials can stay unset.
 *
 * TO RE-ENABLE: set this to true. That is the entire change.
 */
export const AI_STUDIO_ENABLED = false;
