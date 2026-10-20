// app.js — Frontend completo do FinançasSea

const state = {
    currentMonth: getTodayYM(),
    activeTab: "dashboard",
    accounts: [],
    people: [],
    categories: [],
    transactions: [],
    recurring: [],
    goals: [],
    rules: [],
    dashboard: null,
    cashflow: null,
    cfMode: "daily",
    cfAccountId: "",
    txQuickTab: "all",
    importPreview: null,
    importFilename: ""
};

const MONTH_NAMES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const PAYMENT_LABELS = {
    pix: "PIX",
    boleto: "Boleto",
    credit_card: "Cartão de Crédito",
    debit_card: "Cartão de Débito",
    transfer: "Transferência",
    auto_debit: "Débito Automático",
    cash: "Dinheiro",
    bank_statement: "Extrato Bancário"
};

const FREQ_LABELS = {
    monthly: "Mensal",
    weekly: "Semanal",
    biweekly: "Quinzenal",
    bimonthly: "Bimestral",
    quarterly: "Trimestral",
    semiannual: "Semestral",
    yearly: "Anual"
};

const ACC_TYPE_LABELS = {
    checking: "Conta Corrente",
    digital: "Conta Digital / Pagamento",
    savings: "Poupança / Reserva",
    investment: "Investimentos / Corretora",
    wallet: "Carteira Física",
    credit_card: "Cartão de Crédito"
};

function getTodayISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function getTodayYM() {
    return getTodayISO().slice(0, 7);
}

function fmtBRL(val) {
    const n = Number(val || 0);
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDateBR(iso) {
    if (!iso || iso.length < 10) return "—";
    const [y, m, d] = iso.slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
}

function formatMonthLabel(ym) {
    const [y, m] = ym.split("-").map(Number);
    return `${MONTH_NAMES[(m || 1) - 1]} ${y}`;
}

function shiftMonth(ym, delta) {
    let [y, m] = ym.split("-").map(Number);
    m += delta;
    while (m > 12) { m -= 12; y += 1; }
    while (m < 1) { m += 12; y -= 1; }
    return `${y}-${String(m).padStart(2, "0")}`;
}

function esc(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function showToast(msg, isError = false) {
    const box = document.getElementById("toast-container");
    const el = document.createElement("div");
    el.className = `toast ${isError ? "error" : ""}`;
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => el.remove(), 3600);
}

async function api(path, opts = {}) {
    const headers = { ...(opts.headers || {}) };
    let body = opts.body;
    if (body && typeof body === "object") {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(body);
    }
    const resp = await fetch(path, {
        method: opts.method || "GET",
        headers,
        body
    });
    const json = await resp.json();
    if (!resp.ok || !json.ok) {
        throw new Error(json.error || `Erro HTTP ${resp.status}`);
    }
    return json.data;
}

// ==================== INITIALIZATION & NAVIGATION ====================

document.addEventListener("DOMContentLoaded", async () => {
    setupEventListeners();
    updateMonthDisplay();
    await refreshAll();
});

function updateMonthDisplay() {
    document.getElementById("current-month-label").textContent = formatMonthLabel(state.currentMonth);
}

async function refreshAll() {
    try {
        const [accounts, people, categories, dash, cf] = await Promise.all([
            api("/api/accounts"),
            api("/api/people"),
            api("/api/categories"),
            api(`/api/dashboard?month=${state.currentMonth}`),
            api(`/api/cashflow?mode=${state.cfMode}&month=${state.currentMonth}&account_id=${state.cfAccountId}`)
        ]);
        state.accounts = accounts;
        state.people = people;
        state.categories = categories;
        state.dashboard = dash;
        state.cashflow = cf;

        populateSelects();
        renderSidebarAccounts();
        renderAccountsPage();
        renderPeoplePage(state.people);
        renderDashboard();
        renderCashflow();

        if (state.activeTab === "people") {
            await loadPeople();
        } else if (state.activeTab === "transactions") {
            await loadTransactions();
        } else if (state.activeTab === "recurring") {
            await loadRecurring();
        } else if (state.activeTab === "import") {
            await loadRules();
        } else if (state.activeTab === "planning") {
            await loadPlanning();
        }
    } catch (err) {
        showToast(err.message, true);
    }
}

function switchTab(tabName) {
    state.activeTab = tabName;
    document.querySelectorAll(".nav-item").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.tab === tabName);
    });
    document.querySelectorAll(".tab-panel").forEach(panel => {
        panel.classList.toggle("active", panel.id === `tab-${tabName}`);
    });

    const titles = {
        dashboard: ["Visão Geral", "Resumo completo de saldos, contas a pagar/receber, orçamentos e metas"],
        accounts: ["Contas Bancárias, Carteiras e Cartões", "Cadastre seus bancos, agências, contas, chaves PIX, limites e acompanhe o saldo de cada instituição"],
        people: ["Cadastro de Pessoas (Pessoa Física & Jurídica)", "Vincule suas contas a pagar e a receber a clientes, fornecedores, empresas ou pessoas (documento CPF/CNPJ opcional)"],
        transactions: ["Contas a Pagar e a Receber", "Gerencie todos os seus lançamentos, baixas, parcelamentos e transferências"],
        cashflow: ["Fluxo de Caixa (Realizado e Projetado)", "Acompanhe a evolução diária e mensal do seu saldo com projeção de contas pendentes"],
        recurring: ["Contas Recorrentes e Fixas", "Automação de salários, aluguéis, assinaturas e contas fixas mensais"],
        import: ["Importação de Extrato Bancário & Conciliação", "Importe arquivos OFX ou CSV e concilie automaticamente com suas contas"],
        planning: ["Categorias, Orçamento & Metas", "Estrutura de categorias de receita/despesa, tetos de gastos e reservas"]
    };
    const [t, sub] = titles[tabName] || ["FinançasSea", ""];
    document.getElementById("page-title").textContent = t;
    document.getElementById("page-subtitle").textContent = sub;

    if (tabName === "accounts") renderAccountsPage();
    if (tabName === "people") loadPeople();
    if (tabName === "transactions") loadTransactions();
    if (tabName === "cashflow") loadCashflowOnly();
    if (tabName === "recurring") loadRecurring();
    if (tabName === "import") loadRules();
    if (tabName === "planning") loadPlanning();
}

function populateSelects() {
    const accOpts = state.accounts.length
        ? state.accounts.map(a => `<option value="${a.id}">${esc(a.name)} (${fmtBRL(a.current_balance)})</option>`).join("")
        : `<option value="0">— Cadastre uma conta bancária —</option>`;
    const accFilterOpts = `<option value="">Todas as Contas</option>` + state.accounts.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join("");

    document.getElementById("tx-account-id").innerHTML = accOpts;
    document.getElementById("tx-dest-account-id").innerHTML = accOpts;
    document.getElementById("pay-account-id").innerHTML = accOpts;
    document.getElementById("rec-account-id").innerHTML = accOpts;
    document.getElementById("import-account-id").innerHTML = accOpts;

    const curFilterAcc = document.getElementById("filter-account").value;
    document.getElementById("filter-account").innerHTML = accFilterOpts;
    document.getElementById("filter-account").value = curFilterAcc;

    const peopleOpts = `<option value="0">— Sem pessoa vinculada —</option>` + state.people.map(p => {
        const docInfo = p.document ? ` · ${esc(p.document)}` : "";
        return `<option value="${p.id}">[${esc(p.person_type)}] ${esc(p.name)}${docInfo}</option>`;
    }).join("");
    const curTxPerson = document.getElementById("tx-person-id").value;
    document.getElementById("tx-person-id").innerHTML = peopleOpts;
    if (curTxPerson) document.getElementById("tx-person-id").value = curTxPerson;

    const curRecPerson = document.getElementById("rec-person-id").value;
    document.getElementById("rec-person-id").innerHTML = peopleOpts;
    if (curRecPerson) document.getElementById("rec-person-id").value = curRecPerson;

    const curFilterPerson = document.getElementById("filter-person").value;
    document.getElementById("filter-person").innerHTML = `<option value="">Todas as Pessoas (PF/PJ)</option>` +
        state.people.map(p => `<option value="${p.id}">[${esc(p.person_type)}] ${esc(p.name)}</option>`).join("");
    document.getElementById("filter-person").value = curFilterPerson;

    const curCfAcc = document.getElementById("cf-account-filter").value;
    document.getElementById("cf-account-filter").innerHTML = `<option value="">Todas as Contas (Consolidado)</option>` + state.accounts.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join("");
    document.getElementById("cf-account-filter").value = curCfAcc;

    const curFilterCat = document.getElementById("filter-category").value;
    document.getElementById("filter-category").innerHTML = `<option value="">Todas as Categorias</option>` +
        state.categories.map(c => `<option value="${c.id}">${c.type === "income" ? "▲" : "▼"} ${esc(c.name)}</option>`).join("");
    document.getElementById("filter-category").value = curFilterCat;

    document.getElementById("rule-category").innerHTML = state.categories.map(c =>
        `<option value="${c.id}">${c.type === "income" ? "[Receita]" : "[Despesa]"} ${esc(c.name)}</option>`
    ).join("");

    populateTxCategorySelect();
    populateRecCategorySelect();
}

function populateTxCategorySelect(selectedType) {
    const checkedRadio = document.querySelector('input[name="tx-type"]:checked');
    const txType = selectedType || (checkedRadio ? checkedRadio.value : "expense");
    const filtered = state.categories.filter(c => c.type === (txType === "income" ? "income" : "expense"));
    document.getElementById("tx-category-id").innerHTML = filtered.map(c =>
        `<option value="${c.id}">${esc(c.name)}</option>`
    ).join("");
}

function populateRecCategorySelect(selectedType) {
    const rType = selectedType || document.getElementById("rec-type").value || "expense";
    const filtered = state.categories.filter(c => c.type === rType);
    document.getElementById("rec-category-id").innerHTML = filtered.map(c =>
        `<option value="${c.id}">${esc(c.name)}</option>`
    ).join("");
}

