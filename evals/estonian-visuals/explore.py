# Writes out/index.html (and the same as out/explore.html): one local page listing everything made so far (pictures by set, the rooms,
# 3D, sounds). Rerun to refresh: python3 evals/estonian-visuals/explore.py. Research only, not published.
import os, glob, html, json
OUT = os.path.join(os.path.dirname(__file__), 'out')
os.chdir(OUT)
def rel(p): return html.escape(p)
pages = [('drift-room/slides.html', 'Slides (picture, judge, map)'), ('drift-room/drift-types.html', 'Drift types: the twelve as a grid, one slide each, are models getting better?'), ('drift-room/cover.html', 'Cover (Ken Burns over the widened ChilloutMix picture)'), ('drift-room/story-open.html', 'The story, opening: gaps filled in (after the cover: the map, she rises away, the hole is filled, into Pakri)'), ('drift-room/story-close.html', 'The story, close: she comes back and turns round, the back the machine made up'), ('drift-room/cost.html', 'What it cost (money and energy)'), ('drift-room/costume-slides.html', 'Muhu costume by year (slides: each model, the judge, the chart)'), ('drift-room/costumes.html', 'Costume figures by year (row, map, particles, Muhu chart), version 2'), ('drift-room/klint-map.html', 'Pakri klint on the map, real photo against generated'), ('drift-room/sound-map.html', 'Music on the map: where the judge hears it from'), ('drift-room/prompt-box.html', 'Prompt box (component)'),
         ('drift-room/lauluvaljak.html', 'Song Festival Grounds room (worst first, judge, splats, anthem)'),
         ('drift-room/hermann.html', 'Pikk Hermann with the flag (room, anthem)'),
         ('drift-room/films.html', 'Film scenes: every model asked for a still from five Estonian films, the judge, the songs'),
         ('drift-room/room-splat.html', 'Room, splats'), ('drift-room/room.html', 'Room, mesh'),
         ('drift-room/land3d.html', 'Landscapes in 3D (SHARP)'), ('drift-room/figures.html', 'Costume figures in 3D (TripoSplat)'),
         ('drift-room/type-smoke.html', 'Type that smokes away (playground)'),
         ('estonia-2026-11-09.html', 'Estonia set, 2026-11-09 (judge answers)')]
# the pages being worked on, first (asked 2026-11-18: "where are our intro links, move the important ones to top")
now = [('drift-room/intro.html', 'Intro: the talk\'s main frame (title, costumes, the walk through Matsalu to the klint, nature slides, AI Estonia map, credits)'),
       ('drift-room/costumes3.html', 'Costume figurines by year, version 3 (the row, then the chart: is this Estonia?)'),
       ('drift-room/films.html', 'Film scenes: five Estonian films, every model, the judge, the songs'),
       ('drift-room/ai-estonia.html', 'AI Estonia: the drift borders map'),
       ('drift-room/laul-ee-lv.html', 'Song festival grounds, Estonia and Latvia side by side (two heats on one map)'),
       ('drift-room/laul-ja-lipp.html', 'Lauluväljak, Riga, Pikk Hermann: the rooms in one deck'),
       ('drift-room/slides.html', 'Nature slides (picture, judge, map)'),
       ('drift-room/picks.html', 'Picks: the pictures marked in every deck\'s index'),
       ('drift-room/scene-pick.html', 'Scene picker: the 3D scenes for the intro\'s walk')]
nowset = {p for p, _ in now}
pages = [x for x in pages if x[0] not in nowset]
def li(p, t): return f'<li><a href="{p}">{t}</a>{"" if os.path.exists(p) else " <i>(not built yet)</i>"}</li>'
nowlinks = ''.join(li(p, t) for p, t in now)
links = ''.join(li(p, t) for p, t in pages)
def gallery(title, pats, note=''):
    files = sorted({f for p in pats for f in glob.glob(p, recursive=True) if not os.path.basename(f).startswith(('.', 's_'))})
    files = [f for f in files if not f.endswith(('-depth.png', '.depth.png')) and 'depth' not in os.path.basename(f)]
    if not files: return ''
    items = ''.join(f'<figure><a href="{rel(f)}"><img loading="lazy" src="{rel(f)}"></a><figcaption>{rel(f)}</figcaption></figure>' for f in files)
    return f'<details><summary>{title} <span>({len(files)})</span></summary>{"<p>"+note+"</p>" if note else ""}<div class="g">{items}</div></details>'
