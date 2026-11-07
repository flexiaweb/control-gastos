// Importar las funciones necesarias de los SDKs de Firebase (Auth, Firestore y App)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Tu configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyClSvaF8nst3oUqEeZKPKJbYmJq34UNm24",
  authDomain: "controlgastos-243e2.firebaseapp.com",
  projectId: "controlgastos-243e2",
  storageBucket: "controlgastos-243e2.firebasestorage.app",
  messagingSenderId: "100307698408",
  appId: "1:100307698408:web:5b2ed06fee5d15cc22ff5d"
};

// Inicializar Firebase, Auth y Firestore
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Estado inicial limpio
let transactions = [];
let savedConcepts = JSON.parse(localStorage.getItem('my_finances_concepts')) || [];

// Control de Paginación
let currentPage = 1;
const recordsPerPage = 10;

// Configuración de tipos
const TYPE_CONFIG = {
  income: { label: 'Ingreso', badgeClass: 'badge-income', sign: '+' },
  expense: { label: 'Gasto', badgeClass: 'badge-expense', sign: '-' }
};

// Inicialización segura y control de sesión al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
  updateClock();
  setInterval(updateClock, 1000);
  setupCycleProgress();
  initEventListeners();

  // Vigilar estado de autenticación
  onAuthStateChanged(auth, (user) => {
    if (user) {
      document.getElementById('login-screen')?.classList.add('hidden');
      document.getElementById('main-app')?.classList.remove('hidden');
      loadTransactionsFromFirebase();
    } else {
      document.getElementById('login-screen')?.classList.remove('hidden');
      document.getElementById('main-app')?.classList.add('hidden');
    }
  });
});

// Función de Inicio de Sesión
window.handleLogin = async function(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const errorBox = document.getElementById('login-error');

  try {
    await signInWithEmailAndPassword(auth, email, password);
    errorBox?.classList.add('hidden');
  } catch (error) {
    console.error("Error de autenticación:", error);
    errorBox?.classList.remove('hidden');
  }
}

// Función de Cierre de Sesión
window.logoutUser = async function() {
  if (confirm("¿Seguro que quieres cerrar sesión?")) {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  }
}

// Abrir y cerrar Modal de Ahorros
window.openSavingsModal = function() {
  calculateTotals();
  document.getElementById('savings-modal')?.classList.remove('hidden');
}

window.closeSavingsModal = function() {
  document.getElementById('savings-modal')?.classList.add('hidden');
}

// Reloj y Fecha en tiempo real
function updateClock() {
  const now = new Date();
  const dateOptions = { weekday: 'long', day: 'numeric', month: 'long' };
  const dateStr = now.toLocaleDateString('es-ES', dateOptions);
  const dateEl = document.getElementById('current-date-text');
  if (dateEl) dateEl.textContent = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit' };
  const timeEl = document.getElementById('current-time-text');
  if (timeEl) timeEl.textContent = now.toLocaleTimeString('es-ES', timeOptions);
}

// Conectar eventos de los botones
function initEventListeners() {
  document.querySelectorAll('.btn-add-green').forEach(btn => {
    btn.addEventListener('click', () => openModal('income'));
  });
  document.querySelectorAll('.btn-add-red').forEach(btn => {
    btn.addEventListener('click', () => openModal('expense'));
  });

  const btnCalc = document.getElementById('btn-calc-events');
  if (btnCalc) btnCalc.addEventListener('click', openCalcModal);

  const txForm = document.getElementById('tx-form');
  if (txForm) txForm.addEventListener('submit', handleFormSubmit);
}

// Formateador de moneda (€)
function formatCurrency(amount) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
}

// Cargar transacciones desde Firestore y ordenarlas
async function loadTransactionsFromFirebase() {
  try {
    const querySnapshot = await getDocs(collection(db, "transactions"));
    transactions = [];
    querySnapshot.forEach((docSnap) => {
      transactions.push({ firebaseId: docSnap.id, ...docSnap.data() });
    });
    sortTransactions();
    currentPage = 1;
    renderApp();
  } catch (error) {
    console.error("Error al cargar de Firebase:", error);
  }
}

