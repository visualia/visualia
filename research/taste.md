# Taste: learning it, sharing it, and homogenisation

How taste can be learned from people's nudges, how a person's taste relates to
a class's, and the evidence that AI use makes work look alike. Background for
`plans/taste-rules.md`; the limits on what may be inferred are
`plans/backstage.md`.

Gathered 2026-10-24 to 2026-11-02 in a claude.ai chat and brought in with the
handoff of 2026-11-02. Prices, benchmarks and release claims are as published
by their makers unless marked otherwise and were not checked here; check them
before relying on them.

## Learning taste from nudges

### Three layers, instant to slow

1. **Preferential Bayesian optimisation (session):** works from relative
   judgements with few queries. *BO as Assistant* (Koyama and Goto, UIST 2022)
   suggests designs just by observing slider use. *Sequential Gallery*
   (SIGGRAPH 2020): pick the best from a 2D grid of options. *Meta-PO*: priors
   from earlier users make new optimisations faster, so a class can warm-start
   each student.
2. **Readable rules from edits (across sessions):** PRELUDE / CIPHER
   (NeurIPS 2024). An LLM compares the original and the edited version and
   writes a preference that explains the change; preferences are retrieved
   from similar contexts and combined. No fine-tuning; users can read and
   change the learned preferences. Reported edit reductions: 31% on
   summaries, 73% on emails.
3. **Fine-tuning a decision model (weeks):** Cloudflare's pipeline: AI
   Gateway captures traffic → tasks and rewards → rollouts on Workers AI →
   reward code in Containers → trainer → redeploy. Training pushes stated
   probabilities toward observed frequencies.

### CIPHER and Clef together

```
nudge (before → after)
  → Clef: kind of change? taste | fix | content       (skip if not taste)
  → CIPHER (LLM): which preference explains this?      → a rule in words
  → stored: {rule, context, person, weight}

next generation:
  retrieve similar rules (embeddings)
  → Clef: does rule X apply here?        yes/no + p
  → LLM generates with chosen rules
  → Clef: does the result follow rule X? yes/no + p
       confident no → fix; unsure → show the rule, ask; yes → done
  → student leaves it (weight +1) or nudges against it (−1, rewrite)
```

- CIPHER writes the questions; Clef answers them fast with probabilities.
- Every rule is already a typed question, so it can run as a Judgement Machine
  over everyone's work; similar rules cluster, and the teacher can promote a
  cluster into a school skill.
- Caveats: Clef has no published calibration and nothing on Estonian; rules
  can conflict, so retrieve per context (project type).

### The small taste scorer (optional)

- Logistic regression or a small MLP over layout metrics plus an image
  embedding, trained with a Bradley–Terry loss on nudge pairs (after >
  before). Trains in milliseconds; a few KB; runs in WASM, a Worker or a
  board page.
- It judges **results** (board states), learning from a gesture's start and
  end, not the gesture's path.
- Needed only for (a) personal snapping and suggestions while dragging,
  (b) ranking many candidates without model calls. Otherwise CIPHER + Clef
  cover it.
- It is preference learning (a reward model), not RL. It becomes RL only when
  something is trained against it.

### What recent research says

- **Efficient Personalization of Generative UIs** (April 2026): 20 designers
  judged the same 600 UIs; low agreement (average kappa 0.25), and the same
  concepts (hierarchy, cleanliness) were defined differently. A new user is
  represented in terms of earlier designers; global preference works best as
  a shared prior for personal adaptation.
- **DesignPref:** per-designer models beat pooled judges.
- **PAT:** a shared low-dimensional preference space plus per-user weights
  from pairwise history, guiding a frozen generator.
- **Layout-HF100k / Uni-Layout:** a 100k human-preference layout dataset.

Sources:
- https://koyama.xyz/project/bo-as-assistant/
- https://koyama.xyz/project/sequential_gallery
- https://arxiv.org/html/2507.15355v1 (Meta-PO)
- https://www.microsoft.com/en-us/research/publication/aligning-llm-agents-by-learning-latent-preference-from-user-edits/
- https://ai-tldr.dev/models/clef/ (RL fine-tuning loop)
- https://arxiv.org/abs/2604.09876
- https://arxiv.org/pdf/2511.20513 (DesignPref)
- https://arxiv.org/html/2610.09015 (PAT)
- https://arxiv.org/html/2508.02374v1 (Uni-Layout)

