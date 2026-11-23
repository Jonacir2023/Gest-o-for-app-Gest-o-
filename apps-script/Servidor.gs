/**
 * GESTÃO GRANSUL · Servidor (Apps Script, web app)
 * Arquivo "Servidor.gs" do mesmo projeto do Codigo.gs.
 *
 * Publicação: Implantar > Nova implantação > Tipo: App da Web
 *   Executar como: Eu (jonacircazelli@gmail.com)
 *   Quem tem acesso: Qualquer pessoa com conta Google
 * Quem entra de fato é só quem estiver na aba "usuarios" com ativo = TRUE.
 */

const FUSO = 'America/Sao_Paulo';
const PERFIS_RDO = ['apontador', 'encarregado', 'engenheiro', 'gerente'];
const PERFIS_GERENCIA = ['gerente'];
const MOTIVO_QUEBRA = 'equipamento_parado';
const MANUT_TIPOS = ['Preventiva', 'Lavação', 'Outra manutenção programada'];
/** false = RDO fora do prazo só é marcado (atrasado). true = RDO trava entre TRAVA_INICIO_H e TRAVA_FIM_H do dia seguinte. Decisão em aberto. */
const TRAVA_RDO_APOS_PRAZO = false;
const TRAVA_INICIO_H = 6;
const TRAVA_FIM_H = 8;

/** Dentro da janela de trava: de 06h a 08h do dia seguinte ao RDO (horário de Brasília). */
function dentroJanelaTrava_(agora, limite) {
  const inicio = limite.getTime();
  const fim = inicio + (TRAVA_FIM_H - TRAVA_INICIO_H) * 3600 * 1000;
  return agora.getTime() >= inicio && agora.getTime() < fim;
}

/* ---------------- Entrada do web app ---------------- */

