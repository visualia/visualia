# How value drift happens: mechanisms and sources

Background for the bias demo at Arunädal (EKA, 20.11.2026, `research/arunadal-demo.md`), which
opens the value drift block with Katrin Laas-Mikko and Kurmo Konsa (`research/arunadal-2026.md`).
The teaching side is `schools/eka/docs/DRIFT.md`. Gathered 2026-11-16.

**How the sources were checked.** Each source below is marked:

- *full text*: the paper or article itself was read where it matters;
- *abstract*: the abstract page (arXiv, ACL Anthology, Europe PMC) was read, not the whole paper;
- *unverified*: seen only in a search result or a summary; do not quote on stage.

Venues are the ones on the paper or its abstract page. Quotes are exact unless marked as a gist.

## The working definition

Drift is not models making mistakes. It is the specific slowly replaced by the probable, with
no single decision, and better models make it more convincing.

The TI-Hüpe risk analysis says nearly the same, in its own words. *TI-Hüppe õpirakenduse ja
haridusprogrammi eetiliste, hariduslike, sotsiaalsete, õiguslike ja tehnoloogiliste riskide ning
väärtusvalikute analüüs*, University of Tartu Centre for Ethics (Margit Sutrop, Dan Bogdanov,
Katrin Laas-Mikko, Liina Kamm, Andra Siibak, Henrik Trasberg), submitted 30.06.2026, revised
24.08.2026. https://tihupe.ee/wp-content/uploads/2026/09/TI-Huppe-riskide-analuus-august-2026.pdf
(*full text*, pages 77 to 86).

Risk 7, *Väärtustriiv* (p. 83):

> RISK: Välise teenusepakkuja kontrollitav tehisintellektipõhine õpirakendus võib vahendada
> Eesti riigi alusväärtustega vastuolus olevaid väärtusi

> Risk ei eelda pahatahtlikku mõjutustegevust ega teadlikku väärtuspropagandat, vaid tuleneb
> asjaolust, et tehisintellektisüsteemid peegeldavad paratamatult nende loomisel tehtud
> kultuurilisi, õiguslikke ja normatiivseid valikuid. Väärtusmõjutus võib toimuda ka kaudselt ja
> järk-järgult: õpilastele korduvate kallutatud näidete, seletuste, probleemipüstituste,
> argumentatsiooniviiside ja vaikimisi eelduste kaudu.

Where the values come from (p. 84):

> Nende vastused kujunevad treeningandmete, arendajate valikute, mudeli häälestamise,
> sisupoliitikate, ohutusfiltrite, tooteotsuste ja kasutajaliidese disaini koosmõjul.

And why it is hard to see (p. 84):

> Väärtusmõjutus ei pruugi olla nähtav ühes vastuses ning on seega ka raskesti diagnoositav.
> Tõenäolisemalt kujuneb see korduva kokkupuute kaudu [...] Aja jooksul võib see mõjutada seda,
> mida õpilane peab normaalseks, mõistlikuks, usaldusväärseks või ihaldusväärseks.

Risk 6, *Eesti kultuur* (p. 77), has the sentence closest to our demo:

> Sügavam risk seisneb selles, et eesti keel võib TI-vahendatud õppes taanduda kasutajaliidese
> keeleks, samal ajal kui keerukamad mõisted, näited, seletused, argumentatsiooniviisid ja
> väärtusmustrid pärinevad mujalt.

Its example: common models used by the TI-Hüpe app *"võivad eksida Eesti kirjanduse sisu kohta ja
kasutada nt otsetõlkes matemaatikaterminoloogiat (nt naturaalarvude asemel loodusarvud)"*.

The English executive summary (p. 8) puts the same list as *"training data, developers'
choices, content policies and commercial objectives"*.

Note the difference in emphasis. TI-Hüpe frames drift around a **foreign provider** and
**students' values**. Our demo is about what models **make** (pictures, words), and our own
tools drift too (DRIFT.md). The two meet at "no single decision" and "repeated exposure".

### Krister Kruusmaa's numbers, checked

*"Keelemudelite mõõdupuu"*, Krister Kruusmaa, Sirp, 13.11.2026,
https://www.sirp.ee/keelemudelite-moodupuu/ (*full text*, read through a fetch tool twice; the
quotes below came back identical both times, but check the two marked ones against the page
before putting them on a slide).

| Claim | Exact words |
| --- | --- |
| Estonian is about 0.1 % of training data | "Eestikeelsed andmed moodustavad levinud treeningkorpustest hinnanguliselt vaid 0,1%" |
| About 60 % of specialist terms | "Oskussõnavara testis aga tunnevad ka parimad mudelid ära vaid ligikaudu 60% erialadefinitsioonidest" |
| 1.5× cost | "sama teksti genereerimine eesti keeles võib olla näiteks poolteist korda kulukam kui inglise keeles" |
| Open models trail closed ones | "Rusikareegel on, et avatud mudelite areng on suletud mudelitest kolm kuni kuus kuud maas"; for Estonian "pigem aasta või kahe võrra" |
| 5.8 points in over two years | "Näiteks paranes mõõdupuu tippmark enam kui kaheaastase perioodi jooksul (2023. aasta märtsist 2025. aasta juunini) vaid 5,8 protsendipunkti võrra." |
| General capability grew many times | "Samal perioodil muutusid mudelid üldiselt (s.t inglise keeles ja üldistes oskustes) kordades võimekamaks ja töökindlamaks." |
| Uneven releases | "Ei ole harv, et mõne mudeliseeria uus väljalase on eelmisest versioonist hoopis kehvem." |
| Less-known facts (check wording) | "Valmistavad praegustele mudelitele raskust vähem levinud teadmised Eesti kohta" |
| Mistral after criticism | "Kui Mistral mõni kuu hiljem uue mudeli avaldas, oli see eelmise põlvkonnaga võrreldes teinud propagandakindluse testis väga suure hüppe" |
| Google not improving (check wording) | "Google, kelle mudelid on eelnimetatutest vähem propagandakindlad ega näita kahjuks märki paranemisest" |

