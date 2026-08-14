# Graph Report - .  (2026-08-05)

## Corpus Check
- Large corpus: 1440 files · ~2,519,817 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 518 nodes · 909 edges · 31 communities (25 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.58)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Product Catalog Rendering
- Admin Categories & Featured Offers
- Admin CSV/Bulk Product Import
- Admin Authentication & Team Accounts
- Customer Accounts & Auth
- Admin Orders & Analytics
- Storefront Features (Wishlist/Reviews/Chat)
- Admin Bulk Selection (Brand/Category)
- Product Detail, Cart & Checkout
- Storefront Config & Data Loading
- Admin Inventory & Variants
- Admin Deleted Items & Recovery
- SEO Page Generator Script
- Admin Core Data Loading
- Admin Reports & Excel Export
- Admin Email Campaigns
- Database Schema (Supabase Tables)
- Admin Undo/Redo Helpers
- Email Campaign Sender (Edge Function)
- Admin SEO Editor
- i18n & Order Submission
- Offers/Campaigns Schema
- Newsletter Subscribe Widget
- Analytics Table
- Orders Table
- Reviews Table
- Settings Table

## God Nodes (most connected - your core abstractions)
1. `renderProducts()` - 17 edges
2. `_foRenderList()` - 13 edges
3. `renderTable()` - 12 edges
4. `renderStats()` - 10 edges
5. `renderSuperAdmin()` - 8 edges
6. `clearSelection()` - 8 edges
7. `brandRun()` - 8 edges
8. `updateHeaderForAuth()` - 8 edges
9. `doAuthSignup()` - 8 edges
10. `_foPushUndo()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `_autoWriteReports()` --indirect_call--> `_buildOrdersWorkbook()`  [INFERRED]
  admin/js/06-reports.js → admin/js/07-orders.js

## Import Cycles
- None detected.

## Communities (31 total, 6 thin omitted)

### Community 0 - "Product Catalog Rendering"
Cohesion: 0.09
Nodes (39): _applyBannerIdx(), applySearchSuggestion(), ARABIC_NAMES, bannerNext(), bannerPrevious(), _cardRawPrice(), cardVariantChange(), _cardVariantPrice() (+31 more)

### Community 1 - "Admin Categories & Featured Offers"
Cohesion: 0.11
Nodes (38): addBanner(), closeCatProducts(), closeEditBanner(), cpFilter(), _cpRenderList(), deleteBanner(), foApplyBulkSale(), foClearBulkSale() (+30 more)

### Community 2 - "Admin CSV/Bulk Product Import"
Cohesion: 0.10
Nodes (35): applyCrop(), _compressB64Image(), _compressCSVImage(), deleteCustomCat(), _drawCrop(), fcCloseAll(), fcFilterList(), fcPick() (+27 more)

### Community 3 - "Admin Authentication & Team Accounts"
Cohesion: 0.12
Nodes (28): applyAccountPermissions(), closeTeamAccountForm(), deleteTeamAccount(), doLogin(), getAuditLog(), getWeekLog(), loadSiteStatus(), loadTeamAccounts() (+20 more)

### Community 4 - "Customer Accounts & Auth"
Cohesion: 0.15
Nodes (31): authForgotPassword(), authSignIn(), authSignOut(), authSignUp(), _clearAuthMessages(), clearAuthSession(), closeAcctModal(), closeAuthModal() (+23 more)

### Community 5 - "Admin Orders & Analytics"
Cohesion: 0.11
Nodes (27): aCard(), addStock(), addStock5000(), addStockAmt(), buildAnTable(), _buildOrdersWorkbook(), card(), exportOrdersExcel() (+19 more)

### Community 6 - "Storefront Features (Wishlist/Reviews/Chat)"
Cohesion: 0.09
Nodes (22): addBulkRow(), cancelOrder(), closeBulkQuote(), encodeHtml(), loadReviews(), onHeaderSearchInput(), openBulkQuote(), openOrderTracker() (+14 more)

### Community 7 - "Admin Bulk Selection (Brand/Category)"
Cohesion: 0.15
Nodes (23): _brandMenuOutside(), brandRun(), bulkAdd5000Stock(), bulkAddStock(), bulkClearStock(), _bulkConfirmIfLarge(), bulkDelete(), bulkHide() (+15 more)

### Community 8 - "Product Detail, Cart & Checkout"
Cohesion: 0.14
Nodes (20): continueCheckoutAsGuest(), handleCheckoutSubmit(), openCheckout(), openProduct(), pmAddToCart(), _pmApplyVariantDisplay(), pmChangeQty(), _pmCurrentPrice() (+12 more)

### Community 9 - "Storefront Config & Data Loading"
Cohesion: 0.10
Nodes (18): applySale(), cart, checkAssetVersion(), _customProds, getAllProducts(), getFeaturedSale(), _hiddenIds, loadSBData() (+10 more)

### Community 10 - "Admin Inventory & Variants"
Cohesion: 0.14
Nodes (20): addVariantRow(), apFileChosen(), _apShowImgPreview(), apUrlPreview(), closeAddProduct(), closeQtyLimits(), closeVariants(), getNextSkuNumber() (+12 more)

### Community 11 - "Admin Deleted Items & Recovery"
Cohesion: 0.17
Nodes (16): _csvImageMap, _csvParsedRows, deleteOrder(), deleteProduct(), getDeletedOrders(), getDeletedProducts(), permanentDelete(), permanentDeleteOrder() (+8 more)

### Community 12 - "SEO Page Generator Script"
Cohesion: 0.18
Nodes (18): clip(), esc(), fs, isHttp(), loadData(), main(), OUT_DIR, path (+10 more)

### Community 13 - "Admin Core Data Loading"
Cohesion: 0.15
Nodes (14): BASE_BRANDS, checkAssetVersion(), _customProductRows, DEFAULT_CATS, _fixCustomProductIds(), getAllAdminProducts(), _hiddenBaseIds, loadFromSupabase() (+6 more)

### Community 14 - "Admin Reports & Excel Export"
Cohesion: 0.24
Nodes (11): _autoWriteReports(), _buildInventoryWorkbook(), _buildSalesWorkbook(), connectInventoryFile(), connectSalesFile(), _loadFsHandle(), _loadSavedHandles(), _openFsDb() (+3 more)

### Community 15 - "Admin Email Campaigns"
Cohesion: 0.40
Nodes (13): initOffersTab(), _offCall(), _offCompose(), _offEsc(), offLoadCampaigns(), offLoadSubscribers(), _offMode(), offSendTest() (+5 more)

### Community 16 - "Database Schema (Supabase Tables)"
Cohesion: 0.14
Nodes (12): public.expert_admin_accounts, public.expert_analytics, public.expert_banners, public.expert_cat_bgs, public.expert_customers, public.expert_hidden, public.expert_orders, public.expert_photos (+4 more)

### Community 17 - "Admin Undo/Redo Helpers"
Cohesion: 0.27
Nodes (8): _prodOverrides, _pushUndo(), redo(), _redoStack, stockData, _syncUrBtns(), undo(), _undoStack

### Community 18 - "Email Campaign Sender (Edge Function)"
Cohesion: 0.36
Nodes (8): RFC-8058, CORS, db(), deliverCampaign(), json(), resendSend(), unsubscribeUrl(), wrapEmail()

### Community 19 - "Admin SEO Editor"
Cohesion: 0.36
Nodes (5): closeProductSEO(), loadSEOSettings(), renderSEOProducts(), saveProductSEO(), _seoUpdateCounts()

### Community 20 - "i18n & Order Submission"
Cohesion: 0.47
Nodes (3): fillMarquee(), setLang(), toggleLang()

## Knowledge Gaps
- **48 isolated node(s):** `SB_KEY`, `SB_HDRS`, `DEFAULT_CATS`, `_customProductRows`, `_hiddenBaseIds` (+43 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `scrollToProducts()` connect `Product Catalog Rendering` to `Storefront Features (Wishlist/Reviews/Chat)`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `renderProducts()` connect `Product Catalog Rendering` to `Product Detail, Cart & Checkout`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `SB_KEY`, `SB_HDRS`, `DEFAULT_CATS` to the rest of the system?**
  _48 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Product Catalog Rendering` be split into smaller, more focused modules?**
  _Cohesion score 0.08879492600422834 - nodes in this community are weakly interconnected._
- **Should `Admin Categories & Featured Offers` be split into smaller, more focused modules?**
  _Cohesion score 0.10801393728222997 - nodes in this community are weakly interconnected._
- **Should `Admin CSV/Bulk Product Import` be split into smaller, more focused modules?**
  _Cohesion score 0.0951219512195122 - nodes in this community are weakly interconnected._
- **Should `Admin Authentication & Team Accounts` be split into smaller, more focused modules?**
  _Cohesion score 0.11596638655462185 - nodes in this community are weakly interconnected._