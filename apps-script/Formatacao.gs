/**
 * GESTÃO GRANSUL · Formatação profissional das abas
 * Arquivo "Formatacao.gs" do mesmo projeto do Codigo.gs e do Servidor.gs.
 *
 * Como usar: no editor do Apps Script, selecione prepararPlanilha() e clique em Executar.
 * É idempotente: pode rodar de novo sem duplicar nada.
 * Depende de TABELAS e VALORES_PERMITIDOS (Codigo.gs) e de criarAbaUsuarios() (Servidor.gs).
 */

const COR_CABECALHO = '#24374B';
const COR_TEXTO_CABECALHO = '#FFFFFF';
const COR_ID = '#879797';
const COR_ALERTA_FUNDO = '#F8E5E3';
const COR_ALERTA_TEXTO = '#B3261E';
const COR_AVISO_FUNDO = '#FFF4D6';

const GRUPO_COR = {
  rdo: '#1C94C4', rdo_efetivo: '#1C94C4', rdo_equipamentos: '#1C94C4', rdo_atividades: '#1C94C4',
  rdo_eventos: '#1C94C4', rdo_fotos: '#1C94C4', rdo_paralisacoes: '#1C94C4',
  checkin_itens: '#7A5200', pauta_itens: '#7A5200', pauta_lideres: '#7A5200', pauta_sessoes: '#7A5200',
  colaboradores: '#1E6B52', categorias_efetivo: '#1E6B52', funcoes_efetivo: '#1E6B52',
  operadores: '#6B7A88', equipamentos: '#6B7A88', equipamento_operadores: '#6B7A88',
  equipamento_historico: '#6B7A88', equipamento_confirmacoes: '#6B7A88',
  usuarios: '#B3261E',
};

const COLUNAS_DATA = ['data', 'prazo', 'prazo_atual', 'data_contrato', 'cnh_validade', 'direcao_defensiva_validade', 'data_entrada', 'prox_preventiva', 'prox_lavacao', 'previsao_saida'];
const COLUNAS_DATAHORA = ['lancado_em', 'criado_em', 'atualizado_em', 'concluido_em', 'transferido_em', 'expira_em', 'bloqueado_ate', 'inativo_em', 'baixa_em'];
const COLUNAS_BOOLEANAS = ['atrasado', 'presente', 'paralisada', 'parado_manha', 'parado_tarde', 'primeiro_acesso_feito', 'atencao_especial', 'apto_rdo', 'ativo'];
const COLUNAS_MOEDA = ['valor_contrato', 'locacao_mensal', 'custo'];
const COLUNAS_TEXTO_LONGO = ['descricao', 'observacoes', 'assunto', 'providencias', 'observacao', 'local_descricao', 'motivo_texto'];

/** Ponto de entrada: formata todas as abas da planilha. */
function prepararPlanilha() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  criarAbaUsuarios();
  Object.keys(TABELAS).forEach((nome) => formatarAba_(ss, nome, TABELAS[nome]));
  formatarAba_(ss, 'usuarios', ['email', 'nome', 'perfil', 'ativo', 'criado_em']);
  formatarLeiaMe_(ss);
  SpreadsheetApp.flush();
}

