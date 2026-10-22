// The window: the key, Join / Leave, and what the worker reports (no prompts).
const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;
const $ = (id) => document.getElementById(id);
let inPool = false;

async function show() {
  const hasKey = await invoke('has_key');
  $('key').hidden = hasKey;
  $('pool').hidden = $('jobs-section').hidden = $('forget').hidden = !hasKey;
}

$('key-form').onsubmit = async (e) => {
  e.preventDefault();
  try {
    await invoke('save_key', { key: $('key-input').value });
    $('key-input').value = '';
    await listen('worker', ({ payload }) => onEvent(payload));

// The worker may already be running (started with --join, or the window reloaded).
show().then(async () => {
  const { running, last } = await invoke('status');
  if (!running) return;
  inPool = true;
  $('toggle').textContent = 'Leave';
  $('status').textContent = 'Joining…';
  if (last) onEvent(last);
});
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
  $('toggle').disabled = false;
};

$('forget').onclick = async () => { await invoke('forget_key'); setOut('Not in the pool'); await show(); };

function setOut(text) {
  inPool = false;
  $('toggle').textContent = 'Join';
  $('status').textContent = text;
  $('models').textContent = '–';
}

const time = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function onEvent(e) {
  if (e.type === 'joined') {
    $('status').textContent = `In the pool as ${e.person}`;
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
    $('no-jobs').hidden = true;
  }
}

listen('worker', ({ payload }) => onEvent(payload));

// The worker may already be running (started with --join, or the window reloaded).
show().then(async () => {
  const { running, last } = await invoke('status');
  if (!running) return;
  inPool = true;
  $('toggle').textContent = 'Leave';
  $('status').textContent = 'Joining…';
  if (last) onEvent(last);
});