function doGet() {
  const usuario = usuarioAtual_();
  const t = HtmlService.createTemplateFromFile('Index');
  t.usuario = usuario;
  return t.evaluate()
    .setTitle('Gestão GranSul')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ---------------- Usuário e permissão ---------------- */

function usuarioAtual_() {
  const email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  if (!email) return null;
  const linha = lerAba_('usuarios').find((x) => String(x.email || '').trim().toLowerCase() === email && ativo_(x.ativo));
  if (!linha) return null;
  return { email: email, nome: String(linha.nome || email), perfil: String(linha.perfil || '').toLowerCase() };
}

function exigirUsuario_(perfisPermitidos) {
  const u = usuarioAtual_();
  if (!u) throw new Error('Acesso não autorizado. Peça ao gerente para cadastrar seu e-mail.');
  if (perfisPermitidos && perfisPermitidos.indexOf(u.perfil) === -1) {
    throw new Error('Seu perfil (' + u.perfil + ') não pode fazer esta ação.');
  }
  return u;
}

/** Chamado pela tela para saber quem está logado. */
function dadosSessao() {
  return usuarioAtual_();
}

/* ---------------- Base de cadastros (carregada uma vez pela tela) ---------------- */

function carregarBase() {
  exigirUsuario_(PERFIS_RDO.concat(['lider']));
  const motivos = lerAba_('motivos_justificativa');
  const colaboradores = lerAba_('colaboradores').filter((c) => !c.inativo_em);
  return {
    obras: lerAba_('projetos').map((p) => ({ id: p.id, nome: p.nome })),
    locais: lerAba_('locais').map((l) => ({ id: l.id, nome: l.nome, projeto_id: l.projeto_id })).sort(comparaNome_),
    colaboradores: colaboradores.map((c) => ({ id: c.id, nome: c.nome, funcao: c.funcao, categoria: c.categoria, grupo_terceiro: c.grupo_terceiro || '', apto: ativo_(c.apto_rdo) })),
    responsaveis: colaboradores.filter((c) => ativo_(c.apto_rdo)).map((c) => ({ id: c.id, nome: c.nome })),
    // descricao (marca) + modelo, para mostrar no RDO
    equipamentos: lerAba_('equipamentos').filter((e) => !e.baixa_em).map((e) => ({
      id: e.id, codigo: e.codigo, descricao: [e.especificacao, e.descricao, e.modelo].filter(Boolean).join(' '), tipo: e.tipo,
      operador: (colaboradores.find((c) => c.id === e.operador_id) || {}).nome || '',
    })),
    // Operadores e motoristas vêm do efetivo, pela função (começa com "Operador" ou "Motorista")
    // Dirigir (Leve/Pesado): qualquer pessoa com CNH e direção defensiva em dia. Operar (Equipamento): função "Operador …".
    operadores: colaboradores.map((c) => ({
      id: c.id, nome: c.nome, funcao: c.funcao,
      podeOperar: classeFuncao_(c.funcao) === 'operador', podeDirigir: motoristaApto_(c),
    }))
      .filter((o) => o.podeOperar || o.podeDirigir).sort(comparaNome_),
    motivos: {
      dia_sem_execucao: motivos.filter((m) => m.tipo === 'dia_sem_execucao').map((m) => ({ id: m.id, descricao: m.descricao })),
      equipamento_parado: motivos.filter((m) => m.tipo === MOTIVO_QUEBRA).map((m) => ({ id: m.id, descricao: m.descricao })),
      atividade_paralisada: motivos.filter((m) => m.tipo === 'atividade_paralisada').map((m) => ({ id: m.id, descricao: m.descricao })),
    },
    atividades: lerAba_('atividades_padrao').map((a) => ({ id: a.id, nome: a.nome, unidade_id: a.unidade_id || '' })).sort(comparaNome_),
    unidades: lerAba_('unidades_medida').map((u) => ({ id: u.id, sigla: u.sigla })).sort((a, b) => comparaNome_({ nome: a.sigla }, { nome: b.sigla })),
    manutencao: MANUT_TIPOS,
    limiteRdo: 'Lançamento até 06h do dia seguinte',
  };
}

/* ---------------- RDO ---------------- */

/** Lista os RDOs vigentes (não substituídos), mais recentes primeiro. */
function listarRdos() {
  exigirUsuario_(PERFIS_RDO);
  return lerAba_('rdo')
    .filter((r) => !r.substituido_por)
    .map((r) => ({
      id: r.id,
      data: isoData_(r.data),
      local_id: r.local_id,
      local: r.frente,
      responsavel: r.encarregado,
      criador: r.apontador,
      atrasado: ativo_(r.atrasado),
      lancado_em: textoData_(r.lancado_em),
    }))
    .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
}

/** RDO completo para reabrir na tela (efetivo, equipamentos, atividades, eventos). Sem objetos Date no retorno. */
function detalheRdo(id) {
  exigirUsuario_(PERFIS_RDO);
  const r = lerAba_('rdo').find((x) => x.id === id);
  if (!r) throw new Error('RDO não encontrado.');
  const motivos = lerAba_('motivos_justificativa');
  const locais = lerAba_('locais');
  const unidades = lerAba_('unidades_medida');
  const equipamentos = lerAba_('equipamentos');
  const pessoas = lerAba_('colaboradores');
  const nome = (lista, chave, campo) => (lista.find((x) => x.id === chave) || {})[campo] || '';
  const hora = (v) => (v instanceof Date ? Utilities.formatDate(v, FUSO, 'HH:mm') : String(v || ''));
  const num = (v) => (v === '' || v === null || v === undefined ? '' : String(v));
  const tempo = (s) => ({
    clima: String(r['clima_' + s] || ''), operacao: String(r['operacao_' + s] || ''),
    motivo: nome(motivos, r['motivo_' + s + '_id'], 'descricao'), mm: num(r['chuva_mm_' + s]),
    ini: hora(r['chuva_inicio_' + s]), fim: hora(r['chuva_fim_' + s]),
  });
  return {
    id: r.id, data: isoData_(r.data), obra_id: r.projeto_id, local: r.frente || nome(locais, r.local_id, 'nome'),
    descricao_local: String(r.local_descricao || ''), responsavel: String(r.encarregado || ''), criador: String(r.apontador || ''),
    lancado_por: String(r.lancado_por || ''), lancado_em: textoData_(r.lancado_em), atrasado: ativo_(r.atrasado),
    manha: tempo('manha'), tarde: tempo('tarde'), observacoes: String(r.observacoes || ''),
    efetivo: lerAba_('rdo_efetivo').filter((e) => e.rdo_id === id).map((e) => ({
      nome: String(e.colaborador || ''), presente: e.presente === '' ? true : ativo_(e.presente), motivo: String(e.motivo_ausencia || ''),
    })),
    equipamentos: lerAba_('rdo_equipamentos').filter((q) => q.rdo_id === id).map((q) => {
      const manha = ativo_(q.parado_manha);
      const tarde = ativo_(q.parado_tarde);
      return {
        codigo: String(q.equipamento_codigo || nome(equipamentos, q.equipamento_id, 'codigo')),
        situacao: String(q.status || 'operando'), operador: nome(pessoas, q.operador_id, 'nome') || String(q.operador || ''),
        ini: num(q.medicao_inicial), fim: num(q.medicao_final),
        motivo: q.status === 'parado' ? nome(motivos, q.justificativa_id, 'descricao') : String(q.manutencao_tipo || ''),
        periodo: manha && tarde ? 'ambos' : manha ? 'manha' : tarde ? 'tarde' : '',
      };
    }),
    atividades: lerAba_('rdo_atividades').filter((a) => a.rdo_id === id).map((a) => ({
      local: nome(locais, a.local_id, 'nome'), nome: String(a.atividade || ''), desc: String(a.descricao || ''),
      un: nome(unidades, a.unidade_id, 'sigla'), qtd: num(a.quantidade), par: ativo_(a.paralisada),
      mot: nome(motivos, a.justificativa_id, 'descricao'),
    })),
    eventos: lerAba_('rdo_eventos').filter((v) => v.rdo_id === id).map((v) => ({
      tipo: String(v.tipo || ''), desc: String(v.descricao || ''), prov: String(v.providencias || ''),
    })),
  };
}

/**
 * Grava um RDO completo. Valida as regras, substitui o RDO anterior do mesmo
 * dia, obra e local (nada é apagado) e marca "atrasado" após 06h do dia seguinte.
 */
function salvarRdo(p) {
  const usuario = exigirUsuario_(PERFIS_RDO);
  const erro = validarRdo_(p);
  if (erro) throw new Error(erro);

  // Operando: veículo leve e pesado (caminhão) exigem motorista; equipamento exige operador (do efetivo, ativo)
  const pessoasCad = lerAba_('colaboradores').filter((x) => !x.inativo_em);
  const equipamentosCad = lerAba_('equipamentos');
  (p.equipamentos || []).forEach((q) => {
    if (q.situacao !== 'operando') return;
    const eq = equipamentosCad.find((e) => e.id === q.equipamento_id) || {};
    const precisa = classeExigida_(eq.tipo);
    const op = pessoasCad.find((x) => x.id === q.operador_id);
    const erroCondutor = condutorInvalido_(op, precisa);
    if (erroCondutor) throw new Error((eq.codigo || 'Equipamento') + ': ' + erroCondutor);
  });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const agora = new Date();
    const idRdo = Utilities.getUuid();
    const limite = limiteRdo_(p.data);
    const atrasado = agora.getTime() > limite.getTime();
    if (TRAVA_RDO_APOS_PRAZO && dentroJanelaTrava_(agora, limite)) {
      throw new Error('RDO travado entre ' + TRAVA_INICIO_H + 'h e ' + TRAVA_FIM_H + 'h do dia seguinte (período da reunião).');
    }
    const local = lerAba_('locais').find((l) => l.id === p.local_id);

    // Substitui o RDO vigente do mesmo dia, obra e local
    lerAba_('rdo').forEach((r) => {
      if (!r.substituido_por && isoData_(r.data) === p.data && r.projeto_id === p.obra_id && r.local_id === p.local_id) {
        atualizarCelula_('rdo', r.id, 'substituido_por', idRdo);
      }
    });

    anexarLinhas_('rdo', [{
      id: idRdo,
      data: p.data,
      projeto_id: p.obra_id,
      frente: local ? local.nome : '',
      encarregado: p.responsavel,
      apontador: p.criador,
      lancado_em: agora.toISOString(),
      lancado_por: usuario.email,
      atrasado: atrasado,
      substituido_por: '',
      clima_manha: p.manha.clima || '',
      operacao_manha: p.manha.operacao || '',
      motivo_manha_id: p.manha.motivo_id || '',
      clima_tarde: p.tarde.clima || '',
      operacao_tarde: p.tarde.operacao || '',
      motivo_tarde_id: p.tarde.motivo_id || '',
      local_id: p.local_id,
      local_descricao: p.descricao_local || '',
      observacoes: p.observacoes || '',
      chuva_mm_manha: p.manha.mm || '',
      chuva_mm_tarde: p.tarde.mm || '',
      chuva_inicio_manha: p.manha.ini || '',
      chuva_fim_manha: p.manha.fim || '',
      chuva_inicio_tarde: p.tarde.ini || '',
      chuva_fim_tarde: p.tarde.fim || '',
    }]);

    anexarLinhas_('rdo_efetivo', (p.efetivo || []).map((e) => ({
      id: Utilities.getUuid(), rdo_id: idRdo, colaborador: e.nome, categoria: e.categoria || '',
      presente: e.presente !== false, motivo_ausencia: e.presente === false ? e.motivo : '', grupo_terceiro: e.grupo_terceiro || '',
    })));

    anexarLinhas_('rdo_equipamentos', (p.equipamentos || []).map((q) => {
      const eq = equipamentosCad.find((x) => x.id === q.equipamento_id) || {};
      const operando = q.situacao === 'operando';
      const parado = q.situacao === 'parado';
      return {
        id: Utilities.getUuid(), rdo_id: idRdo, equipamento_codigo: eq.codigo || '', equipamento_id: q.equipamento_id,
        operador: operando ? ((pessoasCad.find((x) => x.id === q.operador_id) || {}).nome || '') : '',
        operador_id: operando ? q.operador_id : '', status: q.situacao,
        medicao_inicial: operando ? q.ini : '', medicao_final: operando ? q.fim : '', horimetro: operando ? q.fim : '',
        justificativa_id: parado ? q.motivo_id : '', manutencao_tipo: q.situacao === 'manutencao' ? q.motivo_texto : '',
        parado_manha: parado && (q.periodo === 'manha' || q.periodo === 'ambos'),
        parado_tarde: parado && (q.periodo === 'tarde' || q.periodo === 'ambos'),
        descricao: q.observacao || '',
      };
    }));

    anexarLinhas_('rdo_atividades', (p.atividades || []).map((a) => ({
      id: Utilities.getUuid(), rdo_id: idRdo, atividade: a.nome, unidade_id: a.unidade_id || '', local_id: a.local_id || '',
      quantidade: a.quantidade || '', paralisada: !!a.paralisada, justificativa_id: a.paralisada ? a.motivo_id : '', descricao: a.descricao || '',
    })));

    anexarLinhas_('rdo_eventos', (p.eventos || []).map((v) => ({
      id: Utilities.getUuid(), rdo_id: idRdo, tipo: v.tipo, descricao: v.descricao, providencias: v.providencias || '', criado_em: agora.toISOString(),
    })));

    return { id: idRdo, atrasado: atrasado };
  } finally {
    lock.releaseLock();
  }
}

