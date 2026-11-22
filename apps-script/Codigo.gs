/**
 * GESTÃO GRANSUL · Apps Script (projeto independente da planilha JC)
 *
 * Origem: estrutura e regras do Supabase do Gestão (projeto lphyuamltspbczsutwyq),
 * levantadas em 20/11/2026. Este arquivo é só documentação + criação das abas.
 * Nenhum dado é copiado do Supabase.
 *
 * Como usar:
 *   1. Abrir a planilha "Gestão GranSul" > Extensões > Apps Script.
 *   2. Colar este código, salvar.
 *   3. Rodar criarAbas() uma vez (autorizar quando pedir).
 */

const PROJETO_ORIGEM = 'Supabase · lphyuamltspbczsutwyq (Gestão)';

/* ------------------------------------------------------------------
 * 1. TABELAS (uma aba por tabela, cabeçalho na linha 1)
 *    Formato: nome da aba -> colunas, na ordem do Supabase.
 * ------------------------------------------------------------------ */
const TABELAS = {
  unidades_medida: ['id', 'sigla', 'descricao', 'criado_em'],
  projetos: ['id', 'nome', 'criado_em', 'descricao', 'valor_contrato', 'inicio', 'termino', 'cliente', 'empresa_executante'],
  locais: ['id', 'projeto_id', 'nome', 'criado_em'],
  motivos_justificativa: ['id', 'tipo', 'descricao', 'criado_em'],
  rdo: ['id', 'data', 'projeto_id', 'frente', 'encarregado', 'apontador', 'lancado_em', 'lancado_por', 'atrasado', 'substituido_por', 'clima_manha', 'operacao_manha', 'motivo_manha_id', 'clima_tarde', 'operacao_tarde', 'motivo_tarde_id', 'local_id', 'local_descricao', 'observacoes', 'chuva_mm_manha', 'chuva_mm_tarde', 'chuva_inicio_manha', 'chuva_fim_manha', 'chuva_inicio_tarde', 'chuva_fim_tarde'],
  rdo_efetivo: ['id', 'rdo_id', 'colaborador', 'categoria', 'presente', 'motivo_ausencia', 'grupo_terceiro'],
  rdo_equipamentos: ['id', 'rdo_id', 'equipamento_codigo', 'operador', 'status', 'horimetro', 'justificativa_id', 'descricao', 'equipamento_id', 'operador_id', 'medicao_inicial', 'medicao_final', 'manutencao_tipo', 'parado_manha', 'parado_tarde'],
  rdo_atividades: ['id', 'rdo_id', 'atividade', 'unidade_id', 'local_id', 'quantidade', 'paralisada', 'justificativa_id', 'descricao'],
  rdo_eventos: ['id', 'rdo_id', 'tipo', 'descricao', 'providencias', 'criado_em'],
  rdo_fotos: ['id', 'rdo_id', 'caminho', 'legenda', 'criado_em'],
  rdo_paralisacoes: ['id', 'rdo_id', 'motivo_id', 'descricao', 'criado_em', 'periodo', 'hora_inicio', 'hora_fim'],
  checkin_itens: ['id', 'pauta_origem_id', 'criador', 'responsavel', 'area', 'assunto', 'descricao', 'prioridade', 'status', 'prazo_atual', 'historico_prazos', 'atencao_especial', 'concluido_em', 'criado_em', 'atualizado_em'],
  pauta_lideres: ['id', 'nome', 'papel', 'senha_hash', 'primeiro_acesso_feito', 'criado_em', 'tentativas_falhas', 'bloqueado_ate', 'setor', 'funcao'],
  pauta_itens: ['id', 'criador_id', 'responsavel_id', 'area', 'assunto', 'descricao', 'prioridade', 'prazo', 'status', 'transferido_em', 'criado_em', 'atualizado_em', 'criador_setor', 'responsavel_setor', 'registrado_por'],
  pauta_sessoes: ['token_hash', 'lider_id', 'expira_em', 'criado_em'],
  cargos: ['id', 'nome', 'perfil', 'responde_a_id', 'ativo', 'criado_em'],
  pessoas: ['id', 'nome', 'cargo_id', 'ativo', 'criado_em'],
  colaboradores: ['id', 'nome', 'matricula', 'funcao', 'categoria', 'grupo_terceiro', 'inativo_em', 'criado_em', 'apto_rdo', 'data_contrato', 'baixada_dias', 'cnh_numero', 'cnh_validade', 'direcao_defensiva_validade'],
  categorias_efetivo: ['id', 'nome', 'criado_em', 'terceiro', 'empresa'],
  funcoes_efetivo: ['id', 'nome', 'criado_em'],
  operadores: ['id', 'matricula', 'nome', 'funcao', 'empresa', 'cnh_numero', 'cnh_validade', 'direcao_defensiva_validade', 'baixa_em', 'criado_em'],
  equipamentos: ['id', 'codigo', 'descricao', 'tipo', 'origem', 'empresa', 'data_entrada', 'ano_fabricacao', 'medicao_entrada', 'prox_preventiva', 'prox_lavacao', 'locacao_mensal', 'baixa_em', 'criado_em', 'modelo'],
  equipamento_operadores: ['equipamento_id', 'operador_id'],
  equipamento_historico: ['id', 'equipamento_id', 'data', 'tipo', 'descricao', 'operador_id', 'custo', 'medicao', 'criado_em'],
  equipamento_confirmacoes: ['id', 'data', 'local_id', 'responsavel', 'equipamento_id', 'operador_id', 'status', 'justificativa_id', 'manutencao_tipo', 'parado_manha', 'parado_tarde', 'observacao', 'atualizado_em'],
  atividades_padrao: ['id', 'nome', 'unidade_id', 'criado_em'],
};

