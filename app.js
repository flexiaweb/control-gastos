// Estado inicial limpio
let transactions = JSON.parse(localStorage.getItem('my_finances_txs')) || [];

// Conceptos memorizados que empiezan vacíos y se llenan contigo
let savedConcepts = JSON.parse(localStorage.getItem('my_finances_concepts')) || [];

// Configuración de tipos
const TYPE_CONFIG = {
  income: { label: 'Ingreso', badgeClass: 'badge-income', sign: '+' },
  expense: { label: 'Gasto', badgeClass: 'badge-expense', sign: '-' }
};

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  renderApp();
  setupCycleProgress();
  updateClock();
  setInterval(updateClock, 1000);
});

// Reloj y Fecha en tiempo real
function updateClock() {
  const now = new Date();
  
  const dateOptions = { weekday: 'long', day: 'numeric', month: 'long' };
  document.getElementById('current-date-text').textContent = now.toLocaleDateString('es-ES', dateOptions);

  const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit' };
  document.getElementById('current-time-text').textContent = now.toLocaleTimeString('es-ES', timeOptions);
}

// Formateador de moneda (€)
function formatCurrency(amount) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
}

// Renderizado principal
function renderApp() {
  calculateTotals();
  renderTable();
  saveToLocalStorage();
}

// Cálculo de totales y Queda Real
function calculateTotals() {
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);

  const actualRemaining = totalIncome - totalExpense;

  document.getElementById('total-income').textContent = formatCurrency(totalIncome);
  document.getElementById('total-expense').textContent = formatCurrency(totalExpense);
  document.getElementById('actual-remaining').textContent = formatCurrency(actualRemaining);
  
  calculateEventSimulation();
}

// Lógica del ciclo: Desde el día 28 hasta el ÚLTIMO día del mes siguiente
function setupCycleProgress() {
  const now = new Date();
  const day = now.getDate();
  const month = now.getMonth();
  const year = now.getFullYear();

  let startCycle, payrollDate, endCycle;

  if (day < 28) {
    startCycle = new Date(year, month - 1, 28);
    payrollDate = new Date(year, month, 28);
    endCycle = new Date(year, month + 1, 0);
  } else {
    startCycle = new Date(year, month, 28);
    payrollDate = new Date(year, month + 1, 28);
    endCycle = new Date(year, month + 2, 0);
  }

  const totalDuration = endCycle.getTime() - startCycle.getTime();
  const elapsed = Math.max(0, now.getTime() - startCycle.getTime());
  const progressPercentage = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));

  const payrollOffset = payrollDate.getTime() - startCycle.getTime();
  const starPercentage = Math.min(100, Math.max(0, (payrollOffset / totalDuration) * 100));

  const daysLeftPayroll = Math.max(0, Math.ceil((payrollDate - now) / (1000 * 60 * 60 * 24)));

  document.getElementById('days-left-badge').textContent = `Quedan ${daysLeftPayroll} días para la nómina`;
  document.getElementById('cycle-start-text').textContent = `Inicio: 28 ${startCycle.toLocaleDateString('es-ES', { month: 'short' })}`;
  document.getElementById('cycle-end-text').textContent = `Fin de mes: ${endCycle.getDate()} ${endCycle.toLocaleDateString('es-ES', { month: 'short' })}`;

  document.getElementById('cycle-progress-bar').style.width = `${progressPercentage}%`;
  
  const currentDayNum = now.getDate();
  const currentMonthNum = now.getMonth() + 1;
  const dayPin = document.getElementById('day-pin');
  
  dayPin.textContent = `Hoy (${currentDayNum}/${currentMonthNum})`;
  dayPin.style.left = `${progressPercentage}%`;

  const starMarker = document.getElementById('star-marker');
  starMarker.style.left = `${starPercentage}%`;
}