All the numbers in `arunadal-demo.md` hold. One caveat on the 5.8, below under "Are models
getting better".

## The mechanisms

Twelve, roughly from the picture outwards: what the model draws, what wraps the model, what
people do with it, and what comes back. Each has one plain sentence, an Estonian example, the
evidence, and how strong that evidence is. "Our run" is the 2026-11-09 Estonian visuals run
(`evals/estonian-visuals/README.md`, one picture per model per prompt, so small numbers).

### 1. Substitution by a neighbour

**The model fills a gap with the nearest thing it knows better.**

Estonian example: two models (lucid-origin, flux-1-schnell) drew a **Nordic cross** in blue,
black and white: Estonia's colours on Finland's pattern. Germany as control: every model drew the
soft American pretzel, none the Swabian Brezel. A person "from Oceania" becomes Australian.

Evidence:

- Basu, Babu, Pruthi, *Inspecting the Geographical Representativeness of Images from
  Text-to-Image Models*, arXiv 2023, https://arxiv.org/abs/2305.11080 (*abstract*). 540
  participants in 27 countries. Without a country name, images "most reflect the surroundings of
  the United States followed by India"; others average under 3 of 5. Naming the country adds 1.44
  points (DALL·E 2) and 0.75 (Stable Diffusion), but "the overall scores for many countries still
  remain low".
- Naik, Nushi, *Social Biases through the Text-to-Image Generation Lens*, AIES 2023,
  https://arxiv.org/abs/2304.06034 (*abstract*). For everyday situations (park, food, weddings),
  location-neutral images are "closer and more similar to images generated for locations of
  United States and Germany".
- Ghosh, Caliskan, *'Person' == Light-skinned, Western Man, and Sexualization of Women of Color:
  Stereotypes in Stable Diffusion*, Findings of EMNLP 2023, https://arxiv.org/abs/2310.19981
  (*abstract*). "A person from Oceania is deemed to be Australian/New Zealander over Papua New
  Guinean".
- Bianchi et al., *Easily Accessible Text-to-Image Generation Amplifies Demographic Stereotypes
  at Large Scale*, FAccT 2023, https://arxiv.org/abs/2211.03759 (*abstract*). Object prompts
  reinforce "American norms"; stereotypes persist even when the prompt names no group.

**Strength: well evidenced** that defaults lean to the US and Western Europe. The specific
"Finland for Estonia" substitution is only our own observation (two pictures).

### 2. The average replaces the specific

**Asked for one particular thing, the model gives the typical member of its category.**

Estonian example: the Muhu costume came out as a handsome red-and-black geometric folk garment
from every good model (flux-2-dev scored 40); none had the yellow or the striped skirt. No model
drew Vana Toomas on Raekoda. Arvo Pärt as "sad piano" is our hypothesis for music; **untested**.

Evidence:

- Kandpal, Deng, Roberts, Wallace, Raffel, *Large Language Models Struggle to Learn Long-Tail
  Knowledge*, ICML 2023, https://arxiv.org/abs/2211.08411 (*abstract*). Accuracy on a fact
  tracks "how many documents associated with that question were seen during pre-training";
  models "must be scaled by many orders of magnitude" to do well on facts with little support.
  Text, not images, but it is the cleanest statement of why a parish costume loses to "folk
  costume".
- Hintze, Proschinger Åström, Schossau, *Autonomous language-image generation loops converge to
  generic visual motifs*, Patterns, 19.12.2025, PMC12827715 (*abstract*). SDXL and LLaVA in a
  text, image, text loop: 700 runs, 100 steps, all converge to "visual elevator music", 12
  motifs "such as stormy lighthouses and palatial interiors"; loops "gravitate to
  high-probability attractors in training data".
- Kannen et al., *Beyond Aesthetics: Cultural Competence in Text-to-Image Models* (CUBE),
  NeurIPS 2024, https://arxiv.org/abs/2407.06863 (*abstract*). "Significant gaps in the
  cultural awareness of existing models across countries" (8 countries; cuisine, landmarks,
  art).

**Strength: well evidenced** as a general property. The Muhu case has a catch we must say out
loud: EKI's prompt itself asks for "red and black geometric embroidery", so the stereotype starts
in the prompt. The Muhu colour facts still need confirming with ERM or rahvaroivad.ee.

### 3. Local markers on a generic template

**The model makes a place "Estonian" by adding labels and symbols to a scene that could be
anywhere, and the labels are the stereotype.**

Estonian example (2026-11-16, not yet in the README): asked for "Tere tulemast Eestisse" on a
sign, Nano Banana 2 lite added unrequested "Welcome to Estonia", "Looduskaitseala" and an
emblem. The place is marked, heavily, rather than drawn.

Evidence:

- Urman et al., *Prompt Revision as a Source of Cultural Bias in Text-to-Image Systems*, arXiv
  10.09.2026, https://arxiv.org/abs/2609.11532 (*abstract*; the EMNLP 2026 venue came from a
  summary, unverified). DALL·E 3, Imagen 4 and GPT-Image-1.5 silently rewrite prompts. "The US is
  the least-marked context, while non-Western and non-Anglophone contexts are marked far more
  heavily, flattened into narrow vocabularies [...] and reduced to recognizable cultural
  stereotypes." The rewrite layer is "a previously undocumented, causal source of this
  stereotyping."
