// ── CATEGORY BACKGROUNDS (admin-editable) ────────────────────────────────
function applyCatBgs() {
  try {
    var bgs = JSON.parse(localStorage.getItem('jain_cat_bgs') || '{}');
    document.querySelectorAll('.cat-card[data-cat]').forEach(function(card) {
      var slug = card.dataset.cat;
      if (bgs[slug]) card.style.backgroundImage = "url('" + bgs[slug] + "')";
    });
  } catch(e) {}
}
applyCatBgs();

// ── MARQUEE AUTO-FILL ─────────────────────────────────────────────────────
function fillMarquee() {
  var track = document.querySelector('.marquee-track');
  if (!track) return;
  var origHTML = track.innerHTML;
  var singleW  = track.scrollWidth;
  if (!singleW) return;
  var vw      = window.innerWidth || 1280;
  var copies  = Math.max(3, Math.ceil(vw / singleW) + 2);
  var half = '';
  for (var i = 0; i < copies; i++) half += origHTML;
  track.innerHTML = half + half;
  track.style.animationDuration = Math.round((singleW * copies) / 100) + 's';
}
fillMarquee();

// ── TRANSLATIONS ──────────────────────────────────────────────────────────
var _lang = 'en';
var _T = {
  en: {
    nav_home:'Home', nav_about:'About', nav_products:'Products', nav_categories:'Categories', nav_contact:'Contact',
    cart_label:' Cart',
    hero_tag:'<i class="fa fa-tools"></i> Kuwait\'s #1 Hardware Store',
    hero_h1:'Built <span>Tough.</span><br/>Built for <span>Kuwait.</span>',
    hero_p:'Power tools, hand tools, fasteners, safety gear and more — everything you need to build, fix and create. Delivered fast across Kuwait and the GCC.',
    hero_shop:'Shop Now', hero_quote:'Get a Quote',
    stat_products:'Products', stat_genuine:'Genuine', stat_delivery:'Delivery',
    cat_tag:'Browse by Type',
    cat_h2:'Shop by <span class="orange">Category</span>',
    cat_power:'Power Tools', cat_hand:'Hand Tools', cat_fasteners:'Fasteners',
    cat_measuring:'Measuring', cat_safety:'Safety', cat_cutting:'Cutting Tools', cat_storage:'Accessories', cat_all:'All Products',
    cat_power_sub:'Drills, Grinders, Saws & More', cat_hand_sub:'Hammers, Spanners, Pliers',
    cat_fasteners_sub:'Nails, Screws, Bolts, Anchors', cat_measuring_sub:'Tape Measures, Levels, Lasers',
    cat_safety_sub:'Gloves, Hard Hats, Hi-Vis, Boots', cat_cutting_sub:'Saws, Blades, Knives, Cutters',
    cat_storage_sub:'Toolboxes, Bags, Tape, Connectors', cat_all_sub:'Browse our full catalog',
    pill_all:'All', pill_safety:'Safety', pill_cutting:'Cutting', pill_storage:'Accessories',
    prod_tag:'Full Catalog', prod_h2:'Our <span class="orange">Products</span>',
    prod_search:'Search power tools, hand tools, fasteners...',
    no_results:'No products found. Try a different search.',
    cart_title:'Your Cart', cart_empty:'Your cart is empty.',
    cart_total_label:'Total:', cart_wa:'Request Quote on WhatsApp',
    feat_delivery_h:'Fast Delivery', feat_delivery_p:'Same-day delivery in Kuwait City. GCC shipping in 3-5 business days.',
    feat_genuine_h:'100% Genuine', feat_genuine_p:'All products are sourced directly from authorised distributors and manufacturers.',
    feat_advice_h:'Expert Advice', feat_advice_p:'Our hardware experts help you choose the right tool for every job.',
    feat_pricing_h:'Trade Pricing', feat_pricing_p:'Bulk and trade discounts available for contractors and businesses.',
    contact_tag:'Get In Touch', contact_h2:'We\'re Here to <span class="orange">Help</span>',
    contact_p:'Need a specific tool? Looking for a bulk quote? Our team is ready to assist you in Arabic and English.',
    contact_loc_label:'Location', contact_loc:'Kuwait City, Kuwait',
    contact_email_label:'Email', contact_phone_label:'Phone / WhatsApp',
    contact_hours_label:'Working Hours', contact_hours:'Sat-Thu: 7 AM - 8 PM',
    form_name:'Full Name', form_name_ph:'Ahmed Al-Mutairi',
    form_phone:'Phone / WhatsApp', form_email:'Email', form_need:'What do you need?',
    form_msg:'Message', form_msg_ph:'Tell us what tools or materials you need...',
    form_send:'Send Message', form_success:'Message sent! We will get back to you shortly.',
    form_opt1:'General Enquiry', form_opt2:'Bulk / Trade Order', form_opt3:'Product Availability',
    form_opt4:'Technical Advice', form_opt5:'Delivery Information', form_opt6:'Other',
    about_tag:'Who We Are', about_h2:'Your Trusted <span class="orange">Hardware</span> Partner',
    about_badge:'Kuwait',
    about_p1:'Expert Hardware is Kuwait\'s trusted destination for hardware tools and building materials. Power tools, hand tools, fasteners, safety gear, measuring tools and accessories — all under one roof.',
    about_p2:'We stock only genuine, quality-tested products from trusted brands, with competitive prices and expert advice available in Arabic and English.',
    about_f1:'100% genuine, quality-tested products', about_f2:'Expert advice in Arabic and English',
    about_f3:'Same-day delivery within Kuwait City', about_f4:'Bulk pricing for contractors and businesses',
    about_f5:'Easy returns and after-sales support', about_cta:'Contact Us',
    footer_desc:'Kuwait\'s trusted supplier of quality hardware, power tools and construction materials since 2024.',
    footer_nav:'Navigation', footer_cats:'Categories', footer_support:'Support',
    footer_trade:'Trade Accounts', footer_bulk:'Bulk Orders', footer_delivery_info:'Delivery Info',
    footer_returns:'Returns Policy', footer_tech:'Technical Help',
    footer_copy:'2024 Expert Hardware. All rights reserved. Kuwait.',
    intro_tag:'Welcome to Expert Hardware',
    intro_h2:'Kuwait\'s Go-To <span class="orange">Hardware</span> Store — Open 7 Days',
    intro_p:'Expert Hardware supplies power tools, hand tools, fasteners, safety gear, measuring tools and accessories to contractors and businesses across Kuwait. Whether you need one item or a full site order — we have it in stock and ready to go.',
    intro_c1:'60+ Products In Stock', intro_c2:'Same-Day Kuwait Delivery',
    intro_c3:'Bulk & Trade Pricing', intro_c4:'Arabic & English Support',
    intro_cta_text:'Call Us: 6660 9391',
    co_title:'Complete Your Order', co_order_sum:'Order Summary', co_your_details:'Your Details',
    co_delivery_addr:'Delivery Address', co_total_label:'Total Amount',
    co_full_name:'Full Name *', co_wa_num:'WhatsApp Number *', co_area:'Area *',
    co_block:'Block', co_street:'Street', co_house:'House / Building',
    co_floor:'Floor / Apt', co_notes:'Notes', co_submit:'Send Order on WhatsApp',
    back_btn:'Back to Products',
    lang_switch:'عربي',
    mq_items:['Power Tools','Hand Tools','Fasteners','Safety Gear','Measuring Tools','Cutting Tools','Drill Bits','Tool Storage','Accessories']
  },
  ar: {
    nav_home:'الرئيسية', nav_about:'من نحن', nav_products:'المنتجات', nav_categories:'الفئات', nav_contact:'اتصل بنا',
    cart_label:' سلة',
    hero_tag:'<i class="fa fa-tools"></i> محل الأدوات والمعدات الأول في الكويت',
    hero_h1:'ابنِ بقوة.<br/>صُنع لـ<span>الكويت.</span>',
    hero_p:'أدوات كهربائية، أدوات يدوية، مثبتات، معدات سلامة وأكثر — كل ما تحتاجه للبناء والإصلاح والإنشاء. توصيل سريع في جميع أنحاء الكويت ودول الخليج.',
    hero_shop:'تسوق الآن', hero_quote:'احصل على عرض سعر',
    stat_products:'منتج', stat_genuine:'أصلي', stat_delivery:'توصيل خليجي',
    cat_tag:'تصفح حسب النوع',
    cat_h2:'تسوق حسب <span class="orange">الفئة</span>',
    cat_power:'أدوات كهربائية', cat_hand:'أدوات يدوية', cat_fasteners:'مثبتات',
    cat_measuring:'قياس', cat_safety:'سلامة', cat_cutting:'أدوات قطع', cat_storage:'إكسسوارات', cat_all:'جميع المنتجات',
    cat_power_sub:'دريل، صاروخ، مناشير', cat_hand_sub:'مطارق، مفاتيح، كماشات',
    cat_fasteners_sub:'مسامير، براغي، صواميل', cat_measuring_sub:'أمتار قياس، ميزان ماء، ليزر',
    cat_safety_sub:'قفازات، خوذ، أحذية', cat_cutting_sub:'مناشير، شفرات، سكاكين',
    cat_storage_sub:'صناديق عدة، حقائب، شريط', cat_all_sub:'تصفح كتالوجنا الكامل',
    pill_all:'الكل', pill_safety:'سلامة', pill_cutting:'قطع', pill_storage:'إكسسوارات',
    prod_tag:'الكتالوج الكامل', prod_h2:'<span class="orange">منتجاتنا</span>',
    prod_search:'ابحث عن أدوات كهربائية، أدوات يدوية، مثبتات...',
    no_results:'لا توجد منتجات. جرب بحثاً مختلفاً.',
    cart_title:'سلة التسوق', cart_empty:'سلة التسوق فارغة.',
    cart_total_label:'المجموع:', cart_wa:'طلب عرض سعر عبر واتساب',
    feat_delivery_h:'توصيل سريع', feat_delivery_p:'توصيل في نفس اليوم داخل مدينة الكويت. الشحن الخليجي خلال 3-5 أيام عمل.',
    feat_genuine_h:'100% أصلي', feat_genuine_p:'جميع المنتجات مصدرها مباشرة من الموزعين والمصنعين المعتمدين.',
    feat_advice_h:'نصيحة متخصصة', feat_advice_p:'خبراؤنا في الأدوات يساعدونك في اختيار الأداة المناسبة لكل مهمة.',
    feat_pricing_h:'أسعار تجارية', feat_pricing_p:'خصومات بالجملة والتجزئة متاحة للمقاولين والشركات.',
    contact_tag:'تواصل معنا', contact_h2:'نحن هنا <span class="orange">لمساعدتك</span>',
    contact_p:'تحتاج أداة معينة؟ تبحث عن عرض سعر بالجملة؟ فريقنا جاهز لمساعدتك بالعربية والإنجليزية.',
    contact_loc_label:'الموقع', contact_loc:'مدينة الكويت، الكويت',
    contact_email_label:'البريد الإلكتروني', contact_phone_label:'الهاتف / واتساب',
    contact_hours_label:'ساعات العمل', contact_hours:'السبت-الخميس: 7 ص - 8 م',
    form_name:'الاسم الكامل', form_name_ph:'أحمد المطيري',
    form_phone:'الهاتف / واتساب', form_email:'البريد الإلكتروني', form_need:'ماذا تحتاج؟',
    form_msg:'الرسالة', form_msg_ph:'أخبرنا بالأدوات أو المواد التي تحتاجها...',
    form_send:'إرسال الرسالة', form_success:'تم إرسال الرسالة! سنتواصل معك قريباً.',
    form_opt1:'استفسار عام', form_opt2:'طلب بالجملة / تجاري', form_opt3:'توفر منتج',
    form_opt4:'نصيحة تقنية', form_opt5:'معلومات التوصيل', form_opt6:'أخرى',
    about_tag:'من نحن', about_h2:'شريكك الموثوق في <span class="orange">الأدوات</span>',
    about_badge:'الكويت',
    about_p1:'إكسبرت هاردوير هي وجهتك الموثوقة في الكويت للأدوات ومواد البناء. أدوات كهربائية، أدوات يدوية، مثبتات، معدات سلامة، أدوات قياس وإكسسوارات — كل شيء تحت سقف واحد.',
    about_p2:'نحن نخزن منتجات أصلية مختبرة جودتها من علامات تجارية موثوقة، بأسعار تنافسية ونصائح من خبراء باللغتين العربية والإنجليزية.',
    about_f1:'منتجات 100% أصلية ومختبرة الجودة', about_f2:'نصائح من خبراء بالعربية والإنجليزية',
    about_f3:'توصيل في نفس اليوم داخل مدينة الكويت', about_f4:'أسعار بالجملة للمقاولين والشركات',
    about_f5:'إرجاع سهل ودعم ما بعد البيع', about_cta:'اتصل بنا',
    footer_desc:'مورد موثوق للأدوات الجودة والأدوات الكهربائية ومواد البناء في الكويت منذ 2024.',
    footer_nav:'التنقل', footer_cats:'الفئات', footer_support:'الدعم',
    footer_trade:'الحسابات التجارية', footer_bulk:'الطلبات بالجملة', footer_delivery_info:'معلومات التوصيل',
    footer_returns:'سياسة الإرجاع', footer_tech:'المساعدة التقنية',
    footer_copy:'2024 إكسبرت هاردوير. جميع الحقوق محفوظة. الكويت.',
    intro_tag:'مرحباً بك في إكسبرت هاردوير',
    intro_h2:'متجر الأدوات الأول في الكويت — <span class="orange">مفتوح 7 أيام</span>',
    intro_p:'إكسبرت هاردوير توفر أدوات كهربائية، أدوات يدوية، مثبتات، معدات سلامة، أدوات قياس وإكسسوارات للمقاولين والشركات والأفراد في جميع أنحاء الكويت. سواء احتجت قطعة واحدة أو طلباً كاملاً — لدينا المخزون وجاهز.',
    intro_c1:'60+ منتج في المخزون', intro_c2:'توصيل في نفس اليوم بالكويت',
    intro_c3:'أسعار الجملة والتجارة', intro_c4:'دعم بالعربية والإنجليزية',
    intro_cta_text:'اتصل بنا: 6660 9391',
    co_title:'أكمل طلبك', co_order_sum:'ملخص الطلب', co_your_details:'بياناتك',
    co_delivery_addr:'عنوان التوصيل', co_total_label:'المبلغ الإجمالي',
    co_full_name:'الاسم الكامل *', co_wa_num:'رقم واتساب *', co_area:'المنطقة *',
    co_block:'القطعة', co_street:'الشارع', co_house:'المنزل / المبنى',
    co_floor:'الطابق / الشقة', co_notes:'ملاحظات', co_submit:'إرسال الطلب عبر واتساب',
    back_btn:'العودة للمنتجات',
    lang_switch:'EN',
    mq_items:['أدوات كهربائية','أدوات يدوية','مسامير وبراغي','معدات السلامة','أدوات القياس','أدوات القطع','رؤوس الحفر','تخزين الأدوات','إكسسوارات']
  }
};

