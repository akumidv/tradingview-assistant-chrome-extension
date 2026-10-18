---
name: changelog
description: Writes this extension's CHANGELOG.md entry in its project format — a user summary that becomes the popup "What's new" notice, plus a "### Details" part holding only what neither the summary nor git can tell. Use in the same task whenever a change to extension/ alters behaviour, options, messages or anything users, fork maintainers or auditors would notice, and whenever a release (e.g. the release skill) writes CHANGELOG.md. Triggers on "update the changelog", "add to CHANGELOG", "what's new", "release notes".
metadata:
  owner: project
---

# changelog

[`extension/CHANGELOG.md`](../../../extension/CHANGELOG.md) is the release record for three readers: users,
maintainers of forks and clones, and auditors. It records what users notice and what the code history can not
tell them. Update it in the same task that makes the change, not at release time.

## Format

One `## <version>` section per release, newest first; the version is the one in `extension/manifest.json`
(add to the current section while the version is unreleased). Two parts:

- **Summary** (no heading) — what a user reads and cares about: new features, visible improvements, fixes in
  user terms. A few short lines. The popup shows it once after an update as the "What's new" notice and again
  only when the summary text changes.
- **`### Details`** — only information that is **not in the summary** and **can not be recovered from the
  commits and diff**: behaviour and its limits (when an option applies, what happens on a fallback), reasons
  and trade-offs (why off by default, risks), what a user has to do differently. Omit it when there is
  nothing beyond the summary.

Never in either part: a repeat of a summary line in Details, files, functions, return shapes, code, small
fixes or commit history — git has those.

## Rendering constraints

The popup renders the file itself ([assistant.js](../../../extension/popup/assistant.js): `splitChangelog`,
`getChangelogSummary`, `renderChangelogSection`):

- the "What's new" notice is the section cut at its **first `### ` line**, so every `###` subsection is
  hidden from the notice and shown only in the Help tab, collapsed under its `###` heading;
- only this Markdown subset renders: `### ` subheadings, `- ` items (an indented line continues an item),
  paragraphs, `**bold**`, `[text](https://link)`; anything else shows as raw text;
- the text before the first `## ` heading is a note for editors and is not shown.

## Steps

1. Read the current top section of `extension/CHANGELOG.md` and the version in `extension/manifest.json`.
2. Put the user-visible effect of the change into the summary — merge into an existing line when it extends
   one (e.g. add to the "Fixes" line) instead of adding a new line.
3. Add to `### Details` only what step 2 left out and git can not tell; drop Details lines the change made
   obsolete.
4. Write in English, plain words, lines wrapped at about 115 characters.
