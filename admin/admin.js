'use strict';
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const brl = (c) => ((c || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const TZ = 'America/Sao_Paulo';
  const dt = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
  const dOnly = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: TZ }) : '—');
  const hm = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
  const birthBR = (b) => (b ? b.split('-').reverse().join('/') : '—');
  const todayStr = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });
  const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
  const WD = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const tag = (s, label) => `<span class="tag ${esc(s)}">${esc(label || s)}</span>`;
  const LUPA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>';
  const STATUS_ENVIO = { agendada: 'agendada', processando: 'em processamento', aceita: 'aceita pelo serviço', entregue: 'entregue', lida: 'lida', falha: 'falha', incerta: 'resultado incerto', cancelada: 'cancelada' };

  async function api(path, opts = {}) {
    const o = { credentials: 'same-origin', headers: {} };
    if (opts.method) o.method = opts.method;
    if (opts.body !== undefined) { o.method = o.method || 'POST'; o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(opts.body); }
    if (o.method && o.method !== 'GET') o.headers['X-Requested-With'] = 'fetch';
    const res = await fetch(path, o);
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && !path.includes('/login')) { showLogin(); throw new Error('Sessão expirada.'); }
    if (!res.ok) throw new Error(data.erro || `Erro ${res.status}`);
    return data;
  }
  const A = (p) => `/admin/api${p}`;
  function toast(msg, err) { const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (err ? ' err' : ''); t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 4500); }
  async function run(btn, fn) { if (btn) btn.disabled = true; try { return await fn(); } catch (e) { toast(e.message, true); } finally { if (btn) btn.disabled = false; } }
  function modal(html) { $('#modal-box').innerHTML = `<button class="x" type="button" data-x>×</button>${html}`; $('#modal').hidden = false; $('#modal').scrollTop = 0; return $('#modal-box'); }
  function closeModal() { $('#modal').hidden = true; }
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' || e.target.closest('[data-x]')) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });
  const formData = (f) => { const o = {}; for (const el of f.elements) { if (!el.name) continue; if (el.type === 'checkbox') o[el.name] = el.checked; else o[el.name] = el.value; } return o; };
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  // ================= Login =================
  function showLogin() { $('#app').hidden = true; $('#login').hidden = false; $('#login-step1').hidden = false; $('#login-step2').hidden = true; $('#f-login').reset(); }
  $('#f-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target, err = f.querySelector('.err'), btn = f.querySelector('button');
    err.hidden = true; btn.disabled = true;
    try {
      if (!$('#login-step1').hidden) {
        await api(A('/login'), { body: { usuario: f.usuario.value, senha: f.senha.value } });
        $('#login-step1').hidden = true; $('#login-step2').hidden = false; f.codigo.focus();
      } else {
        await api(A('/login/totp'), { body: { codigo: f.codigo.value } });
        await start();
      }
    } catch (ex) {
      err.textContent = ex.message; err.hidden = false;
      if (/expirada/i.test(ex.message)) { $('#login-step1').hidden = false; $('#login-step2').hidden = true; }
    } finally { btn.disabled = false; }
  });
  $('#b-logout').addEventListener('click', async () => { await api(A('/logout'), { body: {} }).catch(() => {}); showLogin(); });

  // ================= Navegação =================
  const sections = {};
  let current = null;
  function go() {
    const [sec, qs] = (location.hash.slice(1) || 'painel').split('?');
    const name = sections[sec] ? sec : 'painel';
    current = name;
    $$('#menu a').forEach((a) => a.classList.toggle('active', a.dataset.sec === name));
    $('#side').classList.remove('open');
    $('#main').innerHTML = '<p class="muted">Carregando…</p>';
    sections[name](new URLSearchParams(qs || '')).catch((e) => { $('#main').innerHTML = `<div class="alert err">${esc(e.message)}</div>`; });
  }
  window.addEventListener('hashchange', go);
  $('#side-toggle').addEventListener('click', () => $('#side').classList.toggle('open'));

  async function start() {
    const me = await api(A('/me'));
    $('#who').textContent = me.nome;
    $('#login').hidden = true; $('#app').hidden = false;
    refreshBadges();
    go();
  }
  async function refreshBadges() {
    try {
      const p = await api(A('/painel'));
      $('#b-resp').textContent = p.respostas_novas; $('#b-resp').hidden = !p.respostas_novas;
      $('#b-conf').textContent = p.conferencias_abertas; $('#b-conf').hidden = !p.conferencias_abertas;
    } catch {}
  }
  let lists = { servicos: [], funcionarios: [] };
  async function loadLists() {
    const [s, f] = await Promise.all([api(A('/servicos')), api(A('/funcionarios'))]);
    lists = { servicos: s.servicos, funcionarios: f.funcionarios };
    return lists;
  }

  // ================= Resumo =================
  sections.painel = async () => {
    const p = await api(A('/painel'));
    const h = p.hoje;
    const dateLabel = new Date().toLocaleDateString('pt-BR', { timeZone: TZ, weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    const ex = p.executor;
    const exOk = ex && ex.segundos < 180;
    const sum = (ch, st) => p.envios_7d.filter((r) => r.channel === ch && (!st || st.includes(r.status))).reduce((s, r) => s + r.n, 0);
    $('#main').innerHTML = `
      <div class="today"><span class="date">Hoje, ${esc(dateLabel)}</span>
        <div class="row">
          <div><div class="l">Agendamentos hoje</div><div class="v">${h.agendamentos}</div></div>
          <div><div class="l">Em atendimento</div><div class="v">${h.em_atendimento.length ? esc(h.em_atendimento.map((a) => a.cliente.split(' ')[0]).join(', ')) : '—'}</div></div>
          <div><div class="l">Próximo cliente</div><div class="v">${h.proximo ? `${esc(h.proximo.hora)} · ${esc(h.proximo.cliente.split(' ')[0])}` : '—'}</div></div>
          <div><div class="l">Faturamento previsto hoje</div><div class="v">${brl(h.faturamento_previsto_centavos)}</div></div>
        </div>
        <p style="margin:1rem 0 0"><a class="btn gold" href="#agenda">Abrir agenda →</a> ${h.pendentes_aprovacao ? `<span class="tag warn">${h.pendentes_aprovacao} aguardando aprovação</span>` : ''}</p>
      </div>
      ${p.alertas.map((a) => `<div class="alert ${a.kind === 'desconexao' ? 'err' : ''}"><span>${esc(a.message)} <span class="small">(${dt(a.created_at)})</span></span><button class="btn sm" data-resolve="${a.id}">Resolvido</button></div>`).join('')}
      <div class="grid k4">
        <div class="kpi"><div class="v">${p.clientes.total.toLocaleString('pt-BR')}</div><div class="l">clientes cadastrados</div></div>
        <div class="kpi"><div class="v">${p.clientes.aniversariantes_hoje}</div><div class="l">aniversariantes hoje</div></div>
        <div class="kpi"><div class="v">${p.clientes.com_whatsapp_marketing} / ${p.clientes.com_email_marketing}</div><div class="l">autorizaram mensagens (WhatsApp / e-mail)</div></div>
        <div class="kpi"><div class="v">${p.clientes.sem_nascimento.toLocaleString('pt-BR')}</div><div class="l">sem data de nascimento</div></div>
        <div class="kpi"><div class="v">${p.campanhas.ativa || 0}</div><div class="l">campanhas ativas · ${p.campanhas.agendada || 0} agendadas · ${p.campanhas.pausada || 0} pausadas · ${p.campanhas.encerrada || 0} encerradas</div></div>
        <div class="kpi"><div class="v">${(p.fila.whatsapp || 0)} / ${(p.fila.email || 0)}</div><div class="l">na fila (WhatsApp / e-mail)</div></div>
        <div class="kpi"><div class="v">${sum('whatsapp', ['aceita', 'entregue', 'lida'])} / ${sum('email', ['aceita', 'entregue', 'lida'])}</div><div class="l">enviados 7 dias (WhatsApp / e-mail)</div></div>
        <div class="kpi"><div class="v">${sum('whatsapp', ['falha', 'incerta']) + sum('email', ['falha', 'incerta'])}</div><div class="l">falhas ou incertos 7 dias</div></div>
        <div class="kpi"><div class="v">${p.respostas_novas}</div><div class="l"><a href="#respostas">respostas novas</a></div></div>
        <div class="kpi"><div class="v">${p.conferencias_abertas}</div><div class="l"><a href="#conferencias">conferências abertas</a></div></div>
      </div>
      <div class="card" style="margin-top:1rem"><h2>Robô e conexões</h2>
        <p>${exOk ? tag('ok', 'Executor funcionando') : tag('err', 'Executor parado')} ${ex ? `último sinal ${dt(ex.ultimo_sinal)}` : 'nunca rodou — inicie o processo do executor no servidor'}</p>
        ${p.conexoes.map((c) => `<p>${c.channel === 'whatsapp' ? 'WhatsApp' : 'E-mail'}: ${tag(c.status)} ${esc(c.label)} ${c.last_error ? `<span class="small muted">— ${esc(c.last_error)}</span>` : ''}</p>`).join('') || '<p class="muted">Nenhuma conexão. <a href="#conexoes">Conectar</a></p>'}
      </div>`;
    $$('[data-resolve]').forEach((b) => b.addEventListener('click', () => run(b, async () => { await api(A(`/alertas/${b.dataset.resolve}/resolver`), { body: {} }); go(); })));
  };

  // ================= Clientes =================
  let clientQuery = {};
  sections.clientes = async (qs) => {
    await loadLists();
    if (qs.get('aniversario')) clientQuery = { aniversario: 'hoje' };
    $('#main').innerHTML = `
      <div class="head"><div><h1>Clientes</h1><div class="count" id="cl-count"></div></div>
        <div class="actions">
          <button class="btn primary" id="cl-new">+ Novo cliente</button>
          <button class="btn" id="cl-export" title="Exporta os clientes da busca atual">Exportar Excel</button>
          <a class="btn" href="${A('/backup.xlsx')}">Backup completo (Excel)</a>
          <a class="btn" href="${A('/backup.db')}" title="Cópia exata do banco de dados">Backup do banco</a>
          <button class="btn" id="cl-import">Importar planilha</button>
        </div></div>
      <div class="card">
        <div class="search" id="cl-search">
          ${[['nome', 'Nome', 'Ex.: João Silva'], ['nascimento', 'Data de nascimento', 'DD/MM/AAAA ou DD/MM'], ['telefone', 'Telefone', 'Ex.: 21 99999'], ['email', 'E-mail', 'Ex.: joao@']]
            .map(([k, l, ph]) => `<div class="sfield"><label for="s-${k}">${l}</label><div class="wrap"><input id="s-${k}" data-field="${k}" placeholder="${ph}" autocomplete="off" value="${esc(clientQuery[k] || '')}">
              <button class="lupa" type="button" data-lupa="${k}" title="Pesquisar por ${l.toLowerCase()}" aria-label="Pesquisar por ${l.toLowerCase()}">${LUPA}</button></div><div class="suggest" hidden></div></div>`).join('')}
        </div>
        <div style="display:flex;gap:.6rem;margin-top:.8rem;flex-wrap:wrap;align-items:center">
          <button class="btn primary" id="cl-go">Pesquisar</button><button class="btn" id="cl-clear">Limpar</button>
          <label class="small" style="display:flex;gap:.3rem;align-items:center"><input type="checkbox" id="cl-niver" ${clientQuery.aniversario ? 'checked' : ''}> Aniversariantes de hoje</label>
          <label class="small" style="display:flex;gap:.3rem;align-items:center"><input type="checkbox" id="cl-semnasc" ${clientQuery.sem === 'nascimento' ? 'checked' : ''}> Sem data de nascimento</label>
        </div>
      </div>
      <div class="card"><div class="table-wrap" id="cl-table"></div><div class="pager" id="cl-pager"></div></div>`;

    const readQuery = () => {
      const q = {};
      $$('#cl-search input').forEach((i) => { if (i.value.trim()) q[i.dataset.field] = i.value.trim(); });
      if ($('#cl-niver').checked) q.aniversario = 'hoje';
      if ($('#cl-semnasc').checked) q.sem = 'nascimento';
      return q;
    };
    const search = async (page = 1) => {
      clientQuery = readQuery();
      const qs2 = new URLSearchParams({ ...clientQuery, pagina: page });
      const r = await api(A(`/clientes?${qs2}`));
      const filtered = Object.keys(clientQuery).length > 0;
      $('#cl-count').innerHTML = `<b>${r.total_cadastrados.toLocaleString('pt-BR')}</b> clientes cadastrados${filtered ? ` · <b>${r.total_encontrados.toLocaleString('pt-BR')}</b> encontrados` : ''}`;
      $('#cl-table').innerHTML = r.clientes.length ? `<table><thead><tr><th>Nome</th><th>Nascimento</th><th>Telefone</th><th>E-mail</th><th>Último atendimento</th><th></th></tr></thead><tbody>
        ${r.clientes.map((c) => `<tr><td><b>${esc(c.nome)}</b>${c.barbeiro ? `<br><span class="small muted">${esc(c.barbeiro)}</span>` : ''}</td><td>${birthBR(c.nascimento)}</td>
          <td>${esc(c.telefone || '—')}${c.telefone2 ? `<br><span class="small muted">${esc(c.telefone2)}</span>` : ''}</td><td>${esc(c.email || '—')}</td><td>${dOnly(c.ultimo_atendimento)}</td>
          <td class="actions"><button class="btn sm" data-edit="${c.id}">Editar</button> <button class="btn sm danger" data-del="${c.id}" data-name="${esc(c.nome)}">Apagar</button></td></tr>`).join('')}</tbody></table>`
        : '<p class="empty">Nenhum cliente encontrado.</p>';
      $('#cl-pager').innerHTML = r.paginas > 1 ? `<button class="btn sm" ${r.pagina <= 1 ? 'disabled' : ''} data-page="${r.pagina - 1}">‹ Anterior</button><span class="small">Página ${r.pagina} de ${r.paginas}</span><button class="btn sm" ${r.pagina >= r.paginas ? 'disabled' : ''} data-page="${r.pagina + 1}">Próxima ›</button>` : '';
      $$('#cl-pager [data-page]').forEach((b) => b.addEventListener('click', () => search(Number(b.dataset.page))));
      $$('#cl-table [data-edit]').forEach((b) => b.addEventListener('click', () => openClient(Number(b.dataset.edit), search)));
      $$('#cl-table [data-del]').forEach((b) => b.addEventListener('click', () => deleteClient(Number(b.dataset.del), b.dataset.name, search)));
    };

    // Lupa: pesquisa só por aquele campo
    $$('#cl-search [data-lupa]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.lupa;
      $$('#cl-search input').forEach((i) => { if (i.dataset.field !== k) i.value = ''; });
      $('#cl-niver').checked = false; $('#cl-semnasc').checked = false;
      run(b, () => search(1));
    }));
    // Autocompletar
    $$('#cl-search input').forEach((inp) => {
      const box = inp.closest('.sfield').querySelector('.suggest');
      let items = [], hl = -1;
      const show = debounce(async () => {
        const q = inp.value.trim();
        if (q.length < 2) { box.hidden = true; return; }
        try {
          const r = await api(A(`/clientes/sugestoes?campo=${inp.dataset.field}&q=${encodeURIComponent(q)}`));
          items = r.sugestoes; hl = -1;
          if (!items.length) { box.hidden = true; return; }
          box.innerHTML = items.map((c, i) => `<button type="button" data-i="${i}">${esc(c.nome)}<small>${birthBR(c.nascimento)} · ${esc(c.telefone || 'sem telefone')}${c.email ? ' · ' + esc(c.email) : ''}</small></button>`).join('');
          box.hidden = false;
          $$('button', box).forEach((b) => b.addEventListener('mousedown', (e) => { e.preventDefault(); pick(items[Number(b.dataset.i)]); }));
        } catch {}
      }, 220);
      const pick = (c) => { box.hidden = true; openClient(c.id, search); };
      inp.addEventListener('input', show);
      inp.addEventListener('blur', () => setTimeout(() => (box.hidden = true), 150));
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); if (!box.hidden && hl >= 0) pick(items[hl]); else { box.hidden = true; search(1); } }
        else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !box.hidden) {
          e.preventDefault(); hl = (hl + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
          $$('button', box).forEach((b, i) => b.classList.toggle('hl', i === hl));
        } else if (e.key === 'Escape') box.hidden = true;
      });
    });
    $('#cl-go').addEventListener('click', (e) => run(e.target, () => search(1)));
    $('#cl-clear').addEventListener('click', () => { $$('#cl-search input').forEach((i) => (i.value = '')); $('#cl-niver').checked = false; $('#cl-semnasc').checked = false; search(1); });
    $('#cl-niver').addEventListener('change', () => search(1));
    $('#cl-semnasc').addEventListener('change', () => search(1));
    $('#cl-new').addEventListener('click', () => openClient(null, search));
    $('#cl-export').addEventListener('click', () => { location.href = A(`/clientes/exportar?${new URLSearchParams(readQuery())}`); });
    $('#cl-import').addEventListener('click', () => importDialog(search));
    await search(1);
  };

  async function deleteClient(id, name, after) {
    if (!confirm(`Apagar o cadastro de ${name}?\n\nIsso remove o cliente, os agendamentos e o histórico de mensagens dele. Não dá para desfazer.\nDica: exporte um backup antes.`)) return;
    try { await api(A(`/clientes/${id}`), { method: 'DELETE' }); toast('Cliente apagado.'); closeModal(); after && after(); } catch (e) { toast(e.message, true); }
  }

  const CONSENT = { concedida: 'Autorizado', revogada: 'Cancelado pelo cliente', null: 'Não informado' };
  async function openClient(id, after) {
    const c = id ? await api(A(`/clientes/${id}`)) : { autorizacoes: {}, historico: [], agendamentos: [], envios: [], historico_autorizacoes: [], respostas: [] };
    const k = c.autorizacoes || {};
    const box = modal(`<h2>${id ? esc(c.full_name) : 'Novo cliente'}</h2>
      ${id ? `<div class="tabs"><button class="on" data-tab="dados">Dados</button><button data-tab="agend">Agendamentos (${c.agendamentos.length})</button><button data-tab="envios">Mensagens (${c.envios.length})</button><button data-tab="hist">Histórico</button></div>` : ''}
      <div data-pane="dados"><form id="f-cli" class="form" novalidate>
        <label class="full">Nome<input name="nome" value="${esc(c.full_name || '')}" required></label>
        <label>Data de nascimento<input name="nascimento" type="date" value="${esc(c.birth_date || '')}"></label>
        <label>Telefone (WhatsApp)<input name="telefone" value="${esc(c.phone || '')}" placeholder="21 99999-8888"></label>
        <label>Telefone 2<input name="telefone2" value="${esc(c.phone2 || '')}"></label>
        <label>E-mail<input name="email" type="email" value="${esc(c.email || '')}"></label>
        <label>CPF<input name="cpf" value="${esc(c.cpf || '')}" inputmode="numeric"></label>
        <label>Barbeiro de preferência<select name="barbeiro_id"><option value="">—</option>${lists.funcionarios.map((f) => `<option value="${f.id}" ${c.barber_id === f.id ? 'selected' : ''}>${esc(f.nickname || f.name)}</option>`).join('')}</select></label>
        <label>Preferência de contato<select name="preferencia">${[['ambos', 'WhatsApp e e-mail'], ['whatsapp', 'Só WhatsApp'], ['email', 'Só e-mail']].map(([v, l]) => `<option value="${v}" ${c.contact_pref === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label>Último atendimento<input name="ultimo_atendimento" type="date" value="${c.last_service_at ? new Date(c.last_service_at).toLocaleDateString('en-CA', { timeZone: TZ }) : ''}"></label>
        <label class="full">Endereço<input name="endereco" value="${esc(c.address || '')}"></label>
        <label class="full">Observações<textarea name="observacoes">${esc(c.notes || '')}</textarea></label>
        <fieldset class="full"><legend>Autorizações de comunicação</legend>
          <p class="hint" style="margin-top:0">Marque só com autorização do cliente. Desmarcar registra o cancelamento e interrompe os envios pendentes.</p>
          <div class="grid k2">
            ${[['whatsapp_marketing', 'WhatsApp — aniversário, promoções, retorno'], ['email_marketing', 'E-mail — aniversário, promoções, retorno'], ['whatsapp_servico', 'WhatsApp — avisos de agendamento'], ['email_servico', 'E-mail — avisos de agendamento']]
              .map(([key, l]) => `<label style="display:flex;gap:.5rem;align-items:center;font-weight:500"><input type="checkbox" name="${key}" ${k[key] === 'concedida' ? 'checked' : ''} data-was="${k[key] === 'concedida'}"> ${l} ${tag(k[key] || 'rascunho', CONSENT[k[key] ?? 'null'])}</label>`).join('')}
          </div>
          <label style="margin-top:.6rem">Como a autorização foi obtida <span class="h">(obrigatório ao marcar)</span><input name="origem_autorizacao" placeholder="Ex.: pediu no balcão em ${new Date().toLocaleDateString('pt-BR')}"></label>
        </fieldset>
      </form>
      ${id ? `<p class="small muted" style="margin-top:.8rem">Origem: ${esc(c.source)} · cadastrado em ${dt(c.created_at)} · atualizado em ${dt(c.updated_at)}
        · telefone ${c.phone_verified_at ? 'confirmado' : 'não confirmado'} · e-mail ${c.email_verified_at ? 'confirmado' : c.email ? 'não confirmado' : '—'}</p>` : ''}
      <div class="modal-foot"><div>${id ? '<button class="btn danger" id="cli-del">Apagar cliente</button> <button class="btn" id="cli-serv">Registrar atendimento</button>' : ''}</div>
        <div><button class="btn" data-x>Cancelar</button> <button class="btn primary" id="cli-save">Salvar</button></div></div></div>
      ${id ? `<div data-pane="agend" hidden>${c.agendamentos.length ? `<table><tr><th>Data</th><th>Serviço</th><th>Profissional</th><th>Status</th></tr>${c.agendamentos.map((a) => `<tr><td>${dt(a.start_at)}</td><td>${esc(a.servico)}</td><td>${esc(a.barbeiro)}</td><td>${tag(a.status)}</td></tr>`).join('')}</table>` : '<p class="empty">Nenhum agendamento.</p>'}</div>
      <div data-pane="envios" hidden>${c.envios.length ? `<table><tr><th>Campanha</th><th>Canal</th><th>Agendado</th><th>Status</th><th>Detalhe</th></tr>${c.envios.map((x) => `<tr><td>${esc(x.campanha)}</td><td>${x.channel}</td><td>${dt(x.scheduled_at)}</td><td>${tag(x.status, STATUS_ENVIO[x.status])}</td><td class="small">${esc(x.error || '')}</td></tr>`).join('')}</table>` : '<p class="empty">Nenhuma mensagem.</p>'}
        ${c.respostas.length ? `<h3 style="margin-top:1rem">Respostas recebidas</h3>${c.respostas.map((m) => `<p class="small">${dt(m.received_at)}: ${esc(m.body)}</p>`).join('')}` : ''}</div>
      <div data-pane="hist" hidden><h3>Alterações cadastrais</h3>${c.historico.length ? `<table><tr><th>Quando</th><th>Campo</th><th>Antes</th><th>Depois</th><th>Origem</th></tr>${c.historico.map((h) => `<tr><td>${dt(h.created_at)}</td><td>${esc(h.field)}</td><td>${esc(h.old_value || '')}</td><td>${esc(h.new_value || '')}</td><td>${esc(h.source)} ${esc(h.actor)}</td></tr>`).join('')}</table>` : '<p class="empty">—</p>'}
        <h3 style="margin-top:1rem">Autorizações</h3>${c.historico_autorizacoes.length ? `<table><tr><th>Quando</th><th>Canal</th><th>Finalidade</th><th>Situação</th><th>Origem</th></tr>${c.historico_autorizacoes.map((h) => `<tr><td>${dt(h.created_at)}</td><td>${h.channel}</td><td>${h.purpose}</td><td>${tag(h.status)}</td><td class="small">${esc(h.source)} ${esc(h.detail)}</td></tr>`).join('')}</table>` : '<p class="empty">Nenhuma autorização registrada.</p>'}</div>` : ''}`);
    $$('[data-tab]', box).forEach((b) => b.addEventListener('click', () => { $$('[data-tab]', box).forEach((x) => x.classList.toggle('on', x === b)); $$('[data-pane]', box).forEach((p) => (p.hidden = p.dataset.pane !== b.dataset.tab)); }));
    $('#cli-save', box).addEventListener('click', (e) => run(e.target, async () => {
      const f = $('#f-cli', box); const d = formData(f);
      // Autorizações: envia só o que mudou
      for (const key of ['whatsapp_marketing', 'email_marketing', 'whatsapp_servico', 'email_servico']) { const el = f.elements[key]; if (String(el.checked) === el.dataset.was) delete d[key]; }
      if (id) await api(A(`/clientes/${id}`), { method: 'PUT', body: d }); else await api(A('/clientes'), { body: d });
      toast('Cliente salvo.'); closeModal(); after && after();
    }));
    if (id) {
      $('#cli-del', box).addEventListener('click', () => deleteClient(id, c.full_name, after));
      $('#cli-serv', box).addEventListener('click', () => registerServiceDialog(id, c.full_name, after));
    }
  }

  function registerServiceDialog(id, name, after) {
    const box = modal(`<h2>Registrar atendimento</h2><p>${esc(name)}</p><form class="form" id="f-at">
      <label>Serviço<select name="servico">${lists.servicos.filter((s) => s.active).map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></label>
      <label>Profissional<select name="barbeiro">${lists.funcionarios.map((f) => `<option value="${f.id}">${esc(f.nickname || f.name)}</option>`).join('')}</select></label>
      <label>Data<input type="date" name="data" value="${todayStr()}"></label><label>Hora<input type="time" name="hora" value="${new Date().toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })}"></label></form>
      <p class="hint">Atualiza o "último atendimento", tira o cliente da fila de inativos e agenda o agradecimento (se a campanha estiver ativa).</p>
      <div class="modal-foot"><span></span><button class="btn primary" id="at-save">Registrar</button></div>`);
    $('#at-save', box).addEventListener('click', (e) => run(e.target, async () => { await api(A(`/clientes/${id}/atendimento`), { body: formData($('#f-at', box)) }); toast('Atendimento registrado.'); closeModal(); after && after(); }));
  }

  function importDialog(after) {
    const box = modal(`<h2>Importar planilha de clientes</h2>
      <p>Aceita a planilha exportada do sistema anterior (colunas Nome, Telefone, Telefone 2, Email, Endereço, Observação, Data Nascimento, CPF) ou a exportada por este painel.</p>
      <div class="note">Não cria duplicados: quem já existe (mesmo nome + telefone ou nascimento) só tem os campos vazios completados. Nenhuma autorização de mensagem é criada — a planilha não traz esse consentimento.</div>
      <input type="file" id="imp-file" accept=".xlsx">
      <div id="imp-res" style="margin-top:1rem"></div>
      <div class="modal-foot"><button class="btn" id="imp-sim">Simular</button><button class="btn primary" id="imp-go">Importar</button></div>`);
    const send = async (sim) => {
      const file = $('#imp-file', box).files[0];
      if (!file) throw new Error('Escolha o arquivo .xlsx.');
      const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(file); });
      const r = await api(A('/importar'), { body: { arquivo: b64, simular: sim } });
      $('#imp-res', box).innerHTML = `<div class="alert ok">${sim ? 'Simulação' : 'Importação concluída'}: ${r.lidos} linhas lidas · ${r.criados} novos · ${r.atualizados} completados · ${r.ignorados} já existiam</div>
        ${r.problemas.length ? `<details><summary>${r.problemas.length} aviso(s)</summary><pre class="preview">${esc(r.problemas.join('\n'))}</pre></details>` : ''}`;
      if (!sim) after && after();
    };
    $('#imp-sim', box).addEventListener('click', (e) => run(e.target, () => send(true)));
    $('#imp-go', box).addEventListener('click', (e) => run(e.target, () => send(false)));
  }

  // ================= Funcionários e escala =================
  sections.funcionarios = async () => {
    await loadLists();
    const f = await api(A('/folgas'));
    $('#main').innerHTML = `<div class="head"><div><h1>Funcionários e escala</h1><p class="muted">Só aparece no agendamento quem está <b>habilitado</b>, tem a <b>especialização</b> do serviço e está na <b>escala</b> no dia e horário.</p></div>
      <div class="actions"><button class="btn primary" id="fn-new">+ Novo funcionário</button><button class="btn" id="fn-folga">+ Folga / bloqueio</button></div></div>
      <div class="card"><div class="table-wrap">${lists.funcionarios.length ? `<table><thead><tr><th>Funcionário</th><th>Contato</th><th>Especialidades</th><th>Escala</th><th>Agendamento</th><th></th></tr></thead><tbody>
        ${lists.funcionarios.map((b) => `<tr><td><b>${esc(b.name)}</b>${b.nickname ? `<br><span class="small muted">"${esc(b.nickname)}"</span>` : ''}</td>
          <td class="small">${esc(b.phone || '')}<br>${esc(b.email || '')}</td>
          <td class="small">${b.servicos.map((sid) => esc(lists.servicos.find((s) => s.id === sid)?.name || '')).join(', ') || '<span class="tag warn">nenhuma</span>'}</td>
          <td class="small">${summarizeSchedule(b.escala)}</td>
          <td>${b.active ? tag('ok', 'Habilitado') : tag('err', 'Desabilitado')}</td>
          <td class="actions"><button class="btn sm" data-sched="${b.id}">Escala</button> <button class="btn sm" data-edit="${b.id}">Editar</button> <button class="btn sm danger" data-del="${b.id}">Apagar</button></td></tr>`).join('')}</tbody></table>`
        : '<p class="empty">Nenhum funcionário cadastrado.</p>'}</div></div>
      <div class="card"><h2>Folgas, férias e bloqueios</h2>${f.folgas.length ? `<table><tr><th>Quem</th><th>De</th><th>Até</th><th>Motivo</th><th></th></tr>${f.folgas.map((k) => `<tr><td>${esc(k.barbeiro || 'Barbearia inteira')}</td><td>${dt(k.start_at)}</td><td>${dt(k.end_at)}</td><td>${esc(k.reason)}</td><td class="actions"><button class="btn sm danger" data-delfolga="${k.id}">Remover</button></td></tr>`).join('')}</table>` : '<p class="empty">Nenhuma folga futura.</p>'}</div>`;
    $('#fn-new').addEventListener('click', () => openBarber(null));
    $('#fn-folga').addEventListener('click', () => folgaDialog());
    $$('[data-edit]').forEach((b) => b.addEventListener('click', () => openBarber(lists.funcionarios.find((x) => x.id === Number(b.dataset.edit)))));
    $$('[data-sched]').forEach((b) => b.addEventListener('click', () => openSchedule(lists.funcionarios.find((x) => x.id === Number(b.dataset.sched)))));
    $$('[data-del]').forEach((b) => b.addEventListener('click', () => {
      const x = lists.funcionarios.find((y) => y.id === Number(b.dataset.del));
      if (!confirm(`Apagar ${x.name}? Ele sai da agenda e do site. Os atendimentos antigos continuam no histórico.`)) return;
      run(b, async () => { await api(A(`/funcionarios/${x.id}`), { method: 'DELETE' }); toast('Funcionário apagado.'); go(); });
    }));
    $$('[data-delfolga]').forEach((b) => b.addEventListener('click', () => run(b, async () => { await api(A(`/folgas/${b.dataset.delfolga}`), { method: 'DELETE' }); go(); })));
  };
  function summarizeSchedule(esc_) {
    if (!esc_.length) return '<span class="tag warn">sem escala</span>';
    const by = {};
    for (const f of esc_) (by[f.dia] ||= []).push(`${f.inicio}–${f.fim}`);
    return Object.entries(by).map(([d, r]) => `${WD[d].slice(0, 3)} ${r.join(', ')}`).join('<br>');
  }
  async function uploadImage(file) {
    const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(file); });
    return (await api(A('/upload'), { body: { nome: file.name, base64: b64 } })).caminho;
  }
  function openBarber(b) {
    b = b || { servicos: [], active: 1 };
    const box = modal(`<h2>${b.id ? 'Editar funcionário' : 'Novo funcionário'}</h2><form class="form" id="f-fn" novalidate>
      <label>Nome<input name="nome" value="${esc(b.name || '')}" required></label>
      <label>Apelido <span class="h">(aparece no site)</span><input name="apelido" value="${esc(b.nickname || '')}"></label>
      <label>Data de nascimento<input type="date" name="nascimento" value="${esc(b.birth_date || '')}"></label>
      <label>Telefone<input name="telefone" value="${esc(b.phone || '')}"></label>
      <label>E-mail<input type="email" name="email" value="${esc(b.email || '')}"></label>
      <label class="full">Endereço<input name="endereco" value="${esc(b.address || '')}"></label>
      <label class="full">Apresentação no site <span class="h">(opcional)</span><input name="bio" value="${esc(b.bio || '')}" maxlength="200"></label>
      <fieldset class="full"><legend>Especialização — o que ele faz</legend><div class="checks">
        ${lists.servicos.filter((s) => s.active).map((s) => `<label><input type="checkbox" name="svc" value="${s.id}" ${b.servicos.includes(s.id) ? 'checked' : ''}> ${esc(s.name)}</label>`).join('') || '<span class="muted">Cadastre os serviços primeiro (menu Serviços).</span>'}
      </div><p class="hint">Faltou algum (ex.: pintura)? Crie em <a href="#servicos">Serviços</a>.</p></fieldset>
      <label class="full" style="display:flex;gap:.5rem;align-items:center"><input type="checkbox" name="habilitado" ${b.active ? 'checked' : ''}> Habilitado — disponível para agendamento</label>
      <label class="full">Foto <span class="h">(opcional)</span><input type="file" id="fn-photo" accept="image/*"></label>
      ${b.photo ? `<img src="${esc(b.photo)}" alt="" style="width:80px;height:80px;border-radius:50%;object-fit:cover">` : ''}
    </form><div class="modal-foot"><span></span><div><button class="btn" data-x>Cancelar</button> <button class="btn primary" id="fn-save">Salvar</button></div></div>`);
    $('#fn-save', box).addEventListener('click', (e) => run(e.target, async () => {
      const f = $('#f-fn', box);
      const d = { nome: f.nome.value, apelido: f.apelido.value, nascimento: f.nascimento.value, telefone: f.telefone.value, email: f.email.value, endereco: f.endereco.value, bio: f.bio.value,
        habilitado: f.habilitado.checked, servicos: $$('input[name=svc]:checked', f).map((i) => Number(i.value)) };
      const file = $('#fn-photo', box).files[0];
      if (file) d.foto = await uploadImage(file);
      if (b.id) await api(A(`/funcionarios/${b.id}`), { method: 'PUT', body: d });
      else { const r = await api(A('/funcionarios'), { body: d }); b.id = r.id; }
      toast('Funcionário salvo.'); closeModal(); go();
    }));
  }
  function openSchedule(b) {
    const by = {}; for (const f of b.escala) (by[f.dia] ||= []).push(f);
    const order = [1, 2, 3, 4, 5, 6, 0];
    const box = modal(`<h2>Escala de ${esc(b.nickname || b.name)}</h2>
      <p class="muted">Marque os dias de trabalho e as faixas de horário. Para intervalo de almoço, use duas faixas (ex.: 09:00–12:00 e 13:00–19:00). O cliente só consegue marcar dentro da escala.</p>
      <div id="sched">${order.map((d) => `<div class="sched-day" data-day="${d}"><label style="display:flex;gap:.5rem;align-items:center;font-weight:600"><input type="checkbox" class="on" ${by[d] ? 'checked' : ''}> ${WD[d]}</label>
        <div><div class="ranges">${(by[d] || [{ inicio: '09:00', fim: '19:00' }]).map(rangeHtml).join('')}</div><button class="btn sm" type="button" data-add style="margin-top:.4rem">+ faixa</button></div></div>`).join('')}</div>
      <div class="modal-foot"><button class="btn" id="sc-copy" type="button">Copiar o primeiro dia marcado para todos os marcados</button><div><button class="btn" data-x>Cancelar</button> <button class="btn primary" id="sc-save">Salvar escala</button></div></div>`);
    const sync = () => $$('.sched-day', box).forEach((row) => { const on = $('.on', row).checked; $$('input[type=time], [data-add], [data-rm]', row).forEach((el) => (el.disabled = !on)); });
    sync();
    box.addEventListener('change', (e) => { if (e.target.classList.contains('on')) sync(); });
    box.addEventListener('click', (e) => {
      if (e.target.matches('[data-add]')) { e.target.previousElementSibling.insertAdjacentHTML('beforeend', rangeHtml({ inicio: '13:00', fim: '19:00' })); }
      if (e.target.matches('[data-rm]')) { const rs = e.target.closest('.ranges'); if (rs.children.length > 1) e.target.closest('.range').remove(); }
    });
    $('#sc-copy', box).addEventListener('click', () => {
      const rows = $$('.sched-day', box).filter((r) => $('.on', r).checked);
      if (rows.length < 2) return;
      const tpl = $('.ranges', rows[0]).innerHTML;
      const vals = $$('input[type=time]', rows[0]).map((i) => i.value);
      rows.slice(1).forEach((r) => { $('.ranges', r).innerHTML = tpl; $$('input[type=time]', r).forEach((i, k) => (i.value = vals[k])); });
    });
    $('#sc-save', box).addEventListener('click', (e) => run(e.target, async () => {
      const faixas = [];
      $$('.sched-day', box).forEach((row) => { if (!$('.on', row).checked) return; $$('.range', row).forEach((r) => { const [a, z] = $$('input', r); faixas.push({ dia: Number(row.dataset.day), inicio: a.value, fim: z.value }); }); });
      await api(A(`/funcionarios/${b.id}/escala`), { method: 'PUT', body: { faixas } });
      toast('Escala salva.'); closeModal(); go();
    }));
  }
  const rangeHtml = (f) => `<div class="range"><input type="time" value="${f.inicio}" step="300"> até <input type="time" value="${f.fim}" step="300"> <button class="btn sm danger" type="button" data-rm title="Remover faixa">×</button></div>`;
  function folgaDialog() {
    const box = modal(`<h2>Folga, férias ou bloqueio</h2><form class="form" id="f-fg">
      <label class="full">Quem<select name="barbeiro_id"><option value="">Barbearia inteira (feriado, evento)</option>${lists.funcionarios.map((f) => `<option value="${f.id}">${esc(f.nickname || f.name)}</option>`).join('')}</select></label>
      <label>Data início<input type="date" name="data_inicio" value="${todayStr()}"></label><label>Hora início <span class="h">(vazio = dia todo)</span><input type="time" name="hora_inicio"></label>
      <label>Data fim<input type="date" name="data_fim" value="${todayStr()}"></label><label>Hora fim <span class="h">(vazio = dia todo)</span><input type="time" name="hora_fim"></label>
      <label class="full">Motivo<input name="motivo" placeholder="Ex.: férias, consulta médica"></label></form>
      <p class="hint">Agendamentos já marcados nesse período não são cancelados automaticamente — confira na agenda.</p>
      <div class="modal-foot"><span></span><button class="btn primary" id="fg-save">Salvar</button></div>`);
    $('#fg-save', box).addEventListener('click', (e) => run(e.target, async () => { await api(A('/folgas'), { body: formData($('#f-fg', box)) }); toast('Bloqueio salvo.'); closeModal(); go(); }));
  }

  // ================= Serviços =================
  sections.servicos = async () => {
    await loadLists();
    $('#main').innerHTML = `<div class="head"><h1>Serviços</h1><button class="btn primary" id="sv-new">+ Novo serviço</button></div>
      <div class="note">Os serviços são as especializações dos funcionários (corte, barba, pintura…). A duração define o tamanho do horário na agenda.</div>
      <div class="card">${lists.servicos.length ? `<table><tr><th>Serviço</th><th>Duração</th><th>Preço</th><th>Situação</th><th></th></tr>${lists.servicos.map((s) => `<tr><td><b>${esc(s.name)}</b><br><span class="small muted">${esc(s.description)}</span></td><td>${s.duration_min} min</td><td>${brl(s.price_cents)}</td><td>${s.active ? tag('ok', 'Ativo') : tag('err', 'Inativo')}</td>
        <td class="actions"><button class="btn sm" data-edit="${s.id}">Editar</button> <button class="btn sm danger" data-del="${s.id}">Apagar</button></td></tr>`).join('')}</table>` : '<p class="empty">Nenhum serviço.</p>'}</div>`;
    const open = (s = {}) => {
      const box = modal(`<h2>${s.id ? 'Editar serviço' : 'Novo serviço'}</h2><form class="form" id="f-sv">
        <label class="full">Nome<input name="nome" value="${esc(s.name || '')}"></label>
        <label>Duração (min)<input name="duracao" type="number" min="5" max="480" step="5" value="${s.duration_min || 30}"></label>
        <label>Preço (R$)<input name="preco" inputmode="decimal" value="${s.price_cents != null ? (s.price_cents / 100).toFixed(2).replace('.', ',') : ''}"></label>
        <label class="full">Descrição <span class="h">(opcional)</span><input name="descricao" value="${esc(s.description || '')}"></label>
        ${s.id ? `<label style="display:flex;gap:.5rem;align-items:center"><input type="checkbox" name="ativo" ${s.active ? 'checked' : ''}> Ativo</label>` : ''}</form>
        <div class="modal-foot"><span></span><button class="btn primary" id="sv-save">Salvar</button></div>`);
      $('#sv-save', box).addEventListener('click', (e) => run(e.target, async () => { const d = formData($('#f-sv', box)); if (s.id) d.id = s.id; else d.ativo = true; await api(A('/servicos'), { body: d }); closeModal(); go(); }));
    };
    $('#sv-new').addEventListener('click', () => open());
    $$('[data-edit]').forEach((b) => b.addEventListener('click', () => open(lists.servicos.find((s) => s.id === Number(b.dataset.edit)))));
    $$('[data-del]').forEach((b) => b.addEventListener('click', () => { if (confirm('Apagar este serviço? Se já tiver sido usado, ele só será desativado.')) run(b, async () => { await api(A(`/servicos/${b.dataset.del}`), { method: 'DELETE' }); go(); }); }));
  };

  // ================= Agenda =================
  let agendaDate = null;
  sections.agenda = async () => {
    await loadLists();
    agendaDate = agendaDate || todayStr();
    const r = await api(A(`/agenda?data=${agendaDate}`));
    const [y, m, d] = agendaDate.split('-').map(Number);
    const label = new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'UTC' });
    const cols = r.funcionarios.map((b) => {
      const ap = r.agendamentos.filter((a) => a.barber_id === b.id);
      const off = r.folgas.filter((k) => !k.barber_id || k.barber_id === b.id);
      return `<div class="card"><h2>${esc(b.nickname || b.name)}</h2><p class="small muted">${b.escala.length ? b.escala.map((e) => `${e.inicio}–${e.fim}`).join(', ') : 'fora da escala'}</p>
        ${off.map((k) => `<div class="alert">Bloqueado ${hm(k.start_at)}–${hm(k.end_at)} ${esc(k.reason)}</div>`).join('')}
        ${ap.map((a) => `<div class="appt ${a.status}"><div class="t">${hm(a.start_at)}–${hm(a.end_at)} · ${esc(a.cliente)}</div><div class="small">${esc(a.servico)} · ${brl(a.price_cents)} · ${tag(a.status)} ${a.source === 'site' ? '<span class="small muted">pelo site</span>' : ''}</div>
          ${a.telefone ? `<div class="small muted">${esc(a.telefone)}</div>` : ''}
          <div class="btns">${a.status === 'pendente' ? `<button class="btn sm" data-st="confirmado" data-id="${a.id}">Confirmar</button>` : ''}
          ${['pendente', 'confirmado'].includes(a.status) ? `<button class="btn sm" data-st="atendido" data-id="${a.id}">Atendido</button><button class="btn sm" data-st="faltou" data-id="${a.id}">Faltou</button><button class="btn sm danger" data-st="cancelado" data-id="${a.id}">Cancelar</button>` : ''}
          <button class="btn sm" data-cli="${a.client_id}">Cliente</button></div></div>`).join('') || '<p class="empty">Livre.</p>'}</div>`;
    }).join('');
    $('#main').innerHTML = `<div class="head"><div><h1>Agenda</h1><p class="muted" style="text-transform:capitalize">${esc(label)}</p></div>
      <div class="actions"><button class="btn" id="ag-prev">‹</button><input type="date" id="ag-date" value="${agendaDate}" style="width:auto"><button class="btn" id="ag-next">›</button><button class="btn" id="ag-today">Hoje</button><button class="btn primary" id="ag-new">+ Agendar</button></div></div>
      <div class="agenda-cols">${cols || '<p class="empty">Nenhum funcionário habilitado.</p>'}</div>`;
    const set = (v) => { agendaDate = v; go(); };
    $('#ag-prev').addEventListener('click', () => set(addDays(agendaDate, -1)));
    $('#ag-next').addEventListener('click', () => set(addDays(agendaDate, 1)));
    $('#ag-today').addEventListener('click', () => set(todayStr()));
    $('#ag-date').addEventListener('change', (e) => set(e.target.value));
    $('#ag-new').addEventListener('click', () => newAppointment());
    $$('[data-st]').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.st === 'cancelado' && !confirm('Cancelar este agendamento? Os lembretes pendentes serão interrompidos.')) return;
      run(b, async () => { await api(A(`/agenda/${b.dataset.id}/status`), { method: 'PUT', body: { status: b.dataset.st } }); go(); });
    }));
    $$('[data-cli]').forEach((b) => b.addEventListener('click', () => openClient(Number(b.dataset.cli), go)));
  };
  function newAppointment() {
    let clientId = null;
    const box = modal(`<h2>Novo agendamento</h2><form class="form" id="f-ag">
      <div class="sfield full"><label>Cliente</label><input id="ag-cli" placeholder="Digite nome ou telefone" autocomplete="off"><div class="suggest" hidden></div><span class="hint" id="ag-cli-sel"></span></div>
      <label>Serviço<select name="servico">${lists.servicos.filter((s) => s.active).map((s) => `<option value="${s.id}">${esc(s.name)} (${s.duration_min} min)</option>`).join('')}</select></label>
      <label>Profissional<select name="barbeiro"><option value="">Qualquer</option>${lists.funcionarios.filter((f) => f.active).map((f) => `<option value="${f.id}">${esc(f.nickname || f.name)}</option>`).join('')}</select></label>
      <label>Data<input type="date" name="data" value="${agendaDate}"></label>
      <label>Horário<select name="hora_sel"><option value="">— escolha serviço e data —</option></select></label>
      <label class="full">Observações<input name="observacoes"></label></form>
      <p class="hint">A equipe pode marcar fora da antecedência mínima, mas nunca em cima de outro horário ou fora da escala.</p>
      <div class="modal-foot"><span></span><button class="btn primary" id="ag-save">Agendar</button></div>`);
    const f = $('#f-ag', box);
    const loadSlots = async () => {
      const sel = f.hora_sel; sel.innerHTML = '<option>Carregando…</option>';
      try {
        const r = await api(A(`/agenda/horarios?servico=${f.servico.value}&data=${f.data.value}${f.barbeiro.value ? `&barbeiro=${f.barbeiro.value}` : ''}`));
        sel.innerHTML = r.horarios.length ? r.horarios.map((h) => `<option value="${h.hora}|${h.barbeiro_id}">${h.hora} — ${esc(h.barbeiro)}</option>`).join('') : '<option value="">Sem horários livres</option>';
      } catch (e) { sel.innerHTML = `<option value="">${esc(e.message)}</option>`; }
    };
    ['servico', 'barbeiro', 'data'].forEach((n) => f[n].addEventListener('change', loadSlots));
    loadSlots();
    const inp = $('#ag-cli', box), sug = inp.nextElementSibling;
    inp.addEventListener('input', debounce(async () => {
      const q = inp.value.trim(); if (q.length < 2) { sug.hidden = true; return; }
      const campo = /^\d/.test(q) ? 'telefone' : 'nome';
      const r = await api(A(`/clientes/sugestoes?campo=${campo}&q=${encodeURIComponent(q)}`));
      sug.innerHTML = r.sugestoes.map((c) => `<button type="button" data-id="${c.id}" data-n="${esc(c.nome)}">${esc(c.nome)}<small>${esc(c.telefone || '')} · ${birthBR(c.nascimento)}</small></button>`).join('') || '<button type="button" disabled>Nenhum cliente. Cadastre em Clientes.</button>';
      sug.hidden = false;
      $$('button[data-id]', sug).forEach((b) => b.addEventListener('mousedown', (e) => { e.preventDefault(); clientId = Number(b.dataset.id); inp.value = b.dataset.n; sug.hidden = true; $('#ag-cli-sel', box).textContent = 'Cliente selecionado.'; }));
    }, 220));
    $('#ag-save', box).addEventListener('click', (e) => run(e.target, async () => {
      if (!clientId) throw new Error('Selecione o cliente na lista.');
      const [hora, barbeiro] = f.hora_sel.value.split('|');
      if (!hora) throw new Error('Escolha um horário.');
      await api(A('/agenda'), { body: { cliente_id: clientId, servico: Number(f.servico.value), barbeiro: Number(barbeiro), data: f.data.value, hora, observacoes: f.observacoes.value } });
      toast('Agendado.'); closeModal(); agendaDate = f.data.value; go();
    }));
  }

  // ================= Campanhas =================
  const TYPE_LABEL = { aniversario: 'Aniversariantes', inativos: 'Clientes inativos', lembrete: 'Lembrete de agendamento', agradecimento: 'Agradecimento', promocional: 'Promocional', confirmacao: 'Confirmação de agendamento' };
  const CAMP_LABEL = { ativa: 'Ativa', agendada: 'Agendada', pausada: 'Pausada', encerrada: 'Encerrada', arquivada: 'Arquivada', rascunho: 'Rascunho' };
  sections.campanhas = async (qs) => {
    const r = await api(A('/campanhas'));
    const showArch = qs.get('arquivadas') === '1';
    const list = r.campanhas.filter((c) => showArch || c.status !== 'arquivada');
    const n = (c, ch, sts) => sts.reduce((s, k) => s + (c.envios[ch][k] || 0), 0);
    $('#main').innerHTML = `<div class="head"><div><h1>Campanhas</h1><p class="muted">Cada campanha tem sua própria fila e configurações. Pausar uma não afeta as outras.</p></div>
      <div class="actions"><a class="btn" href="#campanhas${showArch ? '' : '?arquivadas=1'}">${showArch ? 'Ocultar' : 'Mostrar'} arquivadas</a><button class="btn primary" id="cp-new">+ Campanha promocional</button></div></div>
      <div class="card table-wrap"><table><thead><tr><th>Campanha</th><th>Situação</th><th>Canais</th><th>Na fila</th><th>Enviadas</th><th>Falha / incerto</th><th></th></tr></thead><tbody>
      ${list.map((c) => `<tr><td><b>${esc(c.name)}</b><br><span class="small muted">${TYPE_LABEL[c.type]}${c.purpose === 'marketing' ? ' · exige autorização de marketing' : ' · aviso de serviço'}</span></td>
        <td>${tag(c.status, CAMP_LABEL[c.status])}</td><td class="small">${c.channels.map((x) => (x === 'whatsapp' ? 'WhatsApp' : 'E-mail')).join(' + ')}</td>
        <td>${n(c, 'whatsapp', ['agendada'])} / ${n(c, 'email', ['agendada'])}</td>
        <td>${n(c, 'whatsapp', ['aceita', 'entregue', 'lida'])} / ${n(c, 'email', ['aceita', 'entregue', 'lida'])}</td>
        <td>${n(c, 'whatsapp', ['falha', 'incerta'])} / ${n(c, 'email', ['falha', 'incerta'])}</td>
        <td class="actions">${['ativa', 'agendada'].includes(c.status) ? `<button class="btn sm" data-act="pausar" data-id="${c.id}">Pausar</button>` : ''}
          ${['pausada', 'rascunho'].includes(c.status) ? `<button class="btn sm gold" data-act="iniciar" data-id="${c.id}">Iniciar</button>` : ''}
          ${['encerrada', 'arquivada'].includes(c.status) ? `<button class="btn sm" data-act="reabrir" data-id="${c.id}">Reabrir</button>` : ''}
          <button class="btn sm" data-edit="${c.id}">Editar</button> <button class="btn sm" data-fila="${c.id}">Fila</button>
          ${c.type === 'promocional' && !['ativa', 'encerrada', 'arquivada'].includes(c.status) ? `<button class="btn sm" data-act="encerrar" data-id="${c.id}">Encerrar</button>` : ''}
          ${!['ativa', 'arquivada'].includes(c.status) ? `<button class="btn sm" data-act="arquivar" data-id="${c.id}">Arquivar</button>` : ''}</td></tr>`).join('')}
      </tbody></table><p class="hint">Colunas de números: WhatsApp / e-mail.</p></div>`;
    $('#cp-new').addEventListener('click', () => editCampaign(null));
    $$('[data-edit]').forEach((b) => b.addEventListener('click', () => editCampaign(Number(b.dataset.edit))));
    $$('[data-fila]').forEach((b) => b.addEventListener('click', () => campaignQueue(Number(b.dataset.fila))));
    $$('[data-act]').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.act === 'encerrar' && !confirm('Encerrar a campanha? Envios que ainda não saíram serão cancelados.')) return;
      run(b, async () => { const x = await api(A(`/campanhas/${b.dataset.id}/acao`), { body: { acao: b.dataset.act } }); toast(`Campanha: ${CAMP_LABEL[x.status]}.`); go(); });
    }));
  };
  async function editCampaign(id) {
    const c = id ? await api(A(`/campanhas/${id}`)) : { type: 'promocional', name: '', channels: ['whatsapp', 'email'], config: { days: [1, 2, 3, 4, 5, 6], window_start: '09:00', window_end: '19:00', interval_seconds: 20, daily_limit: 200 }, text_whatsapp: 'Oi, {primeiro_nome}! ', email_subject: '', text_email: 'Olá, {primeiro_nome}!\n\n\n\n{barbearia}\n\nNão quer mais receber estes e-mails? {link_descadastro}', wa_template: '', wa_lang: 'pt_BR' };
    const cfg = c.config;
    const extra = {
      aniversario: `<label>Horário de envio<input type="time" name="send_time" value="${cfg.send_time || '09:00'}"></label>`,
      inativos: `<label>Sem atendimento há mais de (dias)<input type="number" name="inactive_days" min="7" value="${cfg.inactive_days || 60}"></label>
        <label>Repetir a cada (dias)<input type="number" name="repeat_every_days" min="7" value="${cfg.repeat_every_days || 60}"></label>
        <label>Máximo de mensagens por período sem vir<input type="number" name="max_repeats" min="1" max="6" value="${cfg.max_repeats || 1}"></label>
        <label>Horário de envio<input type="time" name="send_time" value="${cfg.send_time || '10:00'}"></label>`,
      lembrete: `<label>Horas antes do horário<input type="number" name="hours_before" min="1" max="72" value="${cfg.hours_before || 24}"></label>`,
      agradecimento: `<label>Horas depois do atendimento<input type="number" name="hours_after" min="0" max="48" value="${cfg.hours_after ?? 2}"></label>`,
      promocional: `<label>Início<input type="datetime-local" name="inicio" value="${c.starts_at ? new Date(c.starts_at).toLocaleString('sv-SE', { timeZone: TZ }).slice(0, 16) : ''}"></label>
        <label>Fim<input type="datetime-local" name="fim" value="${c.ends_at ? new Date(c.ends_at).toLocaleString('sv-SE', { timeZone: TZ }).slice(0, 16) : ''}"></label>
        <label>Só clientes do profissional<select name="barber_id"><option value="">Todos</option>${lists.funcionarios.map((f) => `<option value="${f.id}" ${Number(cfg.barber_id) === f.id ? 'selected' : ''}>${esc(f.nickname || f.name)}</option>`).join('')}</select></label>
        <label>Só quem veio nos últimos (dias)<input type="number" name="last_service_within_days" min="0" value="${cfg.last_service_within_days || ''}"></label>`,
      confirmacao: '',
    }[c.type];
    if (!lists.funcionarios.length) await loadLists();
    const box = modal(`<h2>${id ? esc(c.name) : 'Nova campanha promocional'}</h2>
      ${c.elegiveis ? `<div class="note">Hoje, <b>${c.elegiveis.clientes_com_canal}</b> clientes podem receber esta campanha (contato confirmado + autorização): ${c.elegiveis.whatsapp} por WhatsApp, ${c.elegiveis.email} por e-mail.</div>` : ''}
      <form class="form" id="f-cp" novalidate>
        <label class="full">Nome<input name="nome" value="${esc(c.name)}"></label>
        <fieldset class="full"><legend>Canais</legend><div class="checks">
          <label><input type="checkbox" name="ch_whatsapp" ${c.channels.includes('whatsapp') ? 'checked' : ''}> WhatsApp</label>
          <label><input type="checkbox" name="ch_email" ${c.channels.includes('email') ? 'checked' : ''}> E-mail</label></div>
          <p class="hint">Com os dois marcados, quem tem os dois contatos autorizados recebe nos dois, agendados no mesmo horário com filas separadas. A chegada depende de cada serviço.</p></fieldset>
        <fieldset class="full"><legend>Quando</legend><div class="form">
          <div class="full"><span class="lbl">Dias da semana</span><div class="checks">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<label><input type="checkbox" name="day" value="${d}" ${cfg.days.includes(d) ? 'checked' : ''}> ${WD[d].slice(0, 3)}</label>`).join('')}</div></div>
          <label>Enviar a partir de<input type="time" name="window_start" value="${cfg.window_start}"></label><label>Até<input type="time" name="window_end" value="${cfg.window_end}"></label>
          <label>Intervalo entre envios (segundos)<input type="number" name="interval_seconds" min="2" value="${cfg.interval_seconds}"></label>
          <label>Limite por dia (por canal)<input type="number" name="daily_limit" min="1" value="${cfg.daily_limit}"></label>
          ${extra}</div></fieldset>
        <fieldset class="full"><legend>Texto do WhatsApp</legend>
          <label>Modelo aprovado na Meta <span class="h">(nome exato do modelo; o texto abaixo deve ser igual ao aprovado)</span><input name="modelo_whatsapp" value="${esc(c.wa_template)}" placeholder="ex.: aniversario_cliente"></label>
          <textarea name="texto_whatsapp" rows="4">${esc(c.text_whatsapp)}</textarea>
          <p class="hint">Campos: {nome} {primeiro_nome} {barbearia} {barbeiro} {servico} {data} {hora} {dia_semana} {link_agendamento} {link_gerenciar}. ${c.parametros_modelo?.length ? `Parâmetros do modelo, na ordem: ${c.parametros_modelo.map((p, i) => `{{${i + 1}}}=${p}`).join(', ')}` : ''}</p></fieldset>
        <fieldset class="full"><legend>E-mail</legend><label>Assunto<input name="assunto_email" value="${esc(c.email_subject)}"></label>
          <textarea name="texto_email" rows="6">${esc(c.text_email)}</textarea>
          ${c.purpose !== 'servico' ? '<p class="hint">Mantenha {link_descadastro} nos e-mails promocionais.</p>' : ''}</fieldset>
      </form>
      ${c.previa ? `<details><summary>Prévia com um cliente de exemplo</summary><p class="small"><b>WhatsApp</b></p><pre class="preview">${esc(c.previa.whatsapp)}</pre><p class="small"><b>E-mail: ${esc(c.previa.assunto)}</b></p><pre class="preview">${esc(c.previa.email)}</pre></details>` : ''}
      <div class="note" style="margin-top:1rem">O robô só envia o texto aprovado aqui. Ele não cria descontos, não confirma horários e não negocia — respostas dos clientes vão para <b>Respostas</b>.</div>
      <div class="modal-foot"><span></span><div><button class="btn" data-x>Cancelar</button> <button class="btn primary" id="cp-save">Salvar</button></div></div>`);
    $('#cp-save', box).addEventListener('click', (e) => run(e.target, async () => {
      const f = $('#f-cp', box);
      const conf = { days: $$('input[name=day]:checked', f).map((i) => Number(i.value)), window_start: f.window_start.value, window_end: f.window_end.value, interval_seconds: Number(f.interval_seconds.value), daily_limit: Number(f.daily_limit.value) };
      for (const k of ['send_time', 'inactive_days', 'repeat_every_days', 'max_repeats', 'hours_before', 'hours_after', 'barber_id', 'last_service_within_days']) if (f[k]) conf[k] = f[k].type === 'time' ? f[k].value : (f[k].value === '' ? null : Number(f[k].value));
      const toIso = (v) => (v ? new Date(v + ':00-03:00').toISOString() : null);
      const body = { nome: f.nome.value, canais: [f.ch_whatsapp.checked && 'whatsapp', f.ch_email.checked && 'email'].filter(Boolean), config: conf,
        modelo_whatsapp: f.modelo_whatsapp.value, texto_whatsapp: f.texto_whatsapp.value, assunto_email: f.assunto_email.value, texto_email: f.texto_email.value };
      if (f.inicio) { body.inicio = toIso(f.inicio.value); body.fim = toIso(f.fim.value); }
      if (id) await api(A(`/campanhas/${id}`), { method: 'PUT', body }); else await api(A('/campanhas'), { body });
      toast('Campanha salva.'); closeModal(); go();
    }));
  }
  async function campaignQueue(id, status = '', canal = '', page = 1) {
    const r = await api(A(`/campanhas/${id}/fila?status=${status}&canal=${canal}&pagina=${page}`));
    const box = modal(`<h2>Fila da campanha</h2><div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.8rem">
      <select id="q-st" style="width:auto"><option value="">Todas as situações</option>${Object.entries(STATUS_ENVIO).map(([k, v]) => `<option value="${k}" ${status === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <select id="q-ch" style="width:auto"><option value="">Todos os canais</option><option value="whatsapp" ${canal === 'whatsapp' ? 'selected' : ''}>WhatsApp</option><option value="email" ${canal === 'email' ? 'selected' : ''}>E-mail</option></select>
      <span class="muted small" style="align-self:center">${r.total} envio(s)</span></div>
      <div class="table-wrap">${r.envios.length ? `<table><tr><th>Cliente</th><th>Canal</th><th>Evento</th><th>Agendado</th><th>Situação</th><th>Detalhe</th><th></th></tr>${r.envios.map((x) => `<tr><td>${esc(x.cliente)}</td><td>${x.channel}</td><td class="small">${esc(x.event_key)}</td><td class="small">${dt(x.scheduled_at)}</td><td>${tag(x.status, STATUS_ENVIO[x.status])}</td><td class="small">${esc(x.error || x.destination || '')}</td>
        <td class="actions">${['falha', 'incerta'].includes(x.status) ? `<button class="btn sm" data-res="reenviar" data-id="${x.id}" title="Agenda de novo (decisão manual)">Reenviar</button><button class="btn sm" data-res="confirmar-recebido" data-id="${x.id}">Cliente recebeu</button><button class="btn sm" data-res="descartar" data-id="${x.id}">Descartar</button>` : ''}<button class="btn sm" data-ev="${x.id}">Histórico</button></td></tr>`).join('')}</table>` : '<p class="empty">Nada aqui.</p>'}</div>
      <div class="pager">${page > 1 ? '<button class="btn sm" id="q-prev">‹</button>' : ''}${r.total > page * 50 ? '<button class="btn sm" id="q-next">›</button>' : ''}</div>
      <p class="hint">Resultado incerto = o serviço pode ter recebido ou não. O robô nunca reenvia sozinho; confirme com o cliente antes de reenviar.</p>`);
    $('#q-st', box).addEventListener('change', (e) => campaignQueue(id, e.target.value, canal, 1));
    $('#q-ch', box).addEventListener('change', (e) => campaignQueue(id, status, e.target.value, 1));
    const pv = $('#q-prev', box); if (pv) pv.addEventListener('click', () => campaignQueue(id, status, canal, page - 1));
    const nx = $('#q-next', box); if (nx) nx.addEventListener('click', () => campaignQueue(id, status, canal, page + 1));
    $$('[data-res]', box).forEach((b) => b.addEventListener('click', () => run(b, async () => { await api(A(`/envios/${b.dataset.id}/resolver`), { body: { acao: b.dataset.res } }); campaignQueue(id, status, canal, page); })));
    $$('[data-ev]', box).forEach((b) => b.addEventListener('click', () => run(b, async () => {
      const ev = await api(A(`/envios/${b.dataset.ev}`));
      alert(ev.eventos.map((e) => `${dt(e.created_at)}  ${STATUS_ENVIO[e.status] || e.status}  ${e.detail}`).join('\n'));
    })));
  }

  // ================= Respostas =================
  sections.respostas = async (qs) => {
    const st = qs.get('status') ?? 'nova';
    const r = await api(A(`/respostas${st ? `?status=${st}` : ''}`));
    const KIND = { mensagem: 'Mensagem', descadastro: 'Pediu para sair', 'possivel-cancelamento': 'Possível cancelamento' };
    $('#main').innerHTML = `<div class="head"><div><h1>Respostas dos clientes</h1><p class="muted">Mensagens recebidas no WhatsApp conectado. Respostas por e-mail ficam na caixa do Gmail.</p></div>
      <div class="actions">${['nova', 'em-atendimento', 'resolvida', ''].map((s) => `<a class="btn ${s === st ? 'primary' : ''}" href="#respostas?status=${s}">${{ nova: 'Novas', 'em-atendimento': 'Em atendimento', resolvida: 'Resolvidas', '': 'Todas' }[s]}</a>`).join('')}</div></div>
      <div class="card">${r.respostas.length ? `<table><tr><th>Recebida</th><th>De</th><th>Mensagem</th><th>Tipo</th><th>Situação</th><th></th></tr>${r.respostas.map((m) => `<tr><td class="small">${dt(m.received_at)}</td><td>${esc(m.cliente || m.from_addr)}</td><td>${esc(m.body)}${m.reply ? `<br><span class="small muted">↳ ${esc(m.reply)}</span>` : ''}</td><td>${tag(m.kind === 'mensagem' ? 'info' : 'warn', KIND[m.kind])}</td><td>${tag(m.status)}</td>
        <td class="actions">${m.status !== 'resolvida' ? `<button class="btn sm" data-reply="${m.id}">Responder</button> <button class="btn sm" data-st="resolvida" data-id="${m.id}">Resolvida</button>` : ''}${m.status === 'nova' ? ` <button class="btn sm" data-st="em-atendimento" data-id="${m.id}">Assumir</button>` : ''}</td></tr>`).join('')}</table>` : '<p class="empty">Nenhuma mensagem.</p>'}</div>`;
    $$('[data-st]').forEach((b) => b.addEventListener('click', () => run(b, async () => { await api(A(`/respostas/${b.dataset.id}`), { method: 'PUT', body: { status: b.dataset.st } }); go(); refreshBadges(); })));
    $$('[data-reply]').forEach((b) => b.addEventListener('click', () => {
      const box = modal(`<h2>Responder pelo WhatsApp</h2><p class="hint">Texto livre só é permitido até 24h depois da última mensagem do cliente. Não ofereça descontos ou condições fora das regras da barbearia.</p><textarea id="rp-t"></textarea><div class="modal-foot"><span></span><button class="btn primary" id="rp-go">Enviar</button></div>`);
      $('#rp-go', box).addEventListener('click', (e) => run(e.target, async () => { await api(A(`/respostas/${b.dataset.reply}/responder`), { body: { texto: $('#rp-t', box).value } }); toast('Enviada.'); closeModal(); go(); }));
    }));
    refreshBadges();
  };

  // ================= Conferências =================
  sections.conferencias = async () => {
    const r = await api(A('/conferencias'));
    $('#main').innerHTML = `<h1>Conferências</h1><p class="muted">Clientes que perderam acesso aos contatos antigos, ou homônimos. Confirme a identidade (ex.: pessoalmente) antes de aprovar.</p>
      <div class="card">${r.conferencias.length ? `<table><tr><th>Pedido</th><th>Cliente</th><th>Dados atuais</th><th>Informado</th><th>Situação</th><th></th></tr>${r.conferencias.map((c) => `<tr><td class="small">${dt(c.created_at)}<br>${c.kind === 'homonimo' ? 'Homônimo' : 'Perdeu acesso'}</td>
        <td>${esc(c.cliente || c.payload.nome || '—')}${c.nascimento ? `<br><span class="small muted">${birthBR(c.nascimento)}</span>` : ''}</td>
        <td class="small">${esc(c.telefone_atual || '')}<br>${esc(c.email_atual || '')}</td>
        <td class="small">${esc(c.payload.telefone || '')}<br>${esc(c.payload.email || '')}${c.payload.mensagem ? `<br><i>${esc(c.payload.mensagem)}</i>` : ''}</td>
        <td>${tag(c.status)}${c.resolution ? `<br><span class="small">${esc(c.resolution)}</span>` : ''}</td>
        <td class="actions">${c.status === 'aberta' ? `${c.kind === 'perdeu-acesso' ? `<button class="btn sm gold" data-ac="aprovar" data-id="${c.id}">Aprovar contatos</button>` : ''} <button class="btn sm" data-ac="recusar" data-id="${c.id}">${c.kind === 'homonimo' ? 'Concluir' : 'Recusar'}</button>` : ''}</td></tr>`).join('')}</table>` : '<p class="empty">Nenhum pedido.</p>'}</div>`;
    $$('[data-ac]').forEach((b) => b.addEventListener('click', () => {
      const note = prompt(b.dataset.ac === 'aprovar' ? 'Como a identidade foi confirmada? (ex.: conferido no balcão com documento)' : 'Observação (opcional)');
      if (note === null) return;
      run(b, async () => { await api(A(`/conferencias/${b.dataset.id}`), { body: { acao: b.dataset.ac, resolucao: note } }); go(); refreshBadges(); });
    }));
  };

  // ================= Conexões =================
  sections.conexoes = async (qs) => {
    const r = await api(A('/conexoes'));
    const by = Object.fromEntries(r.conexoes.map((c) => [c.channel, c]));
    const card = (ch, title, body) => { const c = by[ch];
      return `<div class="card"><h2>${title}</h2>${c ? `<p>${tag(c.status)} <b>${esc(c.label)}</b></p><p class="small muted">Provedor: ${esc(c.provider)} · última verificação ${dt(c.last_check_at)} · último sucesso ${dt(c.last_ok_at)}${c.backoff_until && c.backoff_until > new Date().toISOString() ? ` · <b>pausado por limite do serviço até ${dt(c.backoff_until)}</b>` : ''}</p>
        ${c.last_error ? `<div class="alert err">${esc(c.last_error)}</div>` : ''}
        <div style="display:flex;gap:.4rem;flex-wrap:wrap">${c.status === 'conectado' ? `<button class="btn" data-ac="pausar" data-id="${c.id}">Pausar</button>` : ''}${['pausado', 'erro'].includes(c.status) ? `<button class="btn" data-ac="retomar" data-id="${c.id}">Retomar</button>` : ''}
          ${c.status !== 'desconectado' ? `<button class="btn" data-test="${c.id}" data-ch="${ch}">Enviar teste</button><button class="btn danger" data-ac="desconectar" data-id="${c.id}">Desconectar</button>` : ''}</div>` : '<p>Não conectado.</p>'}
        <hr style="border:0;border-top:1px solid var(--line);margin:1rem 0">${body}</div>`; };
    $('#main').innerHTML = `<h1>Conexões</h1>
      ${qs.get('ok') ? '<div class="alert ok">Gmail conectado.</div>' : ''}${qs.get('erro') ? `<div class="alert err">Não foi possível conectar: ${esc(qs.get('erro'))}</div>` : ''}
      <div class="note">Pausar interrompe os envios daquele canal (as filas ficam guardadas). Se um serviço sinalizar limite, o robô para sozinho por 30 minutos e não tenta contornar o bloqueio.</div>
      ${card('whatsapp', 'WhatsApp (API oficial da Meta)', `<details ${by.whatsapp && by.whatsapp.provider === 'whatsapp-cloud' ? '' : 'open'}><summary><b>Conectar o número da barbearia</b></summary>
        <ol class="small"><li>Em business.facebook.com, crie/verifique a empresa e uma conta do WhatsApp Business. Com a coexistência, o número continua funcionando no app WhatsApp Business do celular.</li>
        <li>No app da Meta (developers.facebook.com), em WhatsApp &gt; Configuração da API, copie o <b>ID do número de telefone</b> e gere um <b>token permanente</b> (usuário do sistema).</li>
        <li>Configure o webhook: URL <code>${esc(r.webhook_url)}</code>, token de verificação = WHATSAPP_VERIFY_TOKEN do servidor, campo <b>messages</b>. ${r.meta_configurado ? tag('ok', 'servidor pronto') : tag('err', 'falta META_APP_SECRET / WHATSAPP_VERIFY_TOKEN no .env')}</li>
        <li>Crie e aprove os modelos de mensagem (um por campanha) e um modelo de <b>autenticação</b> para o código de acesso.</li></ol>
        <form class="form" id="f-wa"><label>ID do número de telefone<input name="phone_number_id"></label><label>ID da conta WhatsApp Business<input name="waba_id"></label>
        <label class="full">Token de acesso<input name="access_token" type="password" autocomplete="off"></label><label>Nome do modelo de autenticação (código)<input name="modelo_codigo" placeholder="ex.: codigo_acesso"></label></form>
        <button class="btn primary" id="wa-go" style="margin-top:.6rem">Conectar WhatsApp</button></details>
        <p class="small" style="margin-top:.8rem"><button class="link" data-sim="whatsapp">Usar modo simulado</button> (para testes: nada é enviado).</p>`)}
      ${card('email', 'E-mail (Gmail com OAuth)', `${r.google_configurado ? '<p>Você será levado à página do Google para autorizar <b>somente o envio</b> de e-mails. A senha do Google nunca é digitada aqui.</p><a class="btn primary" href="/admin/oauth/google/start">Conectar com Google</a>'
        : '<div class="alert">O servidor ainda não tem GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET. Crie as credenciais OAuth no Google Cloud (veja o guia) e reinicie o servidor.</div>'}
        <p class="small muted" style="margin-top:.8rem">Limite do Gmail pessoal: cerca de 500 e-mails por dia, somando todos os envios da conta. O Gmail não confirma entrega — o status máximo é "aceito pelo serviço".</p>
        <p class="small"><button class="link" data-sim="email">Usar modo simulado</button></p>`)}`;
    $$('[data-ac]').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.ac === 'desconectar' && !confirm('Desconectar? Os envios desse canal param até conectar de novo.')) return;
      run(b, async () => { await api(A(`/conexoes/${b.dataset.id}/acao`), { body: { acao: b.dataset.ac } }); go(); });
    }));
    $$('[data-test]').forEach((b) => b.addEventListener('click', () => {
      const dest = prompt(b.dataset.ch === 'whatsapp' ? 'Número para o teste (com DDD). Usa o modelo "hello_world" da Meta.' : 'E-mail para o teste:');
      if (dest) run(b, async () => { const x = await api(A(`/conexoes/${b.dataset.test}/acao`), { body: { acao: 'testar', destino: dest } }); toast(x.mensagem); });
    }));
    $$('[data-sim]').forEach((b) => b.addEventListener('click', () => { if (confirm('Trocar para o modo simulado? Nada será enviado de verdade.')) run(b, async () => { await api(A('/conexoes/simulado'), { body: { canal: b.dataset.sim } }); go(); }); }));
    const wa = $('#wa-go'); if (wa) wa.addEventListener('click', (e) => run(e.target, async () => { const x = await api(A('/conexoes/whatsapp'), { body: formData($('#f-wa')) }); toast(`WhatsApp conectado: ${x.numero}`); go(); }));
  };

  // ================= Relatórios =================
  sections.relatorios = async (qs) => {
    const de = qs.get('de') || addDays(todayStr(), -30), ate = qs.get('ate') || todayStr();
    const r = await api(A(`/relatorios?de=${de}&ate=${ate}`));
    const table = (rows, cols) => rows.length ? `<table><tr>${cols.map((c) => `<th>${c[1]}</th>`).join('')}</tr>${rows.map((x) => `<tr>${cols.map((c) => `<td>${c[2] ? c[2](x[c[0]]) : esc(x[c[0]])}</td>`).join('')}</tr>`).join('')}</table>` : '<p class="empty">Sem dados.</p>';
    $('#main').innerHTML = `<div class="head"><h1>Relatórios</h1><form class="actions" id="f-rel"><input type="date" name="de" value="${de}" style="width:auto"> até <input type="date" name="ate" value="${ate}" style="width:auto"><button class="btn primary">Ver</button></form></div>
      <div class="grid k2">
        <div class="card"><h2>Envios por campanha</h2>${table(r.envios_por_campanha, [['campanha', 'Campanha'], ['canal', 'Canal'], ['status', 'Situação', (s) => tag(s, STATUS_ENVIO[s])], ['n', 'Qtd']])}</div>
        <div class="card"><h2>Agendamentos</h2>${table(r.agendamentos_por_status, [['status', 'Situação', (s) => tag(s)], ['n', 'Qtd']])}
          <h3 style="margin-top:1rem">Por funcionário</h3>${table(r.agendamentos_por_funcionario, [['funcionario', 'Funcionário'], ['n', 'Agendamentos'], ['faturado', 'Atendido (R$)', brl]])}</div>
        <div class="card"><h2>Novos clientes</h2>${table(r.novos_clientes, [['origem', 'Origem'], ['n', 'Qtd']])}</div>
        <div class="card"><h2>Descadastros e respostas</h2>${table(r.descadastros, [['canal', 'Canal'], ['n', 'Pedidos de saída']])}${table(r.respostas, [['tipo', 'Tipo de resposta'], ['n', 'Qtd']])}</div>
      </div>`;
    $('#f-rel').addEventListener('submit', (e) => { e.preventDefault(); location.hash = `relatorios?de=${e.target.de.value}&ate=${e.target.ate.value}`; });
  };

  // ================= Logs =================
  sections.logs = async (qs) => {
    const tipo = qs.get('tipo') || 'robo';
    const params = new URLSearchParams({ de: qs.get('de') || '', ate: qs.get('ate') || '', acao: qs.get('acao') || '', nivel: qs.get('nivel') || '', ocultar_verificacoes: qs.get('ocultar') || '', pagina: qs.get('pagina') || 1 });
    const r = await api(A(`/logs/${tipo}?${params}`));
    $('#main').innerHTML = `<div class="head"><h1>Logs</h1><div class="actions"><a class="btn ${tipo === 'robo' ? 'primary' : ''}" href="#logs?tipo=robo">Ações do robô</a><a class="btn ${tipo === 'auditoria' ? 'primary' : ''}" href="#logs?tipo=auditoria">Auditoria (pessoas)</a>
      <a class="btn" href="${A(`/logs/${tipo}/exportar?${params}`)}">Exportar Excel</a></div></div>
      <form class="card" id="f-log" style="display:flex;gap:.6rem;flex-wrap:wrap;align-items:end">
        <label class="lbl">De<input type="date" name="de" value="${esc(qs.get('de') || '')}"></label><label class="lbl">Até<input type="date" name="ate" value="${esc(qs.get('ate') || '')}"></label>
        <label class="lbl">Ação contém<input name="acao" value="${esc(qs.get('acao') || '')}"></label>
        ${tipo === 'robo' ? `<label class="lbl">Nível<select name="nivel"><option value="">Todos</option>${['info', 'aviso', 'erro'].map((n) => `<option ${qs.get('nivel') === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          <label class="small" style="display:flex;gap:.3rem;align-items:center"><input type="checkbox" name="ocultar" ${qs.get('ocultar') === '1' ? 'checked' : ''}> Ocultar verificações periódicas</label>` : ''}
        <button class="btn primary">Filtrar</button></form>
      <div class="card table-wrap"><p class="small muted">${r.total.toLocaleString('pt-BR')} registro(s)</p>
      ${tipo === 'robo' ? `<table><tr><th>Data e hora</th><th>Nível</th><th>Ação</th><th>Resultado</th><th>Detalhe</th></tr>${r.linhas.map((l) => `<tr><td class="small">${dt(l.ts)}</td><td>${tag(l.level === 'info' ? 'ok' : l.level)}</td><td>${esc(l.action)}</td><td>${esc(l.result)}</td><td class="small">${esc(l.detail)}</td></tr>`).join('')}</table>`
        : `<table><tr><th>Data e hora</th><th>Quem</th><th>Ação</th><th>Item</th><th>Resultado</th><th>Detalhe</th><th>IP</th></tr>${r.linhas.map((l) => `<tr><td class="small">${dt(l.ts)}</td><td>${esc(l.actor)}</td><td>${esc(l.action)}</td><td class="small">${esc(l.entity)} ${esc(l.entity_id)}</td><td>${tag(l.result === 'ok' ? 'ok' : 'err', l.result)}</td><td class="small">${esc(l.detail)}</td><td class="small">${esc(l.ip || '')}</td></tr>`).join('')}</table>`}
      <div class="pager">${r.pagina > 1 ? `<a class="btn sm" href="#logs?${new URLSearchParams({ ...Object.fromEntries(qs), pagina: r.pagina - 1 })}">‹</a>` : ''}${r.total > r.pagina * 100 ? `<a class="btn sm" href="#logs?${new URLSearchParams({ ...Object.fromEntries(qs), pagina: r.pagina + 1 })}">›</a>` : ''}</div></div>`;
    $('#f-log').addEventListener('submit', (e) => { e.preventDefault(); const d = formData(e.target); location.hash = `logs?${new URLSearchParams({ tipo, de: d.de, ate: d.ate, acao: d.acao, nivel: d.nivel || '', ocultar: d.ocultar ? '1' : '' })}`; });
  };

  // ================= Configurações =================
  sections.config = async () => {
    const [c, g] = await Promise.all([api(A('/config')), api(A('/galeria'))]);
    const s = c.shop, b = c.booking, al = c.alerts;
    $('#main').innerHTML = `<h1>Configurações</h1>
      <div class="card"><h2>Barbearia (aparece no site)</h2><form class="form" id="f-shop">
        <label>Nome<input name="name" value="${esc(s.name)}"></label><label>Frase de destaque<input name="tagline" value="${esc(s.tagline)}"></label>
        <label class="full">Sobre<textarea name="about">${esc(s.about)}</textarea></label>
        <label class="full">Endereço<input name="address" value="${esc(s.address)}"></label>
        <label>Horário de funcionamento (texto)<input name="hours_text" value="${esc(s.hours_text)}"></label>
        <label>Telefone para exibir<input name="phone_display" value="${esc(s.phone_display)}"></label>
        <label>WhatsApp para contato (com DDD)<input name="whatsapp_number" value="${esc(s.whatsapp_number)}"></label>
        <label>Instagram (link)<input name="instagram" value="${esc(s.instagram)}"></label>
        <label class="full">Mapa (link "incorporar" do Google Maps: https://www.google.com/maps/embed?...)<input name="maps_url" value="${esc(s.maps_url)}"></label>
        <label>Logo<input type="file" data-up="logo" accept="image/*"><span class="h">Atual: <img src="${esc(s.logo)}" alt="" style="height:36px;vertical-align:middle"></span></label>
        <label>Foto de capa<input type="file" data-up="hero_image" accept="image/*">${s.hero_image ? `<span class="h">Atual: <img src="${esc(s.hero_image)}" alt="" style="height:36px;vertical-align:middle"> <button type="button" class="link" id="rm-hero">remover</button></span>` : ''}</label>
      </form><button class="btn primary" id="shop-save" style="margin-top:.8rem">Salvar</button></div>

      <div class="card"><h2>Galeria do site</h2><p class="hint">Use só fotos de trabalhos da barbearia, com autorização de quem aparece. Não publique as fotos do lutador de judô que estão no Instagram.</p>
        <div style="display:flex;gap:.6rem;flex-wrap:wrap;margin:.6rem 0">${g.fotos.map((f) => `<div style="position:relative"><img src="${esc(f.path)}" alt="" style="width:110px;height:110px;object-fit:cover;border-radius:8px"><button class="btn sm danger" data-rmfoto="${f.id}" style="position:absolute;top:4px;right:4px">×</button></div>`).join('') || '<span class="muted">Sem fotos.</span>'}</div>
        <input type="file" id="gal-up" accept="image/*" multiple></div>

      <div class="card"><h2>Regras do agendamento</h2><form class="form" id="f-book">
        <label style="display:flex;gap:.5rem;align-items:center" class="full"><input type="checkbox" name="auto_confirm" ${b.auto_confirm ? 'checked' : ''}> Confirmar automaticamente (desmarcado: a equipe aprova cada pedido)</label>
        <label>Antecedência mínima (min)<input type="number" name="min_advance_min" value="${b.min_advance_min}"></label>
        <label>Agendar até quantos dias à frente<input type="number" name="max_days_ahead" value="${b.max_days_ahead}"></label>
        <label>Grade de horários (min)<input type="number" name="slot_step_min" value="${b.slot_step_min}" min="5" step="5"></label>
        <label>Cliente cancela pelo site até (min antes)<input type="number" name="cancel_deadline_min" value="${b.cancel_deadline_min}"></label>
        <label>Agendamentos futuros por cliente<input type="number" name="max_future_per_client" value="${b.max_future_per_client}" min="1"></label>
        <label>Lembrar o aparelho do cliente por (dias)<input type="number" name="client_session_days" value="${b.client_session_days}" min="1"></label>
      </form><button class="btn primary" id="book-save" style="margin-top:.8rem">Salvar</button></div>

      <div class="card"><h2>Avisos ao administrador</h2><form class="form" id="f-al">
        <label>E-mail para alertas do robô<input name="admin_email" type="email" value="${esc(al.admin_email)}"></label>
        <label>Considerar fila travada após (min)<input type="number" name="stuck_minutes" value="${al.stuck_minutes}"></label>
        <label>Verificar conexões a cada (min)<input type="number" name="connection_check_min" value="${al.connection_check_min}"></label>
      </form><button class="btn primary" id="al-save" style="margin-top:.8rem">Salvar</button></div>

      <div class="card"><h2>Respostas automáticas</h2><form class="form" id="f-rep">
        <label class="full">Palavras para sair das mensagens (separadas por vírgula)<input name="optout_keywords" value="${esc(c.replies.optout_keywords.join(', '))}"></label>
        <label class="full">Confirmação enviada ao cliente que pediu para sair<textarea name="optout_confirmation">${esc(c.replies.optout_confirmation)}</textarea></label>
      </form><p class="hint">É a única resposta automática do robô. Outras mensagens vão para a equipe em Respostas.</p><button class="btn primary" id="rep-save" style="margin-top:.8rem">Salvar</button></div>

      <div class="card"><h2>Minha senha</h2><form class="form" id="f-pw"><label>Senha atual<input type="password" name="atual" autocomplete="current-password"></label><label>Nova senha (mín. 10)<input type="password" name="nova" autocomplete="new-password"></label></form>
        <button class="btn" id="pw-save" style="margin-top:.8rem">Trocar senha</button></div>`;
    const pending = {};
    $$('[data-up]').forEach((i) => i.addEventListener('change', () => run(null, async () => { pending[i.dataset.up] = await uploadImage(i.files[0]); toast('Imagem carregada. Clique em Salvar.'); })));
    const rm = $('#rm-hero'); if (rm) rm.addEventListener('click', () => { pending.hero_image = ''; toast('Capa será removida ao salvar.'); });
    $('#shop-save').addEventListener('click', (e) => run(e.target, async () => { await api(A('/config'), { method: 'PUT', body: { shop: { ...formData($('#f-shop')), ...pending } } }); toast('Salvo.'); go(); }));
    $('#book-save').addEventListener('click', (e) => run(e.target, async () => { await api(A('/config'), { method: 'PUT', body: { booking: formData($('#f-book')) } }); toast('Salvo.'); }));
    $('#al-save').addEventListener('click', (e) => run(e.target, async () => { const d = formData($('#f-al')); d.stuck_minutes = Number(d.stuck_minutes); d.connection_check_min = Number(d.connection_check_min); await api(A('/config'), { method: 'PUT', body: { alerts: d } }); toast('Salvo.'); }));
    $('#rep-save').addEventListener('click', (e) => run(e.target, async () => { const d = formData($('#f-rep')); await api(A('/config'), { method: 'PUT', body: { replies: { optout_keywords: d.optout_keywords.split(',').map((x) => x.trim()).filter(Boolean), optout_confirmation: d.optout_confirmation } } }); toast('Salvo.'); }));
    $('#pw-save').addEventListener('click', (e) => run(e.target, async () => { await api(A('/minha-senha'), { body: formData($('#f-pw')) }); toast('Senha alterada.'); $('#f-pw').reset(); }));
    $('#gal-up').addEventListener('change', (e) => run(null, async () => { for (const f of e.target.files) { const p = await uploadImage(f); await api(A('/galeria'), { body: { caminho: p } }); } go(); }));
    $$('[data-rmfoto]').forEach((b) => b.addEventListener('click', () => run(b, async () => { await api(A(`/galeria/${b.dataset.rmfoto}`), { method: 'DELETE' }); go(); })));
  };

  // ================= Início =================
  api(A('/me')).then(start).catch(showLogin);
})();