function validarRdo_(p) {
  if (!p.obra_id || !p.data || !p.local_id || !p.responsavel || !p.criador) return 'Preencha obra, data, local, responsável e criador.';
  for (const [nome, t] of [['manhã', p.manha], ['tarde', p.tarde]]) {
    if (!t || !t.operacao) return 'Informe a operação da ' + nome + '.';
    if (t.operacao === 'sem_operacao' && !t.motivo_id) return 'Informe o motivo da ' + nome + ' sem operação.';
    if (t.clima === 'chuva') {
      if (t.mm === '' || t.mm === null || t.mm === undefined) return 'Informe os mm de chuva da ' + nome + '.';
      if (!t.ini || !t.fim) return 'Informe início e fim da chuva da ' + nome + '.';
      if (t.fim < t.ini) return 'O fim da chuva da ' + nome + ' não pode ser antes do início.';
    }
  }
  for (const e of (p.efetivo || [])) {
    if (!e.nome) return 'Efetivo: escolha o colaborador em todas as linhas.';
    if (e.presente === false && !e.motivo) return 'Efetivo: informe o motivo da ausência de ' + e.nome + '.';
  }
  for (const q of (p.equipamentos || [])) {
    if (!q.equipamento_id) return 'Equipamento sem código no cadastro.';
    if (q.situacao === 'operando') {
      if (!q.operador_id) return 'Informe o operador ou motorista de cada equipamento que trabalhou.';
      if (q.ini === '' || q.fim === '' || q.ini === null || q.fim === null) return 'Informe a medição inicial e final de cada equipamento que trabalhou.';
      if (Number(q.fim) < Number(q.ini)) return 'A medição final não pode ser menor que a inicial.';
    }
    if (q.situacao === 'parado') {
      if (!q.motivo_id) return 'Informe a justificativa de cada equipamento parado.';
      if (!q.periodo) return 'Informe o período em que cada equipamento parou.';
    }
    if (q.situacao === 'manutencao' && !q.motivo_texto) return 'Informe o tipo de manutenção de cada equipamento em manutenção.';
  }
  for (const a of (p.atividades || [])) {
    if (!a.nome) return 'Escolha a atividade em todas as linhas.';
    if (a.paralisada && !a.motivo_id) return 'Informe o motivo da atividade paralisada.';
  }
  for (const v of (p.eventos || [])) {
    if (['SST', 'MA', 'Q'].indexOf(v.tipo) === -1) return 'Evento com tipo inválido.';
    if (!String(v.descricao || '').trim()) return 'Descreva cada evento.';
  }
  return null;
}

/** 06h do dia seguinte ao RDO, no fuso de Brasília. */
function limiteRdo_(dataIso) {
  const [a, m, d] = dataIso.split('-').map(Number);
  const dia = new Date(Date.UTC(a, m - 1, d + 1, 6, 0, 0));
  const offset = -3; // America/Sao_Paulo (sem horário de verão desde 2019)
  return new Date(dia.getTime() - offset * 3600 * 1000);
}

/* ---------------- Check-in ---------------- */

function listarCheckin() {
  exigirUsuario_(PERFIS_RDO.concat(['lider']));
  return lerAba_('checkin_itens').map((c) => ({
    id: c.id, criador: c.criador, responsavel: c.responsavel, area: c.area, assunto: c.assunto,
    descricao: c.descricao, prioridade: c.prioridade, status: c.status, prazo: isoData_(c.prazo_atual),
    atencao: ativo_(c.atencao_especial), criado_em: textoData_(c.criado_em), origem_pauta: !!c.pauta_origem_id,
  }));
}