def sounds(title, pats, note=''):
    files = sorted({f for p in pats for f in glob.glob(p, recursive=True)})
    if not files: return ''
    items = ''.join(f'<div class="a"><span>{rel(f)}</span><audio controls preload="none" src="{rel(f)}"></audio></div>' for f in files)
    return f'<details><summary>{title} <span>({len(files)})</span></summary>{"<p>"+note+"</p>" if note else ""}{items}</details>'

# The drift mechanisms (research/drift-mechanisms.md), each with the pictures and sounds that show it.
MECH = [
 ('1. Swapped for the neighbour', 'With no data on the specific place, the model fills in the nearest better-photographed one. Pakri becomes Dover; Nipernaadi\'s countryside becomes Sweden (9 of 18, none in Estonia); Setomaa becomes Czech or Slovak; a plain "1918" becomes Finland\'s. Evidence: well studied.',
  ['nature/sheet-klint.png', 'neighbours/map-klint-siglip.png', 'history/sheet-nipernaadi.jpg', 'nature/sheet-setomaa.png', 'history/sheet-manifesto_1918.jpg'], []),
 ('2. The average replaces the specific', 'The probable version wins: Muhu becomes a generic Baltic dress until the expert text is given (checks 27 % → 81 %). In text, the two deportations (1941, 1949) merge into one. Evidence: well studied.',
  ['drift-room/costume-muhu-plain-vs-text.jpg', 'drift-room/costume-kihnu-plain-vs-text.jpg', 'drift-room/figure/sheet-nano-banana-2-lite.png'], []),
 ('3. Local markers on a generic scene', 'An average scene with an Estonian sign or flag pasted on: 7 of 23 nature pictures placed in Estonia owe it to painted text or flags ("SIBULATALU"). The plain bog has North American pitcher plants, yet the boardwalk makes the judge say Estonia. Evidence: moderate, new.',
  ['nature/sheet-peipsi.png', 'nature/sheet-lighthouse.png', 'nature/flux-2-klein-4b/bog_neutral.jpg'], []),
 ('4. Taste tuning toward the dramatic', 'Models tuned for pleasing pictures pick the spectacular: 100 m cliffs for the low, flat-topped klint. Pinning the camera (an edit of a plain template) brings back the real, modest klint. Evidence: well (diversity), moderate (culture).',
  ['nature/sheet-klint.png', 'drift-room/land/sheet-nano-banana-2-lite.png'], []),
 ('5. The language of the prompt', 'English pipelines: MiniMax drops õ ("õhtu" → "öhtu", "rõõm" → "rum"); ElevenLabs keeps it. The Estonian-language answer about the deportations was the better one. Evidence: moderate.',
  [], ['sounds-research/mm-anthem-lyrics.mp3', 'sounds-research/el-ernesaks-1.mp3', 'sounds-research/films/mm-room-nipernaadi.mp3', 'sounds-research/films/room-nipernaadi.mp3']),
 ('6. Cost', 'The same text costs about 1.5× more in Estonian (tokens), which pushes people to English (Kruusmaa, Sirp 13.11.2026; to confirm). No picture. Evidence: well (cost), thin (drift).', [], []),
 ('7. Filters and refusals', 'Heritage treated as somebody\'s property: Pärt\'s name refused, Koidula\'s 1867 poem "copyrighted", named Estonian films refused (the grey tile), three of five film theme songs refused. Evidence: thin in the literature, direct here.',
  ['history/sheet-nipernaadi.jpg', 'history/sheet-kevade.jpg'], ['sounds-research/films/named-reliikvia.mp3']),
 ('8. People take on the model\'s style', 'Users drift toward what the model offers (literature, experiments). No own example yet.', [], []),
 ('9. The feedback loop', 'Generated pictures return to the web and the next model, and to people\'s memory: synthetic "archive photos" of the Baltic Way, 1918 or 1991. Why no deportation pictures were made. Evidence: well in the lab.',
  ['history/sheet-baltic_way.jpg', 'history/sheet-restoration_1991.jpg', 'history/sheet-song_festival_1869.jpg', 'history/sheet-great_flight_1944.jpg'], []),
 ('10. The checker shares the bias', 'The judge learned from the same data: real Saaremaa alvar → Öland, a pastiche "Tallinn" → Harju 0.99, the pitcher-plant bog → Estonia, Gemini 0 of 5 real Estonian birds. People from here see it at once. Evidence: our own data, the most direct.',
  ['nature/flux-2-dev/old_town.jpg', 'nature/flux-2-klein-4b/bog_neutral.jpg', 'nature/sheet-alvar.png', 'neighbours/map-alvar-siglip.png'], ['sounds-research/nature/meadow-ee.mp3', 'sounds-research/nature/control/XC656637.mp3']),
 ('11. Deference', 'People trust confident machines: the judge says "high confidence" on wrong birds and names actors who are not in the picture. Evidence: well in general, thin for culture.', [], []),
 ('12. What gets measured gets fixed', 'Public measurement moves vendors: Mistral\'s propaganda resistance 62 → 90 after EKI\'s criticism; Google flat at 79 (EKI data). No picture.', [], []),
 ('A. Are we getting better?', 'Yes on what is common (flags, spelling: 2 of 10 models spelled the sign in 2026-11; most current ones do), not on the long tail (parish costumes, endemic plants). EKI: Estonian language up, knowledge of Estonia stuck. The era ladder shows it 2022 → 2026.',
  ['sheet-estonian_text.png', 'sheet-flag.png', 'era/sheet.jpg', 'era/sheet.png', 'era/ladder.jpg', 'era/ladder.png'], []),
 ('B. Local against cloud', 'What we can run ourselves knows Estonia even less: Gemma 4 26B on this Mac placed 15 % of real Estonian photos in Estonia (Gemini Flash 55 %), but it is counted: about 5 s and 130 J an answer.',
  ['drift-room/local-slide-181.png', 'drift-room/local-slide-186.png'], []),
]
def mechanisms():
    out = ''
    for title, text, pics, snd in MECH:
        pics = [p for p in pics if os.path.exists(p)]; snd = [p for p in snd if os.path.exists(p)]
        g = ''.join(f'<figure><a href="{rel(f)}"><img loading="lazy" src="{rel(f)}"></a><figcaption>{rel(f)}</figcaption></figure>' for f in pics)
        a = ''.join(f'<div class="a"><span>{rel(f)}</span><audio controls preload="none" src="{rel(f)}"></audio></div>' for f in snd)
        out += f'<details><summary>{title}</summary><p>{text}</p>{"<div class=g>"+g+"</div>" if g else ""}{a}</details>'
    return '<h2>By drift mechanism</h2><p>Each mechanism with the examples that show it (research/drift-mechanisms.md).</p>' + out + '<h2>Everything, by set</h2>'

