'use strict';
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtPhone = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.startsWith('55') && d.length >= 12 ? `(${d.slice(2, 4)}) ${d.slice(4, -4)}-${d.slice(-4)}` : (p || ''); };
  const brl = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  async function api(path, body) {
    const opt = body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' }, body: JSON.stringify(body) };
    const res = await fetch(path, { credentials: 'same-origin', ...opt });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(data.erro || 'Algo deu errado. Tente novamente.'); e.status = res.status; throw e; }
    return data;
  }
  function toast(msg, err) {
    const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (err ? ' err' : ''); t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 4500);
  }
  function busy(btn, on) { if (!btn) return; btn.disabled = on; if (on) { btn.dataset.label = btn.textContent; btn.textContent = 'Aguarde…'; } else if (btn.dataset.label) btn.textContent = btn.dataset.label; }

  const state = { site: null, me: null, week: null, start: null, slot: null };
  const isBookingPage = () => Boolean($('#bk-grid'));
  const BOOK_URL = 'agendar.html';
  const setText = (sel, v) => { const el = $(sel); if (el) el.textContent = v || ''; };

  // ---------- Conteúdo comum ----------
  function renderSite(s) {
    const b = s.barbearia;
    document.title = isBookingPage() ? `Agendar horário — ${b.nome}` : `${b.nome} — Barbearia`;
    setText('#brand-name', b.nome); setText('#hero-title', b.nome); setText('#ft-name', b.nome);
    if (b.logo) $$('#brand-logo, #hero-logo, .footer-logo').forEach((i) => { i.src = b.logo; });
    if (b.instagram && $('#ig-link')) $('#ig-link').href = b.instagram;
    const bg = $('#hero-bg');
    if (bg && b.capa) { bg.style.backgroundImage = `url("${b.capa}")`; bg.classList.add('has-photo'); }
    setText('#hero-tagline', b.slogan); setText('#about-text', b.sobre); setText('#about-hours', b.horarios);
    setText('#ct-address', b.endereco); setText('#ct-hours', b.horarios); setText('#ct-phone', b.telefone);
    if (b.instagram && $('#ct-instagram')) { $('#ct-instagram').href = b.instagram; $('#ct-instagram').hidden = false; }
    if (b.whatsapp && $('#ct-whatsapp')) { $('#ct-whatsapp').href = `https://wa.me/${String(b.whatsapp).replace(/\D/g, '')}`; $('#ct-whatsapp').hidden = false; }
    if ($('#ct-map') && b.mapa && /^https:\/\/www\.google\.com\/maps\/embed/.test(b.mapa)) $('#ct-map').innerHTML = `<iframe src="${esc(b.mapa)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Mapa"></iframe>`;
    if ($('#demo-banner')) $('#demo-banner').hidden = !s.demo;

    const servicesHtml = s.servicos.map((v) => `<article class="service"><div class="service-name">${esc(v.nome)}</div>
      ${v.descricao ? `<p class="muted small">${esc(v.descricao)}</p>` : ''}<div class="service-meta"><span class="muted small">${v.duracao} min</span><span class="service-price">${brl(v.preco)}</span></div></article>`).join('')
      || '<p class="muted">Serviços em breve.</p>';
    if ($('#services-grid')) $('#services-grid').innerHTML = servicesHtml;
    if ($('#price-list')) $('#price-list').innerHTML = s.servicos.map((v) => `<div class="price-row"><span class="price-name">${esc(v.nome)}<small>${v.duracao} min</small></span><span class="price-dots" aria-hidden="true"></span><span class="price-val">${brl(v.preco)}</span></div>`).join('') || '<p class="muted">Serviços em breve.</p>';

    if ($('#products-grid')) $('#products-grid').innerHTML = (s.produtos || []).map((p) => `<article class="product">
        <div class="product-photo">${p.foto ? `<img src="${esc(p.foto)}" alt="${esc(p.nome)}" loading="lazy">` : '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="16" y="22" width="32" height="30" rx="6" fill="none" stroke="currentColor" stroke-width="2"/><rect x="14" y="14" width="36" height="9" rx="3" fill="none" stroke="currentColor" stroke-width="2"/></svg>'}</div>
        <div class="product-body"><div class="product-name">${esc(p.nome)}</div>${p.descricao ? `<p class="muted small">${esc(p.descricao)}</p>` : ''}<div class="product-price">${brl(p.preco)}</div></div></article>`).join('')
      || '<p class="muted">Consulte os produtos disponíveis direto na barbearia.</p>';
    if ($('#team-grid')) $('#team-grid').innerHTML = s.barbeiros.map((m) => `<div class="member">${m.foto ? `<img class="member-photo" src="${esc(m.foto)}" alt="${esc(m.nome)}">` : `<div class="member-photo" aria-hidden="true">${esc(m.nome[0] || '?')}</div>`}
      <p class="member-name">${esc(m.nome)}</p>${m.bio ? `<p class="member-bio">${esc(m.bio)}</p>` : ''}</div>`).join('') || '<p class="muted">Equipe em breve.</p>';

    if ($('#galeria')) {
      const hasGallery = s.galeria.length > 0;
      $('#galeria').hidden = !hasGallery; if ($('#nav-galeria')) $('#nav-galeria').hidden = !hasGallery;
      $('#gallery').innerHTML = s.galeria.map((g) => `<figure><img src="${esc(g.path)}" alt="${esc(g.caption || 'Trabalho da barbearia')}" loading="lazy"></figure>`).join('');
    }
    if (isBookingPage()) loadWeek(null);
  }

  // ---------- Agenda em grade (dias × horários de 30 min) ----------
  const WDL = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const dayLabel = (d) => { const [y, m, dd] = d.split('-').map(Number); const wd = new Date(Date.UTC(y, m - 1, dd)).getUTCDay(); return { wd: WDL[wd], dm: `${String(dd).padStart(2, '0')}/${String(m).padStart(2, '0')}` }; };
  const daysPerView = () => (window.innerWidth < 560 ? 3 : window.innerWidth < 900 ? 5 : 7);

  async function loadWeek(start) {
    const box = $('#bk-grid');
    box.innerHTML = '<p class="muted small" style="padding:1rem">Carregando horários…</p>';
    try {
      const r = await api(`/api/semana?dias=${daysPerView()}${start ? `&inicio=${start}` : ''}`);
      state.week = r; state.start = r.inicio;
      renderWeek(r);
    } catch (e) { box.innerHTML = `<p class="form-error" style="padding:1rem">${esc(e.message)}</p>`; }
  }
  function renderWeek(r) {
    const box = $('#bk-grid');
    $('#wk-prev').disabled = !r.anterior; $('#wk-next').disabled = !r.proxima;
    if (r.dias.length) { const a = dayLabel(r.dias[0].data), z = dayLabel(r.dias[r.dias.length - 1].data); $('#wk-label').textContent = `${a.dm} a ${z.dm}`; }
    if (!r.horas.length) { box.innerHTML = '<p class="muted" style="padding:1rem">Nenhum horário disponível neste período.</p>'; return; }
    const cols = r.dias.length;
    let html = `<div class="sched" style="--cols:${cols}"><div class="sched-corner"></div>`;
    for (const d of r.dias) { const l = dayLabel(d.data); html += `<div class="sched-day${d.aberto ? '' : ' closed'}"><span>${l.wd}</span><b>${l.dm}</b></div>`; }
    for (const h of r.horas) {
      html += `<div class="sched-time">${h}</div>`;
      for (const d of r.dias) {
        const st = d.horarios[h];
        if (st === 'livre') html += `<button type="button" class="cell free" data-date="${d.data}" data-time="${h}" aria-label="${dayLabel(d.data).wd} ${dayLabel(d.data).dm} às ${h}: livre">Livre</button>`;
        else html += `<div class="cell ${st}" aria-hidden="true">${st === 'ocupado' ? 'Ocupado' : ''}</div>`;
      }
    }
    box.innerHTML = html + '</div>';
  }

  // Clique num horário livre: escolhe o serviço e quem vai fazer
  async function openSlot(date, time) {
    const l = dayLabel(date);
    state.slot = { date, time, servico: null, barbeiro: 'qualquer', opts: null };
    $('#slot-body').innerHTML = `<h2 id="slot-title">${l.wd} ${l.dm} às ${time}</h2><p class="muted small">Carregando…</p>`;
    openModal($('#slot-modal'));
    try {
      const r = await api(`/api/horario?data=${date}&hora=${time}`);
      state.slot.opts = r.servicos;
      if (!r.servicos.length) { $('#slot-body').innerHTML = `<h2>${l.wd} ${l.dm} às ${time}</h2><p>Esse horário acabou de ser ocupado. Escolha outro, por favor.</p><button class="btn btn-gold btn-block" data-close type="button">Voltar à agenda</button>`; loadWeek(state.start); return; }
      renderSlot();
    } catch (e) { $('#slot-body').innerHTML = `<p class="form-error">${esc(e.message)}</p>`; }
  }
  function renderSlot() {
    const s = state.slot, l = dayLabel(s.date);
    const svc = s.opts.find((o) => o.id === s.servico);
    $('#slot-body').innerHTML = `<h2 id="slot-title">${l.wd} ${l.dm} às ${s.time}</h2>
      <h3 class="slot-h">O que você quer fazer?</h3>
      <div class="opt-list">${s.opts.map((o) => `<button type="button" class="opt" data-opt-svc="${o.id}" aria-pressed="${s.servico === o.id}"><span>${esc(o.nome)}<small>${o.duracao} min</small></span><b>${brl(o.preco)}</b></button>`).join('')}</div>
      ${svc ? `<h3 class="slot-h">Com quem?</h3><div class="chips">${svc.barbeiros.length > 1 ? `<button type="button" class="chip" data-opt-bar="qualquer" aria-pressed="${s.barbeiro === 'qualquer'}">Qualquer disponível</button>` : ''}
        ${svc.barbeiros.map((b) => `<button type="button" class="chip" data-opt-bar="${b.id}" aria-pressed="${s.barbeiro === b.id || svc.barbeiros.length === 1}">${esc(b.nome)}</button>`).join('')}</div>` : ''}
      <button class="btn btn-gold btn-block" type="button" id="slot-confirm" style="margin-top:1.2rem" ${svc ? '' : 'disabled'}>${svc ? `Confirmar ${esc(svc.nome)} às ${s.time}` : 'Escolha o serviço'}</button>`;
  }
  async function confirmSlot() {
    const s = state.slot;
    if (!state.me) { closeModal($('#slot-modal')); openAuth({ mode: 'agendar', then: () => { openModal($('#slot-modal')); renderSlot(); } }); return; }
    const svc = s.opts.find((o) => o.id === s.servico);
    const barbeiro = svc.barbeiros.length === 1 ? svc.barbeiros[0].id : s.barbeiro;
    const btn = $('#slot-confirm'); busy(btn, true);
    try {
      const r = await api('/api/agendamentos', { servico: s.servico, barbeiro, data: s.date, hora: s.time });
      closeModal($('#slot-modal'));
      const done = $('#bk-done');
      done.innerHTML = `<h3>${r.status === 'confirmado' ? 'Horário confirmado!' : 'Pedido recebido!'}</h3>
        <p><b>${esc(r.servico)}</b> com <b>${esc(r.barbeiro)}</b> em <b>${r.data}</b> às <b>${r.hora}</b>.</p>
        <p class="muted small">${r.status === 'confirmado' ? 'Você receberá a confirmação nos contatos cadastrados.' : 'A barbearia vai confirmar e te avisar.'}
        Para cancelar, use <button class="link-btn" type="button" data-open-me>Meu cadastro</button>.</p>`;
      done.hidden = false; done.scrollIntoView({ behavior: 'smooth', block: 'center' });
      loadWeek(state.start); refreshMe();
    } catch (e) {
      toast(e.message, true);
      if (e.status === 409) { closeModal($('#slot-modal')); loadWeek(state.start); }
      if (e.status === 401) { state.me = null; closeModal($('#slot-modal')); openAuth({ mode: 'agendar', then: () => { openModal($('#slot-modal')); renderSlot(); } }); }
    } finally { busy(btn, false); }
  }

  document.addEventListener('click', (ev) => {
    const t = ev.target.closest('button, a');
    if (!t) return;
    if (t.classList.contains('free') && t.dataset.date) openSlot(t.dataset.date, t.dataset.time);
    else if (t.dataset.optSvc) { state.slot.servico = Number(t.dataset.optSvc); state.slot.barbeiro = 'qualquer'; renderSlot(); }
    else if (t.dataset.optBar) { state.slot.barbeiro = t.dataset.optBar === 'qualquer' ? 'qualquer' : Number(t.dataset.optBar); renderSlot(); }
    else if (t.id === 'slot-confirm') confirmSlot();
    else if (t.id === 'wk-prev' && state.week?.anterior) loadWeek(state.week.anterior);
    else if (t.id === 'wk-next' && state.week?.proxima) loadWeek(state.week.proxima);
    else if (t.hasAttribute('data-agendar')) {
      // Cliente não identificado: abre a janela antes de ir para a agenda
      closeMenu();
      if (isBookingPage()) { ev.preventDefault(); $('#agenda-top').scrollIntoView({ behavior: 'smooth' }); return; }
      if (!state.me) { ev.preventDefault(); openAuth({ mode: 'agendar', then: () => { location.href = BOOK_URL; } }); }
    } else if (t.hasAttribute('data-open-me')) openMe();
    else if (t.hasAttribute('data-close')) closeModal(t.closest('.modal'));
  });
  let lastW = window.innerWidth;
  window.addEventListener('resize', () => { if (isBookingPage() && Math.abs(window.innerWidth - lastW) > 120) { lastW = window.innerWidth; loadWeek(state.start); } });

  // ---------- Janela de identificação (nome + nascimento → contatos mascarados → código) ----------
  const auth = { ctx: null };
  function openModal(m) { m.hidden = false; document.body.style.overflow = 'hidden'; setTimeout(() => { const f = m.querySelector('input, button:not(.modal-close)'); f && f.focus(); }, 30); }
  function closeModal(m) { m.hidden = true; document.body.style.overflow = ''; }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $$('.modal').forEach((m) => { if (!m.hidden) closeModal(m); }); });
  $$('.modal').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m) closeModal(m); }));

  function openAuth({ mode = 'entrar', then = null } = {}) {
    auth.ctx = { mode, then, nome: '', nascimento: '' };
    const titles = { agendar: ['Antes de agendar', 'Informe seu nome completo e data de nascimento.'], cadastro: ['Quero me cadastrar', 'Primeiro, vamos ver se você já tem cadastro.'],
      atualizar: ['Atualizar meu cadastro', 'Informe seu nome completo e data de nascimento para localizar seu cadastro.'], entrar: ['Entrar', 'Informe seu nome completo e data de nascimento.'] };
    const [t, sub] = titles[mode] || titles.entrar;
    $('#auth-body').innerHTML = `<h2 id="auth-title">${t}</h2><p class="muted">${sub}</p>
      <form id="f-ident" novalidate><div class="form-error" hidden></div>
        <div class="field"><label for="i-nome">Nome completo</label><input id="i-nome" name="nome" autocomplete="name" required maxlength="120"></div>
        <div class="field"><label for="i-nasc">Data de nascimento</label><input id="i-nasc" name="nascimento" type="date" required max="${new Date().toISOString().slice(0, 10)}" min="1900-01-01"></div>
        <button class="btn btn-gold btn-block" type="submit">Continuar</button></form>`;
    openModal($('#auth-modal'));
    $('#f-ident').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target, err = f.querySelector('.form-error'), btn = f.querySelector('button[type=submit]');
      err.hidden = true;
      auth.ctx.nome = f.nome.value.trim(); auth.ctx.nascimento = f.nascimento.value;
      if (auth.ctx.nome.split(/\s+/).length < 2) { err.textContent = 'Informe nome e sobrenome.'; err.hidden = false; return; }
      if (!auth.ctx.nascimento) { err.textContent = 'Informe a data de nascimento.'; err.hidden = false; return; }
      busy(btn, true);
      try {
        const r = await api('/api/cliente/identificar', { nome: auth.ctx.nome, nascimento: auth.ctx.nascimento });
        if (r.status === 'encontrado') showFound(r);
        else if (r.status === 'nao-encontrado') showRegister();
        else showHomonym();
      } catch (ex) { err.textContent = ex.message; err.hidden = false; } finally { busy(btn, false); }
    });
  }

  function showFound(r) {
    auth.ctx.desafio = r.desafio;
    const avail = r.contatos.filter((c) => c.disponivel);
    if (!r.contatos.length) { showChanged(r, true); return; }
    $('#auth-body').innerHTML = `<h2 id="auth-title">Encontramos seu cadastro</h2>
      <p>Seus contatos continuam os mesmos?</p>
      ${r.contatos.map((c) => `<div class="contact-option"><div><span class="muted small">${c.canal === 'whatsapp' ? 'WhatsApp' : 'E-mail'}</span><br><b>${esc(c.mascara)}</b></div>
        ${c.disponivel ? `<button class="btn btn-gold btn-sm" type="button" data-send="${c.canal}">Sim, enviar código</button>` : '<span class="muted small">indisponível agora</span>'}</div>`).join('')}
      ${avail.length ? '' : '<p class="form-error">No momento não conseguimos enviar o código. Tente mais tarde ou fale com a barbearia.</p>'}
      <div class="actions stack"><button class="btn btn-outline" type="button" id="b-changed">Não, meus contatos mudaram</button></div>`;
    $$('#auth-body [data-send]').forEach((b) => b.addEventListener('click', () => sendCode(b.dataset.send, b)));
    $('#b-changed').addEventListener('click', () => showChanged(r, false));
  }

  async function sendCode(canal, btn) {
    busy(btn, true);
    try {
      const r = await api('/api/cliente/codigo', { desafio: auth.ctx.desafio, canal });
      showCode(canal, r.demo_codigo);
    } catch (e) { toast(e.message, true); } finally { busy(btn, false); }
  }

  function showCode(canal, demo, mascara) {
    $('#auth-body').innerHTML = `<h2 id="auth-title">Digite o código</h2>
      <p>Enviamos um código de 6 dígitos para seu ${canal === 'whatsapp' ? 'WhatsApp' : 'e-mail'}${mascara ? ` <b>${esc(mascara)}</b>` : ''}. Ele vale por 10 minutos.</p>
      ${demo ? `<p class="demo-code">Demonstração — código: <b>${demo}</b></p>` : ''}
      <form id="f-code" novalidate><div class="form-error" hidden></div>
        <div class="field"><label for="i-code" class="sr">Código</label><input id="i-code" class="code-input" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="\\d{6}" required></div>
        <button class="btn btn-gold btn-block" type="submit">Confirmar</button></form>
      <p class="muted small" style="margin-top:1rem">Não chegou? <button class="link-btn" type="button" id="b-resend">Enviar de novo</button> (aguarde 1 minuto)</p>`;
    $('#i-code').focus();
    $('#b-resend').addEventListener('click', (e) => sendCode(canal, e.target));
    $('#f-code').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = e.target.querySelector('.form-error'), btn = e.target.querySelector('button[type=submit]');
      err.hidden = true; busy(btn, true);
      try {
        await api('/api/cliente/verificar', { desafio: auth.ctx.desafio, codigo: $('#i-code').value });
        await refreshMe();
        closeModal($('#auth-modal'));
        toast(`Pronto, ${state.me.cliente.nome.split(' ')[0]}!`);
        const then = auth.ctx.then; auth.ctx = null;
        if (then) then();
      } catch (ex) { err.textContent = ex.message; err.hidden = false; } finally { busy(btn, false); }
    });
  }

  function showChanged(r, none) {
    const usable = r.contatos.filter((c) => c.disponivel);
    $('#auth-body').innerHTML = `<h2 id="auth-title">Contatos desatualizados</h2>
      ${!none && usable.length ? `<p>Se você ainda tem acesso a algum dos contatos abaixo, receba o código por ele. Depois de entrar, você atualiza o outro em <b>Meu cadastro</b>.</p>
        ${usable.map((c) => `<div class="contact-option"><b>${esc(c.mascara)}</b><button class="btn btn-outline btn-sm" type="button" data-send="${c.canal}">Usar este</button></div>`).join('')}
        <p class="muted small" style="margin-top:1rem">Não tem acesso a nenhum deles? Preencha abaixo e a equipe da barbearia confere.</p>`
        : '<p>Informe seus contatos novos. Por segurança, a equipe da barbearia vai conferir antes de atualizar.</p>'}
      <form id="f-lost" novalidate><div class="form-error" hidden></div>
        <div class="field"><label for="l-tel">Telefone novo (WhatsApp)</label><input id="l-tel" name="telefone" type="tel" autocomplete="tel" placeholder="(21) 99999-8888"></div>
        <div class="field"><label for="l-mail">E-mail novo</label><input id="l-mail" name="email" type="email" autocomplete="email"></div>
        <div class="field"><label for="l-msg">Algo que ajude a confirmar que é você (opcional)</label><input id="l-msg" name="mensagem" maxlength="300" placeholder="Ex.: corto com o Fulano, último corte em outubro"></div>
        <button class="btn btn-gold btn-block" type="submit">Enviar para conferência</button></form>`;
    $$('#auth-body [data-send]').forEach((b) => b.addEventListener('click', () => sendCode(b.dataset.send, b)));
    $('#f-lost').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target, err = f.querySelector('.form-error'), btn = f.querySelector('button[type=submit]');
      err.hidden = true; busy(btn, true);
      try {
        await api('/api/cliente/perdi-acesso', { desafio: auth.ctx.desafio, telefone: f.telefone.value, email: f.email.value, mensagem: f.mensagem.value });
        $('#auth-body').innerHTML = '<h2>Pedido enviado</h2><p>A equipe da barbearia vai conferir e atualizar seus contatos. Enquanto isso, você pode agendar pelo telefone da barbearia.</p><button class="btn btn-gold btn-block" data-close type="button">Fechar</button>';
      } catch (ex) { err.textContent = ex.message; err.hidden = false; } finally { busy(btn, false); }
    });
  }

  function showRegister() {
    const ch = state.site.canais;
    $('#auth-body').innerHTML = `<h2 id="auth-title">Vamos fazer seu cadastro</h2>
      <p class="muted">Não encontramos um cadastro com esse nome e data de nascimento. Se você já é cliente, informe o telefone que usa na barbearia: completamos o cadastro que já existe.</p>
      <form id="f-reg" novalidate><div class="form-error" hidden></div>
        <div class="field"><label for="r-nome">Nome completo</label><input id="r-nome" name="nome" value="${esc(auth.ctx.nome)}" required></div>
        <div class="field"><label for="r-nasc">Data de nascimento</label><input id="r-nasc" name="nascimento" type="date" value="${esc(auth.ctx.nascimento)}" required></div>
        <div class="field"><label for="r-tel">Telefone (WhatsApp)</label><input id="r-tel" name="telefone" type="tel" autocomplete="tel" placeholder="(21) 99999-8888"><span class="hint">Com DDD. Fora do Brasil, comece com + e o código do país.</span></div>
        <div class="field"><label for="r-mail">E-mail</label><input id="r-mail" name="email" type="email" autocomplete="email"></div>
        <p class="small" style="margin:.4rem 0 .5rem"><b>Mensagens da barbearia</b> (aniversário, promoções, lembrete de retorno). Opcional — marque só se quiser:</p>
        <label class="check"><input type="checkbox" name="aut_whatsapp"><span>Aceito receber mensagens da barbearia pelo <b>WhatsApp</b>.</span></label>
        <label class="check"><input type="checkbox" name="aut_email"><span>Aceito receber mensagens da barbearia por <b>e-mail</b>.</span></label>
        <p class="muted small">Avisos dos horários que você agendar são enviados independentemente dessas opções. Você pode mudar tudo depois em "Atualizar meu cadastro".</p>
        <div class="field"><label for="r-canal">Receber o código de confirmação por</label><select id="r-canal" name="canal">
          ${ch.whatsapp ? '<option value="whatsapp">WhatsApp</option>' : ''}${ch.email ? '<option value="email">E-mail</option>' : ''}</select></div>
        <button class="btn btn-gold btn-block" type="submit" ${!ch.whatsapp && !ch.email ? 'disabled' : ''}>Cadastrar</button>
        ${!ch.whatsapp && !ch.email ? '<p class="form-error">Cadastro pelo site indisponível no momento.</p>' : ''}</form>`;
    $('#f-reg').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target, err = f.querySelector('.form-error'), btn = f.querySelector('button[type=submit]');
      err.hidden = true; busy(btn, true);
      try {
        const r = await api('/api/cliente/cadastro', { nome: f.nome.value, nascimento: f.nascimento.value, telefone: f.telefone.value, email: f.email.value,
          aut_whatsapp: f.aut_whatsapp.checked, aut_email: f.aut_email.checked, canal_verificacao: f.canal.value });
        if (r.status === 'ja-cadastrado') { toast('Você já tem cadastro. Vamos confirmar sua identidade.'); const then = auth.ctx.then; openAuth({ mode: 'entrar', then }); return; }
        auth.ctx.desafio = r.desafio;
        showCode(r.canal, r.demo_codigo, r.mascara);
      } catch (ex) { err.textContent = ex.message; err.hidden = false; } finally { busy(btn, false); }
    });
  }

  function showHomonym() {
    $('#auth-body').innerHTML = `<h2 id="auth-title">Precisamos conferir</h2>
      <p>Encontramos mais de um cadastro com esse nome e data de nascimento. Deixe um contato e a equipe da barbearia resolve para você.</p>
      <form id="f-homo" novalidate><div class="form-error" hidden></div>
        <div class="field"><label for="h-tel">Telefone</label><input id="h-tel" name="telefone" type="tel"></div>
        <div class="field"><label for="h-mail">E-mail</label><input id="h-mail" name="email" type="email"></div>
        <button class="btn btn-gold btn-block" type="submit">Enviar</button></form>`;
    $('#f-homo').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target, btn = f.querySelector('button[type=submit]'); busy(btn, true);
      try { await api('/api/cliente/homonimo', { nome: auth.ctx.nome, nascimento: auth.ctx.nascimento, telefone: f.telefone.value, email: f.email.value });
        $('#auth-body').innerHTML = '<h2>Recebido</h2><p>A equipe vai entrar em contato.</p><button class="btn btn-gold btn-block" data-close type="button">Fechar</button>';
      } catch (ex) { const err = f.querySelector('.form-error'); err.textContent = ex.message; err.hidden = false; } finally { busy(btn, false); }
    });
  }

  // ---------- Meu cadastro ----------
  async function refreshMe() {
    try { const r = await api('/api/cliente/eu'); state.me = r.logado ? r : null; } catch { state.me = null; }
    $('#btn-conta').textContent = state.me ? `Olá, ${state.me.cliente.nome.split(' ')[0]}` : 'Entrar';
    return state.me;
  }
  function openMe() {
    if (!state.me) { openAuth({ mode: 'atualizar', then: openMe }); return; }
    const { cliente: c, agendamentos } = state.me;
    const now = new Date().toISOString();
    const upcoming = agendamentos.filter((a) => a.start_at > now && ['confirmado', 'pendente'].includes(a.status));
    const fmt = (iso) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    $('#me-body').innerHTML = `<h2 id="me-title">Meu cadastro</h2>
      <div class="me-row"><div><span class="muted small">Nome</span><br><b>${esc(c.nome)}</b></div><div><span class="muted small">Nascimento</span><br><b>${c.nascimento ? c.nascimento.split('-').reverse().join('/') : '—'}</b></div></div>
      <div class="me-section"><h3>Próximos horários</h3>
        ${upcoming.length ? upcoming.map((a) => `<div class="appt"><div><b>${esc(a.servico)}</b> com ${esc(a.barbeiro)}<br><span class="muted small">${fmt(a.start_at)}${a.status === 'pendente' ? ' · aguardando confirmação' : ''}</span></div>
          <button class="btn btn-outline btn-sm" type="button" data-cancel="${a.id}">Cancelar</button></div>`).join('') : `<p class="muted small">Nenhum horário marcado. <a href="${BOOK_URL}" data-close-go>Agendar agora</a></p>`}</div>
      <div class="me-section"><h3>Contatos</h3>
        <div class="me-row"><div><span class="muted small">WhatsApp</span><br><b>${esc(c.telefone ? fmtPhone(c.telefone) : '—')}</b> ${c.telefone ? `<span class="tag ${c.telefone_verificado ? 'ok' : 'warn'}">${c.telefone_verificado ? 'confirmado' : 'não confirmado'}</span>` : ''}</div>
          <button class="btn btn-outline btn-sm" type="button" data-change="whatsapp">${c.telefone ? 'Alterar' : 'Adicionar'}</button></div>
        <div class="me-row"><div><span class="muted small">E-mail</span><br><b>${esc(c.email || '—')}</b> ${c.email ? `<span class="tag ${c.email_verificado ? 'ok' : 'warn'}">${c.email_verificado ? 'confirmado' : 'não confirmado'}</span>` : ''}</div>
          <button class="btn btn-outline btn-sm" type="button" data-change="email">${c.email ? (c.email_verificado ? 'Alterar' : 'Confirmar / alterar') : 'Adicionar'}</button></div>
        <div id="change-box"></div></div>
      <div class="me-section"><h3>Mensagens da barbearia</h3>
        <p class="muted small">Aniversário, promoções e lembrete de retorno. Avisos dos seus agendamentos continuam chegando.</p>
        <label class="check"><input type="checkbox" id="p-wa" ${c.autorizacoes.whatsapp ? 'checked' : ''}><span>Aceito receber pelo <b>WhatsApp</b></span></label>
        <label class="check"><input type="checkbox" id="p-em" ${c.autorizacoes.email ? 'checked' : ''}><span>Aceito receber por <b>e-mail</b></span></label>
        <div class="field"><label for="p-pref">Canal preferido</label><select id="p-pref">
          <option value="ambos" ${c.preferencia === 'ambos' ? 'selected' : ''}>WhatsApp e e-mail</option><option value="whatsapp" ${c.preferencia === 'whatsapp' ? 'selected' : ''}>Só WhatsApp</option><option value="email" ${c.preferencia === 'email' ? 'selected' : ''}>Só e-mail</option></select></div>
        <button class="btn btn-gold" type="button" id="p-save">Salvar preferências</button></div>
      <div class="me-section"><button class="link-btn" type="button" id="b-logout">Sair deste aparelho</button></div>`;
    openModal($('#me-modal'));
    $$('#me-body [data-cancel]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Cancelar este horário?')) return;
      busy(b, true);
      try { await api(`/api/agendamentos/${b.dataset.cancel}/cancelar`, {}); await refreshMe(); openMe(); toast('Horário cancelado.'); if (isBookingPage()) loadWeek(state.start); }
      catch (e) { toast(e.message, true); busy(b, false); }
    }));
    $$('#me-body [data-change]').forEach((b) => b.addEventListener('click', () => changeContact(b.dataset.change)));
    const go = $('#me-body [data-close-go]'); if (go) go.addEventListener('click', () => closeModal($('#me-modal')));
    $('#p-save').addEventListener('click', async (e) => {
      busy(e.target, true);
      try { await api('/api/cliente/preferencias', { aut_whatsapp: $('#p-wa').checked, aut_email: $('#p-em').checked, preferencia: $('#p-pref').value }); await refreshMe(); toast('Preferências salvas.'); }
      catch (ex) { toast(ex.message, true); } finally { busy(e.target, false); }
    });
    $('#b-logout').addEventListener('click', async () => { await api('/api/cliente/sair', {}); state.me = null; await refreshMe(); closeModal($('#me-modal')); toast('Você saiu.'); });
  }
  function changeContact(canal) {
    const box = $('#change-box');
    box.innerHTML = `<form id="f-chg" novalidate style="margin-top:.8rem"><div class="form-error" hidden></div>
      <div class="field"><label for="c-val">${canal === 'whatsapp' ? 'Novo telefone (WhatsApp)' : 'Novo e-mail'}</label>
      <input id="c-val" type="${canal === 'whatsapp' ? 'tel' : 'email'}" value="${canal === 'email' && state.me.cliente.email && !state.me.cliente.email_verificado ? esc(state.me.cliente.email) : ''}" required></div>
      <p class="muted small">Enviaremos um código para o novo contato. Ele só passa a valer depois de confirmado.</p>
      <button class="btn btn-gold btn-sm" type="submit">Enviar código</button></form>`;
    $('#c-val').focus();
    $('#f-chg').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = e.target.querySelector('.form-error'), btn = e.target.querySelector('button'); err.hidden = true; busy(btn, true);
      try {
        const r = await api('/api/cliente/contato', { canal, valor: $('#c-val').value });
        if (r.status === 'sem-mudanca') { box.innerHTML = '<p class="muted small">Esse contato já está confirmado.</p>'; return; }
        box.innerHTML = `<form id="f-chg2" novalidate style="margin-top:.8rem"><div class="form-error" hidden></div>
          ${r.demo_codigo ? `<p class="demo-code">Demonstração — código: <b>${r.demo_codigo}</b></p>` : ''}
          <div class="field"><label for="c-code">Código recebido no novo contato</label><input id="c-code" class="code-input" inputmode="numeric" maxlength="6" autocomplete="one-time-code"></div>
          <button class="btn btn-gold btn-sm" type="submit">Confirmar</button></form>`;
        $('#c-code').focus();
        $('#f-chg2').addEventListener('submit', async (e2) => {
          e2.preventDefault();
          const err2 = e2.target.querySelector('.form-error'), b2 = e2.target.querySelector('button'); err2.hidden = true; busy(b2, true);
          try { await api('/api/cliente/contato/confirmar', { desafio: r.desafio, codigo: $('#c-code').value }); await refreshMe(); openMe(); toast('Contato atualizado.'); }
          catch (ex) { err2.textContent = ex.message; err2.hidden = false; } finally { busy(b2, false); }
        });
      } catch (ex) { err.textContent = ex.message; err.hidden = false; } finally { busy(btn, false); }
    });
  }

  // ---------- Botões do topo e rodapé ----------
  $('#btn-conta').addEventListener('click', () => { closeMenu(); state.me ? openMe() : openAuth({ mode: 'entrar', then: openMe }); });
  for (const id of ['#btn-cadastrar', '#ft-cadastrar']) $(id)?.addEventListener('click', () => { state.me ? openMe() : openAuth({ mode: 'cadastro', then: openMe }); });
  for (const id of ['#btn-atualizar', '#ft-atualizar']) $(id)?.addEventListener('click', () => openMe());
  const menuBtn = $('#menu-toggle');
  function closeMenu() { $('#nav').classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); }
  menuBtn.addEventListener('click', () => { const o = $('#nav').classList.toggle('open'); menuBtn.setAttribute('aria-expanded', String(o)); });
  $$('#nav a').forEach((a) => a.addEventListener('click', closeMenu));

  // Aba ativa no menu lateral conforme a seção visível
  const navLinks = $$('#nav a.nav-link[href^="#"]');
  if (navLinks.length && 'IntersectionObserver' in window) {
    const byId = new Map(navLinks.map((a) => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting && byId.has(e.target.id)) { navLinks.forEach((a) => a.classList.remove('active')); byId.get(e.target.id).classList.add('active'); }
    }, { rootMargin: '-45% 0px -50% 0px' });
    byId.forEach((a, id) => { const sec = document.getElementById(id); if (sec) io.observe(sec); });
  }

  (async () => {
    try { state.site = await api('/api/site'); renderSite(state.site); }
    catch { toast('Não foi possível carregar a página. Atualize em instantes.', true); }
    await refreshMe();
  })();
})();
