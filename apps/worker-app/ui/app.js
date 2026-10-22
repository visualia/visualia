// The window: the key, Join / Leave, and what the worker reports (no prompts).
const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;
const $ = (id) => document.getElementById(id);
let inPool = false;
let ready = false; // at least one model this app can serve is downloaded

// ---- Ollama and the models -----------------------------------------------------
let downloading = null; // { tag, percent }
let models = []; // from the last check

async function check() {
  const c = await invoke('check');
  $('no-ollama').hidden = c.ollama;
  $('have-ollama').hidden = !c.ollama;
  const machine = { chip: c.chip ?? '', gb: c.memory_gb ?? '?' };
  $('machine').textContent = c.mlx ? t('machine-mlx', machine) : t('machine', machine);
  ready = !!c.ready;
  if (c.ollama) { models = c.models; drawModels(); }
  if (!inPool) {
    $('toggle').disabled = !ready;
    $('status').textContent = !c.ollama ? '' : ready ? t('not-in-pool') : t('get-model-first');
  }
}

function drawModels() {
  $('model-list').replaceChildren(...models.map((m) => {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = t(`model-${m.name}`);
    const state = document.createElement('span');
    if (m.here) state.textContent = t('model-ready');
    else if (!m.fits) { state.className = 'quiet'; state.textContent = t('model-needs', { gb: m.need_gb }); }
    else if (downloading?.tag === m.tag) {
      state.append(`${t('model-downloading', { percent: downloading.percent ?? 0 })} · `, link(t('stop'), () => invoke('stop_download')));
    } else state.append(link(t('model-get', { gb: m.gb }), () => getModel(m.tag), !!downloading));
    li.append(name, state);
    return li;
  }));
}

function note(text) { $('note').hidden = !text; $('note').textContent = text; }

function link(text, onclick, off = false) {
  const a = document.createElement('a');
  a.href = '#'; a.textContent = text;
  if (off) a.className = 'quiet';
  a.onclick = (e) => { e.preventDefault(); if (!off) onclick(); };
  return a;
}

async function getModel(tag) {
  try { await invoke('get_model', { tag }); downloading = { tag, percent: 0 }; await check(); }
  catch (err) { note(String(err)); }
}

listen('download', async ({ payload: d }) => {
  if (d.done || d.error) {
    downloading = null;
    await check();
    if (d.error && d.error !== 'stopped') note(t('download-failed', { error: d.error }));
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
    if (ready && !inPool) await join(); // a saved key means "put me in the pool"
  } catch (err) {
    $('key-note').textContent = String(err);
  }
};

async function join() {
  $('toggle').disabled = true;
  try { $('status').textContent = t('joining'); await invoke('join'); inPool = true; $('toggle').textContent = t('leave'); }
  catch (err) { setOut(String(err)); }
  $('toggle').disabled = !inPool && !ready;
}

$('toggle').onclick = async () => {
  if (!inPool) return join();
  $('toggle').disabled = true;
  try { await invoke('leave'); setOut(t('not-in-pool')); }
  catch (err) { setOut(String(err)); }
  $('toggle').disabled = !inPool && !ready;
};

$('forget').onclick = async () => { await invoke('forget_key'); setOut(t('not-in-pool')); await show(); };

function setOut(text) {
  inPool = false;
  $('toggle').textContent = t('join');
  $('toggle').disabled = !ready;
  $('status').textContent = text;
  $('live').hidden = true;
}

// Energy: watts live, watt-hours for work (joules / 3600), two significant digits.
const wh = (j) => Number((j / 3600).toPrecision(2));
let today = { day: new Date().toDateString(), j: 0 };
function addToday(j) {
  const day = new Date().toDateString();
  if (day !== today.day) today = { day, j: 0 };
  today.j += j;
  $('today').textContent = t('today', { wh: wh(today.j) });
}

const time = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function onEvent(e) {
  if (e.type === 'joined') {
    $('status').textContent = t('in-pool-as', { person: e.person });
  } else if (e.type === 'waiting') {
    $('status').textContent = t('trying-again', { why: `${e.why[0].toUpperCase()}${e.why.slice(1)}`, seconds: e.seconds });
  } else if (e.type === 'live') {
    $('live').hidden = !inPool;
    $('live').textContent = t('live', { used: e.mem_used_gb, total: e.mem_total_gb, c: e.c ?? '?', pause: e.pause_c, watts: e.watts });
  } else if (e.type === 'cooling') {
    $('status').textContent = t('cooling', { c: e.gpu_c });
  } else if (e.type === 'cooled') {
    $('status').textContent = t('in-pool');
  } else if (e.type === 'left' || e.type === 'stopped') {
    if (inPool) setOut(t('not-in-pool'));
  } else if (e.type === 'job') {
    const li = document.createElement('li');
    const model = e.model.replace(/^pool\//, ''); // every model here is a pool model
    const what = e.failed
      ? e.failed === 'cancelled' ? t('job-stopped', { model }) : t('job-failed', { model })
      : e.kind === 'decide' ? t('job-decision', { model }) : t('job-tokens', { model, tokens: e.tokens });
    const seconds = e.seconds.toFixed(1);
    const cost = e.failed || e.energy_j == null ? t('job-time', { seconds }) : t('job-cost', { seconds, wh: wh(e.energy_j) });
    if (!e.failed && e.energy_j != null) addToday(e.energy_j);
    for (const text of [time(e.t), what, cost]) { const span = document.createElement('span'); span.textContent = text; li.append(span); }
    $('jobs').prepend(li);
    while ($('jobs').children.length > 50) $('jobs').lastChild.remove();
    $('jobs-section').hidden = false;
  }
}

listen('worker', ({ payload }) => onEvent(payload));

// Start with this computer: the app's own login item, opened with --join.
invoke('get_autostart').then((on) => { $('autostart').checked = on; });
$('autostart').onchange = async () => {
  try { $('autostart').checked = await invoke('set_autostart', { on: $('autostart').checked }); }
  catch (err) { $('autostart').checked = !$('autostart').checked; $('status').textContent = String(err); }
};

// The worker may already be running (started with --join, or the window reloaded).
textReady.then(show).then(check).then(async () => {
  const { running, last } = await invoke('status');
  if (!running) return;
  inPool = true;
  $('toggle').textContent = t('leave');
  $('toggle').disabled = false;
  $('status').textContent = t('joining');
  if (last) onEvent(last);
});