body = mechanisms() + ''.join([
  gallery('Song Festival Grounds (all models)', ['lauluvaljak/*/*.png', 'lauluvaljak/sheet.jpg'], "Tallinn's song festival grounds by every image model, named and plain (no Tallinn, no Estonia). Only the Nano Banana models and GPT Image 2 drew Kotli's shell; the rest drew domes, tents, rock stages and a palace."),
  gallery('Pikk Hermann with the flag (all models)', ['hermann/*/*.png', 'hermann/sheet*.jpg'], "Pikk Hermann on Toompea with the Estonian flag, named, and as 'a medieval castle tower with the national flag': which flag does a model reach for?"),
  gallery('Cover: the ChilloutMix picture widened', ['cover/*.png'], "original.png is ChilloutMix's 'Estonian folk costume' (512 px). wide-* add a background on the left as wide again, the original kept pixel for pixel on the right. GPT Image 2 has no seam; Seedream added onion domes."),
  gallery('Sheets (one row per subject)', ['sheet-*.png', 'nature/sheet-*.png', 'history/sheet-*.jpg', 'drift-room/land/sheet-*.png', 'drift-room/figure/sheet-*.png', 'era/*sheet*', 'drift-room/costume-*.jpg'], "One row per subject, every model side by side: the quickest way to see a drift. The flags, sign, coat of arms and Raekoda are the 2026-11-09 run of EKI's ten prompts; nature/ are Estonian landscapes asked for by five models (with and without the word Estonia); history/ are events and film scenes; land/ and figure/ are the one-standpoint edits for the room; costume-* put the plain prompt next to the expert text."),
  gallery('Room backgrounds: template edits and new backgrounds', ['drift-room/land/**/*.jpg', 'drift-room/land/**/*.png', 'drift-room/land/template.png'], "Backgrounds for the drift room. template.png is a plain field; most others are edits of it that keep the same camera and horizon, so they can morph into each other point by point. Folders are models (cheap, best, local); free pictures that don't share the camera pass through fog in the room."),
  gallery('Film scenes (template edits)', ['drift-room/film/**/*.jpg', 'drift-room/film/**/*.png'], "Nipernaadi, Nukitsamees, Kevade/Paunvere and Viimne reliikvia, drawn as edits of the same template, once by the film's name and once as a plain description of the scene. They play with their own generated theme songs in the room."),
  gallery('Nature set (all models)', ['nature/*/*.jpg'], "The 'where is this?' test: bog, alvar, klint, Peipsi, Setomaa, Lasnamäe and more, by five cloud models (and local ones when done). A judge guessed the country with no hints: real Estonian photos 55 % Estonia, generated 31 %, without the word Estonia 9 %. real/ are the Commons photos used as the control."),
  gallery('History and films', ['history/*/*.jpg'], 'Historical events (Baltic Way, Singing Revolution, 1918, Tartu peace, 1991, 1869 song festival, 1944 flight) and film scenes, named and as plain descriptions. Plain countryside scenes were placed in Sweden 9 of 18 times, never in Estonia; named films were often refused. No pictures of the deportations were made (text check only).'),
  gallery('Era ladder', ['era/**/*.jpg', 'era/**/*.png'], "Five years of 'an Estonian in national costume': each era's model draws the figure and, from the same era, the background (pasted and painted versions). The question 'are models getting better?' in pictures."),
  gallery('Costume pilots (research only, room only)', ['rahvaroivad/pilot/*.jpg', 'rahvaroivad/round2/gen/*.jpg'], 'Generated. Not for publishing.'),
  gallery('Room and slides screenshots', ['drift-room/*.png', 'drift-room/map/desktop-*.png'], 'How the slides and the rooms looked at each step today (mesh, splats, fog, edges, map), kept to compare versions.'),
  gallery('Neighbour maps', ['neighbours/*.png'], 'Where generated pictures sit among real photos from different countries, by two image models (DINOv2, SigLIP). Only the klint map is trustworthy (its control works): Pakri lands 0 of 10 in Estonia, near England and France. The others show a direction only.'),
  sounds('Sounds: national songs (generated)', ['sounds-research/national/*.mp3'], "Song festival songs with their real, public-domain words (Koidula, Liiv, Kuhlbars, Körber, Enno), music by the model: nat- ElevenLabs, mm- MiniMax (õ lost), named- the title only, nudge- Rändaja õhtulaul pushed toward the 1983 original by measured tempo and form."),
  sounds('Sounds: old music models (local)', ['sounds-research/era/**/*.mp3', 'sounds-research/era/**/*.wav'], 'The same descriptions through older music models on this Mac, for the era ladder.'),
  sounds('Sounds: Rändaja õhtulaul, the original (research only)', ['sounds-research/films/original/*.mp3'], "Anne Maasik's song from Nipernaadi (1983), downloaded from YouTube to measure and compare. Not for showing or sharing."),
  sounds('Sounds: nature (generated)', ['sounds-research/nature/*.mp3'], "Field recordings asked from a music model (ElevenLabs), with and without 'Estonian'. BirdNET checked the birds: the corncrake, black grouse and curlew never came; birds from elsewhere did. control/ are real Estonian recordings from xeno-canto (others' work, credit them). The clips are quiet: turn up."),
  sounds('Sounds: film theme songs', ['sounds-research/films/*.mp3'], "New songs for the film scenes (lyrics written for the room, no real songs copied), plus what the model invents when asked for a film's theme by name (three of five were refused as copyrighted)."),
  sounds('Sounds: finale mixes and beds', ['sounds-research/finale/*.mp3'], 'Candidates for the end: the tintinnabuli rule dissolving into a generic bed and back, and the anthem mixes (removed from the room, kept here).'),
  sounds('Sounds: anthem, Ernesaks, regilaul, Pärt tests', ['sounds-research/*.mp3', 'sounds-research/*.wav'], "The first music tests: the anthem (Pacius's tune, shared with Finland), Ernesaks's choir song, regilaul, 'Pärt style' (refused by ElevenLabs), and the tintinnabuli rule as code (the WAV). el- is ElevenLabs, mm- is MiniMax (which drops õ)."),
])
css = 'body{font:15px/1.5 system-ui;margin:24px;background:#e6e4df;color:#4f4c47}a{color:#0072ce}summary{cursor:pointer;font-size:18px;margin:14px 0 6px}summary span{opacity:.5}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}img{width:100%;border-radius:2px}figcaption{font-size:11px;opacity:.6;word-break:break-all}.a{display:flex;gap:12px;align-items:center;margin:4px 0}.a span{font-size:12px;width:22em;word-break:break-all}'
# the page is index.html, so the server's root opens it (asked 2026-11-18: "just index html"); explore.html kept for old links
page = f'<!doctype html><meta charset=utf-8><title>Drift work so far</title><style>{css}</style><h1>Drift work so far</h1><p>Local only, research.</p><h2>Working on now</h2><ul>{nowlinks}</ul><h2>Other pages</h2><ul>{links}</ul>{body}'
for name in ('index.html', 'explore.html'): open(name, 'w').write(page)
print('explore.html written')