/** Só gerentes criam ou alteram itens do Check-in (regra combinada). */
function salvarCheckin(item) {
  const u = exigirUsuario_(PERFIS_GERENCIA);
  if (!item.assunto || !item.responsavel || !item.area) throw new Error('Preencha área, assunto e responsável.');
  if (['alta', 'media', 'baixa'].indexOf(item.prioridade) === -1) throw new Error('Prioridade inválida.');
  if (['a_fazer', 'fazendo', 'concluido', 'cancelado'].indexOf(item.status) === -1) throw new Error('Status inválido.');
  const agora = new Date().toISOString();
  if (item.id) {
    const atual = lerAba_('checkin_itens').find((x) => x.id === item.id);
    if (!atual) throw new Error('Item não encontrado.');
    if (String(atual.prazo_atual && isoData_(atual.prazo_atual)) !== String(item.prazo || '')) {
      const hist = JSON.parse(atual.historico_prazos || '[]');
      hist.push({ de: isoData_(atual.prazo_atual), para: item.prazo, por: u.email, em: agora });
      atualizarCelula_('checkin_itens', item.id, 'historico_prazos', JSON.stringify(hist));
    }
    const campos = {
      area: item.area, assunto: item.assunto, descricao: item.descricao || '', responsavel: item.responsavel,
      prioridade: item.prioridade, status: item.status, prazo_atual: item.prazo || '', atencao_especial: !!item.atencao,
    };
    Object.keys(campos).forEach((c) => atualizarCelula_('checkin_itens', item.id, c, campos[c]));
    atualizarCelula_('checkin_itens', item.id, 'atualizado_em', agora);
    if (item.status === 'concluido') atualizarCelula_('checkin_itens', item.id, 'concluido_em', agora);
    return { id: item.id };
  }
  const id = Utilities.getUuid();
  anexarLinhas_('checkin_itens', [{
    id: id, criador: u.nome, responsavel: item.responsavel, area: item.area, assunto: item.assunto, descricao: item.descricao || '',
    prioridade: item.prioridade, status: item.status || 'a_fazer', prazo_atual: item.prazo || '', historico_prazos: '[]',
    atencao_especial: !!item.atencao, concluido_em: '', criado_em: agora, atualizado_em: agora,
  }]);
  return { id: id };
}

/* ---------------- Pauta (líderes com senha própria) ---------------- */

const PAUTA_SESSAO_DIAS = 30;
const PAUTA_MAX_FALHAS = 5;
const PAUTA_BLOQUEIO_MIN = 15;
const PAUTA_SENHA_MIN = 6;
const PRIORIDADES = ['alta', 'media', 'baixa'];
const STATUS_ITENS = ['a_fazer', 'fazendo', 'concluido', 'cancelado'];

function hashSenha_(salt, texto) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + texto);
  return bytes.map((b) => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

/** Precisa criar senha: nunca criou ou não tem senha válida gravada (ex.: dados migrados). */
function precisaSenha_(l) {
  return !ativo_(l.primeiro_acesso_feito) || String(l.senha_hash || '').indexOf('$') === -1;
}

/** Nomes dos líderes para a tela de entrada. Não expõe senha. */
function listarLideresPauta() {
  return lerAba_('pauta_lideres').map((l) => ({
    id: l.id, nome: l.nome, setor: l.setor || '', funcao: l.funcao || '', primeiro: precisaSenha_(l),
  })).sort(comparaNome_);
}

/** Valida a senha do líder (ou cria no primeiro acesso) e devolve token de 30 dias. */
function entrarPauta(liderId, senha) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const l = lerAba_('pauta_lideres').find((x) => x.id === liderId);
    if (!l) throw new Error('Líder não encontrado.');
    const agora = new Date();
    const bloqueadoAte = l.bloqueado_ate ? new Date(l.bloqueado_ate) : null;
    if (bloqueadoAte && bloqueadoAte > agora) {
      throw new Error('Acesso bloqueado após senhas erradas. Tente às ' + Utilities.formatDate(bloqueadoAte, FUSO, 'HH:mm') + '.');
    }
    senha = String(senha || '');
    if (precisaSenha_(l)) {
      if (senha.length < PAUTA_SENHA_MIN) throw new Error('Crie uma senha com pelo menos ' + PAUTA_SENHA_MIN + ' caracteres.');
      const salt = Utilities.getUuid().slice(0, 8);
      atualizarCelula_('pauta_lideres', l.id, 'senha_hash', salt + '$' + hashSenha_(salt, senha));
      atualizarCelula_('pauta_lideres', l.id, 'primeiro_acesso_feito', true);
    } else {
      const partes = String(l.senha_hash || '').split('$');
      if (partes.length !== 2 || hashSenha_(partes[0], senha) !== partes[1]) {
        const falhas = (Number(l.tentativas_falhas) || 0) + 1;
        const bloqueia = falhas >= PAUTA_MAX_FALHAS;
        atualizarCelula_('pauta_lideres', l.id, 'tentativas_falhas', bloqueia ? 0 : falhas);
        if (bloqueia) atualizarCelula_('pauta_lideres', l.id, 'bloqueado_ate', new Date(agora.getTime() + PAUTA_BLOQUEIO_MIN * 60000).toISOString());
        throw new Error(bloqueia
          ? 'Senha incorreta. Acesso bloqueado por ' + PAUTA_BLOQUEIO_MIN + ' minutos.'
          : 'Senha incorreta. Tentativas restantes: ' + (PAUTA_MAX_FALHAS - falhas) + '.');
      }
    }
    atualizarCelula_('pauta_lideres', l.id, 'tentativas_falhas', 0);
    atualizarCelula_('pauta_lideres', l.id, 'bloqueado_ate', '');
    const token = Utilities.getUuid() + Utilities.getUuid();
    const expira = new Date(agora.getTime() + PAUTA_SESSAO_DIAS * 86400000);
    anexarLinhas_('pauta_sessoes', [{ token_hash: hashSenha_('token', token), lider_id: l.id, expira_em: expira.toISOString(), criado_em: agora.toISOString() }]);
    return { token: token, quem: l.nome, lider: { id: l.id, nome: l.nome, setor: l.setor || '' } };
  } finally {
    lock.releaseLock();
  }
}

/** Líder logado pelo token, se a sessão ainda valer. */
function sessaoPauta_(token) {
  if (!token) return null;
  const h = hashSenha_('token', String(token));
  const s = lerAba_('pauta_sessoes').find((x) => x.token_hash === h);
  if (!s || new Date(s.expira_em) <= new Date()) return null;
  const l = lerAba_('pauta_lideres').find((x) => x.id === s.lider_id);
  return l ? { id: l.id, nome: l.nome, setor: l.setor || '' } : null;
}