/* ------------------------------------------------------------------
 * 2. CHAVES E VALORES PERMITIDOS (checks do Supabase)
 * ------------------------------------------------------------------ */
const VALORES_PERMITIDOS = {
  'motivos_justificativa.tipo': ['dia_sem_execucao', 'equipamento_parado', 'atividade_paralisada'],
  'rdo.clima_manha': ['sol', 'nublado', 'chuva'],
  'rdo.clima_tarde': ['sol', 'nublado', 'chuva'],
  'rdo.operacao_manha': ['operacao', 'sem_operacao'],
  'rdo.operacao_tarde': ['operacao', 'sem_operacao'],
  'rdo_efetivo.motivo_ausencia': ['falta', 'atestado', 'folga', 'baixada', 'ferias'],
  'rdo_equipamentos.status': ['operando', 'parado', 'manutencao'],
  'rdo_equipamentos.manutencao_tipo': ['Preventiva', 'Lavação', 'Outra manutenção programada'],
  'rdo_eventos.tipo': ['SST', 'MA', 'Q'],
  'rdo_paralisacoes.periodo': ['manha', 'tarde'],
  'checkin_itens.prioridade': ['alta', 'media', 'baixa'],
  'checkin_itens.status': ['a_fazer', 'fazendo', 'concluido', 'cancelado'],
  'pauta_itens.prioridade': ['alta', 'media', 'baixa'],
  'pauta_itens.status': ['a_fazer', 'fazendo', 'concluido', 'cancelado'],
  'cargos.perfil': ['acesso_total', 'lider'],
  'operadores.funcao': ['Operador de equipamento', 'Motorista de caminhão', 'Motorista de veículo leve'],
  'equipamentos.tipo': ['Equipamento', 'Caminhão', 'Leve'],
  'equipamentos.origem': ['Própria', 'Terceiro', 'Locado'],
  'equipamento_historico.tipo': ['Preventiva', 'Corretiva', 'Quebra', 'Lavação', 'Outra'],
  'equipamento_confirmacoes.status': ['operando', 'parado', 'manutencao'],
  'equipamento_confirmacoes.manutencao_tipo': ['Preventiva', 'Lavação', 'Outra manutenção programada'],
  'colaboradores.baixada_dias': [30, 45, 60, 90],
};

/* ------------------------------------------------------------------
 * 3. REGRAS DE NEGÓCIO (vindas das decisões tomadas com o usuário)
 * ------------------------------------------------------------------ */