function renderSidebarAccounts() {
    const box = document.getElementById("sidebar-accounts-list");
    if (!state.accounts.length) {
        box.innerHTML = `<div class="text-muted">Nenhuma conta</div>`;
        return;
    }
    box.innerHTML = state.accounts.map(a => `
        <div class="sidebar-acc-item" style="cursor:pointer" onclick="switchTab('accounts')" title="Clique para gerenciar contas bancárias">
            <div class="sidebar-acc-name">
                <span class="color-dot" style="background:${esc(a.color)}"></span>
                <span>${esc(a.name)}</span>
            </div>
            <span class="sidebar-acc-bal ${a.current_balance < 0 ? "text-danger" : "text-success"}">
                ${fmtBRL(a.current_balance)}
            </span>
        </div>
    `).join("");
}

function renderAccountsPage() {
    const grid = document.getElementById("bank-accounts-grid");
    if (!grid) return;

    let sumCur = 0;
    let sumProj = 0;
    let sumLim = 0;
    state.accounts.forEach(a => {
        sumCur += Number(a.current_balance || 0);
        sumProj += Number(a.projected_balance || 0);
        sumLim += Number(a.credit_limit || 0);
    });

    document.getElementById("acc-kpi-current").textContent = fmtBRL(sumCur);
    document.getElementById("acc-kpi-projected").textContent = fmtBRL(sumProj);
    document.getElementById("acc-kpi-limits").textContent = fmtBRL(sumLim);
    document.getElementById("acc-kpi-count").textContent = state.accounts.length;

    if (!state.accounts.length) {
        grid.innerHTML = `<div class="empty-state">Nenhuma conta bancária cadastrada. Clique em "+ Cadastrar Conta Bancária" para começar.</div>`;
        return;
    }

    grid.innerHTML = state.accounts.map(a => {
        const bankHeader = [
            a.bank_code ? `Banco ${esc(a.bank_code)}` : "",
            a.institution ? esc(a.institution) : "",
            esc(ACC_TYPE_LABELS[a.type] || a.type)
        ].filter(Boolean).join(" · ");

        return `
            <div class="bank-card">
                <div class="bank-card-accent" style="background:${esc(a.color)}"></div>
                <div class="bank-card-header">
                    <div>
                        <div class="bank-card-title">
                            <span class="color-dot" style="background:${esc(a.color)}"></span>
                            <span>${esc(a.name)}</span>
                        </div>
                        <div class="bank-card-sub">${bankHeader}</div>
                    </div>
                    <span class="badge badge-neutral">#${a.id}</span>
                </div>

                <div class="bank-details-grid">
                    <div class="bank-detail-item">
                        <span>Agência</span>
                        <strong>${esc(a.branch || "—")}</strong>
                    </div>
                    <div class="bank-detail-item">
                        <span>Nº da Conta</span>
                        <strong>${esc(a.account_number || "—")}</strong>
                    </div>
                    <div class="bank-detail-item">
                        <span>Saldo Inicial</span>
                        <strong>${fmtBRL(a.initial_balance)}</strong>
                    </div>
                    <div class="bank-detail-item">
                        <span>Chave PIX</span>
                        <strong title="${esc(a.pix_key || "")}">${esc(a.pix_key || "—")}</strong>
                    </div>
                    <div class="bank-detail-item">
                        <span>Limite / Crédito</span>
                        <strong>${a.credit_limit > 0 ? fmtBRL(a.credit_limit) : "—"}</strong>
                    </div>
                    <div class="bank-detail-item">
                        <span>Pendências</span>
                        <strong>${a.pending_count || 0} lanç.</strong>
                    </div>
                </div>

                ${a.notes ? `<div class="tx-desc-sub">📌 ${esc(a.notes)}</div>` : ""}

                <div class="bank-balances-row">
                    <div class="bank-bal-box">
                        <div class="bank-bal-label">Saldo Atual (Realizado)</div>
                        <div class="bank-bal-value ${a.current_balance < 0 ? "text-danger" : "text-success"}">
                            ${fmtBRL(a.current_balance)}
                        </div>
                    </div>
                    <div class="bank-bal-box">
                        <div class="bank-bal-label">Saldo Projetado</div>
                        <div class="bank-bal-value ${a.projected_balance < 0 ? "text-danger" : "text-info"}">
                            ${fmtBRL(a.projected_balance)}
                        </div>
                    </div>
                </div>

                <div class="bank-card-actions">
                    <button class="btn btn-outline btn-xs" onclick="viewAccountTransactions(${a.id})">📄 Ver Extrato</button>
                    <button class="btn btn-success-soft btn-xs" onclick="adjustAccountBalancePrompt(${a.id}, ${a.current_balance})">⚖️ Ajustar Saldo</button>
                    <button class="btn btn-outline btn-xs" onclick="goToImportForAccount(${a.id})">📥 Importar OFX/CSV</button>
                    <button class="btn btn-outline btn-xs" onclick="openEditAccount(${a.id})">✎ Editar</button>
                    <button class="btn btn-danger-soft btn-xs" onclick="deleteAccount(${a.id})">🗑</button>
                </div>
            </div>
        `;
    }).join("");
}

const PERSON_ROLE_LABELS = {
    ambos: "Cliente / Fornecedor",
    cliente: "Cliente / Pagador",
    fornecedor: "Fornecedor / Credor",
    funcionario: "Funcionário / Prestador",
    outro: "Outro"
};

async function loadPeople() {
    try {
        const search = document.getElementById("people-search") ? document.getElementById("people-search").value : "";
        const pType = document.getElementById("people-filter-type") ? document.getElementById("people-filter-type").value : "all";
        const role = document.getElementById("people-filter-role") ? document.getElementById("people-filter-role").value : "all";
        const q = new URLSearchParams({ search, person_type: pType, role });
        const rows = await api(`/api/people?${q.toString()}`);
        renderPeoplePage(rows);
    } catch (err) {
        showToast(err.message, true);
    }
}

