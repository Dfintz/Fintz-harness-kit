# `_template` — blank domain pack

Copy this directory to author a new domain pack:

```bash
cp -r .github/harness/domains/_template .github/harness/domains/<your-pack>
```

Then, in the copy:

1. **`pack.json`** — set `name` to `<your-pack>` (must equal the directory name), fill `title` /
   `industry` / `deliverableKind`, relabel the `stages`, write the five `gates`, and pick the
   `checks` (compose the shared checks in `scripts/harness/domain-checks/`; add a new one only if no
   existing check covers your rule). Update `loops` to your renamed loop basenames.
2. **`samples/good.md`** — a realistic deliverable that passes **every** check.
   **`samples/broken.md`** — a flawed one that fails **at least one** (ideally several).
3. **`loops/`** — rename `template-validate.json` → `<prefix>-validate.json` and
   `template-review.json` → `<prefix>-review.json`; set each file's internal `name` to match, and
   update the `instructions`/`skills` references. Unique loop basenames avoid collisions when
   `domain-pack activate` copies them into `.github/harness/loops/`.
4. **`STAGES.md`, `gates.md`, `skills/SKILL.md`, `config.preset.json`** — replace the placeholders.
5. **Prove it:** `node scripts/harness/domain-pack.mjs --self-test` must stay green. The `_template`
   directory itself is skipped by discovery (leading underscore), so it is never validated or listed.

See [`../README.md`](../README.md) for the full domain-pack model and the shared check catalog.