function setLang(lang) {
  _lang = lang;
  localStorage.setItem('bahar_lang', lang);
  var html = document.documentElement;
  html.lang = lang;
  html.dir  = lang === 'ar' ? 'rtl' : 'ltr';

  var btn = document.getElementById('langBtn');
  if (btn) btn.textContent = _T[lang].lang_switch;

  var t = _T[lang];

  // textContent replacements
  document.querySelectorAll('[data-i18n]').forEach(function(el) {
    var k = el.getAttribute('data-i18n');
    if (t[k] !== undefined) el.textContent = t[k];
  });

  // innerHTML replacements (elements containing nested HTML like spans)
  document.querySelectorAll('[data-i18n-html]').forEach(function(el) {
    var k = el.getAttribute('data-i18n-html');
    if (t[k] !== undefined) el.innerHTML = t[k];
  });

  // placeholder replacements
  document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el) {
    var k = el.getAttribute('data-i18n-placeholder');
    if (t[k] !== undefined) el.placeholder = t[k];
  });

  // Re-render product cards with translated names/descriptions
  if (typeof renderProducts === 'function') renderProducts();

  // Rebuild marquee with translated items
  var track = document.querySelector('.marquee-track');
  if (track && t.mq_items) {
    track.innerHTML = t.mq_items.map(function(item) {
      return '<span>' + item + '</span><span class="sep">&nbsp;&#183;&nbsp;</span>';
    }).join('');
    fillMarquee();
  }
}

