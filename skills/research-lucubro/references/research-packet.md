# Research Packet Contract

Return a compact semantic packet. JSON is preferred when the host requests machine-readable output; otherwise preserve these fields exactly in structured Markdown.

## Required fields

- `objective`: the research question this packet answers.
- `audience_context`: what the downstream user is trying to accomplish.
- `observed_at`: observation date/time when current facts matter.
- `claims[]`:
  - `id`: stable local claim id.
  - `statement`: concise claim.
  - `kind`: `source_fact`, `synthesis`, or `recommendation`.
  - `confidence`: `high`, `medium`, or `low`.
  - `evidence_refs[]`: ids into `evidence`.
  - `notes`: optional qualification or conflict note.
- `evidence[]`:
  - `id`: stable local evidence id.
  - `source_type`: web page, paper, standard, dataset, repo file, Lucubro Evidence, or other truthful type.
  - `title`.
  - `publisher_or_owner`.
  - `locator`: URL, document id, repo path, dataset id, or other inspectable locator.
  - `published_or_updated_at`: when known.
  - `observed_at`: when current/volatile.
  - `supports_claim_ids[]`.
- `media_candidates[]`:
  - `id`.
  - `purpose`.
  - `source_page`.
  - `asset_locator`: when available.
  - `publisher_or_owner`.
  - `rights_status`: `permitted`, `restricted`, `unknown`, or a more precise truthful value.
  - `supports_claim_ids[]`.
- `uncertainties[]`: unresolved claims, conflicts, or missing access.
- `handoff`: the smallest useful summary for the next synthesis/teaching step.

## Quality rules

- Prefer several strong sources over many weak ones.
- Do not include raw source dumps.
- Do not add a claim to `claims` only because it sounds plausible.
- A recommendation must identify which source facts it synthesizes.
- If evidence is too weak for downstream teaching, say so in `handoff`.
