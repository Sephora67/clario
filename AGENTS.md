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

- The Admin procedural-icon gallery must source paths and washes from `board-icons` so previews exactly match lesson videos.
- The complete procedural icon inventory is catalog-driven; Admin and lesson rendering must use the same procedural renderer so every preview matches video output.
- Procedural icon removal is reversible visibility state in the database; hidden icons remain renderable for existing lessons but are excluded from new lesson generation.
- Never expose a procedural icon under a label it does not visually represent; unfinished concepts stay unavailable until they have a distinct drawing.
- The main product surface is a document-first study workspace: `/` is the folders dashboard, `/cahier` is the document editor, and legacy generated lessons remain under `/lecons`; this keeps the reliable notebook workflow primary without discarding existing lessons.
- Render notebook annotations with separate committed and live-stroke canvases; this avoids repainting every saved mark for each stylus event and keeps pen input responsive.
