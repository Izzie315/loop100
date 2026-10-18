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

- All direct and loop attachment deliveries use shared on-demand normalization and sequential chunked uploads, retaining drafts on failure and cleaning incomplete batches to avoid mobile memory pressure and orphaned files.
- Private attachment reads authorize every referenced path in both legacy media fields and attachment arrays against note participation or group membership; never make the bucket public to repair rendering.
- Conversation scrolling stays inside its own container and follows new content only when already near the bottom; media frames reserve space to prevent load-induced reading jumps.
- First-visit preferences use shared pure helpers with regression tests; saved appearance choices override the default.
