'use strict';
(async () => {
  const box = document.getElementById('box');
  const t = new URLSearchParams(location.search).get('t') || '';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LABEL = { confirmado: 'Confirmado', pendente: 'Aguardando confirmação', cancelado: 'Cancelado', atendido: 'Atendido', faltou: 'Não compareceu' };
  async function load() {
    const res = await fetch(`/api/agendamento-link?t=${encodeURIComponent(t)}`);
    const a = await res.json();
    if (!res.ok) { box.innerHTML = `<h1>Link inválido</h1><p class="muted">${esc(a.erro || '')}</p><a class="btn btn-gold" href="./#agendar">Ir para a agenda</a>`; return; }
    const canCancel = ['confirmado', 'pendente'].includes(a.status);
    box.innerHTML = `<h1 style="font-size:1.6rem">Olá, ${esc(a.primeiro_nome)}!</h1>
      <p><b>${esc(a.servico)}</b> com <b>${esc(a.barbeiro)}</b><br>${esc(a.dia_semana)}, ${esc(a.data)} às ${esc(a.hora)}</p>
      <p><span class="tag ${a.status === 'confirmado' ? 'ok' : 'warn'}">${LABEL[a.status] || a.status}</span></p>
      <div class="form-error" id="err" hidden></div>
      <div class="actions">${canCancel ? '<button class="btn btn-outline" id="cancel" type="button">Cancelar horário</button>' : ''}<a class="btn btn-gold" href="./#agendar">${canCancel ? 'Remarcar' : 'Agendar novo horário'}</a></div>
      ${canCancel ? '<p class="muted small" style="margin-top:1rem">Para remarcar, cancele este e escolha outro horário.</p>' : ''}`;
    const c = document.getElementById('cancel');
    if (c) c.addEventListener('click', async () => {
      if (!confirm('Cancelar este horário?')) return;
      c.disabled = true;
      const r = await fetch('/api/agendamento-link/cancelar', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' }, body: JSON.stringify({ t }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { const e = document.getElementById('err'); e.textContent = d.erro || 'Não foi possível cancelar.'; e.hidden = false; c.disabled = false; return; }
      load();
    });
  }
  load();
})();
