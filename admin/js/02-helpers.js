// ── STOCK ──────────────────────────────────────────────────────────────────────
// Stock quantities are stored locally in the browser (localStorage key: jain_stock)
// AND synced to Supabase. getStock() loads them from localStorage on startup.
function getStock() {
  const s = localStorage.getItem('jain_stock');
  if (s) return JSON.parse(s);
  const d = {};
  PRODUCTS.forEach(p => { d[p.id] = p.price > 10 ? 15 : p.price > 5 ? 30 : 50; });
  return d;
}
let stockData = getStock();

// _prodOverrides — stores manual name/price edits made in the admin table
//                  so they survive page refresh (localStorage key: bahar_overrides)
let _prodOverrides = {};
try { _prodOverrides = JSON.parse(localStorage.getItem('bahar_overrides') || '{}'); } catch(e) {}

// ── UNDO / REDO ────────────────────────────────────────────────────────────────
// Tracks stock changes so you can undo/redo with Ctrl+Z / Ctrl+Y.
// Each time stock changes, a snapshot is pushed onto _undoStack (max 50 levels).
let _undoStack = [];
let _redoStack = [];
function _pushUndo() {
  _undoStack.push(JSON.stringify(stockData));
  if (_undoStack.length > 50) _undoStack.shift();
  _redoStack = [];
  _syncUrBtns();
}
function _syncUrBtns() {
  document.getElementById('undoBtn').disabled = _undoStack.length === 0;
  document.getElementById('redoBtn').disabled = _redoStack.length === 0;
}
function undo() {
  if (!_undoStack.length) return;
  _redoStack.push(JSON.stringify(stockData));
  stockData = JSON.parse(_undoStack.pop());
  localStorage.setItem('jain_stock', JSON.stringify(stockData));
  renderTable(); renderStats(); _syncUrBtns();
  showToast('Undone â†©');
}
function redo() {
  if (!_redoStack.length) return;
  _undoStack.push(JSON.stringify(stockData));
  stockData = JSON.parse(_redoStack.pop());
  localStorage.setItem('jain_stock', JSON.stringify(stockData));
  renderTable(); renderStats(); _syncUrBtns();
  showToast('Redone â†ª');
}
document.addEventListener('keydown', function(e) {
  if ((e.ctrlKey||e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
  if ((e.ctrlKey||e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo(); }
});

