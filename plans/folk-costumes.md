---
status: idea
---

# Folk costumes: one parish at a time

A dataset of Estonian folk costumes, one record per parish and wearer, built
from the expert texts and photos of rahvaroivad.ee. Research use only until
MTÜ Rahvarõivas answers about the licence. Grew out of the costume section of
`estonian-visuals.md`.

## Three uses

**Learning.** What differs between parishes, and why. Two costumes side by
side with the garments named and the differences pointed out. A "which
parish?" game: a photo, four parishes to choose from, then the text that
gives the answer away (the stripes of the skirt, the cut of the jacket, the
headdress of a married woman).

**Measuring.** Does a model know Muhu from Kihnu? Three tests:

- Identify: show a real photo, ask for the parish.
- Generate: ask for a parish's costume, judge it against the expert text.
- Round trip: generate, then ask the same or another model which parish it
  drew.

**Reconstruction.** Generate a parish's costume from the expert text and a
few reference photos. Judge it against real photos held out from the
references. Experts are the final judge; the model judge only sorts.

## Sources

- **rahvaroivad.ee** (MTÜ Rahvarõivas). A WordPress site with an open API
  (`cms.rahvaroivad.ee/wp-json/wp/v2/`). Fetched 2026-11-16 for research:
  - `kihelkond`: 109 parishes under 4 regions (Lääne-Eesti, Lõuna-Eesti,
    Põhja-Eesti, Saared). Setomaa sits under Lõuna-Eesti.
  - `kandja`: 4 wearers (naine, mees, tüdruk, poiss).
  - `eseme_tyyp`: garment types in a tree (headwear, shirts, skirts, belts,
    jewellery, footwear and so on).
  - `rahvaroivad`: about 366 entries, one per parish and wearer, sometimes
    more (summer and winter, married and unmarried). Each is a long Estonian
    text, garment by garment, with museum numbers such as "ERM A 291:158".
  - `media`: about 4,200 photos of modern reproductions, tagged with parish,
    wearer and garment type. Newer ones name the photographer (often Sandra
    Urvak); older ones do not.
- **MuIS** (museums' information system). The museum numbers in the texts
  point to the original garments there. MuIS has open data
  (`opendata.muis.ee`): persistent URIs per object, RDF, bulk files by
  museum or collection, a licence per record. A lookup by museum number is
  not documented; the likely route is the ERM bulk file, matched on the
  number. To check.
- **ERM's book** *Rahvarõivas on norm* (Reet Piiri, ERM 2022): 151 costume
  sets from every parish, photographed for the book. Not open; a reference
  for experts and a source to cite, not to scrape.
- **Wikimedia Commons**: festival and archive photos, poor labels. Useful as
  held-out "in the wild" photos once checked by hand.
- **Europeana**: about 260 Estonian items, mixed rights; the search mostly
  returns Ukrainian costumes.

## Schema

One record per costume (parish × wearer × variant):

```
costume
  parish, region            from kihelkond and its parent
  wearer                    naine | mees | tüdruk | poiss
  variant, period           "talvised", "19. saj keskpaik"
  source                    entry link, modified date
  garments[]
    type                    eseme_tyyp name (seelik, särk, põll, tanu ...)
    colours[], materials[], techniques[]
    period
    museum_refs[]           "ERM A 291:158"
    source_sentence         the sentence it came from, verbatim
  criteria[]                5 to 8 yes/no questions a picture can answer
    question, garment, source_sentence
  photos[]                  media id, garment type, photographer, held_out
```

The source sentence travels with every claim, so a person can check it and
a judge's answer points back to the text.

## Care

- Kihnu and Seto are living traditions on UNESCO's list. People wear these
  costumes today and decide what is right. The work is about where AI gets
  them wrong, never about an "AI folk costume".
- Photographers are credited by name wherever the site gives one.
- Nothing is published: no photos, no generated costumes, no dataset. All
  of it stays in the git-ignored `out/` and is deleted after the research.
- Ask MTÜ Rahvarõivas (info@rahvaroivas.ee) about the licence (the terms say
  CC BY-NC-ND 3.0 EE, a sampled IIIF manifest says CC BY 4.0), tell them
  about the class, and offer them the results.
- Prefer models that keep no data when sending reference photos.

## Value drift

`schools/eka/docs/DRIFT.md` names cultural drift: what is not in the data
fades. Costumes show it at the scale of one parish. A model asked for an
Estonian folk costume draws an average: a striped skirt, a white blouse, a
wreath. The rule that told one parish from the next (Muhu's bright embroidery
on black, Kihnu's red striped kört, the Seto silver) is replaced by the
average. The specific is the counter-move: the expert text, the parish
name, the museum number. The measure is how far the specific pulls the
picture back from the average, and where it can't.

## First steps

1. `evals/estonian-visuals/costume-extract.mjs`: one entry's text to
   garment records and criteria, each with its source sentence.
2. A pilot on Muhu and Kihnu women: plain prompt, prompt from the text,
   text plus reference photos; judged on the criteria, and the judge asked
   for the parish. Held-out real photos through the same judge as a control.
3. The 12 women's costumes of the confusable pairs from
   `estonian-visuals.md` (round two, 2026-11-16: done, see below), then
   all parishes.
4. The side-by-side page and the game, for the class only.

## What the pilot and round two taught (2026-11-16)

Details and tables: `evals/estonian-visuals/README.md`, "Folk costumes,
pilot" and "round two"; script `costume-round2.mjs`.

- **Criteria must be calibrated on real photos before they score anything.**
  The extractor follows one variant of the text; the site's reproduction is
  often another (Vormsi: the text's 20th-century costume against the
  photographed 19th-century one, 18% of its own criteria). Calibration on
  photos not used for scoring, with yes / no / hidden answers, then by eye:
  rewrite to the variants the text names (keeping both source sentences),
  loosen what the judge can't see, drop outer layers and hidden parts. 90
  criteria: 54 kept, 18 rewritten, 18 dropped. Held-out pass rates went from
  18-81% to 71-100%. The files are the start of the dataset's `criteria[]`.
- **One extraction per variant**, not "either" questions: "either" makes the
  criteria pass the neighbour too (Vormsi's pass 59% of Noarootsi photos).
- **The expert text is what pulls the picture back**: 27% of the criteria
  with a plain prompt, 81% with the text, on both models and in all 12
  parishes. Plain pictures are the regional average.
- **References no longer copy** when the prompt asks for a different woman,
  place and pose, but add little over the text; where they show another
  variant (a winter coat), the text wins.
- **Ask the judge with a closed list.** Gemini 3.8 Flash named the parish of
  15 of 27 held-out photos alone (Muhu 4/4, Kihnu, Tõstamaa, Kadrina all);
  Sonnet 5.5 only 5, at four times the price. Few-shot reached 27/27 with
  both, but mostly by matching the same garments; the one fair case (Kihnu,
  examples from another reproduction) was 2/2. Vormsi, Noarootsi, Räpina and
  Emmaste stay hard to name.
- **The photo set is the limit.** Most photos have only a full-size file;
  8 of 11 parishes have one reproduction on disk, Halliste none with a
  woman. Held-out photos and references from other reproductions need the
  full-size fetch on a fixed line.

## Open questions

- The licence, and the society's blessing.
- Whether MuIS can be matched on museum number, and what its photos allow.
- Who in the class or at ERM can be the expert judge.
