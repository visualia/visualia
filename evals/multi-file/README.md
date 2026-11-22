# Multi-file

How models write several files through tool calls. `capture.mjs` runs a loop of
up to 6 model calls over an in-memory file system (`read`, `ls`, `write`,
`edit`, `delete`). Step 0, the stream capture, is in `plans/multi-file.md`
"Capture"; the five eval tasks are `plans/local-coding.md` section 7.

## Run

```sh
cd evals/multi-file
node capture.mjs --local http://127.0.0.1:11434/v1 gemma4:26b       # step 0 cases: auto, required, serial, edit, big
node capture.mjs --local http://127.0.0.1:11434/v1 --tasks all gemma4:26b   # the five tasks, 2 runs
node capture.mjs --local http://127.0.0.1:11434/v1 --tasks punane,viga --runs 1 gemma4:26b
node capture.mjs --tasks all @cf/deepseek-ai/deepseek-v4.1-flash-1017       # cloud reference, through the gateway
node tasks-test.mjs                                                  # the task checks on hand-made answers, no model, no browser
```

## The five tasks

Briefs in Estonian in `tasks.json`, the fixed starting sites in `fixtures/`.
A fixture is shown to the model as `read` results after the brief.

| id | task | passes when |
| --- | --- | --- |
| `spiraal` | the first-pages spiral brief as `index.html`, `style.css`, `main.js` | the four checks; the three files exist; `index.html` links both by relative path; no absolute or broken links |
| `punane` | "Tee mõlema lehe põhipealkiri punaseks." on `fixtures/punane/` (two pages, `style.css`, `main.js`) | the four checks on both pages; every `h1` renders red; `style.css` differs from the fixture only in the colour of an `h1` rule (an added `h1 { color }` rule is allowed); `main.js` unchanged |
| `viga` | `fixtures/viga/` throws `Cannot set properties of null`, the error text is in the brief | `html` and `clean`; the page shows a running time and the greeting; `style.css` unchanged; `index.html` keeps its texts and links |
| `kivid` | the first-pages three.js stones brief, three files, three.js through an import map | the four checks; the map is JSON, maps `three` to cdnjs or jsdelivr with an exact `x.y.z` version; something imports `'three'` by its bare name; that URL answered under 400 in the page |
| `plakat` | the first-pages poster brief, word for word | the four checks; `Kunstiakadeemia`, `14. märts`, `12–18`, `Põhja pst 7`, `Tallinn` all in the page's rendered text (NFC, whitespace collapsed, case and dash exact) |

The four checks are first-pages': `html` (a whole document), `clean` (no
console error or page error), `visible` (at least 12 coarse colours in a
375 × 667 screenshot), `fits` (scroll width at most 376 px). `page-checks.mjs`
serves the written folder on a free 127.0.0.1 port (module scripts do not load
from `file://`) and runs them in Playwright's Chromium, launched after a task's
model loop and closed before the next call.

- A task's system prompt is step 0's plus the first-pages page rules (Estonian
  text, 375 px, libraries from cdnjs or jsdelivr with an exact version).
- Out, per model, beside step 0's files: `r<run>-<task>/` the project as real
  folders, `r<run>-<task>-<page>.png` the screenshots, `r<run>-<task>-s<step>.json`
  and `.sse` per call, and `turns.json` with `checks` (every result and the
  `failed` reasons) and `pass` per task. The run's tables are printed at the end
  and `out/local-turns.json` (or `out/turns.json`) holds the run.
- `pass` is `null` when the browser could not run; the static checks still read.
- `out/` is not in git (`evals/*/out/`).
