/* MAISON SURGA V2.1 — vanilla JS. Injects shared chrome (header, menu, bag, footer) so pages stay short. */
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
/* PRODUCT: single source for the bag. TODO: replace with Wix Stores product (real name, price GBP, variant, image). */
const P={name:'The Sleep Ritual',price:null,variant:'Variant: TODO'};
const money=n=>n==null?'£XX.XX':'£'+n.toFixed(2);
/* TRACKING: add Meta Pixel base code in <head> (TODO: real Pixel ID). Events fire only if fbq exists. */
const track=(e,d)=>{try{window.fbq&&fbq('track',e,d)}catch(_){}};
document.documentElement.classList.add('js');
const home=document.body.dataset.page==='home';
const SPR='<svg width="0" height="0" style="position:absolute" aria-hidden="true"><symbol id="mask" viewBox="0 0 200 110"><path fill="currentColor" d="M8 56C8 28 46 16 100 30c54-14 92-2 92 26 0 34-40 44-66 30-14-8-38-8-52 0C48 100 8 90 8 56Z"/><ellipse cx="58" cy="56" rx="24" ry="14" fill="#fff" opacity=".12"/><ellipse cx="142" cy="56" rx="24" ry="14" fill="#fff" opacity=".12"/></symbol><symbol id="mark" viewBox="0 0 24 24"><path d="M4 22V11a8 8 0 0 1 16 0v11M8.5 22V11a3.5 3.5 0 0 1 7 0v11" fill="none" stroke="currentColor" stroke-width="1.3"/></symbol></svg>';
const tr=(id,l)=>`<button data-open="${id}" aria-controls="${id}" aria-expanded="false">${l}</button>`;
document.body.insertAdjacentHTML('afterbegin',SPR+`<header class="hd${home?' over':''}">${tr('menu','Menu')}<a class="logo" href="index.html"><svg width="18" height="18" aria-hidden="true"><use href="#mark"/></svg>Maison Surga</a>${tr('bag','Bag (<span id="count">0</span>)')}</header>`);
document.body.insertAdjacentHTML('beforeend',`<div class="veil" id="veil"></div>
<div class="panel menu" id="menu" role="dialog" aria-modal="true" aria-label="Menu" aria-hidden="true"><button class="x" data-close>Close</button><nav aria-label="Main"><a href="index.html#ritual">The Sleep Ritual</a><a href="index.html#house">The house</a><a href="index.html#society">Surga Society</a><a href="product.html#faq">Help</a></nav><p class="small muted">Modern beauty rituals. United Kingdom, GBP.</p></div>
<div class="panel bag" id="bag" role="dialog" aria-modal="true" aria-label="Your bag" aria-hidden="true"><button class="x" data-close>Close</button><h2 style="font-size:2rem">Your bag</h2><div id="items"></div><div class="bf"><div class="row"><span>Subtotal</span><span id="sub"></span></div><button class="btn" style="width:100%" id="checkout" disabled>Checkout</button><p class="small muted" style="margin-top:.6rem">Not connected yet. TODO: Wix Stores checkout.</p></div></div>
<footer><div class="wrap"><a class="logo" href="index.html">Maison Surga</a><nav aria-label="Footer"><a href="product.html#delivery">Shipping</a><a href="product.html#delivery">Returns</a><a href="#">Privacy (TODO)</a><a href="#">Terms (TODO)</a><a href="mailto:TODO@maisonsurga.com">Contact</a><a href="#">Instagram (TODO)</a></nav><p class="small muted">United Kingdom · GBP (£). TODO: legal entity and address.</p></div></footer>`);
/* UTMs persist across internal pages */
try{const q=new URLSearchParams(location.search),k=['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid'];
k.forEach(x=>q.get(x)&&sessionStorage.setItem(x,q.get(x)));
const p=new URLSearchParams();k.forEach(x=>sessionStorage.getItem(x)&&p.set(x,sessionStorage.getItem(x)));
if([...p].length)$$('a[href]').forEach(a=>{const h=a.getAttribute('href');if(/^[\w-]+\.html/.test(h)&&!h.includes('?')){const[u,f]=h.split('#');a.href=u+'?'+p+(f?'#'+f:'')}})}catch(_){}
/* panels: backdrop, scroll lock, focus trap, focus return, aria */
let opener=null,cur=null;const veil=$('#veil');
const FOC='button:not([disabled]),a[href],input,summary,[tabindex]:not([tabindex="-1"])';
function open(id,b){close();cur=$('#'+id);opener=b;cur.classList.add('open');cur.setAttribute('aria-hidden','false');b.setAttribute('aria-expanded','true');document.body.classList.add('lock');if(id==='bag')veil.classList.add('on');setTimeout(()=>cur&&$('[data-close]',cur).focus(),50)}
function close(){if(!cur)return;cur.classList.remove('open');cur.setAttribute('aria-hidden','true');opener?.setAttribute('aria-expanded','false');veil.classList.remove('on');document.body.classList.remove('lock');opener?.focus();cur=null}
document.addEventListener('click',e=>{const o=e.target.closest('[data-open]');if(o)return open(o.dataset.open,o);if(e.target.closest('[data-close]')||e.target===veil)close();
const m=e.target.closest('[data-add]');if(m)add();const qb=e.target.closest('[data-q]');if(qb)setQ(S.q+ +qb.dataset.q);if(e.target.closest('[data-rm]'))setQ(0)});
addEventListener('keydown',e=>{if(!cur)return;if(e.key==='Escape')close();if(e.key==='Tab'){const f=$$(FOC,cur);if(!f.length)return;const a=f[0],z=f[f.length-1];if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus()}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}}});
/* bag: visual only, persisted locally for testing. TODO: replace with Wix Stores cart API */
let S={q:0};try{S=JSON.parse(localStorage.getItem('ms_bag'))||S}catch(_){}
function render(){const c=$('#count');c.textContent=S.q;const it=$('#items');
$('#sub').textContent=S.q?(P.price==null?'£XX.XX (TODO)':money(P.price*S.q)):'£0.00';
it.innerHTML=S.q?`<div class="it"><div class="arch"><svg viewBox="0 0 200 110"><use href="#mask"/></svg></div><div><h3>${P.name}</h3><p class="small muted">${P.variant}</p><div class="qty"><button data-q="-1" aria-label="Decrease quantity">−</button><span aria-live="polite">${S.q}</span><button data-q="1" aria-label="Increase quantity">+</button></div><button class="lnk small" data-rm>Remove</button></div><p>${money(P.price==null?null:P.price*S.q)}</p></div>`:'<p class="muted" style="margin:1.5rem 0">Your bag is empty.</p><a class="btn" href="product.html">See The Sleep Ritual</a>'}
function setQ(n){S.q=Math.max(0,Math.min(9,n));try{localStorage.setItem('ms_bag',JSON.stringify(S))}catch(_){}render()}
function add(){setQ(S.q+1);const c=$('#count');c.classList.remove('bump');void c.offsetWidth;c.classList.add('bump');track('AddToCart',{content_name:P.name,currency:'GBP'});const b=$('[data-open=bag]');open('bag',b)}
render();$('#checkout').onclick=()=>track('InitiateCheckout',{currency:'GBP'});
if($('#pdp'))track('ViewContent',{content_name:P.name,currency:'GBP'});
/* scroll reveal (light) */
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.15});$$('[data-r]').forEach(el=>io.observe(el));
/* PDP gallery + sticky bar */
const tk=$('#track');if(tk){const th=$$('.thumbs button');const go=i=>tk.children[i].scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'});th.forEach((b,i)=>b.onclick=()=>go(i));
tk.addEventListener('scroll',()=>{const i=Math.round(tk.scrollLeft/(tk.scrollWidth/tk.children.length));th.forEach((b,j)=>b.setAttribute('aria-current',j===i))},{passive:true});
const st=$('#sticky'),buy=$('#buy');new IntersectionObserver(([e])=>st.classList.toggle('on',!e.isIntersecting&&e.boundingClientRect.top<0)).observe(buy)}
/* newsletter: DEMO ONLY, nothing is stored. TODO: connect to Wix Forms / email tool */
$('#join')?.addEventListener('submit',e=>{e.preventDefault();$('#joined').textContent='Demo only: nothing was saved. This form is not connected to Wix yet.';console.warn('Newsletter not persisted (demo).')});
