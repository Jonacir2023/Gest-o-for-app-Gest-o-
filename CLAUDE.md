# CLAUDE.md — Gestão GranSul

Regras do projeto para qualquer trabalho feito pelo Claude neste repositório.

## App

- O app Gestão GranSul é construído em Google Apps Script, com o código-fonte
  na pasta `apps-script/`.
- A publicação é automática: todo push no ramo `claude/gestao-base` que altera
  algo em `apps-script/**` dispara o GitHub Action
  `.github/workflows/publicar-apps-script.yml`, que envia o código ao projeto
  do Apps Script (`clasp push`) e cria uma nova versão na implantação existente
  (`clasp deploy`), sem trocar a URL `/exec`.
  - Não editar o código direto no editor do Apps Script — a próxima publicação
    sobrescreve.

## Proibições

- Nunca escrever "CESBE" em nenhuma parte do app (código, texto, tela, dado).
  Este projeto é do GranSul, não da CESBE.
- Nunca usar endereços (URLs), IDs de projeto, chaves ou implantações do
  GitHub ou do Supabase de outros projetos. Usar somente os deste
  repositório.

## Regra do RDO

- Um RDO por combinação de (data + responsável + criador).
- Ao reenviar um RDO com a mesma combinação, a versão mais antiga é apagada
  automaticamente — não acumula duplicado.

## Regras de motorista/operador

- Veículo leve: qualquer pessoa do efetivo com CNH e direção defensiva em dia
  pode dirigir.
- Veículo pesado: exige função "Motorista".
- Equipamento: exige função "Operador".
