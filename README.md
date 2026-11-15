# Gestão · CESBE

App de gestão de obras da CESBE: cadastro de obras, RDO, Check-in e Pauta.
Um único app para todas as obras. O backend é o Supabase.

## Estado atual

| Módulo | Situação |
|---|---|
| Login (e-mail e senha) | Pronto |
| Cadastro de obra | Pronto (lista, novo, editar) |
| RDO, Check-in, Pauta, Cadastros (telas) | A fazer |

O banco já tem as regras de acesso, as funções da Pauta e os cadastros iniciais
(unidades de medida, motivos de justificativa, locais da obra GranSul).

## Como funciona

- **Front-end**: uma página estática (`index.html`), sem build. HTML, CSS e JavaScript puros,
  com o cliente `@supabase/supabase-js` carregado do jsDelivr.
- **Backend**: Supabase (projeto `lphyuamltspbczsutwyq`, região sa-east-1).
- **Acesso**: quem entra com e-mail e senha no Supabase Auth e tem um cargo com perfil
  `acesso_total` (gerentes) gerencia as obras. A regra fica no banco (RLS e funções), não no navegador.
- **Líderes**: entram pelo link da Pauta com senha própria. Não usam o login do app.

## Rodar localmente

Não precisa instalar nada. Abra `index.html` por um servidor local, não pelo duplo clique,
porque o navegador bloqueia chamadas de rede a partir de `file://`:

```bash
python3 -m http.server 8000
```

Depois abra `http://localhost:8000`.

## Publicar (GitHub Pages)

1. No repositório: **Settings → Pages**.
2. Em **Source**, escolha **Deploy from a branch**.
3. Branch: `claude/gestao-base`, pasta: `/ (root)`. Salve.
4. Em alguns minutos o endereço aparece nessa mesma tela, no formato
   `https://jonacir2023.github.io/gest-o-for-app-gest-o-/`.

Depois que a base estiver validada, troque a branch do Pages para `main`.

## Criar usuários

Só o Supabase cria contas. No painel do projeto: **Authentication → Users → Add user**,
com **Auto Confirm User** marcado. Depois, um gerente com acesso total liga a conta a um cargo
pela função `pessoa_vincular(email, nome, cargo_id)`.

O app não tem tela de cadastro de usuários nesta fase.

## Segurança

- A chave no `index.html` é a chave **anon** do Supabase. Ela é pública por desenho.
  Quem protege os dados são as políticas RLS e as funções `SECURITY DEFINER`.
- Nunca coloque senhas, chaves `service_role` ou tokens neste repositório.
- Se alguma senha for exposta, troque no Supabase Auth imediatamente.

## Próximos passos

1. Validar o login e o cadastro de obra no endereço do Pages.
2. Telas de Cadastros (unidades, locais, motivos) para o gerente de obras.
3. RDO, Check-in e Pauta.
4. Cadastro de líderes (crachá, nome, função, setor, e-mail e senha), após decisão sobre login ou link.

## Pendências

- Logotipo oficial horizontal da CESBE (hoje é texto).
- Decisão: ao criar uma obra, copiar a lista padrão de locais ou cada obra cadastra os seus.
- Gerentes de contratos e de planejamento: criar as contas e vincular.