## Taste: individual and collective

- **Structure:** a collective prior (class, school) plus a personal residual.
  A new student starts from the collective; nudges move them toward their own.
- **Risk:** the collective average is the median design, i.e. bland. Use it as
  a reference ("how typical is this?"), not a target.
- **Plural tastes:** cluster nudges into schools of taste; show which ones a
  student is near. Individual taste is measurable as distance from the
  collective; novelty is a signal.
- **Skills vs taste:** skills are explicit (written, curated, shareable:
  competence); taste is implicit (learned from practice: judgement).
  CIPHER-style rules are the bridge: nudges → personal rules → promoted into a
  school skill.

### Earlier art and research

- **Birkhoff, *Aesthetic Measure* (1933):** M = order / complexity.
- **Max Bense, Abraham Moles:** information aesthetics, Stuttgart 1950s–60s;
  the background of Nake and Nees.
- **Harold Cohen, AARON (from 1973):** taste encoded as rules by hand.
- **Karl Sims, *Genetic Images* (1993), *Galápagos* (1997):** visitors select,
  forms evolve.
- **Latham and Todd, Mutator (1990s):** the artist as gardener of evolution.
- **Electric Sheep (Scott Draves, 1999):** a distributed screensaver; machines
  render fractal flames, viewers vote, popular sheep breed. A transient pool
  plus collective taste, decades earlier.
- **Picbreeder (Secretan, Stanley et al., 2008):** collective evolution by
  continuing others' images; greatness through lineages, not goals (Stanley,
  *Why Greatness Cannot Be Planned*).
- **Komar and Melamid, *People's Choice / Most Wanted Paintings*
  (1994–97):** polled national tastes and painted the averages: kitsch.

Lesson for Visualia: collective taste works as selection and lineage, and
fails as an average. Show tastes as plural and comparable, make novelty
visible, let tastes be forked like projects.

## Homogenization and ways out

### Evidence

- A Duke study of 69 models from 12 providers (2023–2026) found a
  statistically significant decline in output diversity across generations.
- A systematic review and meta-analysis (de Rooij and Biskjaer, 2026): a small
  but significant homogenization effect with AI use; individual creativity
  can rise while collective diversity falls.
- Hintze et al. (January 2026): in repeated text → image → text loops, only
  certain meanings survive; AI-mediated culture favours the familiar, the
  describable and the conventional.
- Web vibe coding (Shin et al.): replacing intentional choices with
  probabilistic defaults drives convergence to the dominant aesthetic;
  proposes productive friction.
- AHFE 2026: niche, diversified datasets and iterative human–computer
  collaboration against similarity.

### Moves for Visualia and EKA

1. **Material instead of words:** field-collected vernacular material (signs,
   lettering, packaging, zines, patterns, handwriting) as the base; AI composes
   with it.
2. **Turn the taste model around:** the collective model as a cliché detector;
   reward distance from it (novelty search, Picbreeder). "Does this look like
   the average AI look?" as a no-gate.
3. **An anti-skill:** the AI look written down as prohibitions (centred hero,
   purple gradient, rounded cards, Inter, three-column feature grids, cheerful
   stock phrases); students add to it.
4. **Small, old and strange models as material;** base models without chat
   tuning.
5. **Niche LoRAs from class corpora** ("Tallinn signs", "zines"), using the pool.
6. **Rules and chance:** Vorkurs, Oulipo, Fluxus-style constraints.
7. **Multicultural and multilingual, carefully:** work with communities and
   archives; credit, consent, CARE principles for Indigenous material.
8. **Plurality on the board:** show distributions, highlight outliers;
   Komar and Melamid as the warning.

Sources:
- https://www.unite.ai/?p=455305 (on arXiv 2608.19437)
- https://research.tilburguniversity.edu/en/publications/does-generative-ai-make-us-think-alike-a-systematic-review-and-me-2/
- https://cobbcountycourier.com/2026/01/ai-induced-cultural-stagnation-is-no-longer-speculation-−-its-already-happening/
- https://www.alphaxiv.org/abs/2603.13036 (vibe coding)
- https://openaccess-api.cms-conferences.org/articles/download/978-1-964867-79-3_11