- Bhatt, Vijay, Milbauer, Diaz, *Characterizing Cultural Localization in AI-Generated Stories*,
  arXiv 12.06.2026, https://arxiv.org/abs/2606.14626 (*abstract*). Stories for 193
  nationalities: "only a small subset (9-17%) of the vocabulary accounts for the variation across
  nationalities"; the rest is "a shared culturally-agnostic narrative template".

**Strength: moderate and recent.** Two 2026 preprints, one on images, one on text. It matters for
the "are they getting better" question: this layer is new in the newest commercial systems.

### 4. Preference and aesthetic tuning

**Models are tuned toward what raters find pleasing and familiar, and that narrows the output
toward one taste.**

Estonian example: the most beautiful Muhu picture is the wrong one. DALL·E mini's 256 px blur
scored 100 on the same criteria. Polish wins over fidelity.

Evidence:

- Zhang et al., *Verbalized Sampling: How to Mitigate Mode Collapse and Unlock LLM Diversity*,
  arXiv 2025 (v4 July 2026), https://arxiv.org/abs/2510.01171 (*abstract*). Mode collapse after
  alignment comes from "typicality bias in preference data, whereby annotators systematically
  favor familiar text".
- Kirk et al., *Understanding the Effects of RLHF on LLM Generalisation and Diversity*, arXiv
  2023, https://arxiv.org/abs/2310.06452 (*abstract*). "RLHF significantly reduces output
  diversity compared to SFT".
- Taylor, Agnew, Sap, Fox, Zhu, *The Algorithmic Gaze of Image Quality Assessment: An Audit and
  Trace Ethnography of the LAION-Aesthetics Predictor*, arXiv 2026 (FAccT 2026 per a summary,
  unverified), https://arxiv.org/abs/2601.09896 (*abstract*). The predictor that curated Stable
  Diffusion's training data (about 1.2B images) rates "realistic images of landscapes,
  cityscapes, and portraits from western and Japanese artists most highly"; its scores came
  "primarily from English-speaking photographers and western AI-enthusiasts".
- Hall et al., *DIG In*, TMLR 12/2023 (below, mechanism 12): newer Stable Diffusion versions
  cover real-world geography worse, "could be due to extra rounds of aesthetic training".

**Strength: well evidenced** that tuning reduces diversity; **moderate** that it erases culture
specifically (one audit, one suggested cause).

### 5. The prompt's language and the English pipeline

**Most systems think in English; a prompt in Estonian is translated, misread or answered from
English-language material.**

Estonian example: "Tere tulemast Eestisse" came out as "Esttise", "Èstisse", "EESTISSSE",
"Tcere" (2 of 10 right). From TI-Hüpe: "loodusarvud" for "naturaalarvud", a direct translation of
"natural numbers".

Evidence:

- TI-Hüpe risk 6 (above): Estonian may become "kasutajaliidese keeleks".
- Saxon, Wang, *Multilingual Conceptual Coverage in Text-to-Image Models* (CoCo-CroLa), ACL 2023,
  pp. 4831–4848, https://aclanthology.org/2023.acl-long.266/ (*abstract*). A method to measure
  whether the same noun in another language gives the same pictures; finds language-specific
  weaknesses. Estonian was not among its languages.
- Tao et al., *Cultural bias and cultural alignment of large language models*, PNAS Nexus 2024,
  https://academic.oup.com/pnasnexus/article/3/9/pgae346/7756548 (*abstract*, through a fetch
  summary). GPT models are "most aligned with the cultural values of countries in the Anglosphere
  and Protestant Europe"; telling the model to answer as someone from a country helped for 71–81 %
  of countries.
- Ventura et al., *Navigating Cultural Chasms*, arXiv 2023, https://arxiv.org/abs/2310.01929
  (*abstract*). Ten languages, six models; the abstract states the questions, not a headline
  result. Read the paper before citing it for a finding.

**Strength: moderate.** Strong that English dominates; thin on what prompting in Estonian versus
English does to pictures. That is a test we could run cheaply.

### 6. Cost: the same text costs more in Estonian

**Small languages pay more per word and get worse answers, a quiet push toward English.**

Estonian example: Kruusmaa's 1.5×.

Evidence:

- Petrov, La Malfa, Torr, Bibi, *Language Model Tokenizers Introduce Unfairness Between
  Languages*, NeurIPS 2023, https://arxiv.org/abs/2305.15425 (*abstract*). The same text differs
  in token length "up to 15 times in some cases".
- Ahia et al., *Do All Languages Cost the Same?*, arXiv 2023, https://arxiv.org/abs/2305.13707
  (*abstract*). 22 languages: speakers of many "are overcharged while obtaining poorer results".

