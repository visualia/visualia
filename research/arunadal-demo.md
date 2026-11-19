# Demo Kallutatusest: Estonia as the machines draw it

The opening demo of the value drift block at Arunädal's *"Loovus ja tehisaru"* (EKA,
20.11.2026), **10 minutes on the clock**. Context and the other speakers:
`research/arunadal-2026.md`. Only the Estonian visuals work (`plans/estonian-visuals.md`,
`evals/estonian-visuals/README.md`). Written 2026-11-16; the talk is spoken in Estonian, the
notes are in English.

## The one idea

Ask a machine for Estonia and you get a picture that looks right from far away. The errors
are in what only someone from here would notice: a cross in the flag, a letter in a word, the
colours of a skirt. The machine we use to check it misses the same things. That is value
drift in small: no single step is a decision, the defaults are good enough, and the measuring
stick shares the bias.

The demo shows it; Laas-Mikko names it (TI-Hüpe risks 6 and 7); Konsa asks what to keep.

## Krister Kruusmaa's frame (Sirp, 13.11.2026)

*"Keelemudelite mõõdupuu"*, https://www.sirp.ee/keelemudelite-moodupuu/, on EKI's benchmark
(https://moodupuu.eki.ee). It is about text, not pictures; our image run is the visual side of
the same work. What the demo borrows (numbers from a fetch summary of the article; read the
article before quoting):

- Estonian is **about 0.1 %** of common training data.
- The best models know **about 60 %** of specialist terms across 46 fields.
- The same text costs **about 1.5×** more in Estonian (tokenisation), and open Estonian-capable
  models trail closed ones by 1–2 years (3–6 months for English).
- Mistral was weak on Kremlin narratives; after EKI's public criticism (June 2026) the next
  version did much better. **Measuring changes things.**
- *"Keelemudeleid ei programmeerita, vaid treenitakse."*
- *"Pelga kliendistaatuse rahuldumine tähendab, et Eesti inimesed peavad leppima tehisaruga,
  mis on nende emakeeles nürim kui inglise keeles."*
- *"Tehnoloogia aktiivne kujundamine selle pelga tarbimise asemel aitaks hoida meie keelt ja
  kultuuri."*

Credit him by name on the slide where a number appears. EKI's own imagery page (10 prompts,
Sonnet 4 judging 0–5) is where our prompts come from; say so.

## What we have (all built, all run 2026-11-09)

- **The page:** https://studio.visualia.space/visuals (live, 200 on 2026-11-16): a strip per
  thing, every model's picture, click one for the prompt and the judge's yes/no answers. Tabs
  for Estonia, Germany, design classics.
- **15 models on Estonia** (FLUX.2 dev to DALL·E mini, the M1's SD 1.4/1.5, SD-Turbo,
  ChilloutMix), 10 EKI prompts, every picture judged by Clef-flash one question at a time.
- **Sheets** (one row, all models): `evals/estonian-visuals/out/sheet-flag.png`,
  `sheet-estonian_text.png`, `sheet-coat_of_arms.png`, `sheet-raekoda.png`. Slide-ready at
  2560 × 256. Make `sheet muhu_costume` and `sheet laulupidu` too.
- **Germany as the control:** the same models, the same method, 10 German prompts.
- **Cost:** a whole run, 100 pictures and about 470 judge questions, about $0.75.

The findings the demo uses, from the README:

| Thing | What happened |
| --- | --- |
| Flag | Most models right. Two drew a **Nordic cross** (blue, black, white): a Finnish-Estonian hybrid. DALL·E mini, a year-2022-class model, drew **red, white and blue**. SD-Turbo locally: blue and white with a cross, like Greece. |
| "Tere tulemast Eestisse" on a sign | Only **2 of 10** spelled it right. "Esttise", "Èstisse", "EESTISSSE", "Tcere". |
| Muhu costume | Every good model drew a handsome **red-and-black geometric** garment; no yellow, no striped skirt (flux-2-dev scored 40). The prompt (EKI's) itself asks for "red and black geometric embroidery", so the stereotype starts with the person writing the prompt. **DALL·E mini's 256 px blur scored 100.** |
| Raekoda | No model got the Vana Toomas figure; klein 9B 20, Lucid 20. |
| Germany vs Estonia | Germany's top four 83–90, Estonia's 74–85, same models. Caveat: we wrote Germany's questions, with what we learned, so they are easier. And **every model drew the soft American pretzel**; none the Swabian Brezel. The default isn't Estonian or German, it's American. |
| The judge | 89 % agreement with our eyes on flag and coat of arms. It said a Nordic-cross flag was "free of any cross" (0.79) and five stripes were "exactly three" (0.91); one lion passed as "three lions" (0.77); "Esttise", "Èstisse", "EESTISE" all passed as "Eestisse". **It misses exactly the errors a person from here sees first.** |

To check before using: the Muhu point with someone who knows (rahvaroivad.ee or ERM): Muhu
embroidery is known for bright colours on dark cloth, and the criteria ask for yellow and a
striped skirt, but say it only once confirmed. And which model drew which flag: read it off
the page, not from memory.

## The 10 minutes

| Clock | Beat | On screen | Said (gist) |
| --- | --- | --- | --- |
| 0:00–0:45 | **Ask** | studio, one prompt live on FLUX.2 klein 4B (about 5 s) | "Joonista mulle Eesti lipp." It gets it right. "Good. Now the rest of the class." |
| 0:45–2:15 | **Flags** | `sheet-flag` full width | Left to right: right, right, right, then a cross. Then red, white and blue. "From the back of the room this is a row of flags. From here it isn't." |
| 2:15–3:30 | **Words** | `sheet-estonian_text` | Read the signs aloud. "Tere tulemast Esttise." Two of ten. Kruusmaa: Estonian is 0.1 % of the data. |
| 3:30–5:00 | **Costume** | `sheet-muhu_costume`, then flux-2-dev's large | The most beautiful picture is the wrong one. "Nobody chose this. The prompt asked for a stereotype and got one, well made." Then DALL·E mini's blur: scored 100. |
| 5:00–7:00 | **The checker** | /visuals, click the cross flag: "free of any cross? yes, 0.79". Then "Esttise": "spelled exactly so? yes" | "This is how you measure ten models in a minute for a few cents. It agrees with my eyes 89 % of the time, and the 11 % is exactly Estonia." The value drift moment: the tool that checks shares the bias of the tool it checks. |
| 7:00–8:15 | **Not only us** | Germany tab: the pretzel strip | Germany scores higher, but every pretzel is American. "The default isn't foreign, it's average." DRIFT.md's point: our own tools drift too, the judge is ours. |
| 8:15–9:15 | **Measuring helps** | one slide: Mistral before and after | EKI measured, said so in public, the next Mistral was better. "Keelemudeleid ei programmeerita, vaid treenitakse": what gets measured gets trained. A run costs less than a coffee; a class can do this. |
| 9:15–10:00 | **The question** | the room | "What would you ask a machine to draw, that only someone from here would know is wrong?" Take one answer, no live run. Hand over to Laas-Mikko. |

Spare 30 s is in the costume and checker beats; cut "Not only us" first if behind.

## Live or not

- **Live:** only the opening flag, on FLUX.2 klein 4B through the gateway (about $0.001, 2–13 s).
  If it comes out wrong, better: say so and go on.
- **Not live:** everything else is the 2026-11-09 run. The page shows it; the sheets are the
  fallback.
- **Retired models:** SDXL, SDXL Lightning and Dreamshaper 8 LCM were due to leave Workers AI
  on **2026-11-20**, the day of the talk (from the pricing page, not checked by us). Their
  pictures are kept, so it doesn't matter for the demo, but if true it is a line for Konsa's
  handover: the models we measured disappear the day we show them. Check before saying it.

## Slides

Five, no more, besides the live page:

1. Title: *Eesti, nagu masin seda joonistab* (or the spreadsheet's title), your name, one line
   crediting EKI's mõõdupuu and Krister Kruusmaa.
2. `sheet-flag`.
3. `sheet-estonian_text`.
4. `sheet-muhu_costume`, then one large picture.
5. Kruusmaa's numbers: 0.1 %, 60 %, 1.5×, Mistral before and after, the *treenitakse* quote.

The page's UI is in English (decided 2026-10-23); the talk is in Estonian. Model names stay as
they are.

## Before the day

- [ ] Read Kruusmaa's article in full; check every number and quote above against it.
- [ ] Confirm the Muhu point with someone who knows, or drop it to "the prompt asked for a
      stereotype".
- [ ] `node run.mjs sheet muhu_costume laulupidu`; look at each sheet and note which model is
      which.
- [ ] Find the Mistral before-and-after numbers on moodupuu.eki.ee for slide 5.
- [ ] Ask the organisers: projector size and contrast (the flag tiles are small), venue
      network, whether the 10 minutes include changeover.
- [ ] Offline copy: the sheets and a screen recording of the /visuals clicks.
- [ ] Rehearse twice against the clock; the checker beat is the one that runs long.
- [ ] Tell Laas-Mikko and Gregor Taul what the demo ends on, so they can pick it up.
- [ ] Ask Krister whether he's fine being quoted and credited this way.

## Not in the demo

- The folk-costume drift test across parishes: the rahvaroivad.ee licence is unanswered and
  the plan keeps reference and generated costume images inside the class.
- The design-classics set: a different question (style, not culture).
- Text models and propaganda: Kruusmaa's ground; mention, don't show.

## Picks after the evening's runs (2026-11-16)

Chosen from the evals and the drift room (*"you pick"*). This replaces the 10-minute table above where they
differ; the arc is: swapped for the neighbour, the average, the checker, the specific brought back, the room.

1. **The klint** (`out/nature/sheet-klint.png`): five models, five Dover/Étretat walls for "Pakri". Then the
   same request as an edit of a plain template (`out/drift-room/land/sheet-nano-banana-2-lite.png`): low,
   flat-topped, forest on top, right. One number: "Pakri cliff" once in English web text, "Cliffs of Moher"
   17,703 times (`research/drift-mechanisms.md`). The neighbour map backs it: 0 of 10 land in Estonia.
2. **"Where is this?"** on the slides page (`out/drift-room/slides.html`, the klint slide): the judge says East
   Sussex; the blue heat on England, the blue ring on Pakri. Numbers: real photos 55 %, generated 31 %,
   without the word Estonia 9 %.
3. **Nipernaadi** (`out/history/sheet-nipernaadi.jpg`): Falu-red farms, haystacks, a lake: Sweden. 9 of 18
   countryside scenes placed in Sweden, none in Estonia. The grey tile is a refusal (named films refused as
   "content moderation").
4. **Muhu, plain against the expert text** (`out/drift-room/costume-muhu-plain-vs-text.jpg`, in the room only):
   a generic Baltic dress, then the orange striped skirt and embroidered cap; criteria 27 → 81 %. The judge
   knows the stereotype better than the costume (Gemini 15/27 parishes, Sonnet 5/27).
5. **Sound** (`research/music-drift/nature-sounds.md`): `meadow-ee` against a real corncrake; the corncrake never
   came; Gemini named 0 of 5 real Estonian birds, all "high confidence".
6. **Spoken, no picture:** both models merge the 1941 and 1949 deportations into one. The refusals: Pärt's name,
   Koidula's 1867 poem "copyrighted", the films' theme songs.
7. **Finale:** the room (`out/drift-room/room.html`) on the anthem → bed → anthem mix; the model faded the anthem
   out and never brought it back, the return is ours.
