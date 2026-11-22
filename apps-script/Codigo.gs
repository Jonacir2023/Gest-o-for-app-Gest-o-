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
  equipamentos: ['id', 'codigo', 'descricao', 'tipo', 'origem', 'empresa', 'data_entrada', 'ano_fabricacao', 'medicao_entrada', 'prox_preventiva', 'prox_lavacao', 'locacao_mensal', 'baixa_em', 'criado_em', 'modelo', 'especificacao'],
  equipamento_operadores: ['equipamento_id', 'operador_id'],
  equipamento_historico: ['id', 'equipamento_id', 'data', 'tipo', 'descricao', 'operador_id', 'custo', 'medicao', 'criado_em'],
  equipamento_confirmacoes: ['id', 'data', 'local_id', 'responsavel', 'equipamento_id', 'operador_id', 'status', 'justificativa_id', 'manutencao_tipo', 'parado_manha', 'parado_tarde', 'observacao', 'atualizado_em'],
  atividades_padrao: ['id', 'nome', 'unidade_id', 'criado_em'],
  catalogo_veiculos: ['id', 'tipo', 'marca', 'modelo', 'criado_em'],
  especificacoes_veiculos: ['id', 'tipo', 'nome', 'criado_em'],
  empresas: ['id', 'nome', 'especialidade_1', 'especialidade_2', 'especialidade_3', 'num_colaboradores', 'data_entrada', 'previsao_saida', 'criado_em'],
};

/** Especificações por tipo (lista do usuário de 22/11/2026). Preenche a aba especificacoes_veiculos por tipo, uma vez. */
const ESPECIFICACOES_PADRAO = {
  Leve: ['Carro', 'Pickup', 'Caminhonete'],
  Pesado: ['Caminhão 3/4', 'Caminhão Carga Seca', 'Caminhão Caçamba', 'Caminhão Munck', 'Caminhão Pipa'],
  Equipamento: ['Retroescavadeira', 'Escavadeira', 'Mini Escavadeira', 'Pá Carregadeira', 'Minicarregadeira', 'Trator Agrícola',
    'Trator Esteira', 'Motoniveladora', 'Rolo Liso', 'Rolo Tandem', 'Rolo de Pneus', 'Guindaste',
    'Perfuratriz Hélice Contínua', 'Perfuratriz Sondagem'],
};

/**
 * Catálogo inicial de veículos leves (carros, SUVs e picapes vendidos no Brasil, modelos comuns em frotas de locadoras).
 * Lista base complementada com os modelos de referência das frotas Localiza e Movida (categorias "ou similar",
 * levantadas pelo usuário em 22/11/2026).
 * Usada só para preencher a aba catalogo_veiculos quando ela está vazia; depois, edite em Cadastros > Marcas e modelos.
 */
const CATALOGO_LEVES = {
  BYD: ['Dolphin', 'Dolphin Mini', 'King', 'Seal', 'Shark', 'Song Plus', 'Song Pro', 'Yuan Plus'],
  'Caoa Chery': ['Arrizo 6', 'Tiggo 5x', 'Tiggo 7', 'Tiggo 8'],
  Chevrolet: ['Cruze', 'Montana', 'Onix', 'Onix Plus', 'S10', 'Spin', 'Tracker', 'Trailblazer'],
  'Citroën': ['Basalt', 'C3', 'C3 Aircross', 'C4 Cactus'],
  Fiat: ['500e', 'Argo', 'Cronos', 'Fastback', 'Fiorino', 'Grand Siena', 'Mobi', 'Pulse', 'Strada', 'Titano', 'Toro'],
  Ford: ['Bronco Sport', 'Maverick', 'Ranger', 'Territory'],
  GWM: ['Haval H6', 'Ora 03'],
  Honda: ['City', 'City Hatchback', 'Civic', 'HR-V', 'WR-V', 'ZR-V'],
  Hyundai: ['Creta', 'HB20', 'HB20S', 'Tucson'],
  Jeep: ['Commander', 'Compass', 'Renegade'],
  Kia: ['Sportage', 'Stonic'],
  MINI: ['Cooper'],
  Mitsubishi: ['Eclipse Cross', 'L200 Triton', 'Outlander Sport', 'Pajero Sport'],
  Nissan: ['Frontier', 'Kicks', 'Leaf', 'Sentra', 'Versa'],
  Peugeot: ['208', '2008', '3008', 'e-Expert'],
  RAM: ['1500', 'Rampage'],
  Renault: ['Duster', 'Kangoo', 'Kardian', 'Kwid', 'Oroch', 'Stepway'],
  Toyota: ['Corolla', 'Corolla Cross', 'Hilux', 'SW4', 'Yaris Cross'],
  Volkswagen: ['Amarok', 'Gol', 'Nivus', 'Polo', 'Saveiro', 'T-Cross', 'Taos', 'Tera', 'Tiguan', 'Virtus', 'Voyage'],
};