**Strength: well evidenced** for cost. **Thin** for the drift step (that people then switch to
English); TI-Hüpe argues it ("varjatud surve liikuda [...] ingliskeelse terminoloogia [...]
poole"), nobody we found measured it.

### 7. Filters and content policies

**Safety layers trained on majority language and culture block or blank what they do not
recognise.**

Estonian example: dreamshaper-8-lcm returned plain black pictures for the coat of arms, the Muhu
costume and kohuke. A safety filter is our guess, **not confirmed**.

Evidence:

- Kim, Choi, Kim, *Not Safe for All: Auditing the Dialect Penalty in Text-to-Image Safety
  Pipelines*, arXiv 30.08.2026, https://arxiv.org/abs/2608.29589 (*abstract*). Over 23,080 paired
  prompts in five English dialects, filters "trigger based on linguistic surface features rather
  than semantic intent" (gaps up to 28 points); the bias "tracks training data imbalance".
- TI-Hüpe names "ohutusfiltrite" and "sisupoliitikate" among the sources of value drift.

**Strength: thin** for culture. One study on English dialects, one unexplained case of ours.

### 8. People take on the model's style

**Writing or designing with a model moves people toward its defaults, and away from their own.**

Estonian example: none measured. Juzek's study includes an Estonian news corpus, but we did not
read the Estonian result.

Evidence:

- Agarwal, Naaman, Vashistha, *AI Suggestions Homogenize Writing Toward Western Styles and
  Diminish Cultural Nuances*, CHI 2025, https://arxiv.org/abs/2409.11360 (*abstract*). 118
  people from India and the US: suggestions "led Indian participants to adopt Western writing
  styles, altering not just what is written but also how it is written".
- Doshi, Hauser, *Generative AI enhances individual creativity but reduces the collective
  diversity of novel content*, Science Advances 10(28), 12.07.2024, PMC11244532 (*abstract*).
  AI ideas make stories rated more creative, "however, generative AI-enabled stories are more
  similar to each other"; "writers are individually better off, but collectively a narrower
  scope of novel content is produced".
- Padmakumar, He, *Does Writing with Language Models Reduce Content Diversity?*, ICLR 2024,
  https://arxiv.org/abs/2309.05196 (*abstract*). InstructGPT help gave "a statistically
  significant reduction in diversity"; the model's text drove it.
- Juzek, *AI-Associated Lexical Shifts Across 34 Languages*, arXiv 25.05.2026,
  https://arxiv.org/abs/2605.25358 (*abstract*; Estonian is in its language list, *full text*
  checked for that only). AI-favoured words rose in news writing in 26 of 34 languages from
  2020–21 to 2023–24 (mean +15.1 %, baseline words −4.5 %).

**Strength: well evidenced** in controlled experiments; the real-world spread is newer and
smaller.

### 9. The feedback loop

**Generated output goes back onto the web, into training data and into people's references, and
the next model learns from the copy.**

Estonian example: none measured. The risk is direct: at 0.1 % of the data, a modest amount of
machine-made Estonian text or imagery is a large share of all Estonian material.

Evidence:

- Shumailov, Shumaylov, Zhao, Papernot, Anderson, Gal, *AI models collapse when trained on
  recursively generated data*, Nature 631, 755–759, 2024,
  https://doi.org/10.1038/s41586-024-07566-y (*full text*, Edinburgh repository copy).
  Indiscriminate training on model output "causes irreversible defects in the resulting models,
  in which tails of the original content distribution disappear". Two stages: "In early model
  collapse, the model begins losing information about the tails of the distribution; in late
  model collapse, the model converges to a distribution that carries little resemblance to the
  original one". The tails are where a parish costume lives.
- Thompson et al., *A Shocking Amount of the Web is Machine Translated*, Findings of ACL 2024,
  https://arxiv.org/abs/2401.05749 (*abstract*). Machine-made multi-way translations "not only
  dominate the translations in lower resource languages; [they] also constitute a large fraction
  of the total web content in those languages".
- Judah, *How AI and Wikipedia have sent vulnerable languages into a doom spiral*, MIT Technology
  Review, 25.09.2025,
  https://www.technologyreview.com/2025/09/25/1124005/ai-wikipedia-vulnerable-languages-doom-spiral/
  (*full text*). 40–60 % of articles in four African-language Wikipedias were uncorrected machine
  translation; Greenlandic Wikipedia was closed. Wikipedia "is sometimes the largest source of
  online linguistic data for languages with few speakers—so any errors on those pages can poison
  the wells that AI is expected to draw from."
- Hintze et al. (mechanism 2) is the same loop in miniature, model to model.

**Strength: well evidenced** in the lab and for very small languages. Caveat: model collapse
assumes *indiscriminate* reuse; later work argues that mixing real and generated data avoids it
(not checked here). For Estonian it is a reasonable warning, not a measured effect.

### 10. The checker shares the bias

**The tool we use to measure the output misses the same things the generator gets wrong.**

Estonian example (our run): the judge (Clef-flash) agreed with our eyes 89 % of the time on
flag and coat of arms. It said a Nordic-cross flag was "free of any cross" (0.79), five stripes
were "exactly three" (0.91), and passed "Esttise", "Èstisse", "EESTISE" as "Eestisse". It checks
whether the text is about the place, not the letters.

Evidence:

- Our run, above. The strongest evidence we have, and our own.
- Panickssery, Bowman, Feng, *LLM Evaluators Recognize and Favor Their Own Generations*, arXiv
  2024, https://arxiv.org/abs/2404.13076 (*abstract*). Self-preference: an evaluator "scores its
  own outputs higher than others' while human annotators consider them of equal quality".
- DeVries, Misra, Wang, van der Maaten, *Does Object Recognition Work for Everyone?*, arXiv 2019,
  https://arxiv.org/abs/1906.02659 (*full text*). Six recognition systems (as of February 2019)
  on Dollar Street: accuracy for households under $50 a month is about 10 % lower than over $3,500;
  the US against Somalia or Burkina Faso, about 15–20 %. The seeing models have the same blind
  spots.

**Strength: our data is direct but small** (two tasks, 100 criteria). The literature shows
evaluator bias and recognition gaps, not a cultural judge failing on a small culture. Our demo is
new evidence here.

### 11. Deference

**People trust a fluent, confident answer and stop checking.**