/** Quem está usando a Pauta: líder com token válido, ou usuário autorizado do sistema. */
function quemPauta_(token) {
  const lider = sessaoPauta_(token);
  if (lider) return { quem: lider.nome, lider: lider };
  const u = exigirUsuario_(PERFIS_RDO);
  return { quem: u.nome, lider: null };
}

function listarPauta(token) {
  const q = quemPauta_(token);
  const lideres = lerAba_('pauta_lideres');
  const nomePor = {};
  lideres.forEach((l) => { nomePor[l.id] = l.nome; });
  const itens = lerAba_('pauta_itens').map((x) => ({
    id: x.id, assunto: x.assunto, descricao: x.descricao || '', area: x.area, prioridade: x.prioridade,
    prazo: isoData_(x.prazo), status: x.status, criador_setor: x.criador_setor || '',
    responsavel_id: x.responsavel_id, responsavel: nomePor[x.responsavel_id] || '', responsavel_setor: x.responsavel_setor || '',
  })).sort((a, b) => (a.prazo || '9999').localeCompare(b.prazo || '9999'));
  return {
    quem: q.quem,
    itens: itens,
    lideres: lideres.map((l) => ({ id: l.id, nome: l.nome, setor: l.setor || '' })).sort(comparaNome_),
  };
}

/** Cria ou altera item da Pauta. Todo item salvo entra (ou é atualizado) no Check-in. */
function salvarPautaItem(token, item) {
  const q = quemPauta_(token);
  if (!item.assunto || !item.area || !item.responsavel_id) throw new Error('Preencha área, assunto e responsável.');
  if (!item.prazo) throw new Error('Informe o prazo.');
  if (PRIORIDADES.indexOf(item.prioridade) === -1) throw new Error('Prioridade inválida.');
  const status = item.status || 'a_fazer';
  if (STATUS_ITENS.indexOf(status) === -1) throw new Error('Status inválido.');
  const resp = lerAba_('pauta_lideres').find((l) => l.id === item.responsavel_id);
  if (!resp) throw new Error('Responsável inválido.');
  const agora = new Date().toISOString();
  const campos = {
    area: item.area, assunto: item.assunto, descricao: item.descricao || '', prioridade: item.prioridade,
    prazo: item.prazo, status: status, responsavel_id: resp.id, responsavel_setor: resp.setor || '', atualizado_em: agora,
  };
  let id = item.id;
  if (id) {
    if (!lerAba_('pauta_itens').find((x) => x.id === id)) throw new Error('Item não encontrado.');
    Object.keys(campos).forEach((c) => atualizarCelula_('pauta_itens', id, c, campos[c]));
  } else {
    id = Utilities.getUuid();
    anexarLinhas_('pauta_itens', [Object.assign({
      id: id, criador_id: q.lider ? q.lider.id : '', criador_setor: q.lider ? q.lider.setor : '',
      registrado_por: q.quem, criado_em: agora, transferido_em: '',
    }, campos)]);
  }
  espelharNoCheckin_(id, q.quem, resp.nome, campos);
  return { id: id };
}

/** Pauta → Check-in: cria o item do Check-in ligado ao item da Pauta, ou atualiza o existente. */
function espelharNoCheckin_(pautaId, criadorNome, responsavelNome, campos) {
  const agora = new Date().toISOString();
  const dados = {
    area: campos.area, assunto: campos.assunto, descricao: campos.descricao, responsavel: responsavelNome,
    prioridade: campos.prioridade, status: campos.status, prazo_atual: campos.prazo, atualizado_em: agora,
  };
  const existente = lerAba_('checkin_itens').find((x) => x.pauta_origem_id === pautaId);
  if (existente) {
    Object.keys(dados).forEach((c) => atualizarCelula_('checkin_itens', existente.id, c, dados[c]));
  } else {
    anexarLinhas_('checkin_itens', [Object.assign({
      id: Utilities.getUuid(), pauta_origem_id: pautaId, criador: criadorNome, historico_prazos: '[]',
      atencao_especial: false, concluido_em: '', criado_em: agora,
    }, dados)]);
  }
  atualizarCelula_('pauta_itens', pautaId, 'transferido_em', agora);
}

/** Gerente cadastra um líder. No primeiro acesso, o próprio líder cria a senha. */
function cadastrarLider(nome, setor, funcao) {
  exigirUsuario_(PERFIS_GERENCIA);
  nome = String(nome || '').trim();
  if (!nome) throw new Error('Informe o nome do líder.');
  const id = Utilities.getUuid();
  anexarLinhas_('pauta_lideres', [{
    id: id, nome: nome, papel: 'lider', senha_hash: '', primeiro_acesso_feito: false, criado_em: new Date().toISOString(),
    tentativas_falhas: 0, bloqueado_ate: '', setor: setor || '', funcao: funcao || '',
  }]);
  return { id: id };
}

/** Gerente zera a senha do líder e encerra as sessões dele. */
function resetarSenhaLider(liderId) {
  exigirUsuario_(PERFIS_GERENCIA);
  const agora = new Date().toISOString();
  atualizarCelula_('pauta_lideres', liderId, 'senha_hash', '');
  atualizarCelula_('pauta_lideres', liderId, 'primeiro_acesso_feito', false);
  atualizarCelula_('pauta_lideres', liderId, 'tentativas_falhas', 0);
  atualizarCelula_('pauta_lideres', liderId, 'bloqueado_ate', '');
  lerAba_('pauta_sessoes').filter((s) => s.lider_id === liderId).forEach((s) => atualizarCelula_('pauta_sessoes', s.token_hash, 'expira_em', agora));
}

/* ---------------- Cadastros ---------------- */

/**
 * obrig: campos obrigatórios · unico: campo sem repetição (entre ativos)
 * baixa: coluna de baixa lógica (lixeira = baixa, histórico fica) · usos: onde o registro é referenciado
 * (sem coluna de baixa, a lixeira só exclui se não houver uso).
 */