function toggleLang() {
  setLang(_lang === 'en' ? 'ar' : 'en');
}

// Apply saved language on load
(function() {
  var saved = localStorage.getItem('bahar_lang');
  if (saved === 'ar') setLang('ar');
})();

// ── SAVE ORDER TO SUPABASE ────────────────────────────────────────────────────
// Saves the order and links it to the logged-in user (or null for guests).
// Guest orders are also stored in localStorage so they can be viewed in "My Orders".
async function saveOrderToSupabase(order) {
  const payload = [{
    customer_name:  order.name,
    customer_phone: order.phone,
    address:        order.address,
    notes:          order.notes || '',
    items:          order.items,
    total:          parseFloat(order.total.toFixed(3)),
    status:         'pending',
    user_id:        (_authUser ? _authUser.id : null)   // link to account if logged in
  }];
  console.log('[JainHardware] Saving order:', payload);
  const result = await sbFetch(SB_URL + '/rest/v1/expert_orders', {
    method: 'POST',
    headers: Object.assign({}, SB_H, {
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    }),
    body: JSON.stringify(payload)
  });
  if (result.error) {
    console.error('[JainHardware] Order save FAILED:', result.error);
    // Still save to localStorage as a fallback
  } else {
    console.log('[JainHardware] Order saved OK:', result.data);
  }
  // If guest → also store in localStorage so they can see it in My Orders
  if (!_authUser) {
    const guestOrder = {
      id: (result.data && result.data[0] && result.data[0].id) || ('guest-' + Date.now()),
      customer_name:  order.name,
      customer_phone: order.phone,
      address:        order.address,
      items:          order.items,
      total:          parseFloat(order.total.toFixed(3)),
      status:         'pending',
      created_at:     new Date().toISOString()
    };
    saveGuestOrder(guestOrder);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