// Ordenar transacciones por fecha metida de más reciente a más antigua
function sortTransactions() {
  transactions.sort((a, b) => {
    const dateA = new Date(a.rawDate || a.createdAt || 0);
    const dateB = new Date(b.rawDate || b.createdAt || 0);
    if (dateB.getTime() !== dateA.getTime()) {
      return dateB - dateA;
    }
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
}

// Renderizado principal
function renderApp() {
  calculateTotals();
  renderTable();
}

// Cálculo de totales, Queda Real y Total Ahorros directamente desde Firebase
function calculateTotals() {
  let totalIncome = 0;
  let totalExpense = 0;
  let totalSavings = 0;

  transactions.forEach(t => {
    const amount = parseFloat(t.amount) || 0;
    const type = t.type ? t.type.toLowerCase() : '';
    const concept = t.concept ? t.concept.toLowerCase() : '';

    // 1. Acumular Ingresos y Gastos generales
    if (type === 'income') {
      totalIncome += amount;
    } else if (type === 'expense') {
      totalExpense += amount;
    }

    // 2. Si el concepto contiene "ahorro", sumar al bote de ahorros independientemente del tipo
    if (concept.includes('ahorro')) {
      totalSavings += amount;
    }
  });

  const actualRemaining = totalIncome - totalExpense;

  const incEl = document.getElementById('total-income');
  const expEl = document.getElementById('total-expense');
  const remEl = document.getElementById('actual-remaining');
  const modalSavEl = document.getElementById('modal-savings-amount');

  if (incEl) incEl.textContent = formatCurrency(totalIncome);
  if (expEl) expEl.textContent = formatCurrency(totalExpense);
  if (remEl) remEl.textContent = formatCurrency(actualRemaining);
  if (modalSavEl) modalSavEl.textContent = formatCurrency(Math.max(0, totalSavings));
  
  calculateEventSimulation();
}

// Lógica del ciclo
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

  const badgeEl = document.getElementById('days-left-badge');
  const startTextEl = document.getElementById('cycle-start-text');
  const endTextEl = document.getElementById('cycle-end-text');
  const progressBar = document.getElementById('cycle-progress-bar');
  const dayPin = document.getElementById('day-pin');
  const starMarker = document.getElementById('star-marker');

  if (badgeEl) badgeEl.textContent = `Quedan ${daysLeftPayroll} días para la nómina`;
  if (startTextEl) startTextEl.textContent = `Inicio: 28 ${startCycle.toLocaleDateString('es-ES', { month: 'short' })}`;
  if (endTextEl) endTextEl.textContent = `Fin de mes: ${endCycle.getDate()} ${endCycle.toLocaleDateString('es-ES', { month: 'short' })}`;
  if (progressBar) progressBar.style.width = `${progressPercentage}%`;
  
  if (dayPin) {
    dayPin.textContent = `Hoy (${now.getDate()}/${now.getMonth() + 1})`;
    dayPin.style.left = `${progressPercentage}%`;
  }
  if (starMarker) starMarker.style.left = `${starPercentage}%`;
}

// Renderizado de Tabla con Paginación (10 registros por página)
function renderTable() {
  const tbody = document.getElementById('tx-list');
  const emptyState = document.getElementById('empty-state');
  const countBadge = document.getElementById('tx-count');
  const paginationControls = document.getElementById('pagination-controls');

  if (!tbody) return;

  tbody.innerHTML = '';
  if (countBadge) countBadge.textContent = `${transactions.length} registros`;

  if (transactions.length === 0) {
    if (emptyState) emptyState.classList.remove('hidden');
    if (paginationControls) paginationControls.style.display = 'none';
    return;
  }
  
  if (emptyState) emptyState.classList.add('hidden');
  if (paginationControls) paginationControls.style.display = 'flex';

  // Lógica de Paginación
  const totalPages = Math.ceil(transactions.length / recordsPerPage) || 1;
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const start = (currentPage - 1) * recordsPerPage;
  const end = start + recordsPerPage;
  const paginatedTransactions = transactions.slice(start, end);

  paginatedTransactions.forEach(t => {
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
        <button class="btn-delete" data-id="${t.firebaseId}" title="Eliminar">
          <i class="fa-regular fa-trash-can"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Actualizar controles de paginación
  const pageInfo = document.getElementById('page-info');
  const btnPrev = document.getElementById('btn-prev-page');
  const btnNext = document.getElementById('btn-next-page');

  if (pageInfo) pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
  if (btnPrev) btnPrev.disabled = currentPage === 1;
  if (btnNext) btnNext.disabled = currentPage === totalPages;

  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      deleteTransaction(btn.getAttribute('data-id'));
    });
  });
}

// Cambiar de página
window.changePage = function(direction) {
  currentPage += direction;
  renderTable();
}

