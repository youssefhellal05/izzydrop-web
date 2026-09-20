(()=>{const $=s=>document.querySelector(s);let SUPPLIERS=[],PROFILES=[],PRODUCTS=[],ORDERS=[],DEFAULT_COMMISSION=0,SELECTED_SUPPLIER=null;
const msg=(t,b=false)=>{const e=$('#status');e.textContent=t;e.className='status'+(b?' bad':'')};
function go(v){document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('on',b.dataset.view===v));document.querySelectorAll('.view').forEach(x=>x.hidden=true);$('#view-'+v).hidden=false;if(v==='commissions')renderCommissions()}
async function verifyAdmin(){const s=IZZY.session();if(!s?.user?.id)throw Error('Please log in.');const roles=await IZZY.request(`/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(s.user.id)}`);if(!roles.some(r=>r.role==='admin'))throw Error('Admin access required.')}

function renderSuppliers(){const pm=new Map(PROFILES.map(p=>[p.id,p]));$('#suppliers').innerHTML=SUPPLIERS.map(s=>{const p=pm.get(s.profile_id)||{};return `<div class="list-row"><div class="row"><div><b>${IZZY.esc(s.business_name)}</b><small>${IZZY.esc(p.full_name||'')} · ${IZZY.esc(p.phone||'')}</small></div><span class="tag ${s.status==='approved'?'ok':s.status==='pending'?'warn':''}">${IZZY.esc(s.status)}</span></div>${s.status==='pending'?`<div class="hero-actions"><button class="btn review-btn" data-id="${s.id}" data-decision="approve">Approve</button><button class="btn secondary review-btn" data-id="${s.id}" data-decision="reject">Reject</button></div>`:s.status==='approved'?`<div class="hero-actions"><button class="btn secondary review-btn" data-id="${s.id}" data-decision="suspend">Suspend</button></div>`:''}</div>`}).join('')||'<div class="notice">No supplier applications yet.</div>';document.querySelectorAll('.review-btn').forEach(b=>b.onclick=()=>review(b))}
function renderProducts(){$('#products').innerHTML=PRODUCTS.map(p=>`<div class="list-row row"><div><b>${IZZY.esc(p.name)}</b><small>${IZZY.esc(p.sku)} · ${IZZY.money(p.suggested_retail_price,p.currency)}</small></div><span class="tag ${p.status==='active'?'ok':''}">${IZZY.esc(p.status)}</span></div>`).join('')||'<div class="notice">No products yet.</div>'}
function renderOrders(){$('#orders').innerHTML=ORDERS.map(o=>`<div class="list-row row"><div><b>${IZZY.esc(o.external_order_ref||o.shopify_order_name||('Order '+String(o.id).slice(0,8)))}</b><small>${IZZY.esc(o.customer_name||'')} · ${IZZY.money(o.total_amount,o.currency)} · ${new Date(o.created_at).toLocaleString()}</small></div><span class="tag ${o.status==='fulfilled'?'ok':''}">${IZZY.esc(o.status)}</span></div>`).join('')||'<div class="notice">No orders yet.</div>'}

function effectiveRate(p,s){return p?.commission_rate_override??s?.commission_rate_override??DEFAULT_COMMISSION}
function renderCommissions(){
  const select=$('#commission-supplier');
  if(!SUPPLIERS.length){select.innerHTML='<option>No suppliers yet</option>';$('#commission-products').innerHTML='<div class="notice">No suppliers available.</div>';return}
  const current=SELECTED_SUPPLIER||select.value||SUPPLIERS[0].id;
  select.innerHTML=SUPPLIERS.map(s=>`<option value="${s.id}">${IZZY.esc(s.business_name)} · ${IZZY.esc(s.status)}</option>`).join('');
  if(SUPPLIERS.some(s=>s.id===current))select.value=current;
  SELECTED_SUPPLIER=select.value;
  const supplier=SUPPLIERS.find(s=>s.id===SELECTED_SUPPLIER);
  $('#global-commission').textContent=Number(DEFAULT_COMMISSION).toFixed(2).replace(/\.00$/,'')+'%';
  $('#supplier-commission').value=supplier?.commission_rate_override??'';
  $('#supplier-commission').placeholder=`Use marketplace default (${DEFAULT_COMMISSION}%)`;
  const products=PRODUCTS.filter(p=>p.supplier_id===SELECTED_SUPPLIER);
  $('#commission-products').innerHTML=products.map(p=>{
    const inherited=supplier?.commission_rate_override??DEFAULT_COMMISSION;
    const effective=effectiveRate(p,supplier);
    return `<div class="list-row commission-row"><div class="commission-product"><div><b>${IZZY.esc(p.name)}</b><small>${IZZY.esc(p.sku)} · Effective commission: ${effective}%</small></div><span class="tag ${p.commission_rate_override!=null?'ok':''}">${p.commission_rate_override!=null?'Product override':'Inherited'}</span></div><div class="inline-control"><input class="product-commission-input" data-id="${p.id}" type="number" min="0" max="100" step="0.01" value="${p.commission_rate_override??''}" placeholder="Inherit ${inherited}%"><button class="btn secondary product-commission-save" data-id="${p.id}">Save</button></div></div>`;
  }).join('')||'<div class="notice">This supplier has no products yet.</div>';
  document.querySelectorAll('.product-commission-save').forEach(b=>b.onclick=()=>saveProductCommission(b));
}
async function saveProductCommission(btn){
  const input=document.querySelector(`.product-commission-input[data-id="${btn.dataset.id}"]`);
  const raw=input.value.trim(),rate=raw===''?null:Number(raw);
  if(rate!==null&&(Number.isNaN(rate)||rate<0||rate>100)){msg('Commission must be between 0 and 100.',true);return}
  btn.disabled=true;btn.textContent='Saving…';
  try{await IZZY.rpc('admin_set_product_commission',{_product_id:btn.dataset.id,_rate:rate});msg('Product commission updated.');await load(false);renderCommissions()}
  catch(e){msg(e.message,true)}
  finally{btn.disabled=false;btn.textContent='Save'}
}
async function review(btn){btn.disabled=true;try{await IZZY.rpc('admin_review_supplier',{_supplier_id:btn.dataset.id,_decision:btn.dataset.decision});msg('Supplier updated.');await load()}catch(e){msg(e.message,true);btn.disabled=false}}

async function load(render=true){
  const [suppliers,profiles,products,orders,settings]=await Promise.all([
    IZZY.request('/rest/v1/suppliers?select=*&order=created_at.desc'),
    IZZY.request('/rest/v1/profiles?select=id,full_name,phone,business_name,created_at'),
    IZZY.request('/rest/v1/supplier_products?select=*&order=created_at.desc'),
    IZZY.request('/rest/v1/orders?select=*&order=created_at.desc&limit=100'),
    IZZY.request('/rest/v1/marketplace_settings?select=default_commission_rate&id=eq.true&limit=1')
  ]);
  SUPPLIERS=suppliers;PROFILES=profiles;PRODUCTS=products;ORDERS=orders;DEFAULT_COMMISSION=Number(settings?.[0]?.default_commission_rate??0);
  if(render){renderSuppliers();renderProducts();renderOrders();renderCommissions()}
  msg('IzzyDrop admin system connected.');
}

$('#commission-supplier').onchange=e=>{SELECTED_SUPPLIER=e.target.value;renderCommissions()};
$('#supplier-commission-form').onsubmit=async e=>{
  e.preventDefault();const raw=$('#supplier-commission').value.trim(),rate=raw===''?null:Number(raw);
  if(rate!==null&&(Number.isNaN(rate)||rate<0||rate>100)){msg('Commission must be between 0 and 100.',true);return}
  try{await IZZY.rpc('admin_set_supplier_commission',{_supplier_id:$('#commission-supplier').value,_rate:rate});msg('Supplier default commission updated.');await load(false);renderCommissions()}
  catch(err){msg(err.message,true)}
};

$('#admin-invite-form').onsubmit=async e=>{
  e.preventDefault();const st=$('#admin-invite-status'),btn=$('#admin-invite-btn'),email=$('#admin-email').value.trim();
  st.textContent='Sending IzzyDrop admin invite…';st.className='status';btn.disabled=true;
  try{await IZZY.request('/functions/v1/admin-invite',{method:'POST',body:JSON.stringify({email})});st.textContent='Admin invitation sent. They can open the email, create their password, and enter the IzzyDrop admin dashboard.';st.className='status';e.target.reset()}
  catch(err){st.textContent=err.message;st.className='status bad'}
  finally{btn.disabled=false}
};

$('#logout').onclick=()=>{IZZY.logout();location.href='login.html'};document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>go(b.dataset.view));
(async()=>{try{await verifyAdmin();await load()}catch(e){msg(e.message,true);setTimeout(()=>location.href='login.html',1200)}})();})();