const CADASTROS = {
  locais: { obrig: ['nome'], unico: 'nome', baixa: '', usos: [['rdo', 'local_id'], ['rdo_atividades', 'local_id'], ['equipamento_confirmacoes', 'local_id']] },
  colaboradores: { obrig: ['nome'], unico: '', baixa: 'inativo_em', usos: [] },
  funcoes_efetivo: { obrig: ['nome'], unico: 'nome', baixa: '', usos: [['colaboradores', 'funcao', 'nome']], renomeia: ['colaboradores', 'funcao'] },
  categorias_efetivo: { obrig: ['nome', 'empresa'], unico: 'nome', baixa: '', usos: [['colaboradores', 'categoria', 'nome']], renomeia: ['colaboradores', 'categoria'] },
  equipamentos: { obrig: ['codigo', 'descricao', 'tipo'], unico: 'codigo', baixa: 'baixa_em', usos: [] },
  empresas: { obrig: ['nome'], unico: 'nome', baixa: '',
    usos: [['categorias_efetivo', 'empresa', 'nome'], ['colaboradores', 'grupo_terceiro', 'nome'], ['equipamentos', 'empresa', 'nome']],
    renomeia: [['categorias_efetivo', 'empresa'], ['colaboradores', 'grupo_terceiro'], ['equipamentos', 'empresa']] },
  especificacoes_veiculos: { obrig: ['tipo', 'nome'], unico: '', unicoCombo: ['tipo', 'nome'], baixa: '', usos: [['equipamentos', 'especificacao', 'nome']], renomeia: ['equipamentos', 'especificacao'] },
  catalogo_veiculos: { obrig: ['tipo', 'marca', 'modelo'], unico: '', unicoCombo: ['tipo', 'marca', 'modelo'], baixa: '', usos: [] },
  atividades_padrao: { obrig: ['nome'], unico: 'nome', baixa: '', usos: [['rdo_atividades', 'atividade', 'nome']] },
  unidades_medida: { obrig: ['sigla'], unico: 'sigla', baixa: '', usos: [['rdo_atividades', 'unidade_id'], ['atividades_padrao', 'unidade_id']] },
  motivos_justificativa: { obrig: ['tipo', 'descricao'], unico: '', baixa: '', usos: [['rdo', 'motivo_manha_id'], ['rdo', 'motivo_tarde_id'], ['rdo_equipamentos', 'justificativa_id'], ['rdo_atividades', 'justificativa_id']] },
};
const CAMPOS_NUMERICOS = ['ano_fabricacao', 'medicao_entrada', 'locacao_mensal', 'baixada_dias', 'num_colaboradores'];
const ROTULOS = {
  nome: 'nome', codigo: 'código', descricao: 'descrição', tipo: 'tipo', sigla: 'sigla', funcao: 'função',
  baixada_dias: 'baixada (dias)', ano_fabricacao: 'ano', medicao_entrada: 'medição na entrada', locacao_mensal: 'locação mensal',
  origem: 'origem', categoria: 'setor', empresa: 'empresa',
};
const rotulo_ = (c, tabela) => (tabela === 'equipamentos' && c === 'descricao' ? 'marca' : ROTULOS[c] || c.replace(/_/g, ' '));

/** Todos os cadastros de uma vez, sem objetos Date (datas viram AAAA-MM-DD). */
function carregarCadastros() {
  const u = exigirUsuario_(PERFIS_RDO);
  garantirAba_('empresas');
  garantirCatalogo_();
  garantirEspecificacoes_();
  const r = {};
  Object.keys(CADASTROS).forEach((t) => { r[t] = lerAba_(t).map(semDatas_); });
  const nomes = (aba) => lerAba_(aba).map((x) => String(x.nome || '')).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  r.colaboradores = r.colaboradores.map((c) => Object.assign(c, { _classe: classeFuncao_(c.funcao), _apto: motoristaApto_(c) }));
  r.categorias = nomes('categorias_efetivo');
  r.funcoes = nomes('funcoes_efetivo');
  r.listas = VALORES_PERMITIDOS;
  r.podeEditar = PERFIS_GERENCIA.indexOf(u.perfil) !== -1;
  return r;
}

/** Cria (sem id) ou altera (com id) um registro de cadastro. Só gerente. */
function salvarCadastro(tabela, reg) {
  exigirUsuario_(PERFIS_GERENCIA);
  const cfg = CADASTROS[tabela];
  if (!cfg) throw new Error('Cadastro inválido.');
  const colunas = cabecalho_(tabela);
  const dados = {};
  Object.keys(reg || {}).forEach((c) => {
    if (c === 'id' || c === 'criado_em' || c === cfg.baixa || colunas.indexOf(c) === -1) return;
    let v = reg[c];
    if (typeof v === 'string') v = v.trim();
    if (CAMPOS_NUMERICOS.indexOf(c) !== -1 && v !== '' && v !== null && v !== undefined) {
      v = Number(String(v).replace(',', '.'));
      if (isNaN(v)) throw new Error('Valor numérico inválido em ' + rotulo_(c, tabela) + '.');
    }
    if (v !== '' && !valorPermitido(tabela + '.' + c, v)) throw new Error('Valor não permitido em ' + rotulo_(c, tabela) + ': ' + v + '.');
    dados[c] = v === null || v === undefined ? '' : v;
  });
  // Empresa: nº de colaboradores inteiro e previsão de saída não anterior à entrada
  if (tabela === 'empresas') {
    if (dados.num_colaboradores !== '' && dados.num_colaboradores !== undefined && (dados.num_colaboradores < 0 || dados.num_colaboradores % 1 !== 0)) {
      throw new Error('Nº de colaboradores deve ser um número inteiro, zero ou maior.');
    }
    if (dados.data_entrada && dados.previsao_saida && String(dados.previsao_saida) < String(dados.data_entrada)) {
      throw new Error('A previsão de saída não pode ser anterior à data de entrada.');
    }
  }
  // Ano do equipamento/veículo: de 2015 a 2050
  if (tabela === 'equipamentos' && dados.ano_fabricacao !== '' && dados.ano_fabricacao !== undefined
    && (dados.ano_fabricacao < 2015 || dados.ano_fabricacao > 2050 || dados.ano_fabricacao % 1 !== 0)) {
    throw new Error('Ano deve estar entre 2015 e 2050.');
  }
  // Motorista/operador fixo: do efetivo ativo; Leve e Pesado só motorista apto; Equipamento só operador
  if (tabela === 'equipamentos' && dados.operador_id) {
    const p = lerAba_('colaboradores').find((x) => x.id === dados.operador_id && !x.inativo_em);
    const erroCondutor = condutorInvalido_(p, classeExigida_(dados.tipo));
    if (erroCondutor) throw new Error(erroCondutor);
  }
  // Equipamento de terceiro: locação não é controlada por nós
  if (tabela === 'equipamentos' && dados.origem === 'Terceiro') dados.locacao_mensal = '';
  // Efetivo sem empresa informada: usa a empresa cadastrada no setor
  if (tabela === 'colaboradores' && !dados.grupo_terceiro && dados.categoria) {
    dados.grupo_terceiro = String((lerAba_('categorias_efetivo').find((x) => x.nome === dados.categoria) || {}).empresa || '');
  }
  cfg.obrig.forEach((c) => {
    if (dados[c] === '' || dados[c] === undefined) throw new Error('Preencha o campo obrigatório: ' + rotulo_(c, tabela) + '.');
  });
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const linhas = lerAba_(tabela);
    if (cfg.unicoCombo) {
      const chave = (o) => cfg.unicoCombo.map((c) => String(o[c] || '').toLowerCase()).join('|');
      if (linhas.some((x) => x.id !== reg.id && chave(x) === chave(dados))) throw new Error('Este item já está cadastrado.');
    }
    if (cfg.unico) {
      const chave = String(dados[cfg.unico]).toLowerCase();
      const dup = linhas.find((x) => x.id !== reg.id && String(x[cfg.unico] || '').toLowerCase() === chave && !(cfg.baixa && x[cfg.baixa]));
      if (dup) throw new Error('Já existe um registro com ' + rotulo_(cfg.unico, tabela) + ' "' + dados[cfg.unico] + '".');
    }
    if (reg.id) {
      const atual = linhas.find((x) => x.id === reg.id);
      if (!atual) throw new Error('Registro não encontrado.');
      atualizarLinha_(tabela, reg.id, dados);
      // Renomear função ou setor atualiza os colaboradores que usam o nome antigo
      if (cfg.renomeia && dados.nome && String(atual.nome) !== String(dados.nome)) {
        const pares = Array.isArray(cfg.renomeia[0]) ? cfg.renomeia : [cfg.renomeia];
        pares.forEach((p) => renomearReferencias_(p[0], p[1], atual.nome, dados.nome));
      }
      return { id: reg.id };
    }
    const id = Utilities.getUuid();
    if (tabela === 'locais' && !dados.projeto_id) dados.projeto_id = (lerAba_('projetos')[0] || {}).id || '';
    anexarLinhas_(tabela, [Object.assign({ id: id, criado_em: new Date().toISOString() }, dados)]);
    return { id: id };
  } finally {
    lock.releaseLock();
  }
}

