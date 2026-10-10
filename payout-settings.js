(()=>{
  'use strict';
  const role=window.IZZY_SETTINGS_ROLE;
  if(role!=='supplier'&&role!=='dropshipper')return;
  const root=document.getElementById('settings-root');
  if(!root)return;
  const appearanceTab=root.querySelector('[data-settings-tab="appearance"]');
  const appearancePanel=root.querySelector('[data-settings-panel="appearance"]');
  if(!appearanceTab||!appearancePanel)return;
  appearanceTab.insertAdjacentHTML('beforebegin','<button type="button" data-settings-tab="payout">Payout details</button>');
  appearancePanel.insertAdjacentHTML('beforebegin',[
    '<section class="settings-panel" data-settings-panel="payout" hidden>',
      '<div class="card settings-card">',
        '<div class="settings-title"><div><h3>Payout details</h3><p class="muted">Where IzzyDrop should send your eligible earnings each Sunday and Wednesday.</p></div></div>',
        '<form id="payout-form" class="form">',
          '<label class="field-label" for="payout-method">Payment method</label>',
          '<select id="payout-method" required>',
            '<option value="">Choose a payment method</option>',
            '<option value="instapay">InstaPay</option>',
            '<option value="bank_transfer">Bank transfer</option>',
            '<option value="mobile_wallet">Mobile wallet</option>',
          '</select>',
          '<label class="field-label" for="payout-beneficiary">Account holder / recipient name</label>',
          '<input id="payout-beneficiary" autocomplete="name" maxlength="120" required placeholder="Recipient name">',
          '<label class="field-label" for="payout-destination" id="payout-destination-label">InstaPay address or account number</label>',
          '<input id="payout-destination" autocomplete="off" maxlength="120" required placeholder="Payment address or account number">',
          '<div id="payout-bank-fields" hidden>',
            '<label class="field-label" for="payout-bank">Bank name</label>',
            '<input id="payout-bank" autocomplete="off" maxlength="120" placeholder="Bank name">',
          '</div>',
          '<small class="muted">Only you and authorized IzzyDrop administrators can access your payout details. Saving details does not send money.</small>',
          '<button class="btn settings-save" type="submit">Save payout details</button>',
        '</form>',
        '<div id="payout-status" class="status" role="status" aria-live="polite"></div>',
      '</div>',
    '</section>'
  ].join(''));

  const tab=root.querySelector('[data-settings-tab="payout"]');
  const form=root.querySelector('#payout-form');
  const method=root.querySelector('#payout-method');
  const beneficiary=root.querySelector('#payout-beneficiary');
  const destination=root.querySelector('#payout-destination');
  const bank=root.querySelector('#payout-bank');
  const bankFields=root.querySelector('#payout-bank-fields');
  const destinationLabel=root.querySelector('#payout-destination-label');
  const statusElement=root.querySelector('#payout-status');
  const table=role==='supplier'?'supplier_payout_details':'dropshipper_payout_details';
  const key=role==='supplier'?'supplier_id':'dropshipper_id';
  let accountId=null;

  const status=(message,bad)=>{
    statusElement.textContent=message||'';
    statusElement.className='status'+(bad?' bad':'');
  };
  const updateFields=()=>{
    const m=method.value;
    destinationLabel.textContent=m==='bank_transfer'?'Bank account number / IBAN':m==='mobile_wallet'?'Mobile wallet phone number':'InstaPay address or account number';
    destination.placeholder=m==='bank_transfer'?'Account number or IBAN':m==='mobile_wallet'?'01XXXXXXXXX':'InstaPay address or account number';
    const showBank=m==='bank_transfer';
    bankFields.hidden=!showBank;
    bank.required=showBank;
  };
  method.addEventListener('change',updateFields);
  updateFields();

  async function load(){
    const uid=IZZY.session()?.user?.id;
    if(!uid){status('Please sign in to manage payout details.',true);return;}
    const accounts=await IZZY.request('/rest/v1/'+(role==='supplier'?'suppliers':'dropshippers')+'?select=id&profile_id=eq.'+encodeURIComponent(uid)+'&limit=1');
    accountId=accounts?.[0]?.id||null;
    if(!accountId){status('Complete your account setup before saving payout details.',true);return;}
    const rows=await IZZY.request('/rest/v1/'+table+'?select=payout_method,payout_details&'+key+'=eq.'+encodeURIComponent(accountId)+'&limit=1');
    const record=rows?.[0]||{};
    const details=record.payout_details||{};
    method.value=record.payout_method||'';
    beneficiary.value=details.beneficiary_name||'';
    destination.value=details.destination||'';
    bank.value=details.bank_name||'';
    updateFields();
  }

  tab.onclick=()=>{
    root.querySelectorAll('[data-settings-tab]').forEach(x=>x.classList.toggle('on',x===tab));
    root.querySelectorAll('[data-settings-panel]').forEach(x=>x.hidden=x.dataset.settingsPanel!=='payout');
    const sharedStatus=root.querySelector('#settings-status');
    if(sharedStatus)sharedStatus.textContent='';
    status('');
    load().catch(e=>status(e.message||'Could not load payout details.',true));
  };

  form.onsubmit=async e=>{
    e.preventDefault();
    const m=method.value;
    const name=beneficiary.value.trim();
    const dest=destination.value.trim();
    const bankName=bank.value.trim();
    if(!accountId){status('Your account is not ready. Please open Payout details again.',true);return;}
    if(!['instapay','bank_transfer','mobile_wallet'].includes(m)||!name||!dest||(m==='bank_transfer'&&!bankName)){
      status('Complete all required payout fields.',true);return;
    }
    const details={beneficiary_name:name,destination:dest};
    if(m==='bank_transfer')details.bank_name=bankName;
    const record={payout_method:m,payout_details:details,updated_at:new Date().toISOString()};
    record[key]=accountId;
    const button=form.querySelector('[type="submit"]');
    button.disabled=true;
    status('Saving payout details…');
    try{
      await IZZY.request('/rest/v1/'+table+'?on_conflict='+key,{
        method:'POST',
        headers:{Prefer:'resolution=merge-duplicates,return=minimal'},
        body:JSON.stringify(record)
      });
      status('Payout details saved. Transfers are handled manually after COD reconciliation.');
    }catch(e){status(e.message||'Could not save payout details.',true)}
    finally{button.disabled=false;}
  };
})();