# FinançasSea — Sistema de Gestão Financeira Pessoal

Sistema completo de gestão financeira pessoal escrito em **[Sea](https://github.com/dopsilva/sea)** com persistência em **SQLite** (modo WAL) e **Frontend Web SPA**.

---

## Funcionalidades Principais

- **Visão Geral (Dashboard)**:
  - Indicadores em tempo real de **Saldo Atual em Contas (Realizado)**, **Saldo Projetado no Fim do Mês**, **Receitas (Recebidas + A Receber)**, **Despesas (Pagas + A Pagar)**, **Balanço Líquido** e **Taxa de Poupança (%)**.
  - Alertas de **Contas em Atraso (Vencidas)** e **Contas Vencendo nos Próximos 7 Dias** com baixa rápida em 1 clique.
  - Gráficos SVG interativos de evolução diária de caixa e distribuição de despesas por categoria.
- **Contas Bancárias, Carteiras e Cartões**:
  - Cadastro completo com atalhos para os principais bancos brasileiros (Itaú `341`, Banco do Brasil `001`, Nubank `260`, Bradesco `237`, Caixa `104`, Santander `033`, Inter `077`, C6 `336`, BTG `208`, Sicredi `748`, Sicoob `756`, XP `348`).
  - Campos para agência, número da conta com dígito, chave PIX principal, saldo inicial, limite de cheque especial/crédito, dias de fechamento/vencimento e observações.
  - **Ajuste/Conciliação de Saldo** automático, filtro direto de extrato por conta e transferências entre contas.
- **Contas a Pagar, a Receber e Transferências**:
  - Lançamento por categoria de **Receita** ou **Despesa**, conta bancária, forma de pagamento (PIX, Boleto, Cartão de Crédito/Débito, TED/DOC, Débito Automático, Espécie), favorecido/pagador e tags.
  - **Parcelamento Automático**: suporte para lançamentos parcelados (`2x` a `36x`+) gerando todas as parcelas nos meses subsequentes.
  - **Baixa Completa**: confirmação de pagamento/recebimento com cálculo de **Desconto** e **Juros/Multa**, além de estorno/reabertura e exportação para **CSV**.
- **Contas Recorrentes (Fixas e Assinaturas)**:
  - Cadastro de receitas e despesas fixas (Semanal, Quinzenal, Mensal, Bimestral, Trimestral, Semestral ou Anual), com geração automática e idempotente para cada mês e opção de baixa automática no vencimento.
- **Fluxo de Caixa (Realizado vs. Projetado)**:
  - Visão **Diária** (dia a dia do mês) e **Mensal** (12 meses — histórico + projeção).
  - Curvas comparativas de **Saldo Realizado** e **Saldo Projetado** (considerando contas a pagar e a receber pendentes) e alerta de menor saldo projetado no período.
- **Importação de Extrato Bancário (OFX e CSV) & Conciliação Inteligente**:
  - Leitura nativa de arquivos **OFX** (1.x SGML e 2.x XML) e **CSV** dos principais bancos brasileiros.
  - **Detecção de Duplicidade** via `FITID` / hash da transação (`bank_fitid`).
  - **Conciliação Bancária Inteligente**: identifica automaticamente contas a pagar/receber já lançadas com mesmo valor e vencimento próximo (±7 dias) e sugere dar baixa e conciliar em vez de duplicar.
  - **Motor de Auto-Categorização** configurável por palavras-chave.
- **Orçamento Mensal por Categoria & Metas Financeiras**:
  - Definição de teto mensal de gastos por categoria com barras de progresso e alertas visuais (`80%` e `100%`).
  - Gestão de metas financeiras e reservas (ex.: Reserva de Emergência, Viagens) com registro de aportes e resgates.

---

## Estrutura do Projeto

```text
.
├── main.sea            # Ponto de entrada CLI e inicialização do servidor HTTP
├── db.sea              # Schema SQLite, migrações e regras de negócio financeiras
├── reports.sea         # Motor de Dashboard, Orçamentos e Fluxo de Caixa (Diário/Mensal)
├── importer.sea        # Parser OFX/CSV, auto-categorização e conciliação bancária
├── server.sea          # Roteador HTTP e API REST JSON
├── financas_test.sea   # Suíte de testes automatizados (sea/test)
├── Makefile            # Atalhos para execução, verificação estática e testes
└── public/             # Frontend Web SPA
    ├── index.html
    ├── styles.css
    └── app.js
```

---

## Pré-requisitos

É necessário ter a VM **Sea** (`~/projects/sea_vm`) compilada com as bibliotecas `sqlite` e `http`:

```bash
cd ~/projects/sea_vm
make
make -C libs/sqlite
make -C libs/http
```

---

## Como Executar

```bash
# Iniciar o servidor web na porta 8080 (banco de dados local financas.db)
make run

# Ou diretamente com flags customizadas:
~/projects/sea_vm/bin/sea main.sea -port 8080 -db financas.db
```

Acesse **`http://localhost:8080`** no navegador.

---

## Verificação e Testes

```bash
# Verificação estática de tipos e escopo
make check

# Executar a suíte de testes automatizados
make test

# Formatar o código-fonte no padrão Sea
make fmt
```

---

## Licença

Distribuído sob a licença BSD-3-Clause.
