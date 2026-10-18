# Agent — release

Project charter for the **release** role: this project's release is a Chrome Web Store package, uploaded by
the owner.

Role of record: `skills/release/SKILL.md` in the akmon standard (`akmon path` prints its root). For the
`package` subject it defers to the commands below; the procedure, gates and owner handoff are owned by the
project skill [webstore-release](../../skills/webstore-release/SKILL.md) — do not restate them here.

## Commands

- Tests: `npm run test:tools`
- Release check: `npm run release:check`
- Build: `npm run release:pack` → `assistant-ext.zip` (gitignored)

## Version carriers

`extension/manifest.json` `version`, `package.json` `version`, and the top `## <version>` of
`extension/CHANGELOG.md` (not a root `CHANGELOG.md`) — the shared release check does not read the first and
the last, so `npm run release:check` is the version gate.
