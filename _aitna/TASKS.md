# TASKS — project backlog

The single backlog for this project. **Index, not a document:** one line per task, detail by
reference; a finished entry moves to `TASKS_ARCHIVE.md`. No dates — git history is the
timeline. Format (akmon `pipelines/tasks.md`):

`- <id> · <title> · <status> · <goal, 12 words max> · [detail](link)`

The id is typed — `A` architecture · `C` code · `N` analysis · `L` learning · `V` release —
and the owning role follows from that letter, so it is not a separate field. Status is one of
`active | blocked | deferred | done`.

- A2 · import the js language profile · blocked · import akmon `js` profile in AGENTS.md once akmon ships it
- C2 · verify chrome-devtools MCP live · active · new session: approve server, snapshot/click on a signed-in chart · [detail](skills/tv-browser-test/SKILL.md)
- C1 · pin the test runner · active · record `[test].runner` in `_aitna/.akmon.toml`, reusing this project's manager
