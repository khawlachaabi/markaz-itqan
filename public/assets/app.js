(function(){
'use strict';
var $=function(s,r){return (r||document).querySelector(s)},$$=function(s,r){return [].slice.call((r||document).querySelectorAll(s))};
var S=JSON.parse($('#site-data').textContent);
var IMG_DEF={imgHero:'/assets/hero.webp',imgEmblem:'/assets/emblem.webp',imgFull:'/assets/logo-full.webp'};
S.site=Object.assign({fb:'',ig:'',tg:'',email:'',addr:''},IMG_DEF,S.site||{});
S.courses.forEach(function(c){c.ins=c.ins||'';c.top=c.top||''});
var SAVED=JSON.stringify(S);
var filter='all',isAdmin=false,preview=false,dirty=false,busy=false,tab='regs',editing=null,root=null,panel=null,modal=null,shade=null,toastEl=null,toastT=null;
var grid=$('#grid'),chips=$('#chips'),sel=$('#fcourse');
var ICONS=[['megaphone','مكبّر صوت (تسويق)'],['pen','قلم (كتابة)'],['chip','شريحة (ذكاء اصطناعي)'],['chart','رسم بياني (بيانات)'],['laptop','حاسوب'],['sprout','نبتة (تطوير الذات)'],['target','هدف'],['users','فريق'],['cert','شهادة'],['screen','شاشة']];
var FORMATS=['أونلاين – مباشر','أونلاين – مسجّلة','حضوري','مدمج (حضوري + أونلاين)'];
var TAGS=['الأكثر طلبًا','جديد','خصم خاص','آخر المقاعد'];

var CSRF='',ADMIN_EMAIL='',REGS=[],rfilter='all';
function api(method,url,body,raw){
  var h={};if(CSRF)h['x-csrf']=CSRF;
  var o={method:method,credentials:'same-origin',headers:h};
  if(raw){h['Content-Type']=raw.type||'application/octet-stream';o.body=raw}
  else if(body!==undefined){h['Content-Type']='application/json';o.body=JSON.stringify(body)}
  return fetch(url,o).then(function(r){return r.json().catch(function(){return {}}).then(function(d){if(!r.ok){var e=new Error(d.error||'http');e.status=r.status;e.data=d;throw e}return d})});
}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(m){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]})}
function uid(p){return p+Date.now().toString(36)+Math.random().toString(36).slice(2,5)}
function catName(id){for(var i=0;i<S.cats.length;i++)if(S.cats[i].id===id)return S.cats[i].n;return ''}
function findC(id){for(var i=0;i<S.courses.length;i++)if(S.courses[i].id===id)return i;return -1}
function waNum(){var d=String(S.site.wa||'').replace(/\D/g,'');if(d.indexOf('00')===0)d=d.slice(2);else if(d.charAt(0)==='0')d='218'+d.slice(1);return d}
function priceTxt(x){var p=String(x.price==null?'':x.price).trim();if(p==='')return 'السعر عند التواصل';var n=Number(p.replace(/,/g,''));if(isNaN(n))return p;if(n===0)return 'مجانية';return n.toLocaleString('en')+' '+S.site.currency}
function priceHtml(x){var p=String(x.price==null?'':x.price).trim();
  if(p==='')return '<div class="pr"><b class="ask">تواصل معنا لمعرفة السعر</b></div>';
  var n=Number(p.replace(/,/g,''));
  if(isNaN(n))return '<div class="pr"><b class="ask">'+esc(p)+'</b></div>';
  if(n===0)return '<div class="pr"><b class="free">مجانية</b></div>';
  return '<div class="pr"><b>'+n.toLocaleString('en')+'</b><small>'+esc(S.site.currency)+'</small></div>'}