function formatarAba_(ss, nome, colunas) {
  const aba = ss.getSheetByName(nome);
  if (!aba) return;
  const linhas = aba.getMaxRows();
  const n = colunas.length;
  const corpoTodo = aba.getRange(2, 1, linhas - 1, n);

  // Limpeza para permitir rodar de novo
  aba.clearConditionalFormatRules();
  corpoTodo.clearDataValidations();
  aba.getBandings().forEach((b) => b.remove());
  if (aba.getFilter()) aba.getFilter().remove();

  // Cabeçalho
  aba.setFrozenRows(1);
  aba.setTabColor(GRUPO_COR[nome] || '#879797');
  aba.setRowHeight(1, 34);
  aba.getRange(1, 1, 1, n)
    .setBackground(COR_CABECALHO)
    .setFontColor(COR_TEXTO_CABECALHO)
    .setFontWeight('bold')
    .setFontSize(10)
    .setVerticalAlignment('middle')
    .setWrap(true);

  // Filtro e faixas zebradas no corpo
  aba.getRange(1, 1, linhas, n).createFilter();
  corpoTodo.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, false, false);

  colunas.forEach((c, i) => {
    const col = i + 1;
    const corpo = aba.getRange(2, col, linhas - 1, 1);
    corpo.setVerticalAlignment('middle').setFontSize(10);

    // Formato de exibição
    if (COLUNAS_DATA.indexOf(c) !== -1) corpo.setNumberFormat('dd/mm/yyyy');
    else if (COLUNAS_DATAHORA.indexOf(c) !== -1) corpo.setNumberFormat('dd/mm/yyyy hh:mm');
    else if (COLUNAS_MOEDA.indexOf(c) !== -1) corpo.setNumberFormat('#,##0.00');

    // Flags: texto TRUE/FALSE antigo vira booleano. Linhas sem registro ficam vazias (sem caixa de seleção).
    if (COLUNAS_BOOLEANAS.indexOf(c) !== -1) {
      const ultima = ultimaLinha_(aba); // definida em Servidor.gs
      if (ultima + 1 <= linhas) aba.getRange(ultima + 1, col, linhas - ultima, 1).clearContent();
      if (ultima > 1) {
        const dados = aba.getRange(2, col, ultima - 1, 1);
        dados.setValues(dados.getValues().map((r) => [r[0] === '' ? '' : (r[0] === true || String(r[0]).toUpperCase() === 'TRUE')]));
      }
    }

    // Listas fechadas (checks do Supabase, agora validação na planilha)
    const lista = VALORES_PERMITIDOS[nome + '.' + c];
    if (lista) {
      const regra = SpreadsheetApp.newDataValidation()
        .requireValueInList(lista.map(String), true)
        .setAllowInvalid(false)
        .build();
      corpo.setDataValidation(regra);
    }

    // Identificadores em cinza, para não competir com os dados
    if (c === 'id' || /_id$/.test(c) || c === 'token_hash' || c === 'senha_hash') {
      corpo.setFontColor(COR_ID).setFontSize(9);
    }

    if (COLUNAS_TEXTO_LONGO.indexOf(c) !== -1) corpo.setWrap(true);
    aba.setColumnWidth(col, larguraColuna_(c));
  });

  // Alertas de situação
  if (nome === 'rdo') {
    const cAtrasado = colunas.indexOf('atrasado') + 1;
    if (cAtrasado > 0) {
      regraCondicional_(aba, n, linhas, '=$' + colLetra_(cAtrasado) + '2=TRUE', COR_ALERTA_FUNDO, COR_ALERTA_TEXTO);
    }
  }
  if (nome === 'checkin_itens' || nome === 'pauta_itens') {
    const cPrazo = colunas.indexOf(nome === 'checkin_itens' ? 'prazo_atual' : 'prazo') + 1;
    const cStatus = colunas.indexOf('status') + 1;
    const p = colLetra_(cPrazo);
    const s = colLetra_(cStatus);
    const aberto = 'AND($' + s + '2<>"concluido",$' + s + '2<>"cancelado")';
    regraCondicional_(aba, n, linhas, '=AND($' + p + '2<>"",$' + p + '2<TODAY(),' + aberto + ')', COR_ALERTA_FUNDO, COR_ALERTA_TEXTO);
    regraCondicional_(aba, n, linhas, '=AND($' + p + '2=TODAY(),' + aberto + ')', COR_AVISO_FUNDO, '#7A5200');
  }
}

function regraCondicional_(aba, n, linhas, formula, fundo, texto) {
  const regra = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied(formula)
    .setBackground(fundo)
    .setFontColor(texto)
    .setRanges([aba.getRange(2, 1, linhas - 1, n)])
    .build();
  const atuais = aba.getConditionalFormatRules();
  atuais.push(regra);
  aba.setConditionalFormatRules(atuais);
}

function formatarLeiaMe_(ss) {
  const aba = ss.getSheetByName('LEIA-ME');
  if (!aba) return;
  aba.setHiddenGridlines(true);
  aba.setTabColor(COR_CABECALHO);
  aba.setColumnWidth(1, 860);
  const ultima = Math.max(aba.getLastRow(), 1);
  aba.getRange(1, 1, aba.getMaxRows(), 1).setWrap(true).setVerticalAlignment('top').setFontSize(10);
  aba.getRange(1, 1).setFontSize(14).setFontWeight('bold').setFontColor(COR_CABECALHO);
  const textos = aba.getRange(1, 1, ultima, 1).getValues();
  textos.forEach((r, i) => {
    if (r[0] === 'REGRAS' || r[0] === 'INSTRUÇÕES') {
      aba.getRange(i + 1, 1).setBackground(COR_CABECALHO).setFontColor('#FFFFFF').setFontWeight('bold');
    }
  });
}

function larguraColuna_(c) {
  if (c === 'id' || /_id$/.test(c) || c === 'token_hash' || c === 'senha_hash' || c === 'rdo_id') return 90;
  if (COLUNAS_TEXTO_LONGO.indexOf(c) !== -1) return 300;
  if (COLUNAS_DATAHORA.indexOf(c) !== -1) return 130;
  if (COLUNAS_DATA.indexOf(c) !== -1) return 95;
  if (COLUNAS_BOOLEANAS.indexOf(c) !== -1) return 85;
  if (c === 'email') return 230;
  if (c === 'nome' || c === 'assunto' || c === 'descricao') return 220;
  return 150;
}

/** 1 -> A, 27 -> AA */
function colLetra_(n) {
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