Estonian example: the judge's 89 % feels good enough to stop looking, and the 11 % it misses is
exactly Estonia.

Evidence:

- Goddard, Roudsari, Wyatt, *Automation bias: a systematic review of frequency, effect mediators,
  and mitigators*, JAMIA 19(1), 2012, PubMed 21685142 (*abstract*). 74 studies; automation bias is
  mediated by "trust and confidence" and worsened by "workload, task complexity, and time
  constraint". Clinical settings.
- TI-Hüpe risk 7 lists as most vulnerable students "kes tajuvad TI-d neutraalse ja objektiivse
  autoriteedina".

**Strength: well evidenced** as a human tendency, **thin** for culture and art.

### 12. What gets measured gets fixed

**Developers fix what benchmarks and public criticism point at; whatever nobody measures
stays as it is.**

Estonian example: Mistral after EKI's propaganda test (below). On the image side, flags and
spelling are what everyone tests, and they improved; nobody tests Muhu.

Evidence: EKI's data and Kruusmaa's article, below. This one cuts both ways: it is a cause of
uneven drift and the main lever against it.

**Strength: one well-documented case** (Mistral); the general claim is plausible, not shown.

## Why it drifts where it drifts

The observation, from the nature run (`evals/estonian-visuals/README.md`, "Nature, first run,
2026-11-16"): asked for "the Pakri limestone cliff on the north coast of Estonia", every model drew
a tall, dramatic sea cliff, which the judge placed in Brittany, Dover, the Black Sea or Höga
Kusten. The real Pakri klint is low (about 20 to 25 m), flat-topped and layered, with forest on top
and a boulder beach. Alvars came out as Öland, Crimea or the Andes; Setomaa as Czech or Slovak
villages; the Peipsi onion village, without "Estonia", as Russia. The judge also placed both real
Saaremaa alvar photos on Öland.

**The short answer: the model does not know the name, so the generic words decide, and the
generic words point at the most photographed, most captioned, most admired example.** The miss
does not land somewhere random. It lands on the postcard.

The chain, link by link:

1. **The name carries almost nothing.** "Pakri cliff" appears once in C4, the English web crawl
   T5 was trained on; "Cliffs of Moher" appears 17,703 times (our counts, below). Performance on a
   concept follows how often it was seen, and the curve is log-linear: ten times the data for one
   step better.
2. **So the category takes over.** With the name empty, the prompt is "limestone cliff, north
   coast". In English text and photos the best-known cliffs are Dover, Étretat and Moher (two of
   them chalk, all of them tall). Photo collections pile up at famous places, so the typical
   "cliff" picture is a famous cliff. "Towering cliffs" is 12 times as common as "low cliff" in C4.
3. **Who photographs and captions what, in which language.** Image-caption sets are mostly
   English captions of rich, English-speaking countries. Estonian photos of a *pank* or a *raba*
   are captioned in Estonian, if at all, so they do not attach to the English words in the prompt.
   (The language point is our inference from the skew below; nobody has measured it for Estonian.)
4. **Tuning for beauty picks the dramatic version.** Aesthetic filtering and preference tuning
   (mechanism 4) reward the scene people stop at. A flat, grey, 20 m bank loses to a white wall
   above surf. No study we found tests this on landscapes; it is our reading.
5. **The neighbour with the most pictures wins.** "Alvar" is a Swedish word, and Öland's Stora
   Alvaret is the best-documented alvar in English (C4: "Öland" 4,049, "Saaremaa alvar" 0). The
   Peipsi miss is the same shape: "onion" plus "village" plus wood finds the onion domes and izbas
   that are photographed far more. Setomaa to Czechia and Slovakia we cannot explain from counts;
   "village in eastern Europe" leading to the most photographed villages is a guess.
6. **The judge learned from the same pile.** A vision-language model placing pictures is pulled to
   the same well-photographed places, so it sends a real Saaremaa alvar to Öland. This is mechanism
   10 with a cause attached.

### Sources

- Udandarao, Prabhu, Ghosh, Sharma, Torr, Bibi, Albanie, Bethge, *No "Zero-Shot" Without
  Exponential Data: Pretraining Concept Frequency Determines Multimodal Model Performance*,
  NeurIPS 2024, https://arxiv.org/abs/2404.04125 (*abstract*). 34 models, five pretraining sets
  including LAION-400M and LAION-Aesthetics, CLIP and Stable Diffusion: models "require
  exponentially more data to achieve linear improvements in downstream 'zero-shot' performance,
  following a sample inefficient log-linear scaling trend."
- Parashar, Lin, Liu, Dong, Li, Ramanan, Caverlee, Kong, *The Neglected Tails in Vision-Language
  Models*, arXiv 2024 (CVPR 2024 by common citation, not on the abstract page),
  https://arxiv.org/abs/2401.12425 (*abstract*). Counts concepts in LAION captions with an LLM
  over synonyms; LAION is "long-tailed", and "text-to-image models (e.g., Stable Diffusion) often
  fail to recognize or generate images of rare concepts". Using the most frequent synonym instead
  of the official name helps. For us: "limestone cliff" is the frequent synonym, and it is the
  wrong picture.
- Samuel, Ben-Ari, Raviv, Darshan, Chechik, *Generating images of rare concepts using
  pre-trained diffusion models*, AAAI 2024, https://arxiv.org/abs/2304.14530 (*abstract*). Names
  "generating uncommon concepts" as "a common failure mode"; the fix is a few reference images
  steering the starting noise (SeedSelect), without retraining.