const REGRAS = [
  // RDO
  'RDO: um por obra, local e dia. Lançar de novo no mesmo dia substitui o anterior (campo substituido_por). Nada é apagado.',
  'RDO atrasado: lançado depois das 06:00 do dia seguinte fica marcado como atrasado. Depois disso o RDO trava.',
  'RDO: local, responsável pelo local e criador são obrigatórios. Criador vem da lista de encarregado, supervisor, coordenador, engenheiro ou apontador.',
  'RDO clima: se o período estiver com chuva, informar mm e início e fim da chuva. Fim não pode ser antes do início.',
  'RDO eventos: tipo SST, MA ou Q; descrição obrigatória.',
  // Efetivo
  'Efetivo: colaborador tem data de contrato. E45 e E90 são data do contrato + 45 e + 90 dias corridos.',
  'Efetivo baixada: 30, 45, 60 ou 90 dias. A regra por função e origem AINDA NÃO FOI DEFINIDA.',
  'Efetivo "Dar baixa" tira a pessoa do efetivo a partir de hoje; o histórico fica. Exclusão apaga o cadastro.',
  'Importação RH (CSV): matrícula ativa existente atualiza nome, função, setor, empresa e data do contrato; com baixa é ignorada; quem não está no arquivo não muda; setor precisa existir. REGRA PADRÃO, A CONFIRMAR.',
  // Equipamentos
  'Diária do equipamento = locação mensal ÷ 30.',
  'Locação mensal cobre 30 dias.',
  'Parada por quebra (status parado): cada meio período parado (manhã ou tarde) desconta 0,5 diária.',
  'Medição do mês = (30 − dias parados) ÷ 30 × locação mensal.',
  'Manutenção (preventiva, lavação, outra manutenção programada): não desconta do valor integral da medição.',
  'Próxima preventiva e próxima lavação são datas marcadas pelo DMV, não calculadas pelo sistema.',
  'Utilização do mês = horas trabalhadas ÷ 220 h. Horas = medição final − medição inicial, somente em status operando.',
  'Equipamento operando exige operador e medição inicial e final (final não pode ser menor que inicial).',
  'Equipamento parado exige justificativa (motivo de equipamento_parado) e período (manhã, tarde ou ambos).',
  'Equipamento em manutenção exige o tipo de manutenção.',
  // Operadores
  'Operadores e motoristas são cadastrados no Efetivo. A função define o tipo: começa com "Operador" ou com "Motorista". A aba operadores não é mais usada.',
  'No RDO, caminhão e veículo leve recebem motorista; máquinas e equipamentos recebem operador. Lista em ordem alfabética.',
  'Operador de equipamento só pode ser escolhido para o equipamento em que está especializado (vínculo ainda não implementado).',
  'Motorista de caminhão: CNH em dia e especializado no caminhão.',
  'Todo motorista (caminhão ou veículo leve): CNH e direção defensiva em dia. Operador de equipamento não precisa de direção defensiva.',
  'Motorista de veículo leve: habilitado para todos os leves com CNH e direção defensiva em dia.',
  // Atividades
  'Atividade do RDO: escolhida da lista de atividades padrão. Unidade padrão preenche sozinha.',
  'Motivo de atividade paralisada: lista inclui atividade_paralisada e dia_sem_execucao (ex.: Chuva).',
  // Pauta e check-in
  'Pauta: item tem criador, responsável, setor, área, prioridade, prazo e status (a_fazer, fazendo, concluido, cancelado).',
  'Líderes entram na Pauta com senha própria. Após 5 senhas erradas, bloqueio de 15 minutos. Sessão dura 30 dias.',
  'Check-in: item com prazo atual, histórico de prazos e atenção especial.',
];

/* ------------------------------------------------------------------
 * 4. INSTRUÇÕES DE OPERAÇÃO
 * ------------------------------------------------------------------ */
const INSTRUCOES = [
  'Cadastros primeiro: unidades, locais, motivos, setores, funções, efetivo (inclui operadores e motoristas), equipamentos, atividades padrão.',
  'Confirmação diária de equipamentos: por data, local e responsável. Gera o resumo do RDO.',
  'RDO: escolher obra, data, local, responsável e criador. Lançar efetivo, atividades, eventos e fotos.',
  'Não apagar linhas de tabela de histórico (rdo, rdo_*, equipamento_historico, equipamento_confirmacoes). Usar substituição ou baixa.',
  'Chaves (id) são geradas pelo sistema. Não editar a coluna id à mão.',
  'Datas no formato AAAA-MM-DD na planilha. Valores decimais com ponto.',
];

/* ------------------------------------------------------------------
 * 5. FUNÇÕES
 * ------------------------------------------------------------------ */

/** Cria uma aba por tabela, com o cabeçalho. Não apaga nada que já existe. */
function criarAbas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(TABELAS).forEach((nome) => {
    let aba = ss.getSheetByName(nome);
    if (!aba) aba = ss.insertSheet(nome);
    const colunas = TABELAS[nome];
    const atual = aba.getRange(1, 1, 1, colunas.length).getValues()[0];
    const vazio = atual.every((c) => c === '');
    if (vazio) aba.getRange(1, 1, 1, colunas.length).setValues([colunas]);
    aba.setFrozenRows(1);
  });
  criarAbaRegras();
}

/** Aba LEIA-ME com regras e instruções, para consulta na própria planilha. */
function criarAbaRegras() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let aba = ss.getSheetByName('LEIA-ME');
  if (!aba) aba = ss.insertSheet('LEIA-ME', 0);
  aba.clear();
  const linhas = [['Gestão GranSul · origem: ' + PROJETO_ORIGEM], [''], ['REGRAS']]
    .concat(REGRAS.map((r) => [r]))
    .concat([[''], ['INSTRUÇÕES']])
    .concat(INSTRUCOES.map((i) => [i]));
  aba.getRange(1, 1, linhas.length, 1).setValues(linhas);
}

/** Valida um valor contra a lista permitida de uma coluna. Usar em scripts de importação. */
function valorPermitido(tabelaColuna, valor) {
  const lista = VALORES_PERMITIDOS[tabelaColuna];
  if (!lista) return true;
  return valor === '' || valor === null || lista.indexOf(valor) !== -1;
}
