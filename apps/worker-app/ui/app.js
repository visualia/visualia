// The window: the key, Join / Leave, and what the worker reports (no prompts).
const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;
const $ = (id) => document.getElementById(id);
let inPool = false;
let ready = false; // at least one model this app can serve is downloaded

// ---- Ollama and the models -----------------------------------------------------
const NAMES = { 'qwen3.5-9b': 'Qwen 3.5 (9B)', 'gemma4-26b': 'Gemma 4 (26B)' };
let downloading = null; // { tag, percent }
let models = []; // from the last check

async function check() {
  const c = await invoke('check');
  $('no-ollama').hidden = c.ollama;
  $('have-ollama').hidden = !c.ollama;
  $('memory').textContent = c.memory_gb ? `This computer has ${c.memory_gb} GB of memory.` : '';
  ready = !!c.ready;
  if (c.ollama) { models = c.models; drawModels(); }
  if (!inPool) {
    $('toggle').disabled = !ready;
    $('status').textContent = !c.ollama ? 'Get Ollama first' : ready ? 'Not in the pool' : 'Get a model first';
  }
}

function drawModels() {
  $('model-list').replaceChildren(...models.map((m) => {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = NAMES[m.name] ?? m.name;
    const state = document.createElement('span');
    if (m.here) state.textContent = 'Ready';
    else if (!m.fits) { state.className = 'quiet'; state.textContent = `Needs ${m.need_gb} GB of memory`; }
    else if (downloading?.tag === m.tag) {
      state.append(`Downloading ${downloading.percent ?? 0}% · `, link('Stop', () => invoke('stop_download')));
    } else state.append(link(`Get (${m.gb} GB)`, () => getModel(m.tag), !!downloading));
    li.append(name, state);
    return li;
  }));
}

function link(text, onclick, off = false) {
  const a = document.createElement('a');
  a.href = '#'; a.textContent = text;
  if (off) a.className = 'quiet';
  a.onclick = (e) => { e.preventDefault(); if (!off) onclick(); };
  return a;
}

async function getModel(tag) {
  try { await invoke('get_model', { tag }); downloading = { tag, percent: 0 }; await check(); }
  catch (err) { $('memory').textContent = String(err); }
}

listen('download', async ({ payload: d }) => {
  if (d.done || d.error) {
    downloading = null;
    await check();
    if (d.error && d.error !== 'stopped') $('memory').textContent = `The download failed: ${d.error}`;
    return;
  }
  if (downloading?.percent === d.percent) return;
  downloading = { tag: d.tag, percent: d.percent };
  drawModels();
});

$('get-ollama').onclick = (e) => { e.preventDefault(); invoke('open_get_ollama'); };
for (const a of document.querySelectorAll('.recheck')) a.onclick = (e) => { e.preventDefault(); check(); };

async function show() {
  const hasKey = await invoke('has_key');
  $('key').hidden = hasKey;
  $('pool').hidden = $('forget').hidden = !hasKey;
}

$('key-form').onsubmit = async (e) => {
  e.preventDefault();
  try {
    await invoke('save_key', { key: $('key-input').value });
    $('key-input').value = '';
    await show();
  } catch (err) {
    $('key-note').textContent = String(err);
  }
};

$('toggle').onclick = async () => {
  $('toggle').disabled = true;
  try {
    if (inPool) { await invoke('leave'); setOut('Not in the pool'); }
    else { $('status').textContent = 'Joining…'; await invoke('join'); inPool = true; $('toggle').textContent = 'Leave'; }
  } catch (err) {
    setOut(String(err));
  }
  $('toggle').disabled = !inPool && !ready;
};

$('forget').onclick = async () => { await invoke('forget_key'); setOut('Not in the pool'); await show(); };

function setOut(text) {
  inPool = false;
  $('toggle').textContent = 'Join';
  $('toggle').disabled = !ready;
  $('status').textContent = text;
  $('serving').hidden = true;
}

const time = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function onEvent(e) {
  if (e.type === 'joined') {
    $('status').textContent = `In the pool as ${e.person}`;
    $('serving').hidden = false;
    $('models').textContent = e.models.join(', ');
  } else if (e.type === 'waiting') {
    $('status').textContent = `${e.why[0].toUpperCase()}${e.why.slice(1)}. Trying again in ${e.seconds} s.`;
  } else if (e.type === 'temp') {
    $('temp').textContent = `${e.gpu_c} °C`;
  } else if (e.type === 'cooling') {
    $('status').textContent = `Cooling down (${e.gpu_c} °C): no jobs for a moment`;
  } else if (e.type === 'cooled') {
    $('status').textContent = 'In the pool';
  } else if (e.type === 'left' || e.type === 'stopped') {
    if (inPool) setOut('Not in the pool');
  } else if (e.type === 'job') {
    const li = document.createElement('li');
    const what = e.failed
      ? `${e.model}, ${e.failed === 'cancelled' ? 'stopped' : 'failed'}`
      : `${e.model}, ${e.kind === 'decide' ? 'a decision' : `${e.tokens} tokens`}`;
    const cost = e.failed ? `${e.seconds.toFixed(1)} s` : `${e.seconds.toFixed(1)} s, ${e.energy_j == null ? '?' : Math.round(e.energy_j)} J`;
    for (const text of [time(e.t), what, cost]) { const span = document.createElement('span'); span.textContent = text; li.append(span); }
    $('jobs').prepend(li);
    while ($('jobs').children.length > 50) $('jobs').lastChild.remove();
    $('jobs-section').hidden = false;
  }
}

listen('worker', ({ payload }) => onEvent(payload));

// The worker may already be running (started with --join, or the window reloaded).
show().then(check).then(async () => {
  const { running, last } = await invoke('status');
  if (!running) return;
  inPool = true;
  $('toggle').textContent = 'Leave';
  $('toggle').disabled = false;
  $('status').textContent = 'Joining…';
  if (last) onEvent(last);
});