/** Lixeira: baixa lógica quando a tabela tem coluna de baixa; senão exclui, se não estiver em uso. */
function excluirCadastro(tabela, id) {
  exigirUsuario_(PERFIS_GERENCIA);
  const cfg = CADASTROS[tabela];
  if (!cfg) throw new Error('Cadastro inválido.');
  const reg = lerAba_(tabela).find((x) => x.id === id);
  if (!reg) throw new Error('Registro não encontrado.');
  if (cfg.baixa) {
    const dados = {};
    dados[cfg.baixa] = isoData_(new Date());
    atualizarLinha_(tabela, id, dados);
    return { baixa: true };
  }
  cfg.usos.forEach((u) => {
    const valor = String(reg[u[2] || 'id']);
    if (lerAba_(u[0]).some((x) => String(x[u[1]]) === valor)) {
      throw new Error('Não é possível excluir: está em uso em ' + ({ rdo: 'RDO', rdo_atividades: 'atividades do RDO', rdo_equipamentos: 'equipamentos do RDO', atividades_padrao: 'atividades padrão', equipamento_confirmacoes: 'confirmação de equipamentos', colaboradores: 'efetivo', categorias_efetivo: 'setores', equipamentos: 'equipamentos e veículos' }[u[0]] || u[0]) + '.');
    }
  });
  excluirLinha_(tabela, id);
  return { excluido: true };
}

/** Troca um texto antigo pelo novo numa coluna inteira (uma gravação só). */
function renomearReferencias_(nome, coluna, antigo, novo) {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nome);
  const ultima = ultimaLinha_(aba);
  if (ultima < 2) return;
  const ci = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0].map(String).indexOf(coluna);
  if (ci < 0) return;
  const faixa = aba.getRange(2, ci + 1, ultima - 1, 1);
  const vals = faixa.getValues();
  let mudou = false;
  vals.forEach((r) => { if (String(r[0]) === String(antigo)) { r[0] = novo; mudou = true; } });
  if (mudou) faixa.setValues(vals);
}

/** Classe pela função: "operador" ou "motorista" (vazio para as demais). */
function classeFuncao_(funcao) {
  const f = String(funcao || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  if (f.indexOf('operador') === 0) return 'operador';
  if (f.indexOf('motorista') === 0) return 'motorista';
  return '';
}

/** Veículo leve e pesado (caminhão): motorista. Máquinas e equipamentos: operador. */
function classeExigida_(tipoEquipamento) {
  return tipoEquipamento === 'Equipamento' ? 'operador' : 'motorista';
}

/** Cabeçalho real da aba (permite colunas novas sem alterar o Codigo.gs). */
function cabecalho_(nome) {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nome);
  return aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0].map(String).filter(Boolean);
}

/** Cria a aba catalogo_veiculos e preenche cada tipo da lista base (CATALOGO_PADRAO) que ainda não tem itens. */
function garantirCatalogo_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let aba = ss.getSheetByName('catalogo_veiculos');
  if (!aba) {
    aba = ss.insertSheet('catalogo_veiculos');
    aba.getRange(1, 1, 1, TABELAS.catalogo_veiculos.length).setValues([TABELAS.catalogo_veiculos]);
    aba.setFrozenRows(1);
  }
  const existentes = lerAba_('catalogo_veiculos');
  const agora = new Date().toISOString();
  const linhas = [];
  Object.keys(CATALOGO_PADRAO).forEach((tipo) => {
    if (existentes.some((x) => x.tipo === tipo)) return;
    const lista = CATALOGO_PADRAO[tipo];
    Object.keys(lista).forEach((marca) => {
      lista[marca].forEach((modelo) => linhas.push([Utilities.getUuid(), tipo, marca, modelo, agora]));
    });
  });
  if (linhas.length) aba.getRange(ultimaLinha_(aba) + 1, 1, linhas.length, 5).setValues(linhas);
}

