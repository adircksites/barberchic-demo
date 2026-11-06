'use strict';
// =====================================================================
// MODO DEMONSTRAÇÃO (GitHub Pages): simula o servidor dentro do navegador.
// Dados 100% fictícios, guardados só neste navegador (localStorage).
// Nada é enviado por WhatsApp ou e-mail. A versão real usa src/server.js.
// =====================================================================
(() => {
  const ROOT = (document.currentScript && document.currentScript.src.replace(/js\/demo-api\.js.*$/, '')) || './';
  const KEY = 'barberchic-demo-v1';
  const TZ = 'America/Sao_Paulo';
  const nowIso = () => new Date().toISOString();
  const localDate = (d = new Date()) => new Date(d).toLocaleDateString('en-CA', { timeZone: TZ });
  const localTime = (d) => new Date(d).toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
  const at = (date, time) => new Date(`${date}T${time}:00-03:00`);
  const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
  const wdOf = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const digits = (s) => String(s || '').replace(/\D/g, '');
  const phoneE164 = (p) => { let d = digits(p); if (!d) return null; if (d.length === 10 || d.length === 11) d = '55' + d; return d.length >= 12 && d.length <= 15 ? '+' + d : null; };
  const maskPhone = (p) => { const d = digits(p); return `+55 (${d.slice(2, 4)}) ${d[4]}••••-••${d.slice(-2)}`; };
  const maskEmail = (e) => { const [u, dm] = e.split('@'); return `${u.slice(0, 2)}•••@${dm}`; };
  const code6 = () => String(Math.floor(Math.random() * 1e6)).padStart(6, '0');
  const WD = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const fmtBR = (iso) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: TZ });

  class E extends Error { constructor(s, m) { super(m); this.status = s; } }

  // ---------------- Dados fictícios ----------------
  function seed() {
    const today = localDate();
    const first = ['João', 'Pedro', 'Lucas', 'Gabriel', 'Mateus', 'Rafael', 'Bruno', 'Felipe', 'Gustavo', 'Thiago', 'André', 'Carlos', 'Diego', 'Eduardo', 'Fábio', 'Hugo', 'Igor', 'Leonardo', 'Marcelo', 'Nicolas', 'Otávio', 'Paulo', 'Renato', 'Samuel', 'Vinícius', 'Wagner', 'Caio', 'Daniel', 'Enzo', 'Heitor'];
    const last = ['Silva', 'Souza', 'Oliveira', 'Santos', 'Pereira', 'Costa', 'Rodrigues', 'Almeida', 'Nascimento', 'Lima', 'Araújo', 'Ferreira', 'Carvalho', 'Gomes', 'Martins', 'Rocha', 'Ribeiro', 'Barbosa'];
    const clients = [];
    let id = 1;
    const add = (c) => clients.push({ id: id++, notes: '', address: '', cpf: null, phone2: null, barber_id: null, contact_pref: 'ambos', source: 'importacao', created_at: nowIso(), updated_at: nowIso(), consents: {}, history: [], ...c });
    add({ full_name: 'João da Silva', birth_date: '1990-05-10', phone: '+5521999990001', phone_verified_at: nowIso(), email: 'joao.demo@exemplo.com', email_verified_at: nowIso(), last_service_at: at(addDays(today, -20), '10:00').toISOString(), barber_id: 1, consents: { whatsapp_marketing: 'concedida', whatsapp_servico: 'concedida' } });
    add({ full_name: 'Marcos Aniversariante', birth_date: `1988-${today.slice(5)}`, phone: '+5521999990002', phone_verified_at: nowIso(), email: null, last_service_at: at(addDays(today, -75), '15:00').toISOString(), consents: { whatsapp_marketing: 'concedida' } });
    for (let i = 0; i < 46; i++) {
      const n = `${first[(i * 7) % first.length]} ${last[(i * 5) % last.length]}${i % 3 === 0 ? ' ' + last[(i * 11 + 3) % last.length] : ''}`;
      const hasBirth = i % 4 !== 0;
      add({ full_name: n, birth_date: hasBirth ? `${1965 + (i * 3) % 40}-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + (i * 3) % 28).padStart(2, '0')}` : null,
        phone: i % 9 === 0 ? null : `+55219${String(80000000 + i * 1234567 % 19999999).slice(0, 8)}`, phone_verified_at: nowIso(),
        email: i % 3 === 0 ? `${norm(n).split(' ')[0]}${i}@exemplo.com` : null, email_verified_at: nowIso(),
        last_service_at: i % 5 === 0 ? null : at(addDays(today, -((i * 13) % 120) - 1), '11:00').toISOString(), barber_id: i % 2 ? 1 : 2 });
    }
    const svc = [[1, 'Corte', 30, 5000], [2, 'Barba', 20, 3500], [3, 'Corte + barba', 50, 8000], [4, 'Pigmentação', 30, 4000], [5, 'Sobrancelha', 10, 1500]]
      .map(([i, n, d, p]) => ({ id: i, name: n, description: '', duration_min: d, price_cents: p, active: 1, sort: i }));
    const hours = (wds, ranges) => wds.flatMap((w) => ranges.map(([a, b]) => ({ dia: w, inicio: a, fim: b })));
    const barbers = [
      { id: 1, name: 'Rafael Costa', nickname: 'Rafa', birth_date: '1990-02-14', phone: '+5521988880001', email: 'rafa@exemplo.com', address: 'Endereço fictício', bio: 'Profissional de exemplo — cortes clássicos e degradê.', photo: null, active: 1, servicos: [1, 2, 3, 4, 5], escala: hours([2, 3, 4, 5, 6], [['09:00', '12:00'], ['13:00', '19:00']]) },
      { id: 2, name: 'Bruno Lima', nickname: 'Bruno', birth_date: '1995-09-03', phone: '+5521988880002', email: 'bruno@exemplo.com', address: 'Endereço fictício', bio: 'Profissional de exemplo — barba e acabamento.', photo: null, active: 1, servicos: [1, 2, 3], escala: hours([3, 4, 5, 6], [['10:00', '19:00']]) },
    ];
    const appts = [];
    let aid = 1;
    const mk = (cid, bid, sid, date, time, status) => { const s = svc.find((x) => x.id === sid); const st = at(date, time); appts.push({ id: aid++, client_id: cid, barber_id: bid, service_id: sid, start_at: st.toISOString(), end_at: new Date(st.getTime() + s.duration_min * 60000).toISOString(), status, source: 'admin', created_at: nowIso(), updated_at: nowIso() }); };
    for (let k = 0; k < 6; k++) { const d = addDays(today, k); const w = wdOf(d); if (w >= 2 && w <= 6) { mk(3 + k, 1, 1, d, '10:00', 'confirmado'); mk(10 + k, 1, 3, d, '15:00', 'confirmado'); if (w >= 3) mk(20 + k, 2, 2, d, '11:00', k === 0 ? 'pendente' : 'confirmado'); } }
    const C = (id_, type, name, purpose, status, tw, subj, te, cfg) => ({ id: id_, type, name, purpose, status, channels: ['whatsapp', 'email'], wa_template: '', wa_lang: 'pt_BR', text_whatsapp: tw, email_subject: subj, text_email: te,
      config: { days: [1, 2, 3, 4, 5, 6], window_start: '09:00', window_end: '19:00', interval_seconds: 20, daily_limit: 200, ...cfg }, starts_at: null, ends_at: null });
    const campaigns = [
      C(1, 'confirmacao', 'Confirmação de agendamento', 'servico', 'ativa', 'Olá, {primeiro_nome}! Seu horário na {barbearia} está confirmado: {servico} com {barbeiro}, {dia_semana} {data} às {hora}. Para cancelar ou remarcar: {link_gerenciar}', 'Horário confirmado — {barbearia}', 'Olá, {primeiro_nome}!\n\nSeu horário está confirmado: {servico} com {barbeiro}, {data} às {hora}.\n\n{barbearia}', {}),
      C(2, 'lembrete', 'Lembrete de agendamento', 'servico', 'ativa', 'Oi, {primeiro_nome}! Lembrete: {servico} com {barbeiro} {dia_semana} {data} às {hora} na {barbearia}.', 'Lembrete do seu horário — {barbearia}', 'Oi, {primeiro_nome}!\n\nLembrete: {servico} com {barbeiro}, {data} às {hora}.', { hours_before: 24 }),
      C(3, 'agradecimento', 'Agradecimento pós-atendimento', 'servico', 'ativa', 'Obrigado pela visita, {primeiro_nome}! Foi um prazer te atender na {barbearia}.', 'Obrigado pela visita — {barbearia}', 'Obrigado pela visita, {primeiro_nome}!', { hours_after: 2 }),
      C(4, 'aniversario', 'Aniversariantes do dia', 'marketing', 'ativa', 'Feliz aniversário, {primeiro_nome}! 🎉 Toda a equipe da {barbearia} deseja um ótimo dia para você. (Para não receber mais mensagens assim, responda SAIR.)', 'Feliz aniversário, {primeiro_nome}!', 'Feliz aniversário, {primeiro_nome}!\n\n{barbearia}\n\nNão quer mais receber estes e-mails? {link_descadastro}', { send_time: '09:00' }),
      C(5, 'inativos', 'Sentimos sua falta (mais de 2 meses)', 'marketing', 'pausada', 'Oi, {primeiro_nome}! Faz um tempinho que você não passa na {barbearia}. Quando quiser, é só agendar: {link_agendamento}', 'Sentimos sua falta, {primeiro_nome}', 'Oi, {primeiro_nome}!\n\nFaz um tempinho que você não passa na {barbearia}.', { send_time: '10:00', inactive_days: 60, repeat_every_days: 60, max_repeats: 1 }),
      C(6, 'promocional', 'Promoção de Dia dos Pais (exemplo)', 'marketing', 'rascunho', 'Oi, {primeiro_nome}! Neste mês, traga seu pai e ganhe... (texto de exemplo)', 'Dia dos Pais na {barbearia}', 'Texto de exemplo.\n\n{link_descadastro}', {}),
    ];
    const dispatches = [
      { id: 1, campaign_id: 4, client_id: 2, event_key: `aniversario:${today.slice(0, 4)}`, channel: 'whatsapp', status: 'entregue', scheduled_at: at(today, '09:00').toISOString(), destination: '+5521999990002', error: null },
      { id: 2, campaign_id: 1, client_id: 3, event_key: 'agendamento:1', channel: 'whatsapp', status: 'lida', scheduled_at: nowIso(), destination: '', error: null },
      { id: 3, campaign_id: 1, client_id: 4, event_key: 'agendamento:2', channel: 'email', status: 'aceita', scheduled_at: nowIso(), destination: '', error: null },
      { id: 4, campaign_id: 2, client_id: 5, event_key: 'agendamento:3', channel: 'whatsapp', status: 'incerta', scheduled_at: nowIso(), destination: '', error: 'tempo esgotado aguardando o serviço' },
    ];
    const t = (min) => new Date(Date.now() - min * 60000).toISOString();
    const robot = [
      [1, 'info', 'verificacao', 'sem falhas', 'fila: 0 agendada(s), 0 em processamento'], [3, 'info', 'envio', 'aceita', '#3 email'], [5, 'aviso', 'envio-incerto', 'incerta — sem reenvio automático', '#4 whatsapp: tempo esgotado'],
      [8, 'info', 'verificacao', 'sem falhas', 'fila: 1 agendada(s)'], [60, 'info', 'envio', 'aceita', '#1 whatsapp'], [61, 'info', 'planejamento', '1 envio(s) agendado(s)', 'Aniversariantes do dia'], [120, 'info', 'executor-iniciado', 'ok', 'executor'],
    ].map(([m, level, action, result, detail], i) => ({ id: 100 - i, ts: t(m), level, action, result, detail, campaign_id: null }));
    return {
      shop: { name: 'Barberchic Fonseca', tagline: 'Corte, barba e estilo.', about: 'Uma barbearia para quem leva o visual a sério sem perder o bom papo. Atendimento com hora marcada, ambiente confortável e profissionais que conhecem o seu estilo.', address: 'Endereço a confirmar', maps_url: '', phone_display: '', whatsapp_number: '', instagram: 'https://www.instagram.com/barberchic.fonseca/', hours_text: 'Terça a sábado, das 9h às 19h', logo: ROOT + 'img/logo.svg', hero_image: '' },
      booking: { auto_confirm: true, min_advance_min: 60, max_days_ahead: 30, slot_step_min: 15, cancel_deadline_min: 120, max_future_per_client: 2, client_session_days: 90 },
      alerts: { admin_email: '', stuck_minutes: 30, connection_check_min: 15 },
      replies: { optout_keywords: ['SAIR', 'PARAR', 'STOP', 'DESCADASTRAR'], optout_confirmation: 'Pronto, você não receberá mais mensagens promocionais da {barbearia}.' },
      clients, services: svc, barbers, appts, campaigns, dispatches, robot, audit: [], blocks: [], gallery: [],
      inbound: [{ id: 1, channel: 'whatsapp', from_addr: '+5521999990001', client_id: 1, body: 'Tem horário sábado de manhã?', kind: 'mensagem', status: 'nova', received_at: t(30), reply: null }],
      reviews: [{ id: 1, client_id: 7, kind: 'perdeu-acesso', payload: { telefone: '+5521977770000', email: null, mensagem: 'Troquei de número, corto com o Rafa' }, status: 'aberta', resolution: '', created_at: t(200) }],
      challenges: {}, session: null, admin: null, nextId: 1000,
    };
  }
  let db;
  try { db = JSON.parse(localStorage.getItem(KEY)) || seed(); } catch { db = seed(); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {} };
  const nid = () => ++db.nextId;
  window.__demoReset = () => { localStorage.removeItem(KEY); location.reload(); };

  const svcById = (id) => db.services.find((s) => s.id === Number(id));
  const barberById = (id) => db.barbers.find((b) => b.id === Number(id));
  const clientById = (id) => db.clients.find((c) => c.id === Number(id));
  const bname = (b) => b.nickname || b.name;
  const audit = (action, detail = '') => db.audit.unshift({ id: nid(), ts: nowIso(), actor: 'admin:demo', action, entity: '', entity_id: '', result: 'ok', detail, ip: 'demo' });
  const robot = (action, result, detail = '') => db.robot.unshift({ id: nid(), ts: nowIso(), level: 'info', action, result, detail });

  // ---------------- Agenda ----------------
  function freeSlots(b, date, dur, ignoreRules = false) {
    const ranges = b.escala.filter((e) => e.dia === wdOf(date));
    const earliest = ignoreRules ? 0 : Date.now() + db.booking.min_advance_min * 60000;
    const busy = db.appts.filter((a) => a.barber_id === b.id && ['pendente', 'confirmado', 'atendido'].includes(a.status));
    const blocks = db.blocks.filter((k) => !k.barber_id || k.barber_id === b.id);
    const out = [];
    for (const r of ranges) {
      for (let t = at(date, r.inicio).getTime(); t + dur * 60000 <= at(date, r.fim).getTime(); t += db.booking.slot_step_min * 60000) {
        const s = new Date(t).toISOString(), e = new Date(t + dur * 60000).toISOString();
        if (t < earliest) continue;
        if (busy.some((a) => s < a.end_at && a.start_at < e) || blocks.some((k) => s < k.end_at && k.start_at < e)) continue;
        out.push({ start: s, hora: localTime(s) });
      }
    }
    return out;
  }
  const eligible = (sid, bid) => db.barbers.filter((b) => b.active && !b.deleted && b.servicos.includes(Number(sid)) && (!bid || bid === 'qualquer' || b.id === Number(bid)));
  function createAppt({ clientId, sid, bid, date, time, source, status, ignoreRules }) {
    const s = svcById(sid);
    if (source === 'site' && db.appts.filter((a) => a.client_id === clientId && ['pendente', 'confirmado'].includes(a.status) && a.start_at > nowIso()).length >= db.booking.max_future_per_client) throw new E(409, `Você já tem ${db.booking.max_future_per_client} horário(s) marcado(s). Cancele um deles para agendar outro.`);
    const startIso = at(date, time).toISOString();
    const free = eligible(sid, bid).filter((b) => freeSlots(b, date, s.duration_min, ignoreRules).some((x) => x.start === startIso));
    if (!free.length) throw new E(409, 'Esse horário acabou de ser ocupado. Escolha outro, por favor.');
    const b = free[0];
    const a = { id: nid(), client_id: clientId, barber_id: b.id, service_id: s.id, start_at: startIso, end_at: new Date(Date.parse(startIso) + s.duration_min * 60000).toISOString(), status: status || (db.booking.auto_confirm ? 'confirmado' : 'pendente'), source, created_at: nowIso(), updated_at: nowIso() };
    db.appts.push(a);
    const c = clientById(clientId);
    for (const ch of ['whatsapp', 'email']) {
      if ((ch === 'whatsapp' ? c.phone : c.email) && a.status === 'confirmado') db.dispatches.unshift({ id: nid(), campaign_id: 1, client_id: c.id, event_key: `agendamento:${a.id}`, channel: ch, status: 'aceita', scheduled_at: nowIso(), destination: ch === 'whatsapp' ? c.phone : c.email, error: null });
    }
    robot('envio-simulado', 'aceito (simulado)', `confirmação do agendamento #${a.id}`);
    return { a, b, s };
  }

  // ---------------- Rotas públicas ----------------
  function me() { return db.session ? clientById(db.session) : null; }
  function meView(c) {
    return { nome: c.full_name, nascimento: c.birth_date, telefone: c.phone, telefone_verificado: Boolean(c.phone_verified_at), email: c.email, email_verificado: Boolean(c.email_verified_at), preferencia: c.contact_pref,
      autorizacoes: { whatsapp: c.consents.whatsapp_marketing === 'concedida', email: c.consents.email_marketing === 'concedida' } };
  }
  function challenge(clientId, purpose, extra = {}) { const id = Math.random().toString(36).slice(2, 12); db.challenges[id] = { clientId, purpose, ...extra }; return id; }
  function sendCode(id, canal) {
    const ch = db.challenges[id]; if (!ch) throw new E(400, 'Esta verificação expirou. Comece novamente.');
    ch.code = code6(); ch.canal = ch.canal || canal; ch.tries = 0;
    robot('codigo-enviado', 'aceito (simulado)', `${ch.canal}`);
    return { ok: true, canal: ch.canal, demo_codigo: ch.code };
  }
  function checkCode(id, codigo) {
    const ch = db.challenges[id]; if (!ch || !ch.code) throw new E(400, 'Peça o código primeiro.');
    if (String(codigo).trim() !== ch.code) { ch.tries++; throw new E(400, `Código incorreto. Restam ${Math.max(0, 5 - ch.tries)} tentativa(s).`); }
    delete db.challenges[id]; return ch;
  }

  const pub = {
    'GET /api/site': () => ({
      barbearia: { nome: db.shop.name, slogan: db.shop.tagline, sobre: db.shop.about, endereco: db.shop.address, mapa: db.shop.maps_url, telefone: db.shop.phone_display, whatsapp: db.shop.whatsapp_number, instagram: db.shop.instagram, horarios: db.shop.hours_text, logo: db.shop.logo, capa: db.shop.hero_image },
      servicos: db.services.filter((s) => s.active).map((s) => ({ id: s.id, nome: s.name, descricao: s.description, duracao: s.duration_min, preco: s.price_cents })),
      barbeiros: db.barbers.filter((b) => b.active && !b.deleted && b.escala.length).map((b) => ({ id: b.id, nome: bname(b), bio: b.bio, foto: b.photo, servicos: b.servicos })),
      galeria: db.gallery, regras: { dias_a_frente: 30 }, canais: { whatsapp: true, email: true }, demo: false,
    }),
    'GET /api/dias': (q) => {
      const s = svcById(q.servico); const today = localDate(); const out = [];
      for (let i = 0; i <= db.booking.max_days_ahead; i++) { const d = addDays(today, i); if (eligible(q.servico, q.barbeiro).some((b) => freeSlots(b, d, s.duration_min).length)) out.push(d); }
      return { dias: out };
    },
    'GET /api/disponibilidade': (q) => {
      const s = svcById(q.servico); const map = new Map();
      for (const b of eligible(q.servico, q.barbeiro)) for (const x of freeSlots(b, q.data, s.duration_min)) { if (!map.has(x.hora)) map.set(x.hora, { hora: x.hora, inicio: x.start, barbeiros: [] }); map.get(x.hora).barbeiros.push({ id: b.id, nome: bname(b) }); }
      return { horarios: [...map.values()].sort((a, b) => a.inicio.localeCompare(b.inicio)) };
    },
    'POST /api/cliente/identificar': (q, b) => {
      if (norm(b.nome).split(' ').length < 2) throw new E(400, 'Informe seu nome completo.');
      const found = db.clients.filter((c) => norm(c.full_name) === norm(b.nome) && c.birth_date === b.nascimento);
      if (!found.length) return { status: 'nao-encontrado' };
      if (found.length > 1) return { status: 'multiplo' };
      const c = found[0];
      const contatos = [];
      if (c.phone && c.phone_verified_at) contatos.push({ canal: 'whatsapp', mascara: maskPhone(c.phone), disponivel: true });
      if (c.email && c.email_verified_at) contatos.push({ canal: 'email', mascara: maskEmail(c.email), disponivel: true });
      return { status: 'encontrado', desafio: challenge(c.id, 'login'), contatos };
    },
    'POST /api/cliente/codigo': (q, b) => sendCode(b.desafio, b.canal),
    'POST /api/cliente/verificar': (q, b) => {
      const ch = checkCode(b.desafio, b.codigo);
      const c = clientById(ch.clientId);
      if (ch.purpose === 'cadastro') { c[ch.canal === 'whatsapp' ? 'phone_verified_at' : 'email_verified_at'] = nowIso(); }
      if (ch.purpose === 'completar') { Object.assign(c, { full_name: ch.payload.nome, birth_date: ch.payload.nascimento, phone_verified_at: nowIso() }); if (ch.payload.email) c.email = ch.payload.email; c.history.unshift({ created_at: nowIso(), field: 'nascimento', old_value: null, new_value: ch.payload.nascimento, source: 'site-cadastro', actor: 'cliente' }); }
      db.session = c.id; return { ok: true };
    },
    'POST /api/cliente/cadastro': (q, b) => {
      if (db.clients.some((c) => norm(c.full_name) === norm(b.nome) && c.birth_date === b.nascimento)) return { status: 'ja-cadastrado' };
      if (norm(b.nome).split(' ').length < 2) throw new E(400, 'Informe o nome completo.');
      if (!b.nascimento) throw new E(400, 'Informe a data de nascimento.');
      const phone = b.telefone ? phoneE164(b.telefone) : null;
      if (b.telefone && !phone) throw new E(400, 'Telefone inválido. Use DDD + número.');
      if (b.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.email)) throw new E(400, 'E-mail inválido.');
      const canal = b.canal_verificacao === 'email' ? 'email' : 'whatsapp';
      if (canal === 'whatsapp' && !phone) throw new E(400, 'Informe um telefone válido para receber o código.');
      if (canal === 'email' && !b.email) throw new E(400, 'Informe um e-mail válido para receber o código.');
      const legacy = phone && db.clients.find((c) => c.phone === phone && !c.birth_date);
      if (legacy) { const id = challenge(legacy.id, 'completar', { canal: 'whatsapp', payload: { nome: b.nome, nascimento: b.nascimento, email: b.email } }); const r = sendCode(id); return { status: 'codigo-enviado', desafio: id, canal: 'whatsapp', mascara: maskPhone(phone), demo_codigo: r.demo_codigo }; }
      const c = { id: nid(), full_name: b.nome.replace(/\s+/g, ' ').trim(), birth_date: b.nascimento, phone, phone_verified_at: null, email: b.email || null, email_verified_at: null, phone2: null, address: '', cpf: null, notes: '', barber_id: null, contact_pref: 'ambos', last_service_at: null, source: 'site', created_at: nowIso(), updated_at: nowIso(), history: [], consents: {} };
      if (b.aut_whatsapp) c.consents.whatsapp_marketing = 'concedida';
      if (b.aut_email) c.consents.email_marketing = 'concedida';
      db.clients.push(c);
      const id = challenge(c.id, 'cadastro', { canal }); const r = sendCode(id);
      return { status: 'codigo-enviado', desafio: id, canal, mascara: canal === 'whatsapp' ? maskPhone(phone) : maskEmail(b.email), demo_codigo: r.demo_codigo };
    },
    'POST /api/cliente/perdi-acesso': (q, b) => { const ch = db.challenges[b.desafio]; db.reviews.unshift({ id: nid(), client_id: ch && ch.clientId, kind: 'perdeu-acesso', payload: { telefone: phoneE164(b.telefone), email: b.email || null, mensagem: b.mensagem }, status: 'aberta', resolution: '', created_at: nowIso() }); return { ok: true }; },
    'POST /api/cliente/homonimo': (q, b) => { db.reviews.unshift({ id: nid(), client_id: null, kind: 'homonimo', payload: { nome: b.nome, nascimento: b.nascimento, telefone: b.telefone, email: b.email }, status: 'aberta', resolution: '', created_at: nowIso() }); return { ok: true }; },
    'POST /api/cliente/sair': () => { db.session = null; return { ok: true }; },
    'GET /api/cliente/eu': () => {
      const c = me(); if (!c) return { logado: false };
      return { logado: true, cliente: meView(c), agendamentos: db.appts.filter((a) => a.client_id === c.id).sort((a, b) => b.start_at.localeCompare(a.start_at)).map((a) => ({ id: a.id, start_at: a.start_at, end_at: a.end_at, status: a.status, barbeiro: bname(barberById(a.barber_id)), servico: svcById(a.service_id).name })) };
    },
    'POST /api/cliente/contato': (q, b) => { const c = me(); if (!c) throw new E(401, 'Identifique-se.'); const v = b.canal === 'whatsapp' ? phoneE164(b.valor) : b.valor; if (!v) throw new E(400, 'Contato inválido.'); const id = challenge(c.id, 'novo-contato', { canal: b.canal, valor: v }); const r = sendCode(id); return { status: 'codigo-enviado', desafio: id, demo_codigo: r.demo_codigo }; },
    'POST /api/cliente/contato/confirmar': (q, b) => { const ch = checkCode(b.desafio, b.codigo); const c = clientById(ch.clientId); if (ch.canal === 'whatsapp') { c.history.unshift({ created_at: nowIso(), field: 'telefone', old_value: c.phone, new_value: ch.valor, source: 'site-meu-cadastro', actor: 'cliente' }); c.phone = ch.valor; c.phone_verified_at = nowIso(); } else { c.history.unshift({ created_at: nowIso(), field: 'email', old_value: c.email, new_value: ch.valor, source: 'site-meu-cadastro', actor: 'cliente' }); c.email = ch.valor; c.email_verified_at = nowIso(); } return { ok: true }; },
    'POST /api/cliente/preferencias': (q, b) => { const c = me(); if (!c) throw new E(401, 'Identifique-se.'); c.consents.whatsapp_marketing = b.aut_whatsapp ? 'concedida' : (c.consents.whatsapp_marketing ? 'revogada' : undefined); c.consents.email_marketing = b.aut_email ? 'concedida' : (c.consents.email_marketing ? 'revogada' : undefined); c.contact_pref = b.preferencia; return { ok: true }; },
    'POST /api/agendamentos': (q, b) => {
      const c = me(); if (!c) throw new E(401, 'Identifique-se para continuar.');
      const { a, b: br, s } = createAppt({ clientId: c.id, sid: b.servico, bid: b.barbeiro, date: b.data, time: b.hora, source: 'site' });
      return { id: a.id, status: a.status, barbeiro: bname(br), servico: s.name, inicio: a.start_at, data: fmtBR(a.start_at), hora: localTime(a.start_at), gerenciar: `agendamento.html?t=${a.id}` };
    },
    'POST /api/agendamentos/:id/cancelar': (q, b, p) => { const a = db.appts.find((x) => x.id === Number(p.id)); if (!a) throw new E(404, 'Agendamento não encontrado.'); a.status = 'cancelado'; return { ok: true }; },
    'GET /api/agendamento-link': (q) => { const a = db.appts.find((x) => x.id === Number(q.t)); if (!a) throw new E(404, 'Link inválido.'); return { servico: svcById(a.service_id).name, barbeiro: bname(barberById(a.barber_id)), data: fmtBR(a.start_at), hora: localTime(a.start_at), dia_semana: WD[wdOf(localDate(a.start_at))], status: a.status, primeiro_nome: clientById(a.client_id).full_name.split(' ')[0] }; },
    'POST /api/agendamento-link/cancelar': (q, b) => { const a = db.appts.find((x) => x.id === Number(b.t)); if (a) a.status = 'cancelado'; return { ok: true }; },
  };

  // ---------------- Rotas do painel ----------------
  const reqAdmin = () => { if (!db.admin) throw new E(401, 'Faça login.'); };
  const consent = (c, k) => c.consents[k] || null;
  const summary = (c) => ({ id: c.id, nome: c.full_name, nascimento: c.birth_date, telefone: c.phone, telefone2: c.phone2, email: c.email, ultimo_atendimento: c.last_service_at, barbeiro: c.barber_id ? bname(barberById(c.barber_id) || { name: '' }) : null, origem: c.source });
  function filterClients(q) {
    let list = db.clients.slice();
    if (q.nome) for (const w of norm(q.nome).split(' ')) list = list.filter((c) => norm(c.full_name).includes(w));
    if (q.telefone) { const d = digits(q.telefone); list = list.filter((c) => digits(c.phone).includes(d) || digits(c.phone2).includes(d)); }
    if (q.email) list = list.filter((c) => (c.email || '').includes(q.email.toLowerCase()));
    if (q.nascimento) { const s = q.nascimento.trim(); let m; if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) { const v = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; list = list.filter((c) => c.birth_date === v); } else if ((m = s.match(/^(\d{1,2})\/(\d{1,2})$/))) { const v = `${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; list = list.filter((c) => c.birth_date && c.birth_date.slice(5) === v); } else throw new E(400, 'Data de nascimento: use DD/MM/AAAA ou DD/MM.'); }
    if (q.sem === 'nascimento') list = list.filter((c) => !c.birth_date);
    if (q.aniversario === 'hoje') list = list.filter((c) => c.birth_date && c.birth_date.slice(5) === localDate().slice(5));
    return list.sort((a, b) => a.full_name.localeCompare(b.full_name, 'pt-BR'));
  }
  const campStats = (id) => { const o = { whatsapp: {}, email: {} }; for (const x of db.dispatches.filter((d) => d.campaign_id === id)) o[x.channel][x.status] = (o[x.channel][x.status] || 0) + 1; return o; };
  const fill = (t, c) => String(t).replace(/\{([a-z_]+)\}/g, (m, k) => ({ nome: c.full_name, primeiro_nome: c.full_name.split(' ')[0], barbearia: db.shop.name, barbeiro: 'Rafa', servico: 'Corte', data: fmtBR(nowIso()), hora: '10:00', dia_semana: 'sexta-feira', link_agendamento: ROOT + '#agendar', link_gerenciar: ROOT + 'agendamento.html?t=1', link_descadastro: ROOT + '#' }[k] ?? m));
  const notInDemo = (what) => { throw new E(400, `${what} não está disponível na demonstração (funciona na versão instalada no servidor).`); };

  const adm = {
    'POST /admin/api/login': (q, b) => { if (!b.usuario || !b.senha) throw new E(401, 'Usuário ou senha incorretos.'); db.adminPending = true; return { etapa: 'totp' }; },
    'POST /admin/api/login/totp': (q, b) => { if (!db.adminPending) throw new E(401, 'Sessão expirada. Entre novamente.'); if (!/^\d{6}$/.test(String(b.codigo).trim())) throw new E(401, 'Código inválido.'); db.admin = true; audit('login', 'demonstração'); return { ok: true }; },
    'POST /admin/api/logout': () => { db.admin = false; return { ok: true }; },
    'GET /admin/api/me': () => { reqAdmin(); return { usuario: 'demo', nome: 'Demonstração', demo: true }; },
    'GET /admin/api/painel': () => {
      reqAdmin(); const today = localDate(); const now = nowIso();
      const ap = db.appts.filter((a) => localDate(a.start_at) === today && a.status !== 'cancelado').sort((a, b) => a.start_at.localeCompare(b.start_at));
      const next = ap.find((a) => a.start_at > now && ['confirmado', 'pendente'].includes(a.status));
      const cnt = (st) => db.dispatches.filter((x) => st.includes(x.status));
      return {
        hoje: { agendamentos: ap.length, em_atendimento: ap.filter((a) => a.start_at <= now && a.end_at > now).map((a) => ({ cliente: clientById(a.client_id).full_name })), proximo: next ? { cliente: clientById(next.client_id).full_name, hora: localTime(next.start_at) } : null,
          faturamento_previsto_centavos: ap.reduce((s, a) => s + svcById(a.service_id).price_cents, 0), pendentes_aprovacao: db.appts.filter((a) => a.status === 'pendente').length },
        clientes: { total: db.clients.length, aniversariantes_hoje: db.clients.filter((c) => c.birth_date && c.birth_date.slice(5) === today.slice(5)).length,
          com_whatsapp_marketing: db.clients.filter((c) => consent(c, 'whatsapp_marketing') === 'concedida').length, com_email_marketing: db.clients.filter((c) => consent(c, 'email_marketing') === 'concedida').length, sem_nascimento: db.clients.filter((c) => !c.birth_date).length },
        campanhas: db.campaigns.reduce((o, c) => ((o[c.status] = (o[c.status] || 0) + 1), o), {}),
        fila: { whatsapp: cnt(['agendada']).filter((x) => x.channel === 'whatsapp').length, email: cnt(['agendada']).filter((x) => x.channel === 'email').length },
        envios_7d: ['whatsapp', 'email'].flatMap((ch) => ['aceita', 'entregue', 'lida', 'falha', 'incerta'].map((st) => ({ channel: ch, status: st, n: db.dispatches.filter((x) => x.channel === ch && x.status === st).length }))),
        respostas_novas: db.inbound.filter((m) => m.status === 'nova').length, conferencias_abertas: db.reviews.filter((r) => r.status === 'aberta').length,
        alertas: [], executor: { ultimo_sinal: nowIso(), segundos: 20, detalhe: {} },
        conexoes: [{ channel: 'whatsapp', status: 'conectado', label: 'Simulado (WhatsApp) — demonstração' }, { channel: 'email', status: 'conectado', label: 'Simulado (e-mail) — demonstração' }],
      };
    },
    'GET /admin/api/clientes': (q) => { reqAdmin(); const all = filterClients(q); const p = Math.max(1, Number(q.pagina) || 1); return { total_cadastrados: db.clients.length, total_encontrados: all.length, pagina: p, paginas: Math.max(1, Math.ceil(all.length / 50)), clientes: all.slice((p - 1) * 50, p * 50).map(summary) }; },
    'GET /admin/api/clientes/sugestoes': (q) => { reqAdmin(); if (String(q.q || '').length < 2) return { sugestoes: [] }; if (q.campo === 'nascimento' && !/^\d{1,2}\/\d{1,2}(\/\d{4})?$/.test(q.q)) return { sugestoes: [] }; return { sugestoes: filterClients({ [q.campo]: q.q }).slice(0, 8).map(summary) }; },
    'GET /admin/api/clientes/:id': (q, b, p) => {
      reqAdmin(); const c = clientById(p.id); if (!c) throw new E(404, 'Cliente não encontrado.');
      return { ...c, autorizacoes: { whatsapp_marketing: consent(c, 'whatsapp_marketing'), email_marketing: consent(c, 'email_marketing'), whatsapp_servico: consent(c, 'whatsapp_servico'), email_servico: consent(c, 'email_servico') },
        historico: c.history, historico_autorizacoes: Object.entries(c.consents).filter(([, v]) => v).map(([k, v]) => ({ created_at: c.updated_at, channel: k.split('_')[0], purpose: k.split('_')[1], status: v, source: 'demonstração', detail: '' })),
        agendamentos: db.appts.filter((a) => a.client_id === c.id).map((a) => ({ ...a, barbeiro: bname(barberById(a.barber_id)), servico: svcById(a.service_id).name })),
        envios: db.dispatches.filter((x) => x.client_id === c.id).map((x) => ({ ...x, campanha: db.campaigns.find((k) => k.id === x.campaign_id).name })), respostas: db.inbound.filter((m) => m.client_id === c.id) };
    },
    'PUT /admin/api/clientes/:id': (q, b, p) => {
      reqAdmin(); const c = clientById(p.id);
      for (const k of ['whatsapp_marketing', 'email_marketing', 'whatsapp_servico', 'email_servico']) if (b[k] !== undefined) { if (b[k] && c.consents[k] !== 'concedida' && !String(b.origem_autorizacao || '').trim()) throw new E(400, 'Para marcar uma autorização, informe como ela foi obtida (ex.: "pediu no balcão em 06/11").'); c.consents[k] = b[k] ? 'concedida' : 'revogada'; }
      const map = { nome: 'full_name', nascimento: 'birth_date', telefone: 'phone', telefone2: 'phone2', email: 'email', cpf: 'cpf', endereco: 'address', observacoes: 'notes', preferencia: 'contact_pref' };
      for (const [f, k] of Object.entries(map)) if (b[f] !== undefined && (b[f] || null) !== (c[k] || null)) { let v = b[f] || null; if ((f === 'telefone' || f === 'telefone2') && v) { v = phoneE164(v); if (!v) throw new E(400, 'Telefone inválido.'); } c.history.unshift({ created_at: nowIso(), field: k, old_value: c[k], new_value: v, source: 'admin', actor: 'admin:demo' }); c[k] = v; }
      if (b.barbeiro_id !== undefined) c.barber_id = Number(b.barbeiro_id) || null;
      if (b.ultimo_atendimento) c.last_service_at = at(b.ultimo_atendimento, '12:00').toISOString();
      c.updated_at = nowIso(); audit('cliente-editado', c.full_name); return { ok: true };
    },
    'DELETE /admin/api/clientes/:id': (q, b, p) => { reqAdmin(); db.clients = db.clients.filter((c) => c.id !== Number(p.id)); db.appts = db.appts.filter((a) => a.client_id !== Number(p.id)); audit('cliente-apagado', `#${p.id}`); return { ok: true }; },
    'POST /admin/api/clientes': (q, b) => { reqAdmin(); if (!String(b.nome || '').trim()) throw new E(400, 'Informe o nome.'); const c = { id: nid(), full_name: b.nome.trim(), birth_date: b.nascimento || null, phone: phoneE164(b.telefone), phone_verified_at: nowIso(), phone2: phoneE164(b.telefone2), email: b.email || null, email_verified_at: nowIso(), address: b.endereco || '', cpf: b.cpf || null, notes: b.observacoes || '', barber_id: Number(b.barbeiro_id) || null, contact_pref: b.preferencia || 'ambos', last_service_at: b.ultimo_atendimento ? at(b.ultimo_atendimento, '12:00').toISOString() : null, source: 'admin', created_at: nowIso(), updated_at: nowIso(), history: [{ created_at: nowIso(), field: 'cadastro', old_value: null, new_value: b.nome, source: 'admin', actor: 'admin:demo' }], consents: {} }; db.clients.push(c); audit('cliente-criado', c.full_name); return { id: c.id }; },
    'POST /admin/api/clientes/:id/atendimento': (q, b, p) => { reqAdmin(); const c = clientById(p.id); c.last_service_at = at(b.data, b.hora).toISOString(); c.history.unshift({ created_at: nowIso(), field: 'ultimo_atendimento', old_value: null, new_value: c.last_service_at, source: 'atendimento', actor: 'admin:demo' }); return { ok: true }; },
    'POST /admin/api/importar': () => notInDemo('A importação de planilha'),
    'GET /admin/api/funcionarios': () => { reqAdmin(); return { funcionarios: db.barbers.filter((b) => !b.deleted) }; },
    'POST /admin/api/funcionarios': (q, b) => { reqAdmin(); if (!String(b.nome || '').trim()) throw new E(400, 'Informe o nome do funcionário.'); const f = { id: nid(), name: b.nome.trim(), nickname: b.apelido || '', birth_date: b.nascimento || null, phone: phoneE164(b.telefone), email: b.email || null, address: b.endereco || '', bio: b.bio || '', photo: b.foto || null, active: b.habilitado ? 1 : 0, servicos: b.servicos || [], escala: [] }; db.barbers.push(f); audit('funcionario-criado', f.name); return { id: f.id }; },
    'PUT /admin/api/funcionarios/:id': (q, b, p) => { reqAdmin(); const f = barberById(p.id); Object.assign(f, { name: b.nome, nickname: b.apelido, birth_date: b.nascimento || null, phone: phoneE164(b.telefone), email: b.email || null, address: b.endereco, bio: b.bio, active: b.habilitado ? 1 : 0, servicos: b.servicos }); if (b.foto) f.photo = b.foto; audit('funcionario-editado', f.name); return { ok: true }; },
    'DELETE /admin/api/funcionarios/:id': (q, b, p) => { reqAdmin(); const f = barberById(p.id); if (db.appts.some((a) => a.barber_id === f.id && ['pendente', 'confirmado'].includes(a.status) && a.start_at > nowIso())) throw new E(409, 'Este funcionário tem agendamentos futuros. Remarque ou cancele antes de apagar.'); f.deleted = true; f.active = 0; audit('funcionario-apagado', f.name); return { ok: true }; },
    'PUT /admin/api/funcionarios/:id/escala': (q, b, p) => { reqAdmin(); for (const f of b.faixas) if (f.inicio >= f.fim) throw new E(400, 'O início precisa ser antes do fim.'); barberById(p.id).escala = b.faixas.map((f) => ({ dia: Number(f.dia), inicio: f.inicio, fim: f.fim })); audit('escala-alterada', bname(barberById(p.id))); return { ok: true }; },
    'GET /admin/api/folgas': () => { reqAdmin(); return { folgas: db.blocks.map((k) => ({ ...k, barbeiro: k.barber_id ? bname(barberById(k.barber_id)) : null })) }; },
    'POST /admin/api/folgas': (q, b) => { reqAdmin(); const s = at(b.data_inicio, b.hora_inicio || '00:00').toISOString(); const e = b.hora_fim ? at(b.data_fim || b.data_inicio, b.hora_fim).toISOString() : at(addDays(b.data_fim || b.data_inicio, 1), '00:00').toISOString(); db.blocks.push({ id: nid(), barber_id: Number(b.barbeiro_id) || null, start_at: s, end_at: e, reason: b.motivo || '' }); return { ok: true }; },
    'DELETE /admin/api/folgas/:id': (q, b, p) => { reqAdmin(); db.blocks = db.blocks.filter((k) => k.id !== Number(p.id)); return { ok: true }; },
    'GET /admin/api/servicos': () => { reqAdmin(); return { servicos: db.services }; },
    'POST /admin/api/servicos': (q, b) => { reqAdmin(); const price = Math.round(Number(String(b.preco || 0).replace(',', '.')) * 100); if (b.id) Object.assign(svcById(b.id), { name: b.nome, duration_min: Number(b.duracao), price_cents: price, description: b.descricao || '', active: b.ativo === false ? 0 : 1 }); else db.services.push({ id: nid(), name: b.nome, duration_min: Number(b.duracao), price_cents: price, description: b.descricao || '', active: 1 }); return { ok: true }; },
    'DELETE /admin/api/servicos/:id': (q, b, p) => { reqAdmin(); svcById(p.id).active = 0; return { ok: true, desativado: true }; },
    'GET /admin/api/agenda': (q) => {
      reqAdmin(); const date = q.data || localDate();
      return { data: date, funcionarios: db.barbers.filter((b) => b.active && !b.deleted).map((b) => ({ id: b.id, name: b.name, nickname: b.nickname, escala: b.escala.filter((e) => e.dia === wdOf(date)) })),
        agendamentos: db.appts.filter((a) => localDate(a.start_at) === date).map((a) => { const c = clientById(a.client_id) || { full_name: '?' }; return { ...a, cliente: c.full_name, telefone: c.phone, barbeiro: bname(barberById(a.barber_id)), servico: svcById(a.service_id).name, price_cents: svcById(a.service_id).price_cents }; }),
        folgas: db.blocks.filter((k) => localDate(k.start_at) <= date && localDate(k.end_at) >= date) };
    },
    'GET /admin/api/agenda/horarios': (q) => { reqAdmin(); const s = svcById(q.servico); return { horarios: eligible(q.servico, q.barbeiro).flatMap((b) => freeSlots(b, q.data, s.duration_min, true).map((x) => ({ hora: x.hora, barbeiro_id: b.id, barbeiro: bname(b) }))) }; },
    'POST /admin/api/agenda': (q, b) => { reqAdmin(); createAppt({ clientId: b.cliente_id, sid: b.servico, bid: b.barbeiro, date: b.data, time: b.hora, source: 'admin', status: 'confirmado', ignoreRules: true }); return { ok: true }; },
    'PUT /admin/api/agenda/:id/status': (q, b, p) => { reqAdmin(); const a = db.appts.find((x) => x.id === Number(p.id)); a.status = b.status; if (b.status === 'atendido') { const c = clientById(a.client_id); c.last_service_at = a.start_at; } audit('agendamento-status', b.status); return { ok: true }; },
    'GET /admin/api/campanhas': () => { reqAdmin(); return { campanhas: db.campaigns.map((c) => ({ ...c, envios: campStats(c.id) })) }; },
    'GET /admin/api/campanhas/:id': (q, b, p) => {
      reqAdmin(); const c = db.campaigns.find((k) => k.id === Number(p.id)); const ex = db.clients[0];
      const key = c.purpose === 'marketing' ? '_marketing' : '_servico';
      const wa = db.clients.filter((x) => x.phone && consent(x, 'whatsapp' + key) === 'concedida').length, em = db.clients.filter((x) => x.email && consent(x, 'email' + key) === 'concedida').length;
      return { ...c, envios: campStats(c.id), elegiveis: { clientes_com_canal: db.clients.filter((x) => consent(x, 'whatsapp' + key) === 'concedida' || consent(x, 'email' + key) === 'concedida').length, whatsapp: wa, email: em },
        previa: { whatsapp: fill(c.text_whatsapp, ex), assunto: fill(c.email_subject, ex), email: fill(c.text_email, ex) }, parametros_modelo: (c.text_whatsapp.match(/\{[a-z_]+\}/g) || []).map((x) => x.slice(1, -1)) };
    },
    'PUT /admin/api/campanhas/:id': (q, b, p) => { reqAdmin(); const c = db.campaigns.find((k) => k.id === Number(p.id)); Object.assign(c, { name: b.nome, channels: b.canais, config: { ...c.config, ...b.config }, wa_template: b.modelo_whatsapp, text_whatsapp: b.texto_whatsapp, email_subject: b.assunto_email, text_email: b.texto_email, starts_at: b.inicio ?? c.starts_at, ends_at: b.fim ?? c.ends_at }); audit('campanha-editada', c.name); return { id: c.id }; },
    'POST /admin/api/campanhas': (q, b) => { reqAdmin(); const c = { id: nid(), type: 'promocional', status: 'rascunho', purpose: 'marketing', name: b.nome || 'Nova campanha', channels: b.canais, config: b.config, wa_template: b.modelo_whatsapp, wa_lang: 'pt_BR', text_whatsapp: b.texto_whatsapp, email_subject: b.assunto_email, text_email: b.texto_email, starts_at: b.inicio, ends_at: b.fim }; db.campaigns.push(c); audit('campanha-criada', c.name); return { id: c.id }; },
    'POST /admin/api/campanhas/:id/acao': (q, b, p) => { reqAdmin(); const c = db.campaigns.find((k) => k.id === Number(p.id)); const next = { iniciar: 'ativa', pausar: 'pausada', encerrar: 'encerrada', arquivar: 'arquivada', reabrir: 'pausada' }[b.acao]; c.status = next; robot(`campanha-${b.acao}`, next, c.name); audit(`campanha-${b.acao}`, c.name); return { status: next }; },
    'GET /admin/api/campanhas/:id/fila': (q, b, p) => { reqAdmin(); const list = db.dispatches.filter((x) => x.campaign_id === Number(p.id) && (!q.status || x.status === q.status) && (!q.canal || x.channel === q.canal)).map((x) => ({ ...x, cliente: (clientById(x.client_id) || { full_name: '?' }).full_name })); return { total: list.length, pagina: 1, envios: list }; },
    'GET /admin/api/envios/:id': (q, b, p) => { reqAdmin(); const x = db.dispatches.find((d) => d.id === Number(p.id)); return { eventos: [{ created_at: x.scheduled_at, status: 'agendada', detail: '' }, { created_at: x.scheduled_at, status: 'processando', detail: '' }, { created_at: x.scheduled_at, status: x.status, detail: x.error || '' }] }; },
    'POST /admin/api/envios/:id/resolver': (q, b, p) => { reqAdmin(); const x = db.dispatches.find((d) => d.id === Number(p.id)); x.status = { reenviar: 'aceita', 'confirmar-recebido': 'entregue', descartar: 'cancelada' }[b.acao]; return { ok: true }; },
    'GET /admin/api/conexoes': () => { reqAdmin(); return { conexoes: [{ id: 1, channel: 'whatsapp', provider: 'simulado', label: 'Simulado (WhatsApp) — demonstração', status: 'conectado', last_check_at: nowIso(), last_ok_at: nowIso() }, { id: 2, channel: 'email', provider: 'simulado', label: 'Simulado (e-mail) — demonstração', status: 'conectado', last_check_at: nowIso(), last_ok_at: nowIso() }], google_configurado: false, webhook_url: 'https://SEU-DOMINIO/webhooks/whatsapp', meta_configurado: false }; },
    'POST /admin/api/conexoes/simulado': () => ({ ok: true }),
    'POST /admin/api/conexoes/whatsapp': () => notInDemo('A conexão com o WhatsApp'),
    'POST /admin/api/conexoes/:id/acao': () => notInDemo('Pausar/desconectar/testar conexões'),
    'GET /admin/api/respostas': (q) => { reqAdmin(); return { respostas: db.inbound.filter((m) => !q.status || m.status === q.status).map((m) => ({ ...m, cliente: (clientById(m.client_id) || {}).full_name })) }; },
    'PUT /admin/api/respostas/:id': (q, b, p) => { reqAdmin(); db.inbound.find((m) => m.id === Number(p.id)).status = b.status; return { ok: true }; },
    'POST /admin/api/respostas/:id/responder': (q, b, p) => { reqAdmin(); const m = db.inbound.find((x) => x.id === Number(p.id)); m.reply = b.texto; m.status = 'resolvida'; return { ok: true }; },
    'GET /admin/api/conferencias': () => { reqAdmin(); return { conferencias: db.reviews.map((r) => { const c = clientById(r.client_id) || {}; return { ...r, cliente: c.full_name, telefone_atual: c.phone, email_atual: c.email, nascimento: c.birth_date }; }) }; },
    'POST /admin/api/conferencias/:id': (q, b, p) => { reqAdmin(); const r = db.reviews.find((x) => x.id === Number(p.id)); r.status = b.acao === 'aprovar' ? 'aprovada' : 'recusada'; r.resolution = b.resolucao || ''; if (b.acao === 'aprovar' && r.client_id && r.payload.telefone) clientById(r.client_id).phone = r.payload.telefone; return { ok: true }; },
    'GET /admin/api/relatorios': (q) => { reqAdmin(); const by = (arr, f) => Object.entries(arr.reduce((o, x) => ((o[f(x)] = (o[f(x)] || 0) + 1), o), {})); return { de: q.de, ate: q.ate,
      envios_por_campanha: db.dispatches.map((x) => ({ campanha: db.campaigns.find((k) => k.id === x.campaign_id).name, canal: x.channel, status: x.status, n: 1 })),
      agendamentos_por_status: by(db.appts, (a) => a.status).map(([status, n]) => ({ status, n })),
      agendamentos_por_funcionario: db.barbers.filter((b) => !b.deleted).map((b) => ({ funcionario: bname(b), n: db.appts.filter((a) => a.barber_id === b.id).length, faturado: db.appts.filter((a) => a.barber_id === b.id && a.status === 'atendido').reduce((s, a) => s + svcById(a.service_id).price_cents, 0) })),
      novos_clientes: by(db.clients, (c) => c.source).map(([origem, n]) => ({ origem, n })), descadastros: [], respostas: [{ tipo: 'mensagem', n: db.inbound.length }] }; },
    'GET /admin/api/logs/:tipo': (q, b, p) => { reqAdmin(); let l = p.tipo === 'auditoria' ? db.audit : db.robot; if (q.ocultar_verificacoes === '1') l = l.filter((x) => x.action !== 'verificacao'); if (q.acao) l = l.filter((x) => x.action.includes(q.acao)); return { total: l.length, pagina: 1, linhas: l.slice(0, 100) }; },
    'GET /admin/api/alertas': () => ({ alertas: [] }),
    'GET /admin/api/config': () => { reqAdmin(); return { shop: db.shop, booking: db.booking, alerts: db.alerts, replies: db.replies }; },
    'PUT /admin/api/config': (q, b) => { reqAdmin(); for (const k of ['shop', 'booking', 'alerts', 'replies']) if (b[k]) Object.assign(db[k], b[k]); if (b.booking) { db.booking.auto_confirm = Boolean(b.booking.auto_confirm); for (const k of ['min_advance_min', 'max_days_ahead', 'slot_step_min', 'cancel_deadline_min', 'max_future_per_client']) db.booking[k] = Number(db.booking[k]) || 0; } return { ok: true }; },
    'POST /admin/api/upload': (q, b) => { reqAdmin(); const ext = (b.nome.split('.').pop() || 'png').toLowerCase(); return { caminho: `data:image/${ext === 'jpg' ? 'jpeg' : ext === 'svg' ? 'svg+xml' : ext};base64,${b.base64}` }; },
    'GET /admin/api/galeria': () => { reqAdmin(); return { fotos: db.gallery.map((g, i) => ({ id: i + 1, path: g.path })) }; },
    'POST /admin/api/galeria': (q, b) => { reqAdmin(); db.gallery.push({ path: b.caminho, caption: '' }); return { ok: true }; },
    'DELETE /admin/api/galeria/:id': (q, b, p) => { reqAdmin(); db.gallery.splice(Number(p.id) - 1, 1); return { ok: true }; },
    'POST /admin/api/minha-senha': () => notInDemo('Trocar a senha'),
  };

  const routes = Object.entries({ ...pub, ...adm }).map(([k, fn]) => {
    const [method, pattern] = k.split(' '); const keys = [];
    const re = new RegExp('^' + pattern.replace(/:([a-z]+)/g, (_, n) => { keys.push(n); return '([^/]+)'; }) + '$');
    return { method, re, keys, fn };
  });
  // rotas fixas antes das com parâmetro (ex.: /clientes/sugestoes antes de /clientes/:id)
  routes.sort((a, b) => a.keys.length - b.keys.length);

  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, opts = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    const idx = url.pathname.search(/\/(admin\/)?api\//);
    if (idx < 0) return realFetch(input, opts);
    const path = url.pathname.slice(idx);
    const method = (opts.method || 'GET').toUpperCase();
    const body = opts.body ? JSON.parse(opts.body) : {};
    const q = Object.fromEntries(url.searchParams);
    await new Promise((r) => setTimeout(r, 120));
    for (const r of routes) {
      if (r.method !== method) continue;
      const m = path.match(r.re); if (!m) continue;
      const p = {}; r.keys.forEach((k, i) => (p[k] = decodeURIComponent(m[i + 1])));
      try { const out = r.fn(q, body, p); save(); return new Response(JSON.stringify(out ?? {}), { status: 200, headers: { 'Content-Type': 'application/json' } }); }
      catch (e) { save(); return new Response(JSON.stringify({ erro: e.message }), { status: e.status || 500, headers: { 'Content-Type': 'application/json' } }); }
    }
    return new Response(JSON.stringify({ erro: 'Não disponível na demonstração.' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  };

  // Downloads e links do servidor real: avisa em vez de quebrar
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (a && /\/admin\/(api|oauth)\//.test(a.getAttribute('href'))) {
      e.preventDefault();
      alert('Exportação, backup e conexão com Google funcionam na versão instalada no servidor. Esta é só uma demonstração com dados fictícios.');
    }
  }, true);

  // Faixa de demonstração
  document.addEventListener('DOMContentLoaded', () => {
    const bar = document.createElement('div');
    bar.setAttribute('style', 'position:fixed;left:0;right:0;bottom:0;z-index:99;background:#3b2f12;color:#f1d796;font:13px system-ui,sans-serif;padding:.45rem 1rem;display:flex;gap:1rem;justify-content:center;align-items:center;flex-wrap:wrap');
    const isAdmin = /\/admin\//.test(location.pathname);
    bar.innerHTML = `<span><b>Demonstração</b> com dados fictícios — nada é enviado de verdade.</span>${isAdmin ? '<span>Login: qualquer usuário e senha; código: quaisquer 6 dígitos.</span>' : '<span>Teste com: <b>João da Silva</b>, nascimento <b>10/05/1990</b>.</span>'}<a href="${isAdmin ? '../' : 'admin/'}" style="color:#fff">${isAdmin ? 'Ver o site' : 'Ver o painel administrativo'}</a><button type="button" style="background:none;border:1px solid #f1d796;color:#f1d796;border-radius:6px;padding:.15rem .5rem;cursor:pointer">Restaurar dados</button>`;
    bar.querySelector('button').addEventListener('click', () => { if (confirm('Apagar as alterações feitas nesta demonstração?')) window.__demoReset(); });
    document.body.appendChild(bar);
    document.body.style.paddingBottom = '44px';
  });
})();