function safeUrl(v){v=String(v).trim();if(/^https?:\/\//i.test(v))return v;if(/^[a-z][a-z0-9+.-]*:/i.test(v))return '#';return 'https://'+v}
function ico(n){return '<svg class="i" aria-hidden="true"><use href="#i-'+n+'"/></svg>'}

/* ---------- العرض العام ---------- */
function shown(adm){return S.courses.filter(function(x){return adm||!x.hide})}
function cardsHtml(adm,f){
  var list=shown(adm).filter(function(x){return f==='all'||x.c===f});
  if(!list.length)return '<p class="empty">'+(adm?'لا توجد دورات هنا بعد. افتح لوحة التحكم وأضف أول دورة.':'لا توجد دورات معروضة حاليًا. راسلنا على واتساب لنخبرك بالمواعيد القادمة.')+'</p>';
  return list.map(function(x){
    var m='';
    if(x.fmt)m+='<li>'+ico('screen')+esc(x.fmt)+'</li>';
    if(x.dur)m+='<li>'+ico('clock')+esc(x.dur)+'</li>';
    if(x.start)m+='<li>'+ico('cal')+esc('تبدأ '+x.start)+'</li>';
    if(x.ins)m+='<li>'+ico('users')+esc('المدرب: '+x.ins)+'</li>';
    return '<article class="card'+(x.hide?' is-hidden':'')+'"><div class="cv">'+ico(x.ic||'target')+(x.tag?'<span class="tag">'+esc(x.tag)+'</span>':'')+(x.hide?'<span class="tag hid">مخفية عن الزوار</span>':'')+'</div>'
    +'<div class="bd"><h3>'+esc(x.t)+'</h3><p>'+esc(x.d)+'</p>'+(m?'<ul class="meta">'+m+'</ul>':'')+priceHtml(x)
    +'<div class="ft"><span class="cat">'+esc(catName(x.c))+'</span><span class="acts">'+(adm?'<button class="ad-edit" data-edit="'+esc(x.id)+'">تعديل</button>':'')
    +'<button class="info-b" data-info="'+esc(x.id)+'">التفاصيل</button><button class="go" data-reg="'+esc(x.id)+'"'+(x.closed?' disabled':'')+'>'+(x.closed?'التسجيل مغلق':'سجّل في الدورة')+'</button></span></div></div></article>';
  }).join('');
}
function chipsHtml(adm,f){
  var used={};shown(adm).forEach(function(x){used[x.c]=1});
  var h='<button class="chip" data-f="all" aria-pressed="'+(f==='all')+'">الكل</button>';
  S.cats.forEach(function(c){if(used[c.id])h+='<button class="chip" data-f="'+esc(c.id)+'" aria-pressed="'+(f===c.id)+'">'+esc(c.n)+'</button>'});
  return h}
function optionsHtml(cur){
  return '<option value="">اختر الدورة</option>'+S.courses.filter(function(x){return !x.hide&&!x.closed}).map(function(x){return '<option value="'+esc(x.id)+'"'+(x.id===cur?' selected':'')+'>'+esc(x.t)+'</option>'}).join('')}
function applySite(){
  var s=S.site,w=waNum();
  $$('[data-b="phone"]').forEach(function(e){e.textContent=s.phone});
  $$('[data-href="wa"]').forEach(function(a){a.href='https://wa.me/'+w});
  $$('[data-href="tel"]').forEach(function(a){a.href='tel:+'+w});
  $('#h1a').textContent=s.h1a;$('#h1b').textContent=s.h1b;$('#hsub').textContent=s.hsub;$('#about-txt').textContent=s.about;
  ['c-mail','f-mail'].forEach(function(i){$('#'+i).hidden=!s.email});
  ['c-addr','f-addr'].forEach(function(i){$('#'+i).hidden=!s.addr});
  $$('[data-mail]').forEach(function(a){a.textContent=s.email;a.href='mailto:'+s.email});
  $$('[data-addr]').forEach(function(e){e.textContent=s.addr});
  var ok=function(u,d){return /^\/(assets|uploads)\/[A-Za-z0-9._-]+$/.test(u||'')?u:d};
  $$('[data-img="emblem"]').forEach(function(i){i.src=ok(s.imgEmblem,IMG_DEF.imgEmblem)});
  $$('[data-img="full"]').forEach(function(i){i.src=ok(s.imgFull,IMG_DEF.imgFull)});
  var hp=$('.hero .photo');if(hp)hp.style.backgroundImage='url("'+ok(s.imgHero,IMG_DEF.imgHero)+'")';
  ['fb','ig','tg'].forEach(function(k){var li=$('#f-'+k),v=String(s[k]||'').trim();if(!li)return;li.hidden=!v;if(v)$('a',li).href=safeUrl(v)});
}
function mode(){return isAdmin&&!preview}
function render(){
  var adm=mode();
  var ok=filter==='all'||shown(adm).some(function(x){return x.c===filter});
  if(!ok)filter='all';
  grid.innerHTML=cardsHtml(adm,filter);chips.innerHTML=chipsHtml(adm,filter);
  sel.innerHTML=optionsHtml(sel.value);applySite();
}
chips.addEventListener('click',function(e){var b=e.target.closest('.chip');if(!b)return;filter=b.dataset.f;render()});
grid.addEventListener('click',function(e){
  var inf=e.target.closest('[data-info]');if(inf){openInfo(inf.dataset.info);return}
  var ed=e.target.closest('[data-edit]');if(ed){openEditor(ed.dataset.edit);return}
  var b=e.target.closest('[data-reg]');if(!b||b.disabled)return;
  sel.value=b.dataset.reg;
  $('#contact').scrollIntoView({behavior:'smooth'});
  setTimeout(function(){$('#fname').focus({preventScroll:true})},500);
});
$('#form').addEventListener('submit',function(e){
  e.preventDefault();
  var n=$('#fname').value.trim(),p=$('#fphone').value.trim(),o=sel.options[sel.selectedIndex],c=sel.value?o.textContent:'',t=$('#fnote').value.trim(),ok=$('#ok'),btn=$('#form button[type=submit]');
  function say(h){ok.innerHTML=h;ok.classList.add('show')}
  if(!n||!p||!c){say('أكمل الاسم ورقم الهاتف واختر الدورة قبل الإرسال.');return}
  var i=findC(sel.value),x=i>-1?S.courses[i]:null;
  var msg='السلام عليكم، سجّلت في دورة: '+c+(x&&x.fmt?'\nالنمط: '+x.fmt:'')+(x?'\nالسعر: '+priceTxt(x):'')+'\nالاسم: '+n+'\nالهاتف: '+p;
  var wa='<a href="https://wa.me/'+waNum()+'?text='+encodeURIComponent(msg)+'" target="_blank" rel="noopener" style="font-weight:700;text-decoration:underline">تأكيد الطلب عبر واتساب</a>';
  btn.disabled=true;
  api('POST','/api/register',{name:n,phone:p,courseId:sel.value,note:t,hp:$('#hp').value}).then(function(){
    say('تم استلام طلب تسجيلك بنجاح، وسنتواصل معك قريبًا. يمكنك أيضًا '+wa+' ليصلنا أسرع.');
    $('#fname').value='';$('#fphone').value='';$('#fnote').value='';sel.value='';
  }).catch(function(er){
    var m=er.status===429?'محاولات كثيرة، حاول لاحقًا.':er.data&&er.data.error==='closed'?'التسجيل في هذه الدورة مغلق.':er.status===400?'تحقق من الاسم ورقم الهاتف (أرقام فقط).':'تعذّر إرسال الطلب الآن.';
    say(esc(m)+' يمكنك التسجيل مباشرة عبر '+wa+'.');
  }).then(function(){btn.disabled=false});
});
var burger=$('#burger'),nav=$('#nav');
burger.addEventListener('click',function(){var o=nav.classList.toggle('open');burger.setAttribute('aria-expanded',o)});
nav.addEventListener('click',function(e){if(e.target.tagName==='A'){nav.classList.remove('open');burger.setAttribute('aria-expanded','false')}});
var links=$$('a',nav);
if('IntersectionObserver' in window){
  var io=new IntersectionObserver(function(es){es.forEach(function(en){if(en.isIntersecting)links.forEach(function(l){l.classList.toggle('on',l.getAttribute('href')==='#'+en.target.id)})})},{rootMargin:'-40% 0px -55% 0px'});
  ['home','courses','about','contact'].forEach(function(id){var el=document.getElementById(id);el&&io.observe(el)});
}
$('#yr').textContent=new Date().getFullYear();
render();


/* ---------- تفاصيل الدورة (للزوار) ---------- */
var infoEl=null,lastFocus=null;
function openInfo(id){
  var i=findC(id);if(i<0)return;var x=S.courses[i];
  closeInfo();lastFocus=document.activeElement;
  var rows=[['النمط',x.fmt],['المدة',x.dur],['موعد البدء',x.start],['المدرب',x.ins],['القسم',catName(x.c)]].filter(function(r){return r[1]});
  var tops=String(x.top||'').split(/\r?\n/).map(function(t){return t.trim()}).filter(Boolean);
  infoEl=document.createElement('div');infoEl.id='info-modal';infoEl.className='ad-modal';infoEl.setAttribute('role','dialog');infoEl.setAttribute('aria-modal','true');infoEl.setAttribute('aria-label','تفاصيل الدورة');
  infoEl.innerHTML='<div class="box"><h2>'+esc(x.t)+(x.tag?' <span class="tag" style="position:static;display:inline-block;vertical-align:middle;font-size:.75rem">'+esc(x.tag)+'</span>':'')+'</h2>'
   +'<p style="margin:0 0 14px;color:var(--muted)">'+esc(x.d)+'</p>'
   +(rows.length?'<dl class="dl">'+rows.map(function(r){return '<dt>'+r[0]+'</dt><dd>'+esc(r[1])+'</dd>'}).join('')+'</dl>':'')
   +(tops.length?'<h3 style="font-size:1.05rem;margin:16px 0 6px;color:var(--title)">محاور الدورة</h3><ul class="tops">'+tops.map(function(t){return '<li>'+esc(t)+'</li>'}).join('')+'</ul>':'')
   +priceHtml(x)
   +'<div class="acts"><button class="btn gold" data-x="reg"'+(x.closed?' disabled style="opacity:.55;cursor:not-allowed"':'')+'>'+(x.closed?'التسجيل مغلق':'سجّل في هذه الدورة')+'</button><button class="b" data-x="close">إغلاق</button></div></div>';
  infoEl.addEventListener('click',function(e){
    if(e.target===infoEl||e.target.closest('[data-x="close"]')){closeInfo();return}
    var r=e.target.closest('[data-x="reg"]');if(r&&!r.disabled){closeInfo();sel.value=x.id;$('#contact').scrollIntoView({behavior:'smooth'});setTimeout(function(){$('#fname').focus({preventScroll:true})},500)}
  });
  document.body.appendChild(infoEl);$('[data-x="close"]',infoEl).focus();
}
function closeInfo(){if(infoEl){infoEl.remove();infoEl=null;if(lastFocus&&lastFocus.focus)try{lastFocus.focus()}catch(e){}}}

/* ---------- دخول المدير ---------- */
var loginEl=null;
function openLogin(){
  if(loginEl)return;lastFocus=document.activeElement;
  loginEl=document.createElement('div');loginEl.id='login-root';loginEl.className='ad-modal';loginEl.setAttribute('role','dialog');loginEl.setAttribute('aria-modal','true');loginEl.setAttribute('aria-label','دخول الإدارة');
  loginEl.innerHTML='<div class="box" style="max-width:420px"><h2>دخول الإدارة</h2><form id="lg-f" novalidate><div class="ad-f">'
   +'<label>البريد الإلكتروني<input id="lg-e" type="email" autocomplete="username" dir="ltr" style="text-align:right"></label>'
   +'<label>كلمة المرور<input id="lg-p" type="password" autocomplete="current-password" dir="ltr" style="text-align:right"></label></div>'
   +'<p class="ad-err" id="lg-err" role="alert" hidden></p><div class="acts"><button class="b gold" type="submit" id="lg-go">دخول</button><button class="b" type="button" data-x="close">إلغاء</button></div></form></div>';
  loginEl.addEventListener('click',function(e){if(e.target===loginEl||e.target.closest('[data-x="close"]'))closeLogin()});
  $('#lg-f',loginEl).addEventListener('submit',doLogin);
  document.body.appendChild(loginEl);$('#lg-e',loginEl).focus();
}
function closeLogin(){if(loginEl){loginEl.remove();loginEl=null;if(lastFocus&&lastFocus.focus)try{lastFocus.focus()}catch(e){}}}
function lgErr(m){var e=$('#lg-err',loginEl);if(!e)return;e.textContent=m;e.hidden=false}
function doLogin(ev){
  ev.preventDefault();
  var em=$('#lg-e',loginEl).value,pw=$('#lg-p',loginEl).value,go=$('#lg-go',loginEl);
  if(!em.trim()||!pw){lgErr('أدخل البريد الإلكتروني وكلمة المرور.');return}
  go.disabled=true;$('#lg-err',loginEl).hidden=true;
  api('POST','/api/login',{email:em,password:pw}).then(function(d){
    CSRF=d.csrf;ADMIN_EMAIL=d.email;closeLogin();return loadAdmin(true);
  }).catch(function(er){
    if(!loginEl)return;go.disabled=false;
    lgErr(er.status===429?'محاولات كثيرة. انتظر عشر دقائق ثم أعد المحاولة.':er.status===401?'البريد الإلكتروني أو كلمة المرور غير صحيحة.':'تعذّر الاتصال بالخادم. حاول مرة أخرى.');
  });
}
function loadAdmin(fresh){
  return api('GET','/api/admin/data').then(function(d){
    S=d;SAVED=JSON.stringify(S);ADMIN_EMAIL=d.email||ADMIN_EMAIL;
    S.site=Object.assign({fb:'',ig:'',tg:'',email:'',addr:''},IMG_DEF,S.site||{});
    S.courses.forEach(function(c){c.ins=c.ins||'';c.top=c.top||''});
    SAVED=JSON.stringify(S);
    enableAdmin();if(fresh)toast('تم تسجيل الدخول. أهلًا بك.');
    return loadRegs(true);
  });
}
var lgl=$('#ad-login-link');if(lgl)lgl.addEventListener('click',function(e){e.preventDefault();openLogin()});

/* ---------- لوحة الإدارة (للمدير فقط) ---------- */
function touch(){dirty=JSON.stringify(S)!==SAVED;updBar()}
function mutated(){touch();render();if(panel&&!panel.hidden)renderPanel()}
function toast(m){if(!toastEl)return;toastEl.textContent=m;toastEl.hidden=false;clearTimeout(toastT);toastT=setTimeout(function(){toastEl.hidden=true},4500)}
function updBar(){
  if(!root)return;
  $('#ad-state').textContent=busy?'جارٍ النشر…':dirty?'لديك تغييرات غير منشورة':'كل التغييرات منشورة';
  $('[data-a="publish"]').disabled=!dirty||busy;
  $('[data-a="discard"]').hidden=!dirty||busy;
  $('[data-a="preview"]').textContent=preview?'العودة إلى وضع الإدارة':'معاينة كزائر';
  root.classList.toggle('dirty',dirty);root.classList.toggle('pv',preview);
}
function enableAdmin(){
  isAdmin=true;document.body.classList.add('admin');
  root=document.createElement('div');root.id='admin-root';
  root.innerHTML='<div class="ad-bar" role="region" aria-label="أدوات الإدارة"><span id="ad-state"></span>'
   +'<button class="ad-btn" data-a="panel">لوحة التحكم</button><button class="ad-btn" data-a="preview">معاينة كزائر</button>'
   +'<button class="ad-btn" data-a="logout">تسجيل الخروج</button><button class="ad-btn" data-a="discard" hidden>تراجع عن التعديلات</button><button class="ad-btn pub" data-a="publish" disabled>حفظ ونشر</button></div>'
   +'<div class="ad-shade" hidden></div><aside class="ad-panel" role="dialog" aria-label="لوحة التحكم" hidden></aside><div class="ad-modal" role="dialog" aria-modal="true" hidden></div><div class="ad-toast" role="status" hidden></div>';
  document.body.appendChild(root);
  panel=$('.ad-panel',root);modal=$('.ad-modal',root);shade=$('.ad-shade',root);toastEl=$('.ad-toast',root);
  root.addEventListener('click',onAdminClick);
  root.addEventListener('input',onAdminInput);
  root.addEventListener('change',onAdminChange);
  document.addEventListener('keydown',function(e){if(e.key!=='Escape'||!modal)return;if(!modal.hidden)closeEditor();else if(!panel.hidden)closePanel()});
  updBar();render();
}
function disableAdmin(keep){
  if(!keep)api('POST','/api/logout').catch(function(){});
  CSRF='';isAdmin=false;preview=false;dirty=false;S=JSON.parse(SAVED);S.courses=S.courses.filter(function(c){return !c.hide});
  if(root){root.remove();root=null;panel=modal=shade=toastEl=null}
  document.body.classList.remove('admin');render();
}
function changeAuth(){
  var op=$('#s-op',panel).value,ne=$('#s-ne',panel).value.trim(),np=$('#s-np',panel).value,nc=$('#s-nc',panel).value,m=$('#s-msg',panel);
  function say(t,ok){m.textContent=t;m.hidden=false;m.style.color=ok?'#067647':'#B42318'}
  if(!op){say('أدخل كلمة المرور الحالية.');return}
  if(ne&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ne)){say('البريد الإلكتروني الجديد غير صالح.');return}
  if(np.length<8){say('كلمة المرور الجديدة أقصر من 8 أحرف.');return}
  if(np!==nc){say('تأكيد كلمة المرور غير مطابق.');return}
  api('POST','/api/admin/password',{oldPassword:op,newEmail:ne,newPassword:np}).then(function(d){
    CSRF=d.csrf;ADMIN_EMAIL=d.email;say('تم تغيير بيانات الدخول فورًا.',true);
    ['#s-op','#s-np','#s-nc','#s-ne'].forEach(function(q){$(q,panel).value=''});
  }).catch(function(er){say(er.status===401?'كلمة المرور الحالية غير صحيحة.':er.status===429?'محاولات كثيرة، حاول لاحقًا.':er.data&&er.data.error==='email'?'البريد الإلكتروني غير صالح.':'تعذّر التنفيذ.')});
}
function openPanel(){panel.hidden=false;shade.hidden=false;renderPanel()}
function closePanel(){panel.hidden=true;shade.hidden=true}
function renderPanel(){
  var nn=REGS.filter(function(r){return r.status==='new'}).length;
  var tabs=[['regs','التسجيلات'+(nn?' ('+nn+')':'')],['courses','الدورات'],['site','بيانات الموقع'],['cats','الأقسام'],['sec','الحساب']];
  var h='<div class="ad-top"><h2>لوحة التحكم</h2><button class="b" data-a="close">إغلاق</button></div><div class="ad-tabs" role="tablist">'
   +tabs.map(function(t){return '<button role="tab" data-tab="'+t[0]+'" aria-selected="'+(tab===t[0])+'">'+t[1]+'</button>'}).join('')+'</div>';
  if(tab==='regs'){
    var ST={'new':'جديد',contacted:'تم التواصل',confirmed:'مؤكد',cancelled:'ملغى'};
    var list=REGS.filter(function(r){return rfilter==='all'||r.status===rfilter});
    h+='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><select class="b" data-rf style="padding:8px 12px">'+[['all','كل الحالات']].concat(Object.keys(ST).map(function(k){return [k,ST[k]]})).map(function(o){return '<option value="'+o[0]+'"'+(rfilter===o[0]?' selected':'')+'>'+o[1]+'</option>'}).join('')+'</select>'
     +'<a class="b" href="/api/admin/registrations.csv" download>تصدير CSV</a><button class="b" data-a="regsreload">تحديث</button></div>';
    h+=list.length?'<ul class="ad-list">'+list.map(function(r){
      var ph=String(r.phone).replace(/\D/g,''),d=new Date(r.ts);
      var wl=ph?'https://wa.me/'+(ph.indexOf('00')===0?ph.slice(2):ph.charAt(0)==='0'?'218'+ph.slice(1):ph):'#';
      return '<li style="align-items:flex-start;flex-direction:column;gap:6px"><div style="display:flex;justify-content:space-between;width:100%;gap:8px"><b>'+esc(r.name)+'</b><small style="color:var(--muted)">'+d.toLocaleDateString('en-GB')+' '+d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})+'</small></div>'
       +'<div style="font-size:.92rem">'+esc(r.courseTitle)+'</div><div style="font-size:.92rem;display:flex;gap:12px;flex-wrap:wrap"><a href="tel:'+esc(r.phone)+'" dir="ltr" style="text-decoration:underline">'+esc(r.phone)+'</a><a href="'+wl+'" target="_blank" rel="noopener" style="text-decoration:underline">واتساب</a></div>'
       +(r.note?'<div style="font-size:.88rem;color:var(--muted)">'+esc(r.note)+'</div>':'')
       +'<div style="display:flex;gap:8px;align-items:center"><select class="b" data-rst="'+r.id+'" style="padding:6px 10px">'+Object.keys(ST).map(function(k){return '<option value="'+k+'"'+(r.status===k?' selected':'')+'>'+ST[k]+'</option>'}).join('')+'</select><button class="b danger" data-rdel="'+r.id+'">حذف</button></div></li>'}).join('')+'</ul>':'<p class="ad-note">لا توجد تسجيلات'+(rfilter==='all'?' بعد':' بهذه الحالة')+'.</p>';
  }else if(tab==='courses'){
    h+='<button class="b gold" data-a="new">+ دورة جديدة</button><ul class="ad-list">'+S.courses.map(function(x,i){
      var sub=priceTxt(x)+(x.fmt?' · '+x.fmt:'')+(x.hide?' · مخفية':'')+(x.closed?' · التسجيل مغلق':'');
      return '<li><div class="ln"><b>'+esc(x.t)+'</b><small>'+esc(sub)+'</small></div><div class="ops"><button class="b ic-b" data-up="'+i+'" aria-label="نقل للأعلى"'+(i===0?' disabled':'')+'>'+ico('up')+'</button><button class="b ic-b" data-dn="'+i+'" aria-label="نقل للأسفل"'+(i===S.courses.length-1?' disabled':'')+'>'+ico('down')+'</button><button class="b" data-edit="'+esc(x.id)+'">تعديل</button></div></li>'}).join('')+'</ul>'
     +'<p class="ad-note">ترتيب القائمة هنا هو ترتيب ظهور الدورات في الموقع.</p>';
  }else if(tab==='site'){
    var F=[['phone','رقم الهاتف المعروض في الموقع','0918597685'],['wa','رقم واتساب (تصله طلبات التسجيل)','0918597685 أو 218918597685'],['currency','العملة','د.ل'],['email','البريد الإلكتروني (اختياري)',''],['addr','العنوان (اختياري)',''],['fb','رابط فيسبوك (اختياري)','facebook.com/yourpage'],['ig','رابط إنستغرام (اختياري)','instagram.com/yourpage'],['tg','رابط تيليغرام (اختياري)','t.me/yourchannel'],['h1a','عنوان الواجهة – السطر الأول',''],['h1b','عنوان الواجهة – السطر الذهبي',''],['hsub','النص التعريفي أسفل العنوان','','t'],['about','نص «من نحن»','','t']];
    var IM=[['imgHero','صورة الواجهة الرئيسية','hero'],['imgEmblem','شعار الرأس (الرمز فقط)','emblem'],['imgFull','الشعار الكامل (قسم من نحن)','full']];
    h+='<div class="ad-f" style="margin-bottom:16px">'+IM.map(function(m){return '<label>'+m[1]+'<span class="h">PNG أو JPG أو WEBP، حتى 4 ميغابايت</span><span style="display:flex;gap:10px;align-items:center"><img src="'+esc(S.site[m[0]]||IMG_DEF[m[0]])+'" alt="" style="width:64px;height:44px;object-fit:contain;background:#fbfaf7;border-radius:8px;border:1px solid var(--line)"><input type="file" accept="image/png,image/jpeg,image/webp" data-up="'+m[2]+'" data-key="'+m[0]+'" style="flex:1"><button class="b" data-imgreset="'+m[0]+'">الافتراضي</button></span></label>'}).join('')+'</div>';
    h+='<div class="ad-f">'+F.map(function(f){var v=esc(S.site[f[0]]||'');
      return '<label>'+f[1]+(f[2]?'<span class="h">مثال: '+f[2]+'</span>':'')+(f[3]?'<textarea data-site="'+f[0]+'">'+v+'</textarea>':'<input data-site="'+f[0]+'" value="'+v+'">')+'</label>'}).join('')+'</div>'
     +'<p class="ad-note">تظهر التغييرات فورًا أمامك، ولا يراها الزوار إلا بعد الضغط على «نشر التغييرات».</p>';
  }else if(tab==='sec'){
    h+='<p class="ad-note" style="margin:0 0 12px">الحساب الحالي: <b dir="ltr">'+esc(ADMIN_EMAIL)+'</b></p><div class="ad-f"><label>كلمة المرور الحالية<input id="s-op" type="password" autocomplete="current-password" dir="ltr" style="text-align:right"></label>'
     +'<label>البريد الجديد<span class="h">اتركه فارغًا للإبقاء على الحالي</span><input id="s-ne" type="email" autocomplete="off" dir="ltr" style="text-align:right"></label>'
     +'<label>كلمة المرور الجديدة<span class="h">8 أحرف على الأقل، والأفضل أن تجمع حروفًا وأرقامًا ورموزًا</span><input id="s-np" type="password" autocomplete="new-password" dir="ltr" style="text-align:right"></label>'
     +'<label>تأكيد كلمة المرور الجديدة<input id="s-nc" type="password" autocomplete="new-password" dir="ltr" style="text-align:right"></label>'
     +'<button class="b gold" data-a="setpw">حفظ بيانات الدخول</button><p class="ad-err" id="s-msg" role="status" hidden></p></div>'
     +'<p class="ad-note">يسري التغيير فورًا ولا يحتاج إلى «حفظ ونشر».</p>';
  }else{
    h+='<div class="ad-f">'+S.cats.map(function(c){var used=S.courses.some(function(x){return x.c===c.id});
      return '<label>اسم القسم<span style="display:flex;gap:8px"><input data-cat="'+esc(c.id)+'" value="'+esc(c.n)+'"><button class="b danger" data-catdel="'+esc(c.id)+'"'+(used||S.cats.length<2?' disabled title="القسم مستخدم في دورات"':'')+'>حذف</button></span></label>'}).join('')
     +'<label>قسم جديد<span style="display:flex;gap:8px"><input id="newcat" placeholder="مثال: اللغات"><button class="b gold" data-a="addcat">إضافة</button></span></label></div>'
     +'<p class="ad-note">لا يمكن حذف قسم تستخدمه دورات. انقل الدورات إلى قسم آخر أولًا.</p>';
  }
  panel.innerHTML=h;
}
function opt(list,cur){return list.map(function(o){var v=Array.isArray(o)?o[0]:o,l=Array.isArray(o)?o[1]:o;return '<option value="'+esc(v)+'"'+(v===cur?' selected':'')+'>'+esc(l)+'</option>'}).join('')}
function openEditor(id){
  var i=id?findC(id):-1,x=i>-1?S.courses[i]:{ins:'',top:'',t:'',c:S.cats[0].id,ic:'target',d:'',tag:'',price:'',fmt:FORMATS[0],dur:'',start:'',hide:false,closed:false};
  editing=i>-1?id:null;
  var fm=FORMATS.slice();if(x.fmt&&fm.indexOf(x.fmt)<0)fm.push(x.fmt);
  modal.innerHTML='<div class="box"><h2>'+(editing?'تعديل الدورة':'دورة جديدة')+'</h2><div class="ad-f">'
   +'<label>اسم الدورة<input id="e-t" value="'+esc(x.t)+'"></label>'
   +'<label>وصف مختصر<textarea id="e-d">'+esc(x.d)+'</textarea></label>'
   +'<div class="row2"><label>السعر<span class="h">اتركه فارغًا لعرض «تواصل معنا لمعرفة السعر»</span><input id="e-price" inputmode="decimal" value="'+esc(x.price)+'" placeholder="مثال: 250"></label>'
   +'<label>نمط الدورة<select id="e-fmt">'+opt(fm,x.fmt)+'</select></label></div>'
   +'<label>المدرب (اختياري)<input id="e-ins" value="'+esc(x.ins)+'" placeholder="اسم المدرب"></label>'
   +'<label>محاور الدورة (اختياري)<span class="h">اكتب كل محور في سطر مستقل، وتظهر في نافذة «التفاصيل»</span><textarea id="e-top" style="min-height:110px">'+esc(x.top)+'</textarea></label>'
   +'<div class="row2"><label>المدة<input id="e-dur" value="'+esc(x.dur)+'" placeholder="مثال: 6 أسابيع"></label><label>موعد البدء<input id="e-start" value="'+esc(x.start)+'" placeholder="مثال: 15 أكتوبر"></label></div>'
   +'<div class="row2"><label>القسم<select id="e-c">'+opt(S.cats.map(function(c){return [c.id,c.n]}),x.c)+'</select></label>'
   +'<label>الأيقونة<select id="e-ic">'+opt(ICONS,x.ic)+'</select></label></div>'
   +'<label>شارة على البطاقة (اختياري)<input id="e-tag" list="e-tags" value="'+esc(x.tag)+'"><datalist id="e-tags">'+TAGS.map(function(t){return '<option value="'+esc(t)+'">'}).join('')+'</datalist></label>'
   +'<label class="chk"><input type="checkbox" id="e-closed"'+(x.closed?' checked':'')+'>إغلاق التسجيل (تبقى الدورة ظاهرة لكن لا يمكن التسجيل)</label>'
   +'<label class="chk"><input type="checkbox" id="e-hide"'+(x.hide?' checked':'')+'>إخفاء الدورة عن الزوار</label></div>'
   +'<p class="ad-err" id="e-err" hidden></p><div class="acts"><button class="b gold" data-a="save">حفظ</button><button class="b" data-a="cancel">إلغاء</button><span class="sp"></span>'
   +(editing?'<button class="b danger" data-a="del">حذف الدورة</button>':'')+'</div></div>';
  modal.hidden=false;$('#e-t',modal).focus();
}
function closeEditor(){modal.hidden=true;modal.innerHTML='';editing=null}
function saveEditor(){
  var t=$('#e-t',modal).value.trim(),err=$('#e-err',modal);
  if(!t){err.textContent='اكتب اسم الدورة أولًا.';err.hidden=false;$('#e-t',modal).focus();return}
  var o={id:editing||uid('c'),t:t,d:$('#e-d',modal).value.trim(),c:$('#e-c',modal).value,ic:$('#e-ic',modal).value,tag:$('#e-tag',modal).value.trim(),price:$('#e-price',modal).value.trim(),fmt:$('#e-fmt',modal).value,dur:$('#e-dur',modal).value.trim(),start:$('#e-start',modal).value.trim(),hide:$('#e-hide',modal).checked,closed:$('#e-closed',modal).checked,ins:$('#e-ins',modal).value.trim(),top:$('#e-top',modal).value.trim()};
  if(editing)S.courses[findC(editing)]=o;else S.courses.push(o);
  closeEditor();mutated();
}
var delT=null;
function onAdminClick(e){
  var el=e.target.closest('button,.ad-shade');if(!el)return;
  if(el.classList.contains('ad-shade')){closePanel();return}
  var a=el.dataset.a;
  if(el.dataset.tab){tab=el.dataset.tab;renderPanel();return}
  if(el.dataset.edit){openEditor(el.dataset.edit);return}
  if(el.dataset.up!=null||el.dataset.dn!=null){
    var i=+(el.dataset.up!=null?el.dataset.up:el.dataset.dn),j=el.dataset.up!=null?i-1:i+1;
    if(j<0||j>=S.courses.length)return;var t=S.courses[i];S.courses[i]=S.courses[j];S.courses[j]=t;mutated();return}
  if(el.dataset.imgreset){S.site[el.dataset.imgreset]=IMG_DEF[el.dataset.imgreset];applySite();touch();renderPanel();return}
  if(el.dataset.rdel){
    if(!el.classList.contains('armed')){el.classList.add('armed');el.textContent='تأكيد الحذف';setTimeout(function(){el.classList.remove('armed');el.textContent='حذف'},4000);return}
    var rid=el.dataset.rdel;api('DELETE','/api/admin/registrations/'+rid).then(function(){REGS=REGS.filter(function(r){return r.id!==rid});renderPanel()}).catch(function(){toast('تعذّر الحذف.')});return}
  if(el.dataset.catdel){S.cats=S.cats.filter(function(c){return c.id!==el.dataset.catdel});mutated();return}
  if(a==='panel')openPanel();
  else if(a==='close')closePanel();
  else if(a==='new')openEditor(null);
  else if(a==='save')saveEditor();
  else if(a==='cancel')closeEditor();
  else if(a==='del'){
    if(!el.classList.contains('armed')){el.classList.add('armed');el.textContent='اضغط مرة أخرى لتأكيد الحذف';clearTimeout(delT);delT=setTimeout(function(){el.classList.remove('armed');el.textContent='حذف الدورة'},4000)}
    else{S.courses.splice(findC(editing),1);closeEditor();mutated()}
  }
  else if(a==='addcat'){var v=$('#newcat',panel).value.trim();if(!v)return;S.cats.push({id:uid('k'),n:v});mutated()}
  else if(a==='preview'){preview=!preview;if(preview)closePanel();render();updBar()}
  else if(a==='discard'){S=JSON.parse(SAVED);dirty=false;render();updBar();if(!panel.hidden)renderPanel();toast('تم التراجع عن التعديلات غير المنشورة.')}
  else if(a==='publish')publish();
  else if(a==='logout'){
    if(dirty&&!el.dataset.armed){el.dataset.armed='1';el.textContent='تأكيد الخروج دون نشر';toast('لديك تعديلات غير منشورة. اضغط مرة أخرى للخروج وفقدانها.');setTimeout(function(){delete el.dataset.armed;el.textContent='تسجيل الخروج'},5000);return}
    disableAdmin();
  }
  else if(a==='setpw')changeAuth();
  else if(a==='regsreload')loadRegs(false);
}
function loadRegs(quiet){
  return api('GET','/api/admin/registrations').then(function(d){
    REGS=d.regs||[];var nn=REGS.filter(function(r){return r.status==='new'}).length;
    if(quiet&&nn)toast('لديك '+nn+' تسجيل جديد في انتظار المتابعة.');
    if(panel&&!panel.hidden)renderPanel();
  }).catch(function(){});
}
function onAdminChange(e){
  var t=e.target;
  if(t.dataset.rf!=null){rfilter=t.value;renderPanel();return}
  if(t.dataset.rst){
    var id=t.dataset.rst,st=t.value;
    api('PATCH','/api/admin/registrations/'+id,{status:st}).then(function(){REGS.forEach(function(r){if(r.id===id)r.status=st});renderPanel()}).catch(function(){toast('تعذّر تحديث الحالة.')});return}
  if(t.dataset.up){
    var f=t.files&&t.files[0];if(!f)return;
    if(!/^image\/(png|jpeg|webp)$/.test(f.type)){toast('الصيغة غير مدعومة. استخدم PNG أو JPG أو WEBP.');t.value='';return}
    if(f.size>4e6){toast('الصورة أكبر من 4 ميغابايت.');t.value='';return}
    toast('جارٍ رفع الصورة…');
    api('POST','/api/admin/upload?kind='+encodeURIComponent(t.dataset.up),undefined,f).then(function(d){S.site[t.dataset.key]=d.url;applySite();touch();renderPanel();toast('تم رفع الصورة. اضغط «حفظ ونشر» لتظهر للزوار.')}).catch(function(er){toast(er.data&&er.data.error==='type'?'ملف الصورة غير صالح.':'تعذّر رفع الصورة.')});
  }
}
function onAdminInput(e){
  var t=e.target;
  if(t.dataset.site){S.site[t.dataset.site]=t.value;applySite();touch()}
  else if(t.dataset.cat){for(var i=0;i<S.cats.length;i++)if(S.cats[i].id===t.dataset.cat)S.cats[i].n=t.value;render();touch()}
}
function publish(){
  if(!dirty||busy)return;
  busy=true;updBar();
  api('PUT','/api/admin/data',{baseVersion:S.v,site:S.site,cats:S.cats,courses:S.courses}).then(function(d){
    S=d;S.courses.forEach(function(c){c.ins=c.ins||'';c.top=c.top||''});SAVED=JSON.stringify(S);busy=false;dirty=false;render();updBar();if(panel&&!panel.hidden)renderPanel();
    toast('تم الحفظ والنشر. التغييرات ظاهرة الآن للزوار.');
  }).catch(function(er){
    busy=false;updBar();
    var m=er.status===409?'عُدّل الموقع من مكان آخر. أعد تحميل الصفحة ثم كرّر تعديلك.':er.status===401||er.status===403?'انتهت الجلسة. سجّل الدخول من جديد.':er.status===413?'حجم البيانات كبير.':'تعذّر الحفظ. تحقق من الاتصال وحاول مرة أخرى.';
    toast(m);
    if(er.status===401||er.status===403){disableAdmin(true)}
  });
}
(function boot(){
  api('GET','/api/me').then(function(d){
    if(d.admin){CSRF=d.csrf;ADMIN_EMAIL=d.email;return loadAdmin(false)}
    if(location.hash==='#admin')openLogin();
  }).catch(function(){});
})();
})();