// Abrir Modal y poner la fecha de hoy por defecto
function openModal(type) {
  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modal-title');
  const txTypeInput = document.getElementById('tx-type');
  
  if (txTypeInput) txTypeInput.value = type;
  if (modalTitle) modalTitle.textContent = type === 'income' ? 'Añadir Ingreso / Nómina' : 'Añadir Gasto';
  
  const amtEl = document.getElementById('tx-amount');
  const conEl = document.getElementById('tx-concept');
  const dateEl = document.getElementById('tx-date');

  if (amtEl) amtEl.value = '';
  if (conEl) conEl.value = '';

  if (dateEl) {
    const today = new Date().toISOString().split('T')[0];
    dateEl.value = today;
  }

  renderChips();
  if (modal) modal.classList.remove('hidden');
}

window.closeModal = function() {
  const modal = document.getElementById('modal');
  if (modal) modal.classList.add('hidden');
}

// Renderizar Chips interactivos
function renderChips() {
  const chipsContainer = document.getElementById('saved-chips');
  if (!chipsContainer) return;

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

    chip.querySelector('.chip-text').onclick = () => {
      const conEl = document.getElementById('tx-concept');
      if (conEl) conEl.value = concept;
    };

    chip.querySelector('.chip-remove').onclick = (e) => {
      e.stopPropagation();
      savedConcepts = savedConcepts.filter(c => c !== concept);
      localStorage.setItem('my_finances_concepts', JSON.stringify(savedConcepts));
      renderChips();
    };

    chipsContainer.appendChild(chip);
  });
}

// Modales Calculadora
function openCalcModal() {
  const nameEl = document.getElementById('calc-event-name');
  const amtEl = document.getElementById('calc-event-amount');
  const calcModal = document.getElementById('calc-modal');

  if (nameEl) nameEl.value = '';
  if (amtEl) amtEl.value = '';
  calculateEventSimulation();
  if (calcModal) calcModal.classList.remove('hidden');
}

function closeCalcModal() {
  const calcModal = document.getElementById('calc-modal');
  if (calcModal) calcModal.classList.add('hidden');
}
window.closeCalcModal = closeCalcModal;

window.calculateEventSimulation = function() {
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const currentRemaining = totalIncome - totalExpense;

  const eventAmountEl = document.getElementById('calc-event-amount');
  const eventAmount = eventAmountEl ? parseFloat(eventAmountEl.value) || 0 : 0;
  const finalSimulated = currentRemaining - eventAmount;

  const simElement = document.getElementById('sim-final-amount');
  if (simElement) {
    simElement.textContent = formatCurrency(finalSimulated);
    simElement.style.color = finalSimulated < 0 ? '#ef4444' : '#0f172a';
  }
}

// Formulario submit (Guarda en Firebase y reordena)
async function handleFormSubmit(e) {
  e.preventDefault();

  const type = document.getElementById('tx-type')?.value;
  const amount = parseFloat(document.getElementById('tx-amount')?.value);
  const concept = document.getElementById('tx-concept')?.value.trim();
  const rawDate = document.getElementById('tx-date')?.value;

  if (!amount || !concept || !rawDate) return;

  if (!savedConcepts.includes(concept)) {
    savedConcepts.push(concept);
    localStorage.setItem('my_finances_concepts', JSON.stringify(savedConcepts));
  }

  const [year, month, day] = rawDate.split('-');
  const formattedDate = `${day}/${month}/${year}`;

  const newTx = {
    type,
    concept,
    amount,
    date: formattedDate,
    rawDate: rawDate,
    createdAt: Date.now()
  };

  try {
    const docRef = await addDoc(collection(db, "transactions"), newTx);
    transactions.push({ firebaseId: docRef.id, ...newTx });
    sortTransactions();
    currentPage = 1;
    renderApp();
    window.closeModal();
  } catch (error) {
    console.error("Error al guardar en Firebase:", error);
    alert("Hubo un error al guardar el movimiento en la nube.");
  }
}

// Eliminar transacción
async function deleteTransaction(firebaseId) {
  if (confirm("¿Seguro que quieres eliminar este movimiento?")) {
    try {
      await deleteDoc(doc(db, "transactions", firebaseId));
      transactions = transactions.filter(t => t.firebaseId !== firebaseId);
      renderApp();
    } catch (error) {
      console.error("Error al eliminar de Firebase:", error);
      alert("Hubo un error al eliminar el movimiento.");
    }
  }
}