// Renderizado de Tabla Única
function renderTable() {
  const tbody = document.getElementById('tx-list');
  const emptyState = document.getElementById('empty-state');
  const countBadge = document.getElementById('tx-count');

  tbody.innerHTML = '';
  countBadge.textContent = `${transactions.length} registros`;

  if (transactions.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  
  emptyState.classList.add('hidden');

  [...transactions].reverse().forEach(t => {
    const tr = document.createElement('tr');
    const isIncome = t.type === 'income';
    const config = TYPE_CONFIG[t.type];

    tr.innerHTML = `
      <td><strong>${t.concept}</strong></td>
      <td><span class="badge ${config.badgeClass}">${config.label}</span></td>
      <td>${t.date}</td>
      <td class="text-right ${isIncome ? 'amount-income' : 'amount-expense'}">
        ${config.sign} ${formatCurrency(t.amount)}
      </td>
      <td class="text-center">
        <button class="btn-delete" onclick="deleteTransaction(${t.id})" title="Eliminar">
          <i class="fa-regular fa-trash-can"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Modal Normal
function openModal(type) {
  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modal-title');
  const txTypeInput = document.getElementById('tx-type');
  
  txTypeInput.value = type;
  modalTitle.textContent = type === 'income' ? 'Añadir Ingreso / Nómina' : 'Añadir Gasto';
  
  document.getElementById('tx-amount').value = '';
  document.getElementById('tx-concept').value = '';

  renderChips();
  modal.classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

// Renderizar Chips interactivos con botón de eliminar
function renderChips() {
  const chipsContainer = document.getElementById('saved-chips');
  chipsContainer.innerHTML = '';

  if (savedConcepts.length === 0) {
    chipsContainer.innerHTML = '<span style="font-size:0.75rem; color:#94a3b8;">No tienes conceptos guardados aún.</span>';
    return;
  }

  savedConcepts.forEach(concept => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    
    chip.innerHTML = `
      <span class="chip-text">${concept}</span>
      <span class="chip-remove" title="Eliminar concepto"><i class="fa-solid fa-xmark"></i></span>
    `;

    // Click en la etiqueta -> Autocompleta el campo
    chip.querySelector('.chip-text').onclick = () => {
      document.getElementById('tx-concept').value = concept;
    };

    // Click en la 'X' -> Borra la etiqueta de tus conceptos guardados
    chip.querySelector('.chip-remove').onclick = (e) => {
      e.stopPropagation();
      removeConcept(concept);
    };

    chipsContainer.appendChild(chip);
  });
}

// Eliminar un concepto específico de la lista guardada
function removeConcept(conceptToRemove) {
  savedConcepts = savedConcepts.filter(c => c !== conceptToRemove);
  localStorage.setItem('my_finances_concepts', JSON.stringify(savedConcepts));
  renderChips();
}

// Modal Calculadora de Eventos
function openCalcModal() {
  document.getElementById('calc-event-name').value = '';
  document.getElementById('calc-event-amount').value = '';
  calculateEventSimulation();
  document.getElementById('calc-modal').classList.remove('hidden');
}

function closeCalcModal() {
  document.getElementById('calc-modal').classList.add('hidden');
}

// Simular cálculo en tiempo real
function calculateEventSimulation() {
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const currentRemaining = totalIncome - totalExpense;

  const eventAmount = parseFloat(document.getElementById('calc-event-amount').value) || 0;
  const finalSimulated = currentRemaining - eventAmount;

  document.getElementById('sim-final-amount').textContent = formatCurrency(finalSimulated);
  
  const simElement = document.getElementById('sim-final-amount');
  if (finalSimulated < 0) {
    simElement.style.color = '#ef4444';
  } else {
    simElement.style.color = '#0f172a';
  }
}

// Formulario submit normal (Guarda el concepto como chip automático)
function handleFormSubmit(e) {
  e.preventDefault();

  const type = document.getElementById('tx-type').value;
  const amount = parseFloat(document.getElementById('tx-amount').value);
  const concept = document.getElementById('tx-concept').value.trim();

  if (!amount || !concept) return;

  // Guardar automáticamente en memoria si el concepto es nuevo
  if (!savedConcepts.includes(concept)) {
    savedConcepts.push(concept);
    localStorage.setItem('my_finances_concepts', JSON.stringify(savedConcepts));
  }

  const newTx = {
    id: Date.now(),
    type,
    concept,
    amount,
    date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
  };

  transactions.push(newTx);
  renderApp();
  closeModal();
}

// Eliminar transacción
function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  renderApp();
}

// Guardar en LocalStorage
function saveToLocalStorage() {
  localStorage.setItem('my_finances_txs', JSON.stringify(transactions));
}