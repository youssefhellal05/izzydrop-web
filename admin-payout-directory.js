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
  const format=(item,party,accountId)=>{
    const info=item.payout_details||{};
    const destination=info.destination||'';
    const beneficiary=info.beneficiary_name||'';
    const method=({instapay:'InstaPay',bank_transfer:'Bank transfer',mobile_wallet:'Mobile wallet'})[item.payout_method]||item.payout_method||'Not selected';
    return '<details class="order-details"><summary>'+e(party)+' · '+e(item.business_name||'Unnamed account')+' · '+e(method)+'</summary>'+
      '<div class="order-card-grid">'+
      '<div><small>Recipient name</small><b>'+e(beneficiary)+'</b></div>'+
      '<div><small>Payment destination</small><b>'+e(destination)+'</b></div>'+
      (info.bank_name?'<div><small>Bank</small><b>'+e(info.bank_name)+'</b></div>':'')+
      '</div><button type="button" class="btn secondary edit-payout-destination" data-party="'+e(party.toLowerCase())+'" data-account-id="'+e(accountId)+'">Edit payout destination</button></details>';
  };
  rows.addEventListener('click',async event=>{
    const edit=event.target.closest('.edit-payout-destination');
    if(!edit)return;
    const detail=edit.closest('details');
    const currentMethod=String(detail?.querySelector('summary')?.textContent||'').includes('InstaPay')?'instapay':'';
    const method=prompt('Payout method: instapay, bank_transfer, or mobile_wallet',currentMethod||'instapay');
    if(method===null)return;
    const normalized=method.trim().toLowerCase();
    if(!['instapay','bank_transfer','mobile_wallet'].includes(normalized)){status('Choose instapay, bank_transfer, or mobile_wallet.',true);return;}
    const info=edit.parentElement?.querySelector('.order-card-grid');
    const currentValues=detail?.querySelectorAll('.order-card-grid b')||[];
    const beneficiary=prompt('Beneficiary / recipient full name:',currentValues[0]?.textContent||'');
    if(beneficiary===null)return;
    const destination=prompt('Payment destination (InstaPay address, bank account or wallet number):',currentValues[1]?.textContent||'');
    if(destination===null)return;
    const bank=normalized==='bank_transfer'?prompt('Bank name:',currentValues[2]?.textContent||''):null;
    if(normalized==='bank_transfer'&&bank===null)return;
    if(!beneficiary.trim()||!destination.trim()||(normalized==='bank_transfer'&&!bank.trim())){status('Complete the recipient and payout destination fields.',true);return;}
    if(!confirm('Save the edited payout destination? This will not send money.'))return;
    edit.disabled=true;
    try{
      await IZZY.rpc('admin_update_payout_destination',{
        _party:edit.dataset.party,_account_id:edit.dataset.accountId,_payout_method:normalized,
        _beneficiary_name:beneficiary.trim(),_destination:destination.trim(),_bank_name:bank?.trim()||null
      });
      status('Payout destination updated and recorded in the audit log.');
      btn.click();
    }catch(error){status(error.message||'Could not update payout details.',true);edit.disabled=false;}
  });
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
      rows.innerHTML=supplierRows.map(x=>format(x,'Supplier',x.supplier_id)).join('')+
        dropshipperRows.map(x=>format(x,'Dropshipper',x.dropshipper_id)).join('')||
        '<div class="empty-mini"><b>No payout destinations saved yet.</b><span>Users can provide payout details in Settings.</span></div>';
      status('Loaded '+supplierRows.length+' supplier and '+dropshipperRows.length+' dropshipper payment destinations. Confirm each recipient before transferring funds.');
    }catch(err){status(err.message||'Could not load payout instructions.',true)}
    finally{btn.disabled=false;}
  };
})();