function renderPeoplePage(rows) {
    const tbody = document.getElementById("people-table-body");
    if (!tbody) return;
    const list = rows || state.people || [];

    let pfCount = 0;
    let pjCount = 0;
    let recvPending = 0;
    let payPending = 0;
    (state.people || []).forEach(p => {
        if (p.person_type === "PJ") pjCount += 1;
        else pfCount += 1;
        recvPending += Number(p.receivable_pending || 0);
        payPending += Number(p.payable_pending || 0);
    });

    document.getElementById("ppl-kpi-total").textContent = (state.people || []).length;
    document.getElementById("ppl-kpi-pf").textContent = pfCount;
    document.getElementById("ppl-kpi-pj").textContent = pjCount;
    document.getElementById("ppl-kpi-receivable").textContent = fmtBRL(recvPending);
    document.getElementById("ppl-kpi-payable").textContent = fmtBRL(payPending);

    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty-state">Nenhuma pessoa cadastrada. Clique em "+ Cadastrar Pessoa (PF / PJ)" para começar (o documento CPF/CNPJ não é obrigatório).</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(p => {
        const isPJ = p.person_type === "PJ";
        const contactParts = [];
        if (p.phone) contactParts.push(`📞 ${esc(p.phone)}`);
        if (p.email) contactParts.push(`✉️ ${esc(p.email)}`);
        if (p.pix_key) contactParts.push(`PIX: ${esc(p.pix_key)}`);

        return `
            <tr>
                <td>
                    <div class="tx-desc-main">
                        <strong>${esc(p.name)}</strong>
                        <span class="mini-tag">${esc(PERSON_ROLE_LABELS[p.role] || p.role)}</span>
                    </div>
                    ${p.trade_name ? `<div class="tx-desc-sub">Fantasia/Apelido: ${esc(p.trade_name)}</div>` : ""}
                    ${p.notes ? `<div class="tx-desc-sub">📌 ${esc(p.notes)}</div>` : ""}
                </td>
                <td>
                    <span class="badge ${isPJ ? "badge-info" : "badge-neutral"}">
                        ${isPJ ? "🏢 PJ (Jurídica)" : "👤 PF (Física)"}
                    </span>
                </td>
                <td>${p.document ? `<code>${esc(p.document)}</code>` : `<span class="text-muted">Não informado</span>`}</td>
                <td>
                    <div class="tx-desc-sub">${contactParts.length ? contactParts.join("<br>") : "—"}</div>
                </td>
                <td class="text-right">
                    <div class="text-success"><strong>${fmtBRL(p.receivable_pending)}</strong> pend.</div>
                    <div class="tx-desc-sub">Recebido: ${fmtBRL(p.received_paid)}</div>
                </td>
                <td class="text-right">
                    <div class="text-danger"><strong>${fmtBRL(p.payable_pending)}</strong> pend.</div>
                    <div class="tx-desc-sub">Pago: ${fmtBRL(p.paid_amount)}</div>
                </td>
                <td class="text-right">
                    <span class="badge badge-neutral">${p.tx_count || 0} lanç.</span>
                </td>
                <td class="text-right">
                    <div class="action-btns">
                        <button class="btn btn-outline btn-xs" title="Ver lançamentos desta pessoa" onclick="viewPersonTransactions(${p.id})">📄 Contas</button>
                        <button class="btn btn-outline btn-xs" title="Editar" onclick="openEditPerson(${p.id})">✎</button>
                        <button class="btn btn-danger-soft btn-xs" title="Remover" onclick="deletePerson(${p.id})">🗑</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

// ==================== TAB 1: DASHBOARD ====================

function renderDashboard() {
    const d = state.dashboard;
    if (!d) return;

    const ms = d.month_summary;
    document.getElementById("dash-current-balance").textContent = fmtBRL(d.total_current_balance);
    document.getElementById("dash-projected-balance").textContent = fmtBRL(d.total_projected_balance);

    document.getElementById("dash-income-total").textContent = fmtBRL(ms.income_total);
    document.getElementById("dash-income-paid").textContent = fmtBRL(ms.income_paid);
    document.getElementById("dash-income-pending").textContent = fmtBRL(ms.income_pending);

    document.getElementById("dash-expense-total").textContent = fmtBRL(ms.expense_total);
    document.getElementById("dash-expense-paid").textContent = fmtBRL(ms.expense_paid);
    document.getElementById("dash-expense-pending").textContent = fmtBRL(ms.expense_pending);

    const netEl = document.getElementById("dash-net-projected");
    netEl.textContent = fmtBRL(ms.net_projected);
    netEl.className = `kpi-value ${ms.net_projected >= 0 ? "text-success" : "text-danger"}`;
    document.getElementById("dash-net-realized").textContent = fmtBRL(ms.net_realized);
    document.getElementById("dash-savings-badge").textContent = `Poupança: ${ms.savings_rate}%`;

    // Alertas de Contas Vencidas e Próximos 7 dias
    document.getElementById("dash-overdue-count").textContent = d.overdue.count;
    const overdueBox = document.getElementById("dash-overdue-list");
    if (!d.overdue.items.length) {
        overdueBox.innerHTML = `<div class="empty-state">🎉 Nenhuma conta em atraso! Tudo em dia.</div>`;
    } else {
        overdueBox.innerHTML = d.overdue.items.map(tx => renderCompactAlertItem(tx, true)).join("");
    }

    document.getElementById("dash-upcoming-count").textContent = d.upcoming.count;
    const upcomingBox = document.getElementById("dash-upcoming-list");
    if (!d.upcoming.items.length) {
        upcomingBox.innerHTML = `<div class="empty-state">Nenhuma conta pendente para os próximos 7 dias.</div>`;
    } else {
        upcomingBox.innerHTML = d.upcoming.items.map(tx => renderCompactAlertItem(tx, false)).join("");
    }

    // Gráfico de evolução no Dashboard
    if (state.cashflow && state.cashflow.series) {
        renderCashflowSvg("dash-cashflow-chart", state.cashflow.series, 245);
    }

    // Despesas por Categoria
    const catBox = document.getElementById("dash-category-chart");
    const activeCats = (d.by_category_expense || []).filter(c => c.total_amount > 0);
    if (!activeCats.length) {
        catBox.innerHTML = `<div class="empty-state">Nenhuma despesa registrada neste mês.</div>`;
    } else {
        catBox.innerHTML = activeCats.slice(0, 7).map(c => `
            <div class="cat-bar-item">
                <div class="item-row-top">
                    <div class="item-title-group">
                        <span class="color-dot" style="background:${esc(c.color)}"></span>
                        <span>${esc(c.name)}</span>
                    </div>
                    <div>
                        <strong>${fmtBRL(c.total_amount)}</strong>
                        <span class="text-muted">(${c.pct_of_expenses}%)</span>
                    </div>
                </div>
                <div class="progress-track">
                    <div class="progress-fill" style="width:${Math.min(100, c.pct_of_expenses)}%; background:${esc(c.color)}"></div>
                </div>
            </div>
        `).join("");
    }

    // Orçamento Mensal por Categoria
    const budgetBox = document.getElementById("dash-budgets-list");
    const budgetedCats = (d.by_category_expense || []).filter(c => c.budget_monthly > 0);
    if (!budgetedCats.length) {
        budgetBox.innerHTML = `<div class="empty-state">Nenhuma categoria com teto de orçamento definido.</div>`;
    } else {
        budgetBox.innerHTML = budgetedCats.map(c => {
            const pct = c.pct_of_budget;
            let barColor = "#10b981";
            if (pct >= 100) barColor = "#f43f5e";
            else if (pct >= 80) barColor = "#f59e0b";
            return `
                <div class="budget-item">
                    <div class="item-row-top">
                        <div class="item-title-group">
                            <span class="color-dot" style="background:${esc(c.color)}"></span>
                            <span>${esc(c.name)}</span>
                        </div>
                        <div>
                            <strong class="${pct > 100 ? "text-danger" : ""}">${fmtBRL(c.total_amount)}</strong>
                            <span class="text-muted"> / ${fmtBRL(c.budget_monthly)} (${pct}%)</span>
                        </div>
                    </div>
                    <div class="progress-track">
                        <div class="progress-fill" style="width:${Math.min(100, pct)}%; background:${barColor}"></div>
                    </div>
                </div>
            `;
        }).join("");
    }

    // Metas Financeiras
    const goalsBox = document.getElementById("dash-goals-list");
    if (!d.goals || !d.goals.length) {
        goalsBox.innerHTML = `<div class="empty-state">Nenhuma meta financeira cadastrada.</div>`;
    } else {
        goalsBox.innerHTML = d.goals.map(g => `
            <div class="goal-item">
                <div class="item-row-top">
                    <div class="item-title-group">
                        <span class="color-dot" style="background:${esc(g.color)}"></span>
                        <span>${esc(g.name)}</span>
                    </div>
                    <div>
                        <strong class="text-success">${fmtBRL(g.current_amount)}</strong>
                        <span class="text-muted"> de ${fmtBRL(g.target_amount)} (${g.progress_pct}%)</span>
                    </div>
                </div>
                <div class="progress-track">
                    <div class="progress-fill" style="width:${Math.min(100, g.progress_pct)}%; background:${esc(g.color)}"></div>
                </div>
            </div>
        `).join("");
    }
}

function renderCompactAlertItem(tx, isOverdue) {
    const isExp = tx.type === "expense";
    return `
        <div class="compact-tx-item">
            <div class="compact-tx-main">
                <div class="compact-tx-title">${esc(tx.description)}</div>
                <div class="compact-tx-meta">
                    Venc: <strong>${fmtDateBR(tx.due_date)}</strong> · ${esc(tx.category_name || "Sem categoria")} · ${esc(tx.account_name || "")}
                </div>
            </div>
            <div class="compact-tx-right">
                <strong class="${isExp ? "text-danger" : "text-success"}">
                    ${isExp ? "-" : "+"}${fmtBRL(tx.final_amount)}
                </strong>
                <button class="btn ${isOverdue ? "btn-danger-soft" : "btn-success-soft"} btn-xs" onclick="openPayModal(${tx.id})">
                    ✓ ${isExp ? "Pagar" : "Receber"}
                </button>
            </div>
        </div>
    `;
}

// ==================== TAB 2: TRANSACTIONS ====================

async function loadTransactions() {
    try {
        const search = document.getElementById("filter-search").value;
        const catId = document.getElementById("filter-category").value;
        const accId = document.getElementById("filter-account").value;
        const personId = document.getElementById("filter-person") ? document.getElementById("filter-person").value : "";
        const typeVal = document.getElementById("filter-type").value;
        const statusVal = document.getElementById("filter-status").value;

        const q = new URLSearchParams({
            month: state.currentMonth,
            search,
            category_id: catId,
            account_id: accId,
            person_id: personId,
            type: typeVal,
            status: statusVal
        });
        const rows = await api(`/api/transactions?${q.toString()}`);
        state.transactions = rows;
        renderTransactionsTable(rows);
    } catch (err) {
        showToast(err.message, true);
    }
}

function renderTransactionsTable(rows) {
    const tbody = document.getElementById("tx-table-body");
    let sumInc = 0;
    let sumExp = 0;
    let sumPend = 0;

    rows.forEach(r => {
        const val = Number(r.final_amount || r.amount || 0);
        if (r.type === "income") sumInc += val;
        if (r.type === "expense") sumExp += val;
        if (r.status === "pending") sumPend += val;
    });

    document.getElementById("tx-sum-count").textContent = rows.length;
    document.getElementById("tx-sum-income").textContent = fmtBRL(sumInc);
    document.getElementById("tx-sum-expense").textContent = fmtBRL(sumExp);
    document.getElementById("tx-sum-pending").textContent = fmtBRL(sumPend);
    const net = sumInc - sumExp;
    const netEl = document.getElementById("tx-sum-net");
    netEl.textContent = fmtBRL(net);
    netEl.className = net >= 0 ? "text-success" : "text-danger";

    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state">Nenhum lançamento encontrado para os filtros selecionados neste mês.</td></tr>`;
        return;
    }

    tbody.innerHTML = rows.map(tx => {
        const isInc = tx.type === "income";
        const isTr = tx.type === "transfer";
        let statusBadge = "";
        if (tx.status === "paid") {
            statusBadge = `<span class="badge badge-success">✓ ${isInc ? "Recebido" : (isTr ? "Transferido" : "Pago")}</span>`;
        } else if (tx.is_overdue) {
            statusBadge = `<span class="badge badge-danger">⚠ Em Atraso</span>`;
        } else {
            statusBadge = `<span class="badge badge-warning">⏳ ${isInc ? "A Receber" : "A Pagar"}</span>`;
        }

        const extraBadges = [];
        if (tx.person_name) {
            const pIcon = tx.person_type === "PJ" ? "🏢" : "👤";
            const pDoc = tx.person_document ? ` (${esc(tx.person_document)})` : "";
            extraBadges.push(`<span class="mini-tag" style="color:#a78bfa" title="${esc(tx.person_type || "PF")}${pDoc}">${pIcon} ${esc(tx.person_name)} [${esc(tx.person_type || "PF")}]</span>`);
        }
        if (tx.recurring_id) extraBadges.push(`<span class="mini-tag">↻ Fixa</span>`);
        if (tx.installment_total && tx.installment_total > 1) {
            extraBadges.push(`<span class="mini-tag">Parcela ${tx.installment_number}/${tx.installment_total}</span>`);
        }
        if (tx.reconciled) extraBadges.push(`<span class="mini-tag" style="color:#34d399">✓ Conciliado</span>`);
        if (tx.tags) {
            tx.tags.split(",").map(s => s.trim()).filter(Boolean).forEach(tg => {
                extraBadges.push(`<span class="mini-tag">#${esc(tg)}</span>`);
            });
        }

        const subParts = [];
        if (tx.contact) subParts.push(`Obs/Favorecido: ${esc(tx.contact)}`);
        if (tx.payment_date && tx.status === "paid") subParts.push(`Baixa em ${fmtDateBR(tx.payment_date)}`);
        if (tx.discount > 0) subParts.push(`Desc: ${fmtBRL(tx.discount)}`);
        if (tx.interest > 0) subParts.push(`Juros: ${fmtBRL(tx.interest)}`);
        if (tx.notes) subParts.push(esc(tx.notes));

        const catHtml = isTr
            ? `<span class="badge badge-info">⇄ Transferência</span>`
            : `<span class="badge badge-neutral"><span class="color-dot" style="background:${esc(tx.category_color || "#64748b")}"></span>${esc(tx.category_name || "Sem Categoria")}</span>`;

        const accHtml = isTr
            ? `${esc(tx.account_name || "")} → ${esc(tx.destination_account_name || "")}`
            : `${esc(tx.account_name || "—")} <span class="text-muted">· ${esc(PAYMENT_LABELS[tx.payment_method] || tx.payment_method)}</span>`;

        return `
            <tr>
                <td>
                    <strong>${fmtDateBR(tx.due_date)}</strong>
                </td>
                <td>
                    <div class="tx-desc-cell">
                        <div class="tx-desc-main">
                            <span>${esc(tx.description)}</span>
                            ${extraBadges.join(" ")}
                        </div>
                        ${subParts.length ? `<div class="tx-desc-sub">${subParts.join(" · ")}</div>` : ""}
                    </div>
                </td>
                <td>${catHtml}</td>
                <td>${accHtml}</td>
                <td>${statusBadge}</td>
                <td class="text-right">
                    <strong class="${isInc ? "text-success" : (isTr ? "text-info" : "text-danger")}">
                        ${isInc ? "+" : (isTr ? "⇄ " : "-")}${fmtBRL(tx.final_amount)}
                    </strong>
                </td>
                <td class="text-right">
                    <div class="action-btns">
                        ${tx.status === "pending"
                            ? `<button class="btn btn-success-soft btn-xs" title="Dar baixa (Pagar / Receber)" onclick="openPayModal(${tx.id})">✓ Baixar</button>`
                            : `<button class="btn btn-outline btn-xs" title="Estornar / Reabrir" onclick="reopenTx(${tx.id})">↩ Reabrir</button>`
                        }
                        <button class="btn btn-outline btn-xs" title="Editar" onclick="openEditTxModal(${tx.id})">✎</button>
                        <button class="btn btn-danger-soft btn-xs" title="Excluir" onclick="deleteTx(${tx.id})">🗑</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

// ==================== TAB 3: CASH FLOW ====================

async function loadCashflowOnly() {
    try {
        const cf = await api(`/api/cashflow?mode=${state.cfMode}&month=${state.currentMonth}&account_id=${state.cfAccountId}`);
        state.cashflow = cf;
        renderCashflow();
    } catch (err) {
        showToast(err.message, true);
    }
}

function renderCashflow() {
    const cf = state.cashflow;
    if (!cf || !cf.summary) return;

    const s = cf.summary;
    document.getElementById("cf-opening").textContent = fmtBRL(s.opening_projected);
    document.getElementById("cf-inflows").textContent = fmtBRL(s.total_inflows);
    document.getElementById("cf-outflows").textContent = fmtBRL(s.total_outflows);

    const closeEl = document.getElementById("cf-closing-proj");
    closeEl.textContent = fmtBRL(s.closing_projected);
    closeEl.className = `mini-kpi-val ${s.closing_projected >= 0 ? "text-success" : "text-danger"}`;

    const minEl = document.getElementById("cf-min-proj");
    minEl.textContent = fmtBRL(s.min_projected_balance);
    minEl.className = `mini-kpi-val ${s.min_projected_balance >= 0 ? "text-info" : "text-danger"}`;

    renderCashflowSvg("cf-main-chart", cf.series || [], 290);

    const tbody = document.getElementById("cf-table-body");
    tbody.innerHTML = (cf.series || []).map(row => {
        const net = row.net_projected;
        return `
            <tr>
                <td><strong>${esc(row.label)}</strong> <span class="text-muted">(${esc(row.date)})</span></td>
                <td class="text-right">${fmtBRL(row.opening_projected)}</td>
                <td class="text-right text-success">${row.income_paid > 0 ? fmtBRL(row.income_paid) : "—"}</td>
                <td class="text-right text-info">${row.income_pending > 0 ? fmtBRL(row.income_pending) : "—"}</td>
                <td class="text-right text-danger">${row.expense_paid > 0 ? fmtBRL(row.expense_paid) : "—"}</td>
                <td class="text-right text-warning">${row.expense_pending > 0 ? fmtBRL(row.expense_pending) : "—"}</td>
                <td class="text-right ${net > 0 ? "text-success" : (net < 0 ? "text-danger" : "text-muted")}">
                    ${net !== 0 ? (net > 0 ? "+" : "") + fmtBRL(net) : "—"}
                </td>
                <td class="text-right"><strong>${fmtBRL(row.balance_realized)}</strong></td>
                <td class="text-right"><strong class="${row.balance_projected < 0 ? "text-danger" : "text-success"}">${fmtBRL(row.balance_projected)}</strong></td>
            </tr>
        `;
    }).join("");
}

function renderCashflowSvg(containerId, series, height = 260) {
    const box = document.getElementById(containerId);
    if (!box) return;
    if (!series || !series.length) {
        box.innerHTML = `<div class="empty-state">Sem dados de fluxo de caixa para o período.</div>`;
        return;
    }

    const width = 860;
    const padL = 75;
    const padR = 24;
    const padT = 22;
    const padB = 34;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;

    let minVal = 0;
    let maxVal = 100;
    series.forEach(p => {
        minVal = Math.min(minVal, p.balance_realized, p.balance_projected, -p.expense_total);
        maxVal = Math.max(maxVal, p.balance_realized, p.balance_projected, p.income_total);
    });
    const span = (maxVal - minVal) || 1;
    minVal -= span * 0.08;
    maxVal += span * 0.08;

    const xAt = i => padL + (series.length === 1 ? plotW / 2 : (i / (series.length - 1)) * plotW);
    const yAt = v => padT + plotH - ((v - minVal) / (maxVal - minVal)) * plotH;
    const zeroY = yAt(0);

    const ptsReal = series.map((p, i) => `${xAt(i).toFixed(1)},${yAt(p.balance_realized).toFixed(1)}`).join(" ");
    const ptsProj = series.map((p, i) => `${xAt(i).toFixed(1)},${yAt(p.balance_projected).toFixed(1)}`).join(" ");
    const areaProj = `${xAt(0).toFixed(1)},${zeroY.toFixed(1)} ${ptsProj} ${xAt(series.length - 1).toFixed(1)},${zeroY.toFixed(1)}`;

    // Grid lines
    const gridLines = [];
    for (let g = 0; g <= 4; g++) {
        const val = minVal + ((maxVal - minVal) * g) / 4;
        const y = yAt(val);
        gridLines.push(`
            <line x1="${padL}" y1="${y.toFixed(1)}" x2="${width - padR}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,0.06)" />
            <text x="${padL - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" fill="#64748b" font-size="10.5">
                ${Math.round(val).toLocaleString("pt-BR")}
            </text>
        `);
    }

    // Bars for daily inflows/outflows
    const barW = Math.max(4, Math.min(16, (plotW / series.length) * 0.42));
    const bars = series.map((p, i) => {
        const cx = xAt(i);
        let incRect = "";
        let expRect = "";
        if (p.income_total > 0) {
            const topY = yAt(p.income_total);
            const h = Math.max(2, zeroY - topY);
            incRect = `<rect x="${(cx - barW / 2).toFixed(1)}" y="${topY.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" fill="rgba(16,185,129,0.28)" rx="2" />`;
        }
        if (p.expense_total > 0) {
            const botY = yAt(-p.expense_total);
            const h = Math.max(2, botY - zeroY);
            expRect = `<rect x="${(cx - barW / 2).toFixed(1)}" y="${zeroY.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" fill="rgba(244,63,94,0.28)" rx="2" />`;
        }
        return incRect + expRect;
    }).join("");

    // X labels
    const step = Math.max(1, Math.ceil(series.length / 10));
    const xLabels = series.map((p, i) => {
        if (i % step !== 0 && i !== series.length - 1) return "";
        return `<text x="${xAt(i).toFixed(1)}" y="${height - 10}" text-anchor="middle" fill="#94a3b8" font-size="10.5">${esc(p.label)}</text>`;
    }).join("");

    box.innerHTML = `
        <svg viewBox="0 0 ${width} ${height}" class="svg-chart">
            <defs>
                <linearGradient id="projGrad-${containerId}" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#10b981" stop-opacity="0.24" />
                    <stop offset="100%" stop-color="#10b981" stop-opacity="0.01" />
                </linearGradient>
            </defs>
            ${gridLines.join("")}
            <line x1="${padL}" y1="${zeroY.toFixed(1)}" x2="${width - padR}" y2="${zeroY.toFixed(1)}" stroke="rgba(255,255,255,0.2)" stroke-dasharray="3,3" />
            <polygon points="${areaProj}" fill="url(#projGrad-${containerId})" />
            ${bars}
            <polyline fill="none" stroke="#38bdf8" stroke-width="2" stroke-dasharray="5,4" points="${ptsProj}" />
            <polyline fill="none" stroke="#10b981" stroke-width="2.6" points="${ptsReal}" />
            ${xLabels}
        </svg>
    `;
}

// ==================== TAB 4: RECURRING ACCOUNTS ====================

async function loadRecurring() {
    try {
        const rows = await api("/api/recurring");
        state.recurring = rows;
        renderRecurringTable(rows);
    } catch (err) {
        showToast(err.message, true);
    }
}

function renderRecurringTable(rows) {
    const tbody = document.getElementById("rec-table-body");
    let incFixed = 0;
    let expFixed = 0;
    rows.forEach(r => {
        if (r.type === "income") incFixed += Number(r.amount || 0);
        else expFixed += Number(r.amount || 0);
    });

    document.getElementById("rec-sum-count").textContent = rows.length;
    document.getElementById("rec-sum-income").textContent = fmtBRL(incFixed);
    document.getElementById("rec-sum-expense").textContent = fmtBRL(expFixed);
    const netEl = document.getElementById("rec-sum-net");
    netEl.textContent = fmtBRL(incFixed - expFixed);
    netEl.className = (incFixed - expFixed) >= 0 ? "text-success" : "text-danger";

    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="9" class="empty-state">Nenhuma conta recorrente cadastrada.</td></tr>`;
        return;
    }

    tbody.innerHTML = rows.map(r => {
        const isInc = r.type === "income";
        const personBadge = r.person_name
            ? `<span class="mini-tag" style="color:#a78bfa">${r.person_type === "PJ" ? "🏢" : "👤"} ${esc(r.person_name)} [${esc(r.person_type || "PF")}]</span>`
            : "";
        return `
            <tr>
                <td><strong>Dia ${r.day_of_month}</strong></td>
                <td>
                    <div class="tx-desc-main">${esc(r.description)} ${personBadge}</div>
                    ${r.contact ? `<div class="tx-desc-sub">${esc(r.contact)}</div>` : ""}
                </td>
                <td>
                    <span class="badge ${isInc ? "badge-success" : "badge-danger"}">
                        ${isInc ? "▲ Receita Fixa" : "▼ Despesa Fixa"}
                    </span>
                </td>
                <td>
                    <span class="badge badge-neutral">
                        <span class="color-dot" style="background:${esc(r.category_color || "#64748b")}"></span>
                        ${esc(r.category_name || "Sem Categoria")}
                    </span>
                </td>
                <td>${esc(r.account_name || "—")}</td>
                <td>${esc(FREQ_LABELS[r.frequency] || r.frequency)}</td>
                <td>${r.auto_pay ? `<span class="badge badge-info">Automática</span>` : `<span class="badge badge-neutral">Manual (Pendente)</span>`}</td>
                <td class="text-right">
                    <strong class="${isInc ? "text-success" : "text-danger"}">${fmtBRL(r.amount)}</strong>
                </td>
                <td class="text-right">
                    <div class="action-btns">
                        <button class="btn btn-outline btn-xs" onclick="openEditRecurring(${r.id})">✎</button>
                        <button class="btn btn-danger-soft btn-xs" onclick="deleteRecurring(${r.id})">🗑</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

// ==================== TAB 5: BANK IMPORT & RECONCILIATION ====================

async function loadRules() {
    try {
        const rules = await api("/api/rules");
        state.rules = rules;
        const box = document.getElementById("rules-list-box");
        if (!rules.length) {
            box.innerHTML = `<div class="empty-state">Nenhuma regra cadastrada.</div>`;
            return;
        }
        box.innerHTML = rules.map(r => `
            <div class="rule-row">
                <div>
                    <strong>"${esc(r.keyword)}"</strong> →
                    <span class="badge badge-neutral">
                        <span class="color-dot" style="background:${esc(r.category_color)}"></span>
                        ${esc(r.category_name)}
                    </span>
                </div>
                <button class="btn btn-danger-soft btn-xs" onclick="deleteRule(${r.id})">✕</button>
            </div>
        `).join("");
    } catch (err) {
        showToast(err.message, true);
    }
}

function renderImportPreview(preview) {
    state.importPreview = preview;
    const card = document.getElementById("import-preview-card");
    card.style.display = "block";

    document.getElementById("import-preview-summary").innerHTML = `
        Formato detectado: <strong>${esc(preview.format)}</strong> ·
        Total no extrato: <strong>${preview.total_found}</strong> ·
        <span class="text-info">🔗 Sugestões de Conciliação: <strong>${preview.reconcile_count}</strong></span> ·
        <span class="text-success">✨ Novos para importar: <strong>${preview.new_count}</strong></span> ·
        <span class="text-muted">⏭ Já importados antes: <strong>${preview.duplicate_count}</strong></span>
    `;

    const tbody = document.getElementById("import-preview-tbody");
    tbody.innerHTML = preview.items.map((it, idx) => {
        const isInc = it.type === "income";
        const catOptions = state.categories
            .filter(c => c.type === it.type)
            .map(c => `<option value="${c.id}" ${c.id === it.category_id ? "selected" : ""}>${esc(c.name)}</option>`)
            .join("");

        let reconcileOption = "";
        if (it.reconcile_candidate) {
            const rc = it.reconcile_candidate;
            reconcileOption = `<option value="reconcile" ${it.action === "reconcile" ? "selected" : ""}>
                🔗 Conciliar e dar baixa em: "${esc(rc.description)}" (Venc. ${fmtDateBR(rc.due_date)})
            </option>`;
        }

        return `
            <tr>
                <td><strong>${fmtDateBR(it.date)}</strong></td>
                <td>
                    <div class="tx-desc-main">${esc(it.description)}</div>
                    <div class="tx-desc-sub">ID Banco: ${esc(it.fitid)}</div>
                </td>
                <td>
                    <span class="badge ${isInc ? "badge-success" : "badge-danger"}">
                        ${isInc ? "▲ Entrada" : "▼ Saída"}
                    </span>
                </td>
                <td class="text-right">
                    <strong class="${isInc ? "text-success" : "text-danger"}">${fmtBRL(it.amount)}</strong>
                </td>
                <td>
                    <select class="form-select import-action-select" data-idx="${idx}">
                        ${reconcileOption}
                        <option value="import" ${it.action === "import" ? "selected" : ""}>✨ Importar como Novo Lançamento</option>
                        <option value="skip" ${it.action === "skip" ? "selected" : ""}>⏭ Ignorar ${it.already_imported ? "(Já importado)" : ""}</option>
                    </select>
                </td>
                <td>
                    <select class="form-select import-cat-select" data-idx="${idx}">
                        ${catOptions}
                    </select>
                </td>
            </tr>
        `;
    }).join("");
}

// ==================== TAB 6: PLANNING ====================

async function loadPlanning() {
    try {
        const [accounts, categories, goals] = await Promise.all([
            api("/api/accounts"),
            api("/api/categories"),
            api("/api/goals")
        ]);
        state.accounts = accounts;
        state.categories = categories;
        state.goals = goals;
        renderPlanning();
    } catch (err) {
        showToast(err.message, true);
    }
}

function renderPlanning() {
    // Contas
    const accBox = document.getElementById("planning-accounts-list");
    accBox.innerHTML = state.accounts.map(a => `
        <div class="planning-item">
            <div class="item-row-top">
                <div class="item-title-group">
                    <span class="color-dot" style="background:${esc(a.color)}"></span>
                    <div>
                        <div>${esc(a.name)}</div>
                        <div class="tx-desc-sub">${esc(ACC_TYPE_LABELS[a.type] || a.type)} ${a.institution ? "· " + esc(a.institution) : ""}</div>
                    </div>
                </div>
                <div class="action-btns">
                    <button class="btn btn-outline btn-xs" onclick="openEditAccount(${a.id})">✎</button>
                    <button class="btn btn-danger-soft btn-xs" onclick="deleteAccount(${a.id})">🗑</button>
                </div>
            </div>
            <div class="tx-desc-sub" style="display:flex; justify-content:space-between; margin-top:6px;">
                <span>Saldo Atual: <strong class="text-success">${fmtBRL(a.current_balance)}</strong></span>
                <span>Projetado: <strong>${fmtBRL(a.projected_balance)}</strong></span>
            </div>
        </div>
    `).join("");

    // Categorias
    const catBox = document.getElementById("planning-categories-list");
    catBox.innerHTML = state.categories.map(c => `
        <div class="planning-item">
            <div class="item-row-top">
                <div class="item-title-group">
                    <span class="color-dot" style="background:${esc(c.color)}"></span>
                    <div>
                        <div>${esc(c.name)}</div>
                        <div class="tx-desc-sub">
                            ${c.type === "income" ? "▲ Receita" : "▼ Despesa"}
                            ${c.budget_monthly > 0 ? ` · Teto: <strong>${fmtBRL(c.budget_monthly)}/mês</strong>` : ""}
                        </div>
                    </div>
                </div>
                <div class="action-btns">
                    <button class="btn btn-outline btn-xs" onclick="openEditCategory(${c.id})">✎</button>
                    <button class="btn btn-danger-soft btn-xs" onclick="deleteCategory(${c.id})">🗑</button>
                </div>
            </div>
        </div>
    `).join("");

    // Metas
    const goalBox = document.getElementById("planning-goals-list");
    if (!state.goals.length) {
        goalBox.innerHTML = `<div class="empty-state">Nenhuma meta cadastrada.</div>`;
    } else {
        goalBox.innerHTML = state.goals.map(g => `
            <div class="planning-item">
                <div class="item-row-top">
                    <div class="item-title-group">
                        <span class="color-dot" style="background:${esc(g.color)}"></span>
                        <div>
                            <div>${esc(g.name)}</div>
                            <div class="tx-desc-sub">
                                ${fmtBRL(g.current_amount)} de ${fmtBRL(g.target_amount)} (${g.progress_pct}%)
                                ${g.deadline ? ` · Prazo: ${fmtDateBR(g.deadline)}` : ""}
                            </div>
                        </div>
                    </div>
                    <div class="action-btns">
                        <button class="btn btn-success-soft btn-xs" onclick="contributeGoalPrompt(${g.id})">+ Aportar</button>
                        <button class="btn btn-danger-soft btn-xs" onclick="deleteGoal(${g.id})">🗑</button>
                    </div>
                </div>
                <div class="progress-track">
                    <div class="progress-fill" style="width:${Math.min(100, g.progress_pct)}%; background:${esc(g.color)}"></div>
                </div>
            </div>
        `).join("");
    }
}

// ==================== MODALS & ACTIONS ====================

function openModal(id) {
    document.getElementById(id).style.display = "flex";
}

function closeModal(id) {
    document.getElementById(id).style.display = "none";
}

function openNewTxModal(defaultType = "expense") {
    document.getElementById("modal-tx-title").textContent = "Novo Lançamento Financeiro";
    document.getElementById("tx-id").value = "";
    document.getElementById("form-tx").reset();
    const radio = document.querySelector(`input[name="tx-type"][value="${defaultType}"]`);
    if (radio) radio.checked = true;
    handleTxTypeToggle(defaultType);
    document.getElementById("tx-due-date").value = `${state.currentMonth}-${getTodayISO().slice(8, 10)}`;
    document.getElementById("tx-status").value = "pending";
    document.getElementById("tx-person-id").value = "0";
    document.getElementById("tx-installments-row").style.display = "grid";
    openModal("modal-tx");
}

window.openEditTxModal = function(id) {
    const tx = state.transactions.find(t => t.id === id) ||
        (state.dashboard && state.dashboard.overdue.items.find(t => t.id === id)) ||
        (state.dashboard && state.dashboard.upcoming.items.find(t => t.id === id));
    if (!tx) return;

    document.getElementById("modal-tx-title").textContent = `Editar Lançamento #${tx.id}`;
    document.getElementById("tx-id").value = tx.id;
    const radio = document.querySelector(`input[name="tx-type"][value="${tx.type}"]`);
    if (radio) radio.checked = true;
    handleTxTypeToggle(tx.type);

    document.getElementById("tx-description").value = tx.description || "";
    document.getElementById("tx-amount").value = tx.amount || 0;
    document.getElementById("tx-due-date").value = tx.due_date || getTodayISO();
    document.getElementById("tx-status").value = tx.status || "pending";
    document.getElementById("tx-payment-date").value = tx.payment_date || "";
    document.getElementById("tx-account-id").value = tx.account_id || "";
    if (tx.destination_account_id) {
        document.getElementById("tx-dest-account-id").value = tx.destination_account_id;
    }
    if (tx.category_id) {
        document.getElementById("tx-category-id").value = tx.category_id;
    }
    document.getElementById("tx-payment-method").value = tx.payment_method || "pix";
    document.getElementById("tx-person-id").value = tx.person_id || "0";
    document.getElementById("tx-contact").value = tx.contact || "";
    document.getElementById("tx-discount").value = tx.discount || 0;
    document.getElementById("tx-interest").value = tx.interest || 0;
    document.getElementById("tx-tags").value = tx.tags || "";
    document.getElementById("tx-notes").value = tx.notes || "";
    document.getElementById("tx-installments-row").style.display = "none";

    openModal("modal-tx");
};

function handleTxTypeToggle(txType) {
    const isTr = txType === "transfer";
    document.getElementById("tx-category-group").style.display = isTr ? "none" : "flex";
    document.getElementById("tx-dest-account-group").style.display = isTr ? "flex" : "none";
    document.getElementById("tx-account-label").textContent = isTr ? "Conta de Origem *" : "Conta Bancária / Carteira *";
    if (!isTr) populateTxCategorySelect(txType);
}

window.openPayModal = function(id) {
    const allLists = [
        ...(state.transactions || []),
        ...((state.dashboard && state.dashboard.overdue.items) || []),
        ...((state.dashboard && state.dashboard.upcoming.items) || [])
    ];
    const tx = allLists.find(t => t.id === id);
    if (!tx) return;

    document.getElementById("pay-tx-id").value = tx.id;
    document.getElementById("modal-pay-title").textContent = tx.type === "income"
        ? "Confirmar Recebimento de Conta"
        : "Dar Baixa / Pagar Conta";
    document.getElementById("pay-summary-banner").innerHTML = `
        <div><strong>${esc(tx.description)}</strong></div>
        <div class="tx-desc-sub">Vencimento original: ${fmtDateBR(tx.due_date)} · Categoria: ${esc(tx.category_name || "—")}</div>
    `;
    document.getElementById("pay-date").value = getTodayISO();
    document.getElementById("pay-account-id").value = tx.account_id || (state.accounts[0] && state.accounts[0].id);
    document.getElementById("pay-amount").value = tx.amount;
    document.getElementById("pay-discount").value = tx.discount || 0;
    document.getElementById("pay-interest").value = tx.interest || 0;
    updatePayFinalDisplay();
    openModal("modal-pay");
};

function updatePayFinalDisplay() {
    const amt = Number(document.getElementById("pay-amount").value || 0);
    const disc = Number(document.getElementById("pay-discount").value || 0);
    const intr = Number(document.getElementById("pay-interest").value || 0);
    document.getElementById("pay-final-display").textContent = fmtBRL(amt - disc + intr);
}

window.reopenTx = async function(id) {
    try {
        await api(`/api/transactions/${id}/reopen`, { method: "POST" });
        showToast("Lançamento reaberto como pendente.");
        await refreshAll();
    } catch (err) {
        showToast(err.message, true);
    }
};

window.deleteTx = async function(id) {
    if (!confirm("Deseja realmente excluir este lançamento?")) return;
    try {
        await api(`/api/transactions/${id}`, { method: "DELETE" });
        showToast("Lançamento excluído.");
        await refreshAll();
    } catch (err) {
        showToast(err.message, true);
    }
};

window.openEditRecurring = function(id) {
    const r = state.recurring.find(x => x.id === id);
    if (!r) return;
    document.getElementById("modal-rec-title").textContent = "Editar Conta Recorrente";
    document.getElementById("rec-id").value = r.id;
    document.getElementById("rec-description").value = r.description;
    document.getElementById("rec-amount").value = r.amount;
    document.getElementById("rec-type").value = r.type;
    populateRecCategorySelect(r.type);
    document.getElementById("rec-category-id").value = r.category_id || "";
    document.getElementById("rec-account-id").value = r.account_id || "";
    document.getElementById("rec-person-id").value = r.person_id || "0";
    document.getElementById("rec-frequency").value = r.frequency || "monthly";
    document.getElementById("rec-day").value = r.day_of_month || 5;
    document.getElementById("rec-start-date").value = r.start_date || getTodayISO();
    document.getElementById("rec-end-date").value = r.end_date || "";
    document.getElementById("rec-auto-pay").value = r.auto_pay ? "1" : "0";
    document.getElementById("rec-contact").value = r.contact || "";
    openModal("modal-recurring");
};

function updatePersonModalLabels(pType) {
    const isPJ = pType === "PJ";
    document.getElementById("person-name-label").textContent = isPJ
        ? "Razão Social / Nome da Empresa *"
        : "Nome Completo *";
    document.getElementById("person-doc-label").textContent = isPJ
        ? "CNPJ (Opcional — não é obrigatório)"
        : "CPF (Opcional — não é obrigatório)";
}

window.openNewPersonModal = function() {
    document.getElementById("modal-person-title").textContent = "Cadastrar Pessoa (Física ou Jurídica)";
    document.getElementById("person-id").value = "";
    document.getElementById("form-person").reset();
    document.getElementById("person-type").value = "PF";
    document.getElementById("person-role").value = "ambos";
    updatePersonModalLabels("PF");
    openModal("modal-person");
};

window.openEditPerson = function(id) {
    const p = state.people.find(x => x.id === id);
    if (!p) return;
    document.getElementById("modal-person-title").textContent = `Editar Pessoa: ${p.name}`;
    document.getElementById("person-id").value = p.id;
    document.getElementById("person-type").value = p.person_type || "PF";
    updatePersonModalLabels(p.person_type || "PF");
    document.getElementById("person-role").value = p.role || "ambos";
    document.getElementById("person-name").value = p.name || "";
    document.getElementById("person-trade-name").value = p.trade_name || "";
    document.getElementById("person-document").value = p.document || "";
    document.getElementById("person-phone").value = p.phone || "";
    document.getElementById("person-email").value = p.email || "";
    document.getElementById("person-pix-key").value = p.pix_key || "";
    document.getElementById("person-notes").value = p.notes || "";
    openModal("modal-person");
};

window.deletePerson = async function(id) {
    if (!confirm("Deseja remover este cadastro de pessoa?")) return;
    try {
        await api(`/api/people/${id}`, { method: "DELETE" });
        showToast("Pessoa removida.");
        await refreshAll();
    } catch (err) {
        showToast(err.message, true);
    }
};

window.viewPersonTransactions = function(personId) {
    document.getElementById("filter-person").value = String(personId);
    switchTab("transactions");
};

window.deleteRecurring = async function(id) {
    if (!confirm("Deseja desativar esta conta recorrente?")) return;
    try {
        await api(`/api/recurring/${id}`, { method: "DELETE" });
        showToast("Regra recorrente removida.");
        await refreshAll();
    } catch (err) {
        showToast(err.message, true);
    }
};

window.openNewAccountModal = function() {
    document.getElementById("modal-acc-title").textContent = "Cadastrar Nova Conta Bancária / Carteira";
    document.getElementById("acc-id").value = "";
    document.getElementById("form-account").reset();
    document.getElementById("acc-color").value = "#10b981";
    openModal("modal-account");
};

window.openEditAccount = function(id) {
    const a = state.accounts.find(x => x.id === id);
    if (!a) return;
    document.getElementById("modal-acc-title").textContent = `Editar Conta Bancária: ${a.name}`;
    document.getElementById("acc-id").value = a.id;
    document.getElementById("acc-bank-preset").value = "";
    document.getElementById("acc-name").value = a.name || "";
    document.getElementById("acc-institution").value = a.institution || "";
    document.getElementById("acc-bank-code").value = a.bank_code || "";
    document.getElementById("acc-branch").value = a.branch || "";
    document.getElementById("acc-number").value = a.account_number || "";
    document.getElementById("acc-pix-key").value = a.pix_key || "";
    document.getElementById("acc-type").value = a.type || "checking";
    document.getElementById("acc-initial-balance").value = a.initial_balance || 0;
    document.getElementById("acc-credit-limit").value = a.credit_limit || 0;
    document.getElementById("acc-closing-day").value = a.closing_day || 1;
    document.getElementById("acc-due-day").value = a.due_day || 10;
    document.getElementById("acc-notes").value = a.notes || "";
    document.getElementById("acc-color").value = a.color || "#10b981";
    openModal("modal-account");
};

window.adjustAccountBalancePrompt = async function(id, currentBal) {
    const a = state.accounts.find(x => x.id === id);
    const valStr = prompt(
        `Qual é o saldo real atual na conta "${a ? a.name : id}"?\n(O sistema criará automaticamente um lançamento de ajuste se houver diferença)`,
        String(Number(currentBal || 0).toFixed(2))
    );
    if (valStr === null || valStr.trim() === "") return;
    const target = Number(valStr.replace(",", "."));
    if (isNaN(target)) {
        showToast("Valor inválido", true);
        return;
    }
    try {
        const res = await api(`/api/accounts/${id}/adjust`, {
            method: "POST",
            body: { target_balance: target, reason: "Ajuste de Conciliação de Saldo Bancário" }
        });
        if (Math.abs(res.adjusted) < 0.01) {
            showToast("O saldo já estava exato!");
        } else {
            showToast(`Saldo ajustado com sucesso (${res.adjusted > 0 ? "+" : ""}${fmtBRL(res.adjusted)})!`);
        }
        await refreshAll();
    } catch (err) {
        showToast(err.message, true);
    }
};

window.viewAccountTransactions = function(accountId) {
    document.getElementById("filter-account").value = String(accountId);
    switchTab("transactions");
};

window.goToImportForAccount = function(accountId) {
    document.getElementById("import-account-id").value = String(accountId);
    switchTab("import");
};

window.deleteAccount = async function(id) {
    if (!confirm("Deseja remover esta conta?")) return;
    try {
        await api(`/api/accounts/${id}`, { method: "DELETE" });
        showToast("Conta removida.");
        await refreshAll();
    } catch (err) {
        showToast(err.message, true);
    }
};

window.openEditCategory = function(id) {
    const c = state.categories.find(x => x.id === id);
    if (!c) return;
    document.getElementById("modal-cat-title").textContent = "Editar Categoria & Orçamento";
    document.getElementById("cat-id").value = c.id;
    document.getElementById("cat-name").value = c.name;
    document.getElementById("cat-type").value = c.type;
    document.getElementById("cat-budget").value = c.budget_monthly || 0;
    document.getElementById("cat-color").value = c.color || "#6366f1";
    openModal("modal-category");
};

window.deleteCategory = async function(id) {
    if (!confirm("Deseja remover esta categoria?")) return;
    try {
        await api(`/api/categories/${id}`, { method: "DELETE" });
        showToast("Categoria removida.");
        await refreshAll();
    } catch (err) {
        showToast(err.message, true);
    }
};

window.contributeGoalPrompt = async function(id) {
    const valStr = prompt("Qual valor deseja aportar na meta? (Use sinal negativo para resgatar)", "250.00");
    if (!valStr) return;
    const amount = Number(valStr.replace(",", "."));
    if (isNaN(amount) || amount === 0) return;
    try {
        await api(`/api/goals/${id}/contribute`, { method: "POST", body: { amount } });
        showToast("Saldo da meta atualizado!");
        await refreshAll();
    } catch (err) {
        showToast(err.message, true);
    }
};

window.deleteGoal = async function(id) {
    if (!confirm("Deseja excluir esta meta financeira?")) return;
    try {
        await api(`/api/goals/${id}`, { method: "DELETE" });
        showToast("Meta removida.");
        await refreshAll();
    } catch (err) {
        showToast(err.message, true);
    }
};

window.deleteRule = async function(id) {
    try {
        await api(`/api/rules/${id}`, { method: "DELETE" });
        showToast("Regra removida.");
        await loadRules();
    } catch (err) {
        showToast(err.message, true);
    }
};

// ==================== EVENT LISTENERS ====================

function setupEventListeners() {
    // Sidebar navigation
    document.querySelectorAll(".nav-item").forEach(btn => {
        btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });

    document.querySelectorAll("[data-goto-tab]").forEach(btn => {
        btn.addEventListener("click", () => switchTab(btn.dataset.gotoTab));
    });

    // Month navigation
    document.getElementById("btn-prev-month").addEventListener("click", () => {
        state.currentMonth = shiftMonth(state.currentMonth, -1);
        updateMonthDisplay();
        refreshAll();
    });
    document.getElementById("btn-next-month").addEventListener("click", () => {
        state.currentMonth = shiftMonth(state.currentMonth, 1);
        updateMonthDisplay();
        refreshAll();
    });
    document.getElementById("btn-current-month").addEventListener("click", () => {
        state.currentMonth = getTodayYM();
        updateMonthDisplay();
        refreshAll();
    });

    // Topbar quick buttons
    document.getElementById("btn-QuickExpense").addEventListener("click", () => openNewTxModal("expense"));
    document.getElementById("btn-QuickIncome").addEventListener("click", () => openNewTxModal("income"));
    document.getElementById("btn-NewTransaction").addEventListener("click", () => openNewTxModal("expense"));
    document.getElementById("btn-add-tx-inline").addEventListener("click", () => openNewTxModal("expense"));

    // Close modals
    document.querySelectorAll("[data-close-modal]").forEach(btn => {
        btn.addEventListener("click", () => closeModal(btn.dataset.closeModal));
    });

    // Radio type change in Tx modal
    document.querySelectorAll('input[name="tx-type"]').forEach(r => {
        r.addEventListener("change", e => handleTxTypeToggle(e.target.value));
    });

    // Submit Tx Form
    document.getElementById("form-tx").addEventListener("submit", async e => {
        e.preventDefault();
        const id = document.getElementById("tx-id").value;
        const checkedRadio = document.querySelector('input[name="tx-type"]:checked');
        const payload = {
            type: checkedRadio ? checkedRadio.value : "expense",
            description: document.getElementById("tx-description").value,
            amount: Number(document.getElementById("tx-amount").value),
            due_date: document.getElementById("tx-due-date").value,
            status: document.getElementById("tx-status").value,
            payment_date: document.getElementById("tx-payment-date").value,
            account_id: Number(document.getElementById("tx-account-id").value),
            destination_account_id: Number(document.getElementById("tx-dest-account-id").value),
            category_id: Number(document.getElementById("tx-category-id").value),
            person_id: Number(document.getElementById("tx-person-id").value || 0),
            payment_method: document.getElementById("tx-payment-method").value,
            contact: document.getElementById("tx-contact").value,
            discount: Number(document.getElementById("tx-discount").value || 0),
            interest: Number(document.getElementById("tx-interest").value || 0),
            installments: Number(document.getElementById("tx-installments").value || 1),
            tags: document.getElementById("tx-tags").value,
            notes: document.getElementById("tx-notes").value
        };

        try {
            if (id) {
                await api(`/api/transactions/${id}`, { method: "PUT", body: payload });
                showToast("Lançamento atualizado com sucesso!");
            } else {
                await api("/api/transactions", { method: "POST", body: payload });
                showToast(payload.installments > 1 ? `${payload.installments} parcelas geradas com sucesso!` : "Lançamento salvo com sucesso!");
            }
            closeModal("modal-tx");
            await refreshAll();
        } catch (err) {
            showToast(err.message, true);
        }
    });

    // Pay modal live calculation & submit
    ["pay-amount", "pay-discount", "pay-interest"].forEach(fid => {
        document.getElementById(fid).addEventListener("input", updatePayFinalDisplay);
    });

    document.getElementById("form-pay").addEventListener("submit", async e => {
        e.preventDefault();
        const id = document.getElementById("pay-tx-id").value;
        const body = {
            payment_date: document.getElementById("pay-date").value,
            account_id: Number(document.getElementById("pay-account-id").value),
            amount: Number(document.getElementById("pay-amount").value),
            discount: Number(document.getElementById("pay-discount").value || 0),
            interest: Number(document.getElementById("pay-interest").value || 0)
        };
        try {
            await api(`/api/transactions/${id}/pay`, { method: "POST", body });
            showToast("Baixa realizada com sucesso!");
            closeModal("modal-pay");
            await refreshAll();
        } catch (err) {
            showToast(err.message, true);
        }
    });

    // Transactions quick tabs & filters
    document.querySelectorAll("#tx-quick-tabs .pill-tab").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll("#tx-quick-tabs .pill-tab").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const tab = btn.dataset.filterTab;
            const typeSel = document.getElementById("filter-type");
            const stSel = document.getElementById("filter-status");
            if (tab === "all") { typeSel.value = "all"; stSel.value = "all"; }
            else if (tab === "payable") { typeSel.value = "expense"; stSel.value = "pending"; }
            else if (tab === "receivable") { typeSel.value = "income"; stSel.value = "pending"; }
            else if (tab === "overdue") { typeSel.value = "all"; stSel.value = "overdue"; }
            else if (tab === "paid") { typeSel.value = "all"; stSel.value = "paid"; }
            else if (tab === "transfer") { typeSel.value = "transfer"; stSel.value = "all"; }
            loadTransactions();
        });
    });

    ["filter-search", "filter-category", "filter-account", "filter-person", "filter-type", "filter-status"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(id === "filter-search" ? "input" : "change", () => loadTransactions());
    });

    document.getElementById("btn-export-csv").addEventListener("click", () => {
        window.open(`/api/export/csv?month=${state.currentMonth}`, "_blank");
    });

    // Cashflow controls
    document.querySelectorAll("[data-cf-mode]").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll("[data-cf-mode]").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            state.cfMode = btn.dataset.cfMode;
            loadCashflowOnly();
        });
    });

    document.getElementById("cf-account-filter").addEventListener("change", e => {
        state.cfAccountId = e.target.value;
        loadCashflowOnly();
    });

    // Recurring
    document.getElementById("rec-type").addEventListener("change", e => populateRecCategorySelect(e.target.value));
    document.getElementById("btn-new-recurring").addEventListener("click", () => {
        document.getElementById("modal-rec-title").textContent = "Nova Conta Recorrente";
        document.getElementById("rec-id").value = "";
        document.getElementById("form-recurring").reset();
        document.getElementById("rec-start-date").value = `${state.currentMonth}-01`;
        document.getElementById("rec-person-id").value = "0";
        populateRecCategorySelect("expense");
        openModal("modal-recurring");
    });

    document.getElementById("form-recurring").addEventListener("submit", async e => {
        e.preventDefault();
        const id = document.getElementById("rec-id").value;
        const body = {
            description: document.getElementById("rec-description").value,
            amount: Number(document.getElementById("rec-amount").value),
            type: document.getElementById("rec-type").value,
            frequency: document.getElementById("rec-frequency").value,
            day_of_month: Number(document.getElementById("rec-day").value),
            category_id: Number(document.getElementById("rec-category-id").value),
            account_id: Number(document.getElementById("rec-account-id").value),
            person_id: Number(document.getElementById("rec-person-id").value || 0),
            start_date: document.getElementById("rec-start-date").value,
            end_date: document.getElementById("rec-end-date").value,
            auto_pay: Number(document.getElementById("rec-auto-pay").value),
            contact: document.getElementById("rec-contact").value
        };
        try {
            if (id) {
                await api(`/api/recurring/${id}`, { method: "PUT", body });
                showToast("Recorrência atualizada!");
            } else {
                await api("/api/recurring", { method: "POST", body });
                showToast("Conta recorrente cadastrada e gerada para o mês!");
            }
            closeModal("modal-recurring");
            await refreshAll();
        } catch (err) {
            showToast(err.message, true);
        }
    });

    document.getElementById("btn-generate-recurring").addEventListener("click", async () => {
        try {
            const r = await api("/api/recurring/generate", { method: "POST", body: { month: state.currentMonth } });
            showToast(`${r.generated} novos lançamentos gerados para ${r.month}!`);
            await refreshAll();
        } catch (err) {
            showToast(err.message, true);
        }
    });

    // Bank Import (OFX / CSV)
    document.getElementById("import-file-input").addEventListener("change", e => {
        const file = e.target.files[0];
        if (!file) return;
        state.importFilename = file.name;
        const reader = new FileReader();
        reader.onload = ev => {
            document.getElementById("import-raw-content").value = ev.target.result;
        };
        reader.readAsText(file);
    });

    document.getElementById("btn-sample-ofx").addEventListener("click", async () => {
        try {
            const sample = await api(`/api/import/sample?format=ofx&month=${state.currentMonth}`);
            state.importFilename = sample.filename;
            document.getElementById("import-raw-content").value = sample.content;
            showToast("Extrato OFX de exemplo carregado! Clique em 'Analisar Extrato e Conciliar'.");
        } catch (err) {
            showToast(err.message, true);
        }
    });

    document.getElementById("btn-sample-csv").addEventListener("click", async () => {
        try {
            const sample = await api(`/api/import/sample?format=csv&month=${state.currentMonth}`);
            state.importFilename = sample.filename;
            document.getElementById("import-raw-content").value = sample.content;
            showToast("Extrato CSV de exemplo carregado! Clique em 'Analisar Extrato e Conciliar'.");
        } catch (err) {
            showToast(err.message, true);
        }
    });

    document.getElementById("btn-preview-import").addEventListener("click", async () => {
        const content = document.getElementById("import-raw-content").value;
        const accountId = Number(document.getElementById("import-account-id").value);
        if (!content.trim()) {
            showToast("Selecione um arquivo OFX/CSV ou carregue um extrato de exemplo.", true);
            return;
        }
        try {
            const preview = await api("/api/import/preview", {
                method: "POST",
                body: { content, filename: state.importFilename, account_id: accountId }
            });
            renderImportPreview(preview);
        } catch (err) {
            showToast(err.message, true);
        }
    });

    document.getElementById("btn-cancel-import").addEventListener("click", () => {
        document.getElementById("import-preview-card").style.display = "none";
        state.importPreview = null;
    });

    document.getElementById("btn-commit-import").addEventListener("click", async () => {
        if (!state.importPreview) return;
        const items = state.importPreview.items.map((it, idx) => {
            const actSel = document.querySelector(`.import-action-select[data-idx="${idx}"]`);
            const catSel = document.querySelector(`.import-cat-select[data-idx="${idx}"]`);
            return {
                ...it,
                action: actSel ? actSel.value : it.action,
                category_id: catSel ? Number(catSel.value) : it.category_id
            };
        });
        try {
            const res = await api("/api/import/commit", {
                method: "POST",
                body: {
                    account_id: Number(document.getElementById("import-account-id").value),
                    items
                }
            });
            showToast(`Concluído! ${res.imported} importados, ${res.reconciled} conciliados e ${res.skipped} ignorados.`);
            document.getElementById("import-preview-card").style.display = "none";
            state.importPreview = null;
            await refreshAll();
        } catch (err) {
            showToast(err.message, true);
        }
    });

    document.getElementById("form-new-rule").addEventListener("submit", async e => {
        e.preventDefault();
        const kw = document.getElementById("rule-keyword").value;
        const cid = Number(document.getElementById("rule-category").value);
        try {
            await api("/api/rules", { method: "POST", body: { keyword: kw, category_id: cid } });
            document.getElementById("rule-keyword").value = "";
            showToast("Regra de auto-categorização criada!");
            await loadRules();
        } catch (err) {
            showToast(err.message, true);
        }
    });

    // People (PF / PJ) buttons & form
    document.getElementById("btn-page-new-person").addEventListener("click", () => window.openNewPersonModal());
    document.getElementById("btn-quick-person-tx").addEventListener("click", () => window.openNewPersonModal());
    document.getElementById("person-type").addEventListener("change", e => updatePersonModalLabels(e.target.value));

    ["people-search", "people-filter-type", "people-filter-role"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(id === "people-search" ? "input" : "change", () => loadPeople());
    });

    document.getElementById("form-person").addEventListener("submit", async e => {
        e.preventDefault();
        const id = document.getElementById("person-id").value;
        const body = {
            person_type: document.getElementById("person-type").value,
            role: document.getElementById("person-role").value,
            name: document.getElementById("person-name").value,
            trade_name: document.getElementById("person-trade-name").value,
            document: document.getElementById("person-document").value,
            phone: document.getElementById("person-phone").value,
            email: document.getElementById("person-email").value,
            pix_key: document.getElementById("person-pix-key").value,
            notes: document.getElementById("person-notes").value
        };
        try {
            let saved = null;
            if (id) {
                saved = await api(`/api/people/${id}`, { method: "PUT", body });
                showToast("Cadastro de pessoa atualizado!");
            } else {
                saved = await api("/api/people", { method: "POST", body });
                showToast("Pessoa cadastrada com sucesso!");
            }
            closeModal("modal-person");
            await refreshAll();
            if (saved && saved.id && document.getElementById("modal-tx").style.display === "flex") {
                document.getElementById("tx-person-id").value = String(saved.id);
            }
        } catch (err) {
            showToast(err.message, true);
        }
    });

    // Account creation & preset buttons
    document.getElementById("btn-new-account").addEventListener("click", () => window.openNewAccountModal());
    document.getElementById("btn-page-new-account").addEventListener("click", () => window.openNewAccountModal());
    document.getElementById("btn-sidebar-new-account").addEventListener("click", () => window.openNewAccountModal());
    document.getElementById("btn-transfer-between-accounts").addEventListener("click", () => openNewTxModal("transfer"));

    document.getElementById("acc-bank-preset").addEventListener("change", e => {
        const val = e.target.value;
        if (!val) return;
        const [code, inst, color] = val.split("|");
        document.getElementById("acc-bank-code").value = code || "";
        document.getElementById("acc-institution").value = inst || "";
        if (color) document.getElementById("acc-color").value = color;
        const nameInput = document.getElementById("acc-name");
        if (!nameInput.value.trim()) {
            nameInput.value = `Conta ${inst}`;
        }
    });

    document.getElementById("form-account").addEventListener("submit", async e => {
        e.preventDefault();
        const id = document.getElementById("acc-id").value;
        const body = {
            name: document.getElementById("acc-name").value,
            institution: document.getElementById("acc-institution").value,
            bank_code: document.getElementById("acc-bank-code").value,
            branch: document.getElementById("acc-branch").value,
            account_number: document.getElementById("acc-number").value,
            pix_key: document.getElementById("acc-pix-key").value,
            type: document.getElementById("acc-type").value,
            initial_balance: Number(document.getElementById("acc-initial-balance").value || 0),
            credit_limit: Number(document.getElementById("acc-credit-limit").value || 0),
            closing_day: Number(document.getElementById("acc-closing-day").value || 1),
            due_day: Number(document.getElementById("acc-due-day").value || 10),
            notes: document.getElementById("acc-notes").value,
            color: document.getElementById("acc-color").value
        };
        try {
            if (id) await api(`/api/accounts/${id}`, { method: "PUT", body });
            else await api("/api/accounts", { method: "POST", body });
            showToast("Conta bancária salva com sucesso!");
            closeModal("modal-account");
            await refreshAll();
        } catch (err) {
            showToast(err.message, true);
        }
    });

    document.getElementById("btn-new-category").addEventListener("click", () => {
        document.getElementById("modal-cat-title").textContent = "Nova Categoria";
        document.getElementById("cat-id").value = "";
        document.getElementById("form-category").reset();
        openModal("modal-category");
    });

    document.getElementById("form-category").addEventListener("submit", async e => {
        e.preventDefault();
        const id = document.getElementById("cat-id").value;
        const body = {
            name: document.getElementById("cat-name").value,
            type: document.getElementById("cat-type").value,
            budget_monthly: Number(document.getElementById("cat-budget").value || 0),
            color: document.getElementById("cat-color").value
        };
        try {
            if (id) await api(`/api/categories/${id}`, { method: "PUT", body });
            else await api("/api/categories", { method: "POST", body });
            showToast("Categoria salva!");
            closeModal("modal-category");
            await refreshAll();
        } catch (err) {
            showToast(err.message, true);
        }
    });

    document.getElementById("btn-new-goal").addEventListener("click", () => {
        document.getElementById("form-goal").reset();
        openModal("modal-goal");
    });

    document.getElementById("form-goal").addEventListener("submit", async e => {
        e.preventDefault();
        const body = {
            name: document.getElementById("goal-name").value,
            target_amount: Number(document.getElementById("goal-target").value),
            current_amount: Number(document.getElementById("goal-current").value || 0),
            deadline: document.getElementById("goal-deadline").value,
            color: document.getElementById("goal-color").value
        };
        try {
            await api("/api/goals", { method: "POST", body });
            showToast("Meta financeira criada!");
            closeModal("modal-goal");
            await refreshAll();
        } catch (err) {
            showToast(err.message, true);
        }
    });

    document.getElementById("btn-seed-demo").addEventListener("click", async () => {
        try {
            await api("/api/demo/seed", { method: "POST", body: { month: state.currentMonth } });
            showToast("Dados de demonstração populados para este mês!");
            await refreshAll();
        } catch (err) {
            showToast(err.message, true);
        }
    });

    document.getElementById("btn-clear-db").addEventListener("click", async () => {
        if (!confirm("Deseja realmente zerar todos os lançamentos, recorrências, metas e contas bancárias?")) return;
        try {
            await api("/api/demo/clear", { method: "POST" });
            showToast("Banco de dados zerado! Todos os dados de exemplo foram removidos.");
            await refreshAll();
        } catch (err) {
            showToast(err.message, true);
        }
    });
}
