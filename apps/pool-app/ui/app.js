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
  spaced($('machine'), [c.chip ?? '', t('memory', { gb: c.memory_gb ?? '?' }), c.mlx ? t('mlx') : '']);
  ready = !!c.ready;
  if (c.ollama) { models = c.models; drawModels(); }
  if (!inPool) {
    $('toggle').disabled = !ready;
    $('status').textContent = !c.ollama ? '' : ready ? t('not-in-pool') : t('get-model-first');
  }
}

function drawModels() {
  $('model-list').replaceChildren(...models.map((m) => {
    const tr = document.createElement('tr');
    const name = cell('name', m.label); // from the model list
    // What it is for: the words are here, by the pool's name; none for a model the list doesn't know.
    const purpose = t(`for-${m.name}`);
    const what = cell('for quiet', purpose === `for-${m.name}` ? '' : purpose);
    const state = cell('state', '');
    if (m.here) {
      state.append(t('model-ready'));
      // Removing waits until the computer is out of the pool.
      if (!inPool && !downloading) {
        const x = link(t('model-remove'), () => removeModel(m.tag));
        x.className = 'remove apart';
        x.title = t('model-remove-label', { model: m.label });
        x.setAttribute('aria-label', x.title);
        state.append(x);
      }
    } else if (!m.fits) { state.classList.add('quiet'); state.textContent = t('model-needs', { gb: m.need_gb }); }
    else if (!m.disk) { state.classList.add('quiet'); state.textContent = t('model-needs-disk', { gb: m.disk_gb }); }
    else if (downloading?.tag === m.tag) {
      const stop = link(t('stop'), () => invoke('stop_download'));
      stop.className = 'apart';
      state.append(t('model-downloading', { percent: downloading.percent ?? 0 }), stop);
    } else {
      const size = m.gb < 1 ? t('size-mb', { mb: Math.round(m.gb * 1000) }) : t('size-gb', { gb: m.gb });
      state.append(link(t('model-get', { size }), () => getModel(m.tag), !!downloading));
    }
    tr.append(name, what, state);
    return tr;
  }));
}

function cell(className, text) {
  const td = document.createElement('td');
  td.className = className;
  td.textContent = text;
  return td;
}

// Values side by side with a wide space between them, no separator characters.
function spaced(el, parts) {
  el.replaceChildren(...parts.filter(Boolean).map((p, i) => {
    const s = document.createElement('span');
    s.textContent = p;
    if (i) s.className = 'apart';
    return s;
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

async function removeModel(tag) {
  try { await invoke('remove_model', { tag }); await check(); }
  catch (err) { note(t('remove-failed', { error: String(err) })); }
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
  // With a key saved the app starts with the computer and joins (a login item
  // opened with --join); "Forget the key" takes the login item away too.
  invoke('set_autostart', { on: hasKey }).catch(() => {});
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
  try { $('status').textContent = t('joining'); await invoke('join'); inPool = true; $('toggle').textContent = t('leave'); drawModels(); }
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
  drawModels();
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

const num = (n) => n.toLocaleString(undefined, { maximumSignificantDigits: 21 });
const oneDecimal = new Intl.NumberFormat(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const time = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function onEvent(e) {
  if (e.type === 'joined') {
    $('status').textContent = t('in-pool-as', { person: e.person });
  } else if (e.type === 'waiting') {
    $('status').textContent = t('trying-again', { why: `${e.why[0].toUpperCase()}${e.why.slice(1)}`, seconds: e.seconds });
  } else if (e.type === 'live') {
    $('live').hidden = !inPool;
    spaced($('live'), [t('live-memory', { used: e.mem_used_gb, total: e.mem_total_gb }), t('live-heat', { c: e.c ?? '?', pause: e.pause_c }), t('live-power', { watts: e.watts })]);
  } else if (e.type === 'cooling') {
    $('status').textContent = t('cooling', { c: e.gpu_c });
  } else if (e.type === 'cooled') {
    $('status').textContent = t('in-pool');
  } else if (e.type === 'left' || e.type === 'stopped') {
    if (inPool) setOut(t('not-in-pool'));
  } else if (e.type === 'job') {
    const tr = document.createElement('tr');
    const model = e.model.replace(/^pool\//, ''); // every model here is a pool model
    // The tokens column says what came of it when there are no tokens to count.
    const tokens = e.failed
      ? e.failed === 'cancelled' ? t('job-stopped') : t('job-failed')
      : e.kind === 'decide' ? t('job-decision') : num(e.tokens);
    const energy = e.failed || e.energy_j == null ? '' : num(wh(e.energy_j));
    if (!e.failed && e.energy_j != null) addToday(e.energy_j);
    for (const [text, cls] of [[time(e.t), 'clock'], [model, ''], [tokens, 'n'], [oneDecimal.format(e.seconds), 'n'], [energy, 'n']]) { const td = document.createElement('td'); td.textContent = text; td.className = cls; tr.append(td); }
    $('job-rows').prepend(tr);
    while ($('job-rows').children.length > 50) $('job-rows').lastChild.remove();
    $('jobs-section').hidden = false;
  }
}

listen('worker', ({ payload }) => onEvent(payload));

// ---- updates: found by the app, installed only on a click -------------------------
function showUpdate(version) {
  $('update').hidden = false;
  $('update-text').textContent = t('update-ready', { version });
  $('update-go').hidden = false;
}

$('update-go').onclick = async (e) => {
  e.preventDefault();
  $('update-go').hidden = true;
  $('update-text').textContent = t('updating');
  try { await invoke('install_update'); } // the app restarts when it is done
  catch (err) { $('update-text').textContent = t('update-failed', { error: String(err) }); $('update-go').hidden = false; }
};

listen('update', ({ payload: u }) => {
  if (u.version) showUpdate(u.version);
  else $('update-text').textContent = u.percent == null ? t('updating') : t('updating-percent', { percent: u.percent });
});

async function showVersion() {
  const u = await invoke('update_status');
  $('version').textContent = u.off ? t('version-off', { version: u.current }) : t('version', { version: u.current });
  if (u.ready) showUpdate(u.ready);
}

// The worker may already be running (started with --join, or the window reloaded).
textReady.then(show).then(showVersion).then(check).then(async () => {
  const { running, last } = await invoke('status');
  // Automatic: with a key saved and a model ready, opening the app joins.
  if (!running) { if (await invoke('has_key') && ready) await join(); return; }
  inPool = true;
  drawModels();
  $('toggle').textContent = t('leave');
  $('toggle').disabled = false;
  $('status').textContent = t('joining');
  if (last) onEvent(last);
});