- Kandpal et al. (mechanism 2): the same for facts in text.
- Basu, Bahl, Bhagat, Seshadri, Babu, Pruthi, *Where Do Images Come From? Analyzing Captions to
  Geographically Profile Datasets*, arXiv 10.02.2026, https://arxiv.org/abs/2602.09775
  (*abstract*). English captions in Re-LAION, DataComp-1B and Conceptual Captions, 20 common
  things: the US, UK and Canada are 48.0 % of located samples; representation tracks GDP
  (ρ = 0.82); "non-English subsets [...] skew heavily toward countries where these languages are
  predominantly spoken." Estonia is not in the abstract.
- Crandall, Backstrom, Huttenlocher, Kleinberg, *Mapping the World's Photos*, WWW 2009,
  https://www.cs.cornell.edu/~lars/mapping09www.pdf (*full text*, abstract and tables). 35 million
  geotagged Flickr photos cluster at a few "popular places"; the paper ranks the most
  photographed landmarks on Earth. Old, but it is the clearest evidence that photos are taken
  where photos are already taken.
- Hall et al., *DIG In* (mechanism 12), and Taylor et al. on the LAION-Aesthetics predictor
  (mechanism 4): aesthetic training worsens geographic coverage; the predictor favours "realistic
  images of landscapes" as Western photographers see them.
- Kirstain, Polyak, Singer, Matiana, Penna, Levy, *Pick-a-Pic: An Open Dataset of User Preferences
  for Text-to-Image Generation*, arXiv 2023, https://arxiv.org/abs/2305.01569 (*abstract*). The
  preferences are those of "text-to-image users" of one web app, and the resulting PickScore is
  recommended for evaluating and ranking models. Who the raters are is the point; the abstract
  says nothing about landscapes.
- Huang, Huang, Liu, Liu, Wang, Zhao, *AI Sees Your Location—But With A Bias Toward The Wealthy
  World*, EMNLP 2025, https://aclanthology.org/2025.emnlp-main.910/ (*abstract*). 1,200 images:
  accuracy is lower for less developed (−12.5 %) and sparsely populated (−17.0 %) areas, and
  models keep answering Sydney for Australia. The famous exemplar again, on the judge's side.
- Ozaki et al., *TextTIGER*, arXiv 2025 (v2 April 2026, under review),
  https://arxiv.org/abs/2504.18269 (*abstract*). Entities in prompts are "almost countless";
  adding a description of the entity to the prompt improves the picture. Supports "describe,
  don't name" below.

Not found: a study of low-salience landscapes (plain, unphotogenic land), or of small countries'
nature in image models. The geography papers count countries and objects (houses, flags), not
terrain. Our nature run may be the first data on it.

### Measuring the cause for Pakri

**What can be queried today (2026-11-16), without credentials:**

- LAION's CLIP retrieval service (`knn.laion.ai`, the old clip-front backend): no answer.
- Re-LAION on Hugging Face: gated.
- DataComp-1B and COYO-700M: the Hugging Face dataset viewer lists search as available, but
  every anonymous search (even on a small unrelated dataset) returned "Authentication check on
  the Hugging Face Hub failed". Whether it would search all 1.4 billion captions or only a part
  is unverified.
