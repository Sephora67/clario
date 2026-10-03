<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Admin icon gallery and lesson rendering share one catalog-driven procedural renderer from `board-icons`; previews match lesson videos exactly. Icon removal is reversible visibility state in the DB; hidden icons stay renderable for old lessons but are excluded from new generation; never mislabel an icon.
- The document-first workspace uses `/` for folders, `/cahier` for editing, and `/lecons` for legacy lessons; folder nesting stops at two levels.
- Study data (all study content) lives in Lovable Cloud tables with owner-only RLS, files in the private `clario-files` bucket under `<user_id>/`, via `src/lib/library.ts`; cross-device sync without extra server code.
- Reminders: `generate_my_reminders()` RPC called from the app every minute and on focus (no background cron); avoids 24/7 DB polling.
- All study pages live under `src/routes/_authenticated/`; `/` stays public and shows the dashboard only when signed in.
- Document chat streams through `/api/chat` and stores one `doc_chats` row of UIMessage[] per document; pop-ups use `askText`/`askConfirm` from `src/lib/dialogs.tsx`, never browser dialogs (they show the site address).
- Clario's persona lives in the `/api/chat` SYSTEM prompt: academic tutor, tutoiement, light emoji, soft humour; off-topic 1-2 paragraphs max but course answers unrestricted; no emotional probing; varied "back to studies" transitions only when the chat truly drifted.
- AI calls use the owner's OPENAI_API_KEY directly via src/lib/openai-direct.server.ts (gpt-4.1-mini, gpt-4o-mini-tts); why: owner pays OpenAI, not Lovable credits.
- Text notes keep plain fallback fields plus optional styled runs; this preserves old notes while allowing font, color, and size per selected passage.
- Chat rate limiting: `/api/chat` calls the SECURITY DEFINER RPC `check_chat_rate_limit()` (12 req/min, per-minute window in `chat_rate_limits`) right after auth; fail-closed on RPC error. Why: no standard backend rate-limiting primitive, and the OpenAI key must be protected from scripted abuse.
- Payments: credits (`user_credits`, `credit_ledger` via `purchases`) are server-only; clients read via `my_credits()` and spend via SECURITY DEFINER `consume_credit(kind)` called in `/api/chat` and video generation before any AI call, refunded on failure; grants only through the signed webhook handler at `src/routes/api/public/payments/webhook.ts` calling `apply_purchase()`; the 5-document free limit is a DB trigger. Why: client-side credit state is attacker-controlled.
- New explainer videos store one Kore audio track per scene; the player measures each track's spoken segments so visuals and captions follow the real narration while legacy continuous tracks remain playable.