/** Cria a aba especificacoes_veiculos e preenche cada tipo de ESPECIFICACOES_PADRAO que ainda não tem itens. */
function garantirEspecificacoes_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let aba = ss.getSheetByName('especificacoes_veiculos');
  if (!aba) {
    aba = ss.insertSheet('especificacoes_veiculos');
    aba.getRange(1, 1, 1, TABELAS.especificacoes_veiculos.length).setValues([TABELAS.especificacoes_veiculos]);
    aba.setFrozenRows(1);
  }
  const existentes = lerAba_('especificacoes_veiculos');
  const agora = new Date().toISOString();
  const linhas = [];
  Object.keys(ESPECIFICACOES_PADRAO).forEach((tipo) => {
    if (existentes.some((x) => x.tipo === tipo)) return;
    ESPECIFICACOES_PADRAO[tipo].forEach((nome) => linhas.push([Utilities.getUuid(), tipo, nome, agora]));
  });
  if (linhas.length) aba.getRange(ultimaLinha_(aba) + 1, 1, linhas.length, 4).setValues(linhas);
}

/** Cria a aba com o cabeçalho de TABELAS, se ainda não existir. */
function garantirAba_(nome) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getSheetByName(nome)) return;
  const aba = ss.insertSheet(nome);
  aba.getRange(1, 1, 1, TABELAS[nome].length).setValues([TABELAS[nome]]);
  aba.setFrozenRows(1);
}

function semDatas_(o) {
  const s = {};
  Object.keys(o).forEach((k) => { s[k] = o[k] instanceof Date ? isoData_(o[k]) : o[k]; });
  return s;
}

/* ---------------- Ferramentas da planilha ---------------- */

/** Cria a aba de usuários (rode uma vez). Depois, preencha com os e-mails autorizados. */
function criarAbaUsuarios() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let aba = ss.getSheetByName('usuarios');
  if (!aba) aba = ss.insertSheet('usuarios');
  if (aba.getRange(1, 1).getValue() === '') {
    aba.getRange(1, 1, 1, 5).setValues([['email', 'nome', 'perfil', 'ativo', 'criado_em']]);
    aba.setFrozenRows(1);
  }
}

/* ---------------- Utilitários ---------------- */

function lerAba_(nome) {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nome);
  if (!aba) throw new Error('Aba não encontrada: ' + nome);
  const v = aba.getDataRange().getValues();
  if (v.length < 2) return [];
  const cab = v[0].map(String);
  // A primeira coluna é sempre a chave do registro; célula só com FALSE (caixa de seleção) não conta como linha.
  return v.slice(1).filter((r) => r[0] !== '' && r[0] !== null).map((r) => {
    const o = {};
    cab.forEach((c, i) => { o[c] = r[i]; });
    return o;
  });
}

function anexarLinhas_(nome, objetos) {
  if (!objetos.length) return;
  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nome);
  const cab = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0].map(String);
  const linhas = objetos.map((o) => cab.map((c) => (o[c] === undefined || o[c] === null ? '' : o[c])));
  aba.getRange(ultimaLinha_(aba) + 1, 1, linhas.length, cab.length).setValues(linhas);
}

/** Última linha com chave na coluna A (getLastRow conta caixas de seleção e valores soltos). */
function ultimaLinha_(aba) {
  const v = aba.getRange(1, 1, aba.getMaxRows(), 1).getValues();
  let i = v.length - 1;
  while (i > 0 && (v[i][0] === '' || v[i][0] === null)) i--;
  return i + 1;
}

function atualizarCelula_(nome, id, coluna, valor) {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nome);
  const v = aba.getDataRange().getValues();
  const cab = v[0].map(String);
  const ci = cab.indexOf(coluna);
  const ri = v.findIndex((r, i) => i > 0 && String(r[0]) === String(id));
  if (ri > 0 && ci >= 0) aba.getRange(ri + 1, ci + 1).setValue(valor);
}

/** Atualiza vários campos de uma linha numa única gravação. */
function atualizarLinha_(nome, id, dados) {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nome);
  const v = aba.getDataRange().getValues();
  const cab = v[0].map(String);
  const ri = v.findIndex((r, i) => i > 0 && String(r[0]) === String(id));
  if (ri < 1) throw new Error('Registro não encontrado.');
  const linha = v[ri].slice();
  Object.keys(dados).forEach((c) => { const ci = cab.indexOf(c); if (ci >= 0) linha[ci] = dados[c]; });
  aba.getRange(ri + 1, 1, 1, linha.length).setValues([linha]);
}

/** Remove a linha do registro (só para cadastros sem uso). */
function excluirLinha_(nome, id) {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nome);
  const v = aba.getRange(1, 1, ultimaLinha_(aba), 1).getValues();
  const ri = v.findIndex((r, i) => i > 0 && String(r[0]) === String(id));
  if (ri > 0) aba.deleteRow(ri + 1);
}

function ativo_(v) {
  return v === true || String(v).toUpperCase() === 'TRUE';
}

function isoData_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, FUSO, 'yyyy-MM-dd');
  const t = String(v || '').trim();
  const br = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return br[3] + '-' + br[2] + '-' + br[1];
  return t.slice(0, 10);
}

/** Mensagem de erro se a pessoa não pode conduzir (motorista: CNH e direção defensiva em dia; operador: função "Operador …"). */
function condutorInvalido_(p, precisa) {
  if (!p) return 'escolha um ' + precisa + ' ativo do Efetivo.';
  if (precisa === 'motorista' && !motoristaApto_(p)) return p.nome + ' está sem CNH ou direção defensiva em dia.';
  if (precisa === 'operador' && classeFuncao_(p.funcao) !== 'operador') return p.nome + ' não tem função de operador.';
  return '';
}

/** Pode dirigir: qualquer função, com CNH (número e validade em dia) e direção defensiva em dia. */
function motoristaApto_(c) {
  const hoje = isoData_(new Date());
  const cnh = isoData_(c.cnh_validade);
  const dd = isoData_(c.direcao_defensiva_validade);
  return !!String(c.cnh_numero || '').trim() && !!cnh && cnh >= hoje && !!dd && dd >= hoje;
}

/** Data e hora como texto. A tela não recebe objetos Date (o Google devolve vazio se houver algum). */
function textoData_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, FUSO, 'dd/MM/yyyy HH:mm');
  return String(v || '');
}

function comparaNome_(a, b) {
  return String(a.nome).localeCompare(String(b.nome), 'pt-BR', { numeric: true, sensitivity: 'base' });
}
