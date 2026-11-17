'use strict';
const $ = id => document.getElementById(id);
let state = { people: [], hasDraw: false, version: 0 };
let busy = false;
let connected = false;
async function request(url, options = {}) {
  const response = await fetch(url, { cache: 'no-store', ...options });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'No se pudo completar la solicitud.');
  return result;
}
async function refresh() { state = await request('/api/state'); connected = true; render(); }
async function mutate(url, method, extra = {}) {
  if (busy) return false;
  busy = true; render(); $('message').textContent = '';
  try {
    state = await request(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: state.version, ...extra }) });
    return true;
  } catch (error) {
    $('message').textContent = error.message;
    try { await refresh(); } catch { connected = false; }
    return false;
  } finally { busy = false; render(); }
}
function allowChange() { return !state.hasDraw || confirm('Cambiar los participantes eliminará el sorteo actual. ¿Continuar?'); }
function render() {
  $('participants').replaceChildren();
  for (const person of state.people) {
    const li = document.createElement('li');
    const avatar = document.createElement('span'); avatar.className = 'avatar'; avatar.textContent = person.name.slice(0, 1).toLocaleUpperCase('es');
    const name = document.createElement('span'); name.className = 'person-name'; name.textContent = person.name;
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove'; remove.textContent = '×'; remove.disabled = busy || !connected; remove.setAttribute('aria-label', `Eliminar a ${person.name}`);
    remove.addEventListener('click', () => { if (allowChange()) mutate(`/api/people/${person.id}`, 'DELETE'); });
    li.append(avatar, name, remove); $('participants').append(li);
  }
  const count = state.people.length;
  $('count').textContent = count; $('empty').hidden = count > 0; $('clear').hidden = count === 0;
  $('draw').disabled = busy || !connected || count < 3;
  $('clear').disabled = busy || !connected;
  $('participant-form').querySelector('button').disabled = busy || !connected;
  $('draw').firstChild.textContent = state.hasDraw ? 'Volver a sortear ' : 'Sortear amigos secretos ';
  $('draw-hint').textContent = count < 3 ? `Faltan ${3 - count} participante${3 - count === 1 ? '' : 's'} para comenzar.` : `${count} participantes. Todo listo para sorprender.`;
  $('results').hidden = !state.hasDraw;
  const selected = $('person').value;
  $('person').replaceChildren(new Option('Selecciona tu nombre', ''));
  state.people.forEach(p => $('person').add(new Option(p.name, p.id)));
  $('person').value = selected;
  $('reveal').disabled = busy || !connected || !$('person').value;
}
$('participant-form').addEventListener('submit', async event => {
  event.preventDefault();
  const name = $('name').value.trim().replace(/\s+/g, ' ');
  if (!name) { $('message').textContent = 'Escribe un nombre para continuar.'; return; }
  if (!allowChange()) return;
  if (await mutate('/api/people', 'POST', { name })) { $('name').value = ''; $('name').focus(); }
});
$('clear').addEventListener('click', async () => {
  if (confirm('¿Eliminar todos los participantes y el sorteo?') && await mutate('/api/people', 'DELETE')) $('name').focus();
});
$('draw').addEventListener('click', async () => {
  if (state.hasDraw && !confirm('¿Realizar un nuevo sorteo? Las asignaciones actuales se reemplazarán.')) return;
  if (await mutate('/api/draw', 'POST')) $('results').scrollIntoView({ behavior: 'smooth', block: 'center' });
});
$('person').addEventListener('change', () => { $('reveal').disabled = busy || !connected || !$('person').value; });
$('reveal').addEventListener('click', async () => {
  if (busy || !$('person').value) return;
  busy = true; render();
  try { const recipient = await request(`/api/secret/${$('person').value}`); $('recipient').textContent = recipient.name; $('secret').showModal(); }
  catch (error) { $('message').textContent = error.message; }
  finally { busy = false; render(); }
});
function hideSecret() { $('secret').close(); }
$('close-secret').addEventListener('click', hideSecret);
$('hide-secret').addEventListener('click', hideSecret);
$('secret').addEventListener('close', () => { $('recipient').textContent = ''; $('person').value = ''; $('reveal').disabled = true; });
window.addEventListener('focus', () => { if (!busy && !$('secret').open) refresh().catch(() => { connected = false; render(); $('message').textContent = 'No hay conexión con el servidor. Recarga para reintentar.'; }); });
render();
refresh().catch(() => { $('message').textContent = 'No se pudo conectar. Inicia el servidor con node server.cjs y abre http://localhost:3000.'; });

