// The task checks against hand-made answers, no model and no browser: each check
// must pass a right answer and fail a wrong one. Usage: node tasks-test.mjs

import { TASKS, loadFixture, openingMessages, judge, cssOnlyHeadingColour, factCheck, importMapCheck, linkCheck } from './tasks.mjs';

const task = Object.fromEntries(TASKS.map((t) => [t.id, t]));
let bad = 0;
const expect = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) bad++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `  got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`); };
const page = (body, head = '') => `<!doctype html>\n<html lang="et">\n<head><meta charset="utf-8">${head}<link rel="stylesheet" href="style.css"></head>\n<body>${body}<script type="module" src="main.js"></script></body>\n</html>`;
const good = { clean: true, visible: true, fits: true, text: '', h1: [], responses: [] };

expect('five tasks, ids unique', [TASKS.length, new Set(TASKS.map((t) => t.id)).size], [5, 5]);
expect('every brief is Estonian and non-empty', TASKS.every((t) => t.brief.length > 20), true);

// Fixtures load, and a fixture is shown as read results after the brief.
const site = loadFixture('punane');
expect('punane fixture files', Object.keys(site), ['about.html', 'index.html', 'main.js', 'style.css']);
expect('punane fixture links are whole', linkCheck(site).missing, []);
const msgs = openingMessages(task.punane, 'S', site);
expect('opening: system, brief, reads, results', msgs.map((m) => m.role), ['system', 'user', 'assistant', 'tool', 'tool', 'tool', 'tool']);
expect('opening: brief is the user turn', msgs[1].content, task.punane.brief);
expect('opening without a fixture', openingMessages(task.spiraal, 'S', {}).length, 2);

// 1 spiraal: three files, relative links.
const spiral = { 'index.html': page('<canvas></canvas>', '<script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.11.3/p5.min.js"></script>'), 'style.css': 'body{margin:0}', 'main.js': 'function setup(){}' };
expect('spiraal right answer, static only', judge(task.spiraal, spiral).failed, []);
expect('spiraal right answer, browser good', judge(task.spiraal, spiral, { 'index.html': good }).pass, true);
expect('spiraal pass is unknown without a browser', judge(task.spiraal, spiral).pass, null);
expect('spiraal missing main.js', judge(task.spiraal, Object.fromEntries(Object.entries(spiral).filter(([p]) => p !== 'main.js'))).failed, ['missing main.js', 'broken link index.html→main.js']);
expect('spiraal absolute link', judge(task.spiraal, { ...spiral, 'index.html': spiral['index.html'].replace('href="style.css"', 'href="/style.css"') }).failed, ['1 absolute links', 'index.html does not link style.css']);
expect('spiraal page check fails', judge(task.spiraal, spiral, { 'index.html': { ...good, fits: false } }).pass, false);