/** Caminhões vendidos no Brasil (lista do usuário de 22/11/2026; Mercedes-Benz, Volkswagen, Scania e DAF completadas com as linhas atuais). */
const CATALOGO_CAMINHOES = {
  Agrale: ['A 7500', 'A 8700', 'A 10000', 'A 15.000', 'A 18.000', 'Marruá'],
  BYD: ['eT3', 'eT5', 'eT7', 'eT8'],
  DAF: ['CF', 'XF', 'XG', 'XG+'],
  Foton: ['Aumark S', 'Auman D', 'eAumark', 'eGalaxus', 'eWonder', 'Galaxus R9'],
  Hyundai: ['HD 80', 'HR'],
  Iveco: ['Daily', 'eDaily', 'S-Way', 'T-Way', 'Tector', 'Trakker', 'X-Way'],
  JAC: ['A 18.290', 'A 25.290', 'iEV1200T', 'N 9.170', 'N 13.210'],
  Kia: ['Bongo K2500'],
  MAN: ['TGX'],
  'Mercedes-Benz': ['Accelo', 'Actros', 'Arocs', 'Atego', 'eActros'],
  Scania: ['Série G', 'Série P', 'Série R', 'Série S', 'XT'],
  Sitrak: ['C7H'],
  Volkswagen: ['Constellation', 'Delivery', 'e-Delivery', 'Meteor'],
  Volvo: ['FH', 'FH Electric', 'FM', 'FM Electric', 'FMX', 'VM'],
  XCMG: ['E7-18T', 'E7-29R', 'E7-49T'],
};

/**
 * Máquinas e equipamentos de obra vendidos no Brasil (lista base, revisar em Cadastros > Marcas e modelos).
 * O modelo leva o tipo da máquina no nome, para a lista sair agrupada (Escavadeira, Rolo, Trator...).
 */
const CATALOGO_EQUIPAMENTOS = {
  Bobcat: ['Mini escavadeira E26', 'Minicarregadeira S450', 'Minicarregadeira S650'],
  Bomag: ['Rolo de pneus BW 24 RH', 'Rolo liso BW 211 D', 'Rolo tandem BW 120'],
  Case: ['Minicarregadeira SR175', 'Motoniveladora 845B', 'Motoniveladora 865B', 'Pá carregadeira 721F', 'Retroescavadeira 580N'],
  Caterpillar: ['Escavadeira 320', 'Escavadeira 336', 'Mini escavadeira 302', 'Minicarregadeira 226', 'Minicarregadeira 262',
    'Motoniveladora 120', 'Motoniveladora 140', 'Pá carregadeira 924', 'Pá carregadeira 950', 'Retroescavadeira 416',
    'Rolo liso CS54', 'Trator de esteira D6', 'Trator de esteira D8'],
  Dynapac: ['Rolo de pneus CP274', 'Rolo liso CA250', 'Rolo tandem CC1200'],
  Grove: ['Guindaste GMK 5250', 'Guindaste RT540E'],
  Hamm: ['Rolo de pneus GRW 280', 'Rolo liso 3411', 'Rolo tandem HD 14'],
  Hyundai: ['Escavadeira HX220', 'Pá carregadeira HL760'],
  JCB: ['Escavadeira JS220', 'Mini escavadeira 8026', 'Minicarregadeira 155', 'Retroescavadeira 3CX', 'Retroescavadeira 4CX'],
  'John Deere': ['Escavadeira 210G', 'Escavadeira 250G', 'Minicarregadeira 332G', 'Motoniveladora 670G', 'Pá carregadeira 524K',
    'Pá carregadeira 624K', 'Retroescavadeira 310L', 'Trator agrícola 5078E', 'Trator agrícola 6125J', 'Trator de esteira 750J'],
  Komatsu: ['Escavadeira PC200', 'Escavadeira PC300', 'Motoniveladora GD555', 'Pá carregadeira WA320', 'Trator de esteira D61', 'Trator de esteira D65'],
  Liebherr: ['Guindaste LTM 1060', 'Guindaste LTM 1100'],
  LiuGong: ['Escavadeira 922F', 'Pá carregadeira 856H'],
  'Massey Ferguson': ['Trator agrícola MF 4292', 'Trator agrícola MF 4707'],
  'New Holland': ['Motoniveladora RG140B', 'Retroescavadeira B95B', 'Retroescavadeira B110B', 'Trator agrícola T6', 'Trator agrícola T7'],
  Sany: ['Escavadeira SY135C', 'Escavadeira SY215C', 'Guindaste STC500'],
  Tadano: ['Guindaste GR-500XL'],
  Valtra: ['Trator agrícola A114', 'Trator agrícola BH180'],
  Volvo: ['Escavadeira EC220', 'Escavadeira EC300', 'Pá carregadeira L90', 'Pá carregadeira L120'],
  XCMG: ['Escavadeira XE215', 'Motoniveladora GR1803', 'Pá carregadeira LW300', 'Rolo liso XS123'],
};

/** Lista base por tipo: cada tipo é preenchido na aba catalogo_veiculos quando ainda não tem nenhum item. */
const CATALOGO_PADRAO = { Leve: CATALOGO_LEVES, Pesado: CATALOGO_CAMINHOES, Equipamento: CATALOGO_EQUIPAMENTOS };

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
  'equipamentos.tipo': ['Leve', 'Pesado', 'Equipamento'],
  'equipamentos.origem': ['Própria', 'Terceiro', 'Locado'],
  'catalogo_veiculos.tipo': ['Leve', 'Pesado', 'Equipamento'],
  'especificacoes_veiculos.tipo': ['Leve', 'Pesado', 'Equipamento'],
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
  'Locação mensal cobre 30 dias. Só se aplica a equipamento de origem Própria ou Locado; de Terceiro não é controlada.',
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
  'Tipos de veículo: Leve (carros e picapes), Pesado (caminhões) e Equipamento (máquinas). No RDO, Leve e Pesado recebem motorista; máquinas e equipamentos recebem operador. Lista em ordem alfabética.',
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