- infini-gram (https://infini-gram.readthedocs.io/en/latest/api.html): open API, no key, exact
  phrase counts over text corpora. Not image captions, but C4 is T5's training text (Raffel et
  al., *Exploring the Limits of Transfer Learning [...]*, arXiv 2019, JMLR 2020 by common
  citation, https://arxiv.org/abs/1910.10683, *abstract*) and Dolma 1.7 (2.6 trillion tokens) is
  a broad English web mix. Run on 2026-11-16, one request a second.
- Wikimedia Commons API: open. Files directly in a category, and with subcategories
  (`deepcat:` search, which gives up on very deep trees, so large places are undercounted).

**Counts, exact phrase, case-sensitive.** "Pakri" alone is not used: it is also a place in India.

| phrase | C4 | Dolma 1.7 |
| --- | ---: | ---: |
| Pakri cliff | 1 | 22 |
| Pakri lighthouse | 6 | 72 |
| Pakri peninsula / Pakri Peninsula | 62 | 629 |
| Baltic Klint | 31 | 334 |
| North Estonian Klint | 12 | 231 |
| Cliffs of Moher | 17,703 | 137,334 |
| White Cliffs of Dover | 3,927 | 36,356 |
| Etretat / Étretat | 3,602 | 35,484 |
| towering cliffs | 8,421 | 60,813 |
| dramatic cliffs | 6,752 | 50,012 |
| low cliff | 720 | 7,223 |
| limestone cliffs | 19,008 | 141,859 |
| Öland | 4,049 | 42,459 |
| Stora Alvaret | 70 | 646 |
| alvars | 429 | 4,580 |
| Saaremaa alvar | 0 | 0 |
| Saaremaa | 4,511 | 49,075 |
| Kihnu | 1,048 | 10,160 |
| Muhu | 1,614 | 19,953 |
| Setomaa | 339 | 3,397 |
| Setomaa village | 0 | 16 |
| Lake Peipus / Lake Peipsi | 1,151 | 13,305 |

| Commons category | files in it | with subcategories |
| --- | ---: | ---: |
| Pakri Cliff | 57 | 57 |
| Pakri Peninsula | 41 | 183 |
| North Estonian Klint | 50 | 858 |
| Cliffs of Moher | 961 | 1,091 |
| White Cliffs of Dover | 578 | 945 |
| Étretat | 168 | 2,361 |
| Alvars | 23 | 125 |
| Stora Alvaret | 9 | 59 |
| Öland | 201 | 5,744 |
| Setomaa | 82 | 2,318 |
| Kihnu | 97 | 314 |
| Muhu | 55 | 697 |
| Lake Peipus | 7 | 327 |

What the numbers say:

- In English web text, the Pakri cliff is about 17,000 times rarer than the Cliffs of Moher, and
  a single mention of it sits next to 8,421 "towering cliffs". The name cannot outweigh the
  category.
- On Commons the gap is only about 19 times (57 against 1,091). Commons is where Estonia does
  well, because Estonians upload; it is not what the models learned from. **Commons is a poor
  proxy for training data**; it understates the gap by three orders of magnitude here.
- Öland outweighs "Saaremaa alvar" on every count. The alvar going to Öland is what the counts
  predict.

**Next, to test the cause rather than describe it:**

1. **Counts against results.** Take the C4 count of each of the 15 nature subjects' key phrase
   and set it against the share placed in Estonia. Udandarao et al. predict a log-linear rise. If
   rare subjects fail and common ones pass, frequency explains it; if not, something else does.
   Costs nothing; the data is in this file and the README.
2. **Describe instead of name.** Prompt "a low, 20 m, flat-topped escarpment of horizontal
   limestone layers, forest on top, a beach of boulders below" with and without "Pakri". If the
   description fixes the shape, the missing name was the cause. If the picture still turns tall
   and white, the pull is the tuning toward drama (link 4).
3. **Real caption counts.** Needs either a Hugging Face token for the viewer search on
   DataComp-1B, or downloading the caption column of DataComp-1B or Re-LAION (hundreds of GB with
   the other columns; captions alone are smaller). Then the Parashar method: count synonyms
   ("Pakri", "klint", "pank", "Paldiski cliff") and see which language the few hits are in.

## Are models getting better over time?

The question behind the demo: current models already get the flag and the sign right, so is drift
a passing problem? Short answer: they get better at what is common in the data and what gets
measured, much slower at the long tail. Absolute quality rises, the gap to the specific can stay
or widen, and the remaining errors get more convincing.

### What Kruusmaa says

His article says the top Estonian score rose "vaid 5,8 protsendipunkti" from March 2023 to June
2025 while models grew "kordades võimekamaks"; new releases are sometimes worse; less-known facts
about Estonia are hard; open models trail by one to two years in Estonian against three to six
months generally; Mistral jumped on propaganda resistance after EKI's criticism, Google did not.

### What EKI's published data shows today

EKI's leaderboard data (CC BY 4.0,
https://github.com/keeleinstituut/leaderboard-data-ui, `summary.csv`, fetched 2026-11-16, 101
models). The best score on each benchmark at three dates:

| Benchmark | Mar 2023 (GPT-4) | Jun 2025 | Nov 2026 |
| --- | ---: | ---: | ---: |
| Language advice (keelenõu) | 47.1 | 51.0 | 77.5 |
| Idioms | 36.7 | 57.0 | 75.0 |
| Specialist terms | 30.6 | 46.3 | 63.0 |
| Trivia, multiple choice | 46.4 | 71.5 | 90.0 |
| Trivia, open answer (harder) | 3.4 | 26.0 | 50.8 |
| Propaganda resistance | 62.5 | 82.0 | 97.6 |

What this says:

- **The 5.8 does not match today's data.** On the current benchmark set the best overall rose
  from 36.9 (GPT-4) to 52.5 (Gemini 2.5 Pro) over the same dates. EKI re-runs and adds
  benchmarks, so his figure is probably from an earlier version of the leaderboard. The closest
  current match is language advice: 47.1 to 51.0, about 4 points in over two years. Ask Krister
  which number he meant before quoting it next to a slide.
- **Since mid-2025 Estonian improved a lot** at the top: language advice +26, terms +17. The
  "stagnation" story is out of date for language.
- **The long tail lags.** The hard open-answer trivia is the long-tail test. Its best score has
  been about 50 since February 2026 (Gemini 3.1 Pro 50.75, Gemini 4 Argon 50.62). 44 of the 78
  models released since June 2025 score under 10 on it, including recent Mistral, Qwen and
  smaller Claude models.
- **Uneven releases, confirmed:** Gemini 4 Argon scores 63.5 on Estonian book recommendations,
  Gemini 3.1 Pro 80.6.
- **Mistral, confirmed:** propaganda resistance 62.3 (Medium 3.5, April 2026) to 90.1 (Large 4,
  October 2026). **Google, confirmed:** 79.05 (Gemini 3.1 Pro) to 79.52 (Gemini 4 Argon).
- **Only the top improves.** These are best scores. The models people run cheaply or locally are
  far below (terms: Gemma 4 31B 17, Mistral Small 4 15).

### Our image data

- **2026-11-09 run**, one picture per model per prompt: the flag went from 20–60 (SDXL era) to
  100 (FLUX.2); correct spelling only from flux-2-dev and lucid-origin. The Muhu costume scored 40
  for every good model; no model drew Vana Toomas. Germany: every model, old and new, drew the
  American pretzel.
- **2026-11-16**, three cheap current catalog models: FLUX.3 klein and Nano Banana 2 lite spelled
  "Tere tulemast Eestisse" right, p-image did not. Nano Banana added "Welcome to Estonia",
  "Looduskaitseala" and an emblem nobody asked for (mechanism 3).

So between model generations, the common things (flag, spelling) fixed themselves; the specific
things (costume, figure on the tower, the regional pretzel) did not move. One picture per model
per prompt: a pattern to show, not a measurement.

### The literature

- **Long-tail knowledge scales slowly.** Kandpal et al. (mechanism 2): larger models learn more
  rare facts, but closing the gap needs "many orders of magnitude"; retrieval helps more.
