(()=>{
  'use strict';
  const section=document.getElementById('view-settlements');
  const heading=section?.querySelector('.section-heading');
  if(!section||!heading)return;
  heading.insertAdjacentHTML('afterend',[
    '<div class="card settings-card" id="admin-payout-directory">',
      '<div class="settings-title">',
        '<div><h3>Payment destinations</h3><p class="muted">Look up saved supplier and dropshipper payout instructions before making manual transfers.</p></div>',
      '</div>',
      '<button class="btn secondary" id="admin-payout-load" type="button">Load payout destinations</button>',
      '<p class="muted">Bank and wallet details load only when requested by an authorized admin. Nothing here sends money.</p>',
      '<div id="admin-payout-status" class="status" role="status" aria-live="polite"></div>',
      '<div id="admin-payout-rows" class="orders-list"></div>',
    '</div>'
  ].join(''));
  const btn=document.getElementById('admin-payout-load');
  const rows=document.getElementById('admin-payout-rows');
  const notice=document.getElementById('admin-payout-status');
  const status=(s,bad=false)=>{
    notice.textContent=s;
    notice.className='status'+(bad?' bad':'');
  };
  const e=value=>IZZY.esc(String(value??''));
  const format=(item,party)=>{
    const info=item.payout_details||{};
    const destination=info.destination||'';
    const beneficiary=info.beneficiary_name||'';
    const method=({instapay:'InstaPay',bank_transfer:'Bank transfer',mobile_wallet:'Mobile wallet'})[item.payout_method]||item.payout_method||'Not selected';
    return '<details class="order-details"><summary>'+e(party)+' · '+e(item.business_name||'Unnamed account')+' · '+e(method)+'</summary>'+
      '<div class="order-card-grid">'+
      '<div><small>Recipient name</small><b>'+e(beneficiary)+'</b></div>'+
      '<div><small>Payment destination</small><b>'+e(destination)+'</b></div>'+
      (info.bank_name?'<div><small>Bank</small><b>'+e(info.bank_name)+'</b></div>':'')+
      '</div></details>';
  };
  btn.onclick=async()=>{
    btn.disabled=true;
    status('Loading private payout details…');
    rows.textContent='';
    try{
      const session=IZZY.session();
      const uid=session?.user?.id;
      if(!uid)throw Error('Sign in as an admin first.');
      const roles=await IZZY.request('/rest/v1/user_roles?select=role&user_id=eq.'+encodeURIComponent(uid));
      if(!roles?.some(x=>x.role==='admin'))throw Error('Admin access required.');
      const [s,d,sInfo,dInfo]=await Promise.all([
        IZZY.request('/rest/v1/suppliers?select=id,business_name'),
        IZZY.request('/rest/v1/dropshippers?select=id,business_name'),
        IZZY.request('/rest/v1/supplier_payout_details?select=supplier_id,payout_method,payout_details'),
        IZZY.request('/rest/v1/dropshipper_payout_details?select=dropshipper_id,payout_method,payout_details')
      ]);
      const sn=new Map((s||[]).map(x=>[x.id,x.business_name||'Supplier']));
      const dn=new Map((d||[]).map(x=>[x.id,x.business_name||'Dropshipper']));
      const supplierRows=(sInfo||[]).map(x=>({...x,business_name:sn.get(x.supplier_id)||'Supplier'}));
      const dropshipperRows=(dInfo||[]).map(x=>({...x,business_name:dn.get(x.dropshipper_id)||'Dropshipper'}));
      rows.innerHTML=supplierRows.map(x=>format(x,'Supplier')).join('')+
        dropshipperRows.map(x=>format(x,'Dropshipper')).join('')||
        '<div class="empty-mini"><b>No payout destinations saved yet.</b><span>Users can provide payout details in Settings.</span></div>';
      status('Loaded '+supplierRows.length+' supplier and '+dropshipperRows.length+' dropshipper payment destinations. Confirm each recipient before transferring funds.');
    }catch(err){status(err.message||'Could not load payout instructions.',true)}
    finally{btn.disabled=false;}
  };
})();