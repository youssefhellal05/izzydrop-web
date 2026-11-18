(()=> {
  'use strict';
  const $=s=>document.querySelector(s);
  const root=$('#view-accounts');
  if(!root)return;
  let rows=[],loaded=false,loading=false;
  const esc=v=>IZZY.esc(String(v??''));
  const status=(message,bad=false)=>{const n=$('#admin-account-status');if(n){n.textContent=message||'';n.className='status'+(bad?' bad':'')}};
  const pretty=value=>{try{return JSON.stringify(value&&typeof value==='object'?value:{},null,2)}catch{return '{}'}};
  const roleText=a=>(Array.isArray(a.roles)?a.roles:[]).join(', ')||'No role';
  const verified=value=>value?'<span class="tag ok">Email verified</span>':'<span class="tag warn">Email not verified</span>';
  function render(){
    const q=$('#admin-account-search').value.trim().toLowerCase();
    const filtered=rows.filter(a=>[a.full_name,a.email,a.phone,a.business_name,roleText(a)].filter(Boolean).join(' ').toLowerCase().includes(q));
    $('#admin-account-meta').textContent=filtered.length+' of '+rows.length+' operational accounts';
    $('#admin-account-results').innerHTML=filtered.map(a=>{
      const supplier=a.supplier_id?'<div><b>Supplier:</b> '+esc(a.supplier_status||'—')+' · Verification '+esc(a.supplier_verification_status||'not submitted')+' · Payout '+(a.supplier_payout_saved?'Saved':'Missing')+'</div>':'';
      const drop=a.dropshipper_id?'<div><b>Dropshipper:</b> '+esc(a.dropshipper_status||'—')+' · Identity '+esc(a.dropshipper_verification_status||'not submitted')+' · Payout '+(a.dropshipper_payout_saved?'Saved':'Missing')+'</div>':'';
      const dropAction=a.dropshipper_id?'<button type="button" class="btn secondary admin-drop-status" data-id="'+esc(a.dropshipper_id)+'" data-status="'+esc(a.dropshipper_status||'active')+'">'+(a.dropshipper_status==='suspended'?'Reactivate dropshipper':'Suspend dropshipper')+'</button>':'';
      return '<article class="card admin-order-card admin-account-record" data-account-id="'+esc(a.user_id)+'">'+
        '<div class="admin-order-head"><div><b>'+esc(a.full_name||'Unnamed account')+'</b><small>'+esc(a.email||'No email')+' · '+esc(roleText(a))+'</small></div>'+verified(a.email_verified)+'</div>'+
        '<div class="order-card-grid"><div><small>Contact phone</small><b>'+esc(a.phone||'Not provided')+'</b></div><div><small>Business / store</small><b>'+esc(a.business_name||'Not provided')+'</b></div><div><small>Created</small><b>'+esc(a.created_at?new Date(a.created_at).toLocaleString():'—')+'</b></div></div>'+
        '<div class="notice">'+supplier+drop+'</div>'+
        '<details class="order-details"><summary>View stored profile address</summary><pre class="admin-account-address">'+esc(pretty(a.address))+'</pre></details>'+
        '<details class="order-details"><summary>Edit account profile</summary>'+
        '<form class="form admin-account-edit" data-id="'+esc(a.user_id)+'">'+
        '<label class="field-label">Full legal name<input name="full_name" maxlength="120" value="'+esc(a.full_name||'')+'" required></label>'+
        '<label class="field-label">Contact phone<input name="phone" type="tel" maxlength="40" value="'+esc(a.phone||'')+'" required></label>'+
        '<label class="field-label">Business / store name<input name="business_name" maxlength="160" value="'+esc(a.business_name||'')+'"></label>'+
        '<label class="field-label">Address data (JSON object)<textarea name="address_json" rows="5" maxlength="2000" spellcheck="false">'+esc(pretty(a.address))+'</textarea></label>'+
        '<div class="admin-row-actions"><button class="btn" type="submit">Save profile changes</button>'+dropAction+'</div>'+
        '</form></details>'+
        '<div class="admin-row-actions">'+
        (a.supplier_id?'<button type="button" class="btn secondary admin-review-nav" data-view-target="suppliers">Open supplier review</button>':'')+
        (a.dropshipper_id?'<button type="button" class="btn secondary admin-review-nav" data-view-target="identity">Open identity review</button>':'')+
        '</div></article>';
    }).join('')||'<div class="empty-state"><h3>No accounts found</h3><p>Try a different name, email, phone or business.</p></div>';
  }
  async function load(force){
    if(loading||(!force&&loaded))return;
    loading=true;status('Loading operational accounts…');
    try{
      const result=await IZZY.rpc('admin_list_operational_accounts',{});
      rows=Array.isArray(result)?result:[];
      loaded=true;render();status('Loaded '+rows.length+' operational accounts. Private authentication secrets are not exposed here.');
    }catch(error){status(error.message||'Could not load operational accounts.',true);}
    finally{loading=false;}
  }
  root.addEventListener('submit',async event=>{
    const form=event.target.closest('.admin-account-edit');if(!form)return;
    event.preventDefault();
    const id=form.dataset.id,fullName=form.elements.full_name.value.trim(),phone=form.elements.phone.value.trim(),businessName=form.elements.business_name.value.trim();
    let address={};
    try{address=JSON.parse(form.elements.address_json.value||'{}');}catch{status('Address must be valid JSON. No changes were saved.',true);return;}
    if(!address||typeof address!=='object'||Array.isArray(address)){status('Address must be a JSON object.',true);return;}
    const button=form.querySelector('[type="submit"]');button.disabled=true;
    try{
      await IZZY.rpc('admin_update_operational_profile',{_user_id:id,_full_name:fullName,_phone:phone,_business_name:businessName||null,_address:address});
      status('Account profile updated. The edit was recorded in the audit log.');
      await load(true);
    }catch(error){status(error.message||'Could not update this profile.',true);}
    finally{button.disabled=false;}
  });
  root.addEventListener('click',async event=>{
    const action=event.target.closest('.admin-drop-status');
    if(action){
      const next=action.dataset.status==='suspended'?'active':'suspended';
      const reason=next==='suspended'?prompt('Reason for suspending this dropshipper (at least 8 characters):'):null;
      if(next==='suspended'&&reason===null)return;
      if(next==='suspended'&&reason.trim().length<8){status('Enter a clear suspension reason of at least eight characters.',true);return;}
      if(!confirm(next==='suspended'?'Suspend this dropshipper and block protected activity?':'Reactivate this dropshipper?'))return;
      action.disabled=true;
      try{await IZZY.rpc('admin_set_dropshipper_status',{_dropshipper_id:action.dataset.id,_status:next,_reason:reason?.trim()||null});status('Dropshipper access updated and audited.');await load(true);}
      catch(error){status(error.message||'Could not update dropshipper access.',true);action.disabled=false;}
      return;
    }
    const nav=event.target.closest('.admin-review-nav');
    if(nav){
      document.querySelector('[data-view="'+nav.dataset.viewTarget+'"]')?.click();
    }
  });
  $('#admin-account-search')?.addEventListener('input',render);
  $('#admin-account-refresh')?.addEventListener('click',()=>load(true));
  $('[data-view="accounts"]')?.addEventListener('click',()=>load(false));
})();