- **Language gaps persist.** Han et al., *MuBench*, arXiv 2025,
  https://arxiv.org/abs/2506.19468 (*abstract*): "a persistent performance disparity between
  English and low-resource languages". Claims that the gap only closes as English saturates, or
  narrows over releases, came from search summaries (*unverified*).
- **Better pictures, worse geography.** Hall, Ross, Williams, Carion, Drozdzal, Romero Soriano,
  *DIG In: Evaluating Disparities in Image Generations with Indicators for Geographic
  Diversity*, TMLR 12/2023, https://arxiv.org/abs/2308.06198 (*full text* for this passage):
  "progress in image generation quality has come at the cost of real-world geographic
  representation". The newer Stable Diffusion 2.1 had lower precision and coverage than 1.5,
  which "could be due to extra rounds of aesthetic training". The only direct version-to-version
  comparison we found; models from 2022–23.
- **New layers bring new bias.** Urman et al. (mechanism 3): the prompt rewriting in the newest
  commercial systems is itself a cause of stereotyping.
- **Specifying helps, partly.** Basu et al. and Naik and Nushi: naming the country improves
  images but many stay low. Tao et al.: cultural prompting helps for 71–81 % of countries.

### The answer, with how sure we are

1. **Common and measured things improve fast.** Supported: EKI top scores, our flags and
   spelling, Mistral.
2. **The long tail improves slowly.** Supported for text (Kandpal, EKI open-answer trivia flat
   around 50 at the top, under 10 for most). For images, only our handful of pictures and DIG In's
   older models. Nobody has measured parish-level culture across image model versions. A gap in
   the literature, and a class project.
3. **The relative gap can widen while absolute quality rises.** Partly supported: Kruusmaa's
   general claim, DIG In for geography. Not supported for Estonian language in the last 17 months,
   where the top closed a lot of distance.
4. **Better quality makes the remaining errors more convincing.** Argued, not measured. Our
   strongest case is the Muhu costume: the prettiest picture is the wrong one, and the 256 px
   blur scored 100. No study we found measures whether people notice cultural errors less in
   better pictures.
5. **Improvement depends on someone measuring.** Supported by one case (Mistral) and the uneven
   releases. This is the hopeful part, and the demo's ending.

## How strong each mechanism is

| # | Mechanism | Evidence | Shown with Estonia |
| --- | --- | --- | --- |
| 1 | Substitution by a neighbour | well evidenced | our run (two flags) |
| 2 | The average replaces the specific | well evidenced | our run (Muhu, Raekoda) |
| 3 | Local markers on a generic template | moderate, new | our 2026-11-16 check |
| 4 | Preference and aesthetic tuning | well (diversity), moderate (culture) | indirect (Muhu) |
| 5 | Prompt language, English pipeline | moderate | our run (spelling), TI-Hüpe |
| 6 | Cost | well (cost), thin (drift) | Kruusmaa |
| 7 | Filters and content policies | thin | unconfirmed (black pictures) |
| 8 | People take on the model's style | well, in experiments | no |
| 9 | The feedback loop | well in the lab, for tiny languages | no |
| 10 | The checker shares the bias | our data direct; literature partial | our run (judge) |
| 11 | Deference | well (general), thin (culture) | no |
| 12 | What gets measured gets fixed | one case | EKI, Mistral |

## For the demo

Ten minutes holds four mechanisms. They follow the existing beats in `arunadal-demo.md`.

1. **Substitution (1)**, the flags beat: `sheet-flag`, the Nordic cross. One line of
   literature: "without a country, the pictures look like the US" (Basu et al.).
2. **The average (2), with the template (3)**, the words and costume beats:
   `sheet-estonian_text`, then `sheet-muhu_costume` and flux-2-dev's large picture. If there is
   room, Nano Banana's sign with its extra "Welcome to Estonia": the place is labelled, not drawn.
   Say that the prompt itself asked for the stereotype.
3. **The checker (10)**, the checker beat: /visuals, click the cross flag ("free of any cross?
   yes, 0.79") and "Esttise". This is the one nobody else can show; it is our data.
4. **What gets measured gets fixed (12)**, the closing beat: Mistral 62 → 90 against Google 79 →
   79 on EKI's propaganda test, and the newer models that now spell the sign right. Then the
   question to the room.

Say, don't show: the feedback loop (9) and people taking on the model's style (8), one sentence
each, as the hand-off to Laas-Mikko (repeated exposure, her risk 7) and Konsa (what is kept when
the copy feeds the next model). Leave out cost, filters and deference.

If asked "aren't the new models already fixing this?": yes for the flag and the sign; the costume,
Vana Toomas and the pretzel did not move, and EKI's hardest Estonian facts test has been stuck
around 50 at the top since February.

## Before quoting

- [ ] Kruusmaa's 5.8: ask him which leaderboard version; today's data gives different numbers.
- [ ] Read the two "check wording" quotes on the Sirp page itself.
- [ ] Muhu colours with ERM or rahvaroivad.ee.
- [ ] Record the 2026-11-16 three-model check in `evals/estonian-visuals/README.md`, with the
      pictures.
- [ ] Not opened, do not cite: the Science news piece on Hintze et al., the claims that language
      gaps narrow across releases, Urman's and Taylor's venues, Kirk's venue (ICLR 2024 by common
      citation).
- [ ] Untested ideas, not findings: Pärt as "sad piano"; the anthem (Pacius's melody, shared by
      "Mu isamaa, mu õnn ja rõõm" and Finland's "Maamme") drawn or sung as Finnish; prompt in
      Estonian against English for the same picture.