// 2 punane: only the h1 colour may change in style.css.
const red = (css) => ({ ...site, 'style.css': css });
const h1Red = site['style.css'].replace('color: #0d3b66;', 'color: red;');
expect('css: unchanged is fine', cssOnlyHeadingColour(site['style.css'], site['style.css']).problems, []);
expect('css: h1 colour changed is fine', cssOnlyHeadingColour(site['style.css'], h1Red).problems, []);
expect('css: whitespace and comments do not count', cssOnlyHeadingColour(site['style.css'], '/* x */\n' + h1Red.replace(/\n {2}/g, '\n\t')).problems, []);
expect('css: an added h1 { color } rule is fine', cssOnlyHeadingColour(site['style.css'], site['style.css'] + '\nheader h1 { color: #e00; }').problems, []);
expect('css: an h1 font-size change fails', cssOnlyHeadingColour(site['style.css'], h1Red.replace('font-size: 2.25rem', 'font-size: 3rem')).problems, ['changed h1']);
expect('css: another rule changed fails', cssOnlyHeadingColour(site['style.css'], h1Red.replace('--ink: #1b1b1f', '--ink: red')).problems, [`changed :root`]);
expect('css: a rule removed fails', cssOnlyHeadingColour(site['style.css'], h1Red.replace(/#kell \{[^}]*\}/, '')).problems, ['removed #kell']);
expect('css: a new non-heading rule fails', cssOnlyHeadingColour(site['style.css'], h1Red + '\np { color: red; }').problems, ['added p']);
expect('css: h1 with a background fails', cssOnlyHeadingColour(site['style.css'], site['style.css'] + '\nh1 { color: red; background: pink; }').problems, ['added h1']);
const both = { 'index.html': { ...good, h1: [[255, 0, 0]] }, 'about.html': { ...good, h1: [[220, 20, 60]] } };
expect('punane right answer', judge(task.punane, red(h1Red), both).pass, true);
expect('punane h1 not red on one page', judge(task.punane, red(h1Red), { ...both, 'about.html': { ...good, h1: [[13, 59, 102]] } }).failed, ['about.html: h1 is rgb(13, 59, 102), not red']);
expect('punane main.js touched', judge(task.punane, { ...red(h1Red), 'main.js': site['main.js'] + '\n// x' }, both).failed, ['main.js changed']);
expect('punane inline red, css untouched', judge(task.punane, site, both).pass, true);

// 3 viga: clean, and nothing else lost.
const broken = loadFixture('viga');
const fixed = { ...broken, 'main.js': broken['main.js'].replace("getElementById('kell')", "getElementById('aeg')") };
const running = { 'index.html': { ...good, visible: false, text: 'Päev ja kell Tere päevast! Kell on 14:05:09' } };
expect('viga fixture has the bug', broken['main.js'].includes("getElementById('kell')") && broken['index.html'].includes('id="aeg"'), true);
expect('viga line 7 is the throwing line', broken['main.js'].split('\n')[6].trim().startsWith('aeg.textContent'), true);
expect('viga fixed', judge(task.viga, fixed, running).pass, true);
expect('viga still erroring', judge(task.viga, broken, { 'index.html': { ...running['index.html'], clean: false, text: 'Päev ja kell Tere päevast! Kell on --:--:--' } }).failed, ['page text lacks /\\b\\d{1,2}:\\d{2}:\\d{2}\\b/']);
expect('viga clock deleted to silence it', judge(task.viga, { ...fixed, 'index.html': fixed['index.html'].replace(/<p class="kell">.*<\/p>/, '') }, { 'index.html': { ...good, text: 'Päev ja kell Tere päevast!' } }).failed, ['index.html lost Kell on', 'page text lacks /\\b\\d{1,2}:\\d{2}:\\d{2}\\b/']);
expect('viga css changed', judge(task.viga, { ...fixed, 'style.css': broken['style.css'] + 'p{}' }, running).failed, ['style.css changed']);

// 4 kivid: an import map from a pinned CDN URL, imported by its bare name.
const url = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
const map = (u) => `<script type="importmap">{ "imports": { "three": "${u}" } }</script>`;
const stones = { 'index.html': page('<canvas></canvas>', map(url)), 'style.css': 'body{margin:0}', 'main.js': "import * as THREE from 'three';" };
expect('kivid map', importMapCheck(stones, ['index.html'], 'three'), { url, problems: [] });
expect('kivid resolves', judge(task.kivid, stones, { 'index.html': { ...good, responses: [{ url, status: 200 }] } }).pass, true);
expect('kivid 404 on the map URL', judge(task.kivid, stones, { 'index.html': { ...good, responses: [{ url, status: 404 }] } }).failed, [`import map URL did not load: ${url}`]);
expect('kivid unpinned', importMapCheck({ ...stones, 'index.html': page('', map('https://cdn.jsdelivr.net/npm/three/build/three.module.js')) }, ['index.html'], 'three').problems, ['three has no exact version: https://cdn.jsdelivr.net/npm/three/build/three.module.js']);
expect('kivid other host', importMapCheck({ ...stones, 'index.html': page('', map('https://unpkg.com/three@0.170.0/build/three.module.js')) }, ['index.html'], 'three').problems.length, 1);
expect('kivid no bare import', importMapCheck({ ...stones, 'main.js': `import * as THREE from '${url}';` }, ['index.html'], 'three').problems, ['nothing imports "three" by its bare name']);
expect('kivid no map', importMapCheck({ ...stones, 'index.html': page('') }, ['index.html'], 'three').problems, ['no import map']);

// 5 plakat: every fact verbatim.
const poster = 'Eesti Kunstiakadeemia Avatud uste päev 14. märts 12–18 Põhja pst 7, Tallinn';
expect('plakat all facts', factCheck(task.plakat.facts, poster).missing, []);
expect('plakat hyphen for en dash', factCheck(task.plakat.facts, poster.replace('12–18', '12-18')).missing, ['12–18']);
expect('plakat decomposed õ still matches', factCheck(task.plakat.facts, poster.normalize('NFD')).missing, []);
expect('plakat line break inside a fact', factCheck(task.plakat.facts, poster.replace('14. märts', '14.\n märts')).missing, []);
expect('plakat poster.html instead of index.html', judge(task.plakat, { 'plakat.html': page(poster) }, { 'plakat.html': { ...good, text: poster } }).pass, true);
expect('plakat a fact lost', judge(task.plakat, { 'index.html': page('x') }, { 'index.html': { ...good, text: poster.replace('Põhja pst 7', 'Põhja puiestee 7') } }).failed, ['fact missing: Põhja pst 7']);

console.log(bad ? `\n${bad} failed` : '\nall checks behave');
process.exit(bad ? 1 : 0);
