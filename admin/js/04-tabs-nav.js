// ── TABS ───────────────────────────────────────────────────────────────────────
// switchTab(tab) — shows the selected tab section, hides all others,
//                  highlights the correct tab button, and loads that tab's data.
//                  Also scrolls back to top so content is never below the fold.
function switchTab(tab) {
  window.scrollTo(0, 0);
  document.getElementById('inventorySection').style.display  = tab==='inventory'  ? 'block' : 'none';
  document.getElementById('analyticsSection').style.display  = tab==='analytics'  ? 'block' : 'none';
  document.getElementById('deletedSection').style.display    = tab==='deleted'    ? 'block' : 'none';
  document.getElementById('ordersSection').style.display     = tab==='orders'     ? 'block' : 'none';
  document.getElementById('reportsSection').style.display    = tab==='reports'    ? 'block' : 'none';
  document.getElementById('categoriesSection').style.display = tab==='categories' ? 'block' : 'none';
  document.getElementById('bannersSection').style.display    = tab==='banners'    ? 'block' : 'none';
  document.getElementById('ownerSection').style.display      = tab==='owner'      ? 'block' : 'none';
  document.getElementById('tabInventory').classList.toggle('active',   tab==='inventory');
  document.getElementById('tabAnalytics').classList.toggle('active',   tab==='analytics');
  document.getElementById('tabDeleted').classList.toggle('active',     tab==='deleted');
  document.getElementById('tabOrders').classList.toggle('active',      tab==='orders');
  document.getElementById('tabReports').classList.toggle('active',     tab==='reports');
  document.getElementById('tabCategories').classList.toggle('active',  tab==='categories');
  document.getElementById('tabBanners').classList.toggle('active',     tab==='banners');
  document.getElementById('tabOwner').classList.toggle('active',       tab==='owner');
  if (tab==='analytics')   renderAnalytics();
  if (tab==='deleted')   { renderDeletedTab(); if (_deletedSubTab==='orders') renderDeletedOrdersTab(); }
  if (tab==='orders')    { loadOrders(false); }
  if (tab==='reports')   { renderReports(); renderOrdersReport(); _autoWriteReports(); }
  if (tab==='categories')  renderCatEditor();
  if (tab==='banners')     loadBanners();
  if (tab==='owner')       renderSuperAdmin();
}

