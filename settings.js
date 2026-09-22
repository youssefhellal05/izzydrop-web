(()=>{
  const role=window.IZZY_SETTINGS_ROLE;
  const root=document.getElementById('settings-root');
  if(!root)return;
  const session=IZZY.session();
  const uid=session?.user?.id;
  const email=session?.user?.email||'';
  const hasBusiness=role==='supplier'||role==='dropshipper';
  const hasNotifications=role==='supplier';

  root.innerHTML=`
    <div class="settings-head">
      <div><h2>Settings</h2><p class="muted">Manage your IzzyDrop account and preferences.</p></div>
    </div>
    <div class="settings-layout">
      <aside class="settings-menu">
        <button class="on" data-settings-tab="account">Account</button>
        ${hasBusiness?'<button data-settings-tab="business">Business</button>':''}
        ${hasNotifications?'<button data-settings-tab="notifications">Notifications</button>':''}
        <button data-settings-tab="appearance">Appearance</button>
        <button data-settings-tab="security">Security</button>
      </aside>
      <div class="settings-content">
        <section class="settings-panel" data-settings-panel="account">
          <div class="card settings-card">
            <div class="settings-title"><div><h3>Account information</h3><p class="muted">Your personal IzzyDrop account details.</p></div></div>
            <form id="settings-account-form" class="form">
              <label class="field-label">Full name</label><input id="settings-full-name" autocomplete="name" placeholder="Your name">
              <label class="field-label">Email</label><input id="settings-email" type="email" autocomplete="email" value="${IZZY.esc(email)}">
              <small class="muted">Changing your email may require confirmation from your inbox.</small>
              <label class="field-label">Phone number</label><input id="settings-phone" type="tel" autocomplete="tel" placeholder="+20 ...">
              <button class="btn settings-save" type="submit">Save account</button>
            </form>
          </div>
        </section>

        ${hasBusiness?`<section class="settings-panel" data-settings-panel="business" hidden>
          <div class="card settings-card">
            <div class="settings-title"><div><h3>Business profile</h3><p class="muted">${role==='supplier'?'Details IzzyDrop uses for your supplier account.':'Keep your store identity simple and up to date.'}</p></div></div>
            <form id="settings-business-form" class="form">
              <label class="field-label">${role==='supplier'?'Business name':'Store / business name'}</label>
              <input id="settings-business-name" placeholder="${role==='supplier'?'Business name':'Store name'}">
              ${role==='supplier'?'<label class="field-label">Business registration number <span class="muted">(optional)</span></label><input id="settings-registration" placeholder="Registration number">':''}
              <button class="btn settings-save" type="submit">Save business</button>
            </form>
          </div>
        </section>`:''}

        ${hasNotifications?`<section class="settings-panel" data-settings-panel="notifications" hidden>
          <div class="card settings-card">
            <div class="settings-title"><div><h3>Supplier notifications</h3><p class="muted">Choose what IzzyDrop should alert you about.</p></div></div>
            <div class="toggle-list">
              <label class="toggle-row"><span><b>Email notifications</b><small>Master switch for supplier emails.</small></span><input id="notify-email" type="checkbox"><span class="switch"></span></label>
              <label class="toggle-row"><span><b>New orders</b><small>When a dropshipper sends you a new fulfillment request.</small></span><input id="notify-new-order" type="checkbox"><span class="switch"></span></label>
              <label class="toggle-row"><span><b>Order cancellations</b><small>When an order containing your product is cancelled.</small></span><input id="notify-cancelled" type="checkbox"><span class="switch"></span></label>
              <label class="toggle-row"><span><b>Low stock</b><small>Warn me when stock falls to my chosen level.</small></span><input id="notify-low-stock" type="checkbox"><span class="switch"></span></label>
              <label class="toggle-row"><span><b>Product updates</b><small>Important changes affecting your listed products.</small></span><input id="notify-product-updates" type="checkbox"><span class="switch"></span></label>
              <label class="toggle-row"><span><b>Important IzzyDrop announcements</b><small>Marketplace and supplier updates that matter.</small></span><input id="notify-announcements" type="checkbox"><span class="switch"></span></label>
            </div>
            <form id="settings-notifications-form" class="form compact-form">
              <label class="field-label">Low-stock warning level</label>
              <input id="low-stock-threshold" type="number" min="0" max="1000000" step="1" placeholder="5">
              <button class="btn settings-save" type="submit">Save notifications</button>
            </form>
            <div class="notice settings-note">Your preferences are saved now. IzzyDrop will use these switches as notification delivery is connected to each marketplace event.</div>
          </div>
        </section>`:''}

        <section class="settings-panel" data-settings-panel="appearance" hidden>
          <div class="card settings-card">
            <div class="settings-title"><div><h3>Appearance</h3><p class="muted">Choose how IzzyDrop looks on this device.</p></div></div>
            <label class="toggle-row appearance-toggle">
              <span><b>Dark mode</b><small>Use a darker IzzyDrop interface that is easier on the eyes at night.</small></span>
              <input id="settings-dark-mode" type="checkbox">
              <span class="switch"></span>
            </label>
            <div class="theme-preview">
              <div class="theme-preview-card"><span class="theme-preview-dot"></span><b>IzzyDrop</b><small>Marketplace workspace</small></div>
            </div>
          </div>
        </section>

        <section class="settings-panel" data-settings-panel="security" hidden>
          <div class="card settings-card">
            <div class="settings-title"><div><h3>Security</h3><p class="muted">Protect access to your IzzyDrop account.</p></div></div>
            <div class="security-row"><div><b>Signed-in account</b><small id="security-email">${IZZY.esc(email||'Signed in')}</small></div><span class="tag ok">Active</span></div>
            <form id="settings-password-form" class="form">
              <label class="field-label">New password</label><input id="settings-password" type="password" minlength="8" autocomplete="new-password" placeholder="At least 8 characters" required>
              <label class="field-label">Confirm new password</label><input id="settings-password-confirm" type="password" minlength="8" autocomplete="new-password" placeholder="Repeat new password" required>
              <button class="btn settings-save" type="submit">Change password</button>
            </form>
            <div class="security-row security-action"><div><b>Two-factor authentication</b><small>Extra login protection for your account.</small></div><span class="tag">Coming later</span></div>
            ${role!=='admin'?'<div class="security-row security-action"><div><b>Sign out</b><small>Sign out of IzzyDrop on this device.</small></div><button id="settings-logout" class="btn secondary" type="button">Sign out</button></div>':''}
            <div class="security-row security-action"><div><b>Sign out everywhere</b><small>End your IzzyDrop sessions on all devices.</small></div><button id="settings-logout-all" class="btn secondary" type="button">Sign out all devices</button></div>
          </div>
        </section>

        <div id="settings-status" class="status"></div>
      </div>
    </div>`;

  IZZY.installPasswordToggles?.();
  const darkToggle=document.getElementById('settings-dark-mode');
  if(darkToggle){
    darkToggle.checked=IZZY.theme()==='dark';
    darkToggle.onchange=()=>{IZZY.setTheme(darkToggle.checked?'dark':'light')};
  }

  const status=(text,bad=false)=>{const e=document.getElementById('settings-status');e.textContent=text;e.className='status'+(bad?' bad':'')};
  document.querySelectorAll('[data-settings-tab]').forEach(btn=>btn.onclick=()=>{
    document.querySelectorAll('[data-settings-tab]').forEach(x=>x.classList.toggle('on',x===btn));
    document.querySelectorAll('[data-settings-panel]').forEach(p=>p.hidden=p.dataset.settingsPanel!==btn.dataset.settingsTab);
    status('');
  });

  let profile=null,account=null;
  async function loadSettings(){
    if(!uid)return;
    const id=encodeURIComponent(uid);
    const requests=[IZZY.request(`/rest/v1/profiles?select=id,full_name,phone&id=eq.${id}&limit=1`)];
    if(role==='supplier')requests.push(IZZY.request(`/rest/v1/suppliers?select=id,business_name,business_registration_number,notification_preferences,low_stock_threshold&profile_id=eq.${id}&limit=1`));
    if(role==='dropshipper')requests.push(IZZY.request(`/rest/v1/dropshippers?select=id,business_name&profile_id=eq.${id}&limit=1`));
    const rows=await Promise.all(requests);
    profile=rows[0]?.[0]||{};
    account=rows[1]?.[0]||{};
    document.getElementById('settings-full-name').value=profile.full_name||'';
    document.getElementById('settings-phone').value=profile.phone||'';
    if(hasBusiness)document.getElementById('settings-business-name').value=account.business_name||'';
    if(role==='supplier'){
      document.getElementById('settings-registration').value=account.business_registration_number||'';
      const n=account.notification_preferences||{};
      document.getElementById('notify-email').checked=n.email_notifications!==false;
      document.getElementById('notify-new-order').checked=n.new_order!==false;
      document.getElementById('notify-cancelled').checked=n.order_cancelled!==false;
      document.getElementById('notify-low-stock').checked=n.low_stock!==false;
      document.getElementById('notify-product-updates').checked=n.product_updates!==false;
      document.getElementById('notify-announcements').checked=n.important_announcements!==false;
      document.getElementById('low-stock-threshold').value=account.low_stock_threshold??5;
    }
  }

  document.getElementById('settings-account-form').onsubmit=async e=>{
    e.preventDefault();status('Saving account…');
    try{
      const newEmail=document.getElementById('settings-email').value.trim();
      await IZZY.request(`/rest/v1/profiles?id=eq.${encodeURIComponent(uid)}`,{method:'PATCH',body:JSON.stringify({
        full_name:document.getElementById('settings-full-name').value.trim()||null,
        phone:document.getElementById('settings-phone').value.trim()||null,
        updated_at:new Date().toISOString()
      })});
      if(newEmail&&newEmail.toLowerCase()!==(email||'').toLowerCase()){
        await IZZY.updateEmail(newEmail);
        status('Account saved. Check your inbox to confirm the new email address.');
      }else status('Account settings saved.');
      await loadSettings();
    }catch(err){status(err.message,true)}
  };

  if(hasBusiness)document.getElementById('settings-business-form').onsubmit=async e=>{
    e.preventDefault();status('Saving business profile…');
    try{
      const body={business_name:document.getElementById('settings-business-name').value.trim(),updated_at:new Date().toISOString()};
      if(role==='supplier')body.business_registration_number=document.getElementById('settings-registration').value.trim()||null;
      const table=role==='supplier'?'suppliers':'dropshippers';
      await IZZY.request(`/rest/v1/${table}?id=eq.${encodeURIComponent(account.id)}`,{method:'PATCH',body:JSON.stringify(body)});
      status('Business settings saved.');
      await loadSettings();
    }catch(err){status(err.message,true)}
  };

  if(role==='supplier')document.getElementById('settings-notifications-form').onsubmit=async e=>{
    e.preventDefault();status('Saving notification preferences…');
    try{
      const threshold=Number(document.getElementById('low-stock-threshold').value||5);
      const preferences={
        email_notifications:document.getElementById('notify-email').checked,
        new_order:document.getElementById('notify-new-order').checked,
        order_cancelled:document.getElementById('notify-cancelled').checked,
        low_stock:document.getElementById('notify-low-stock').checked,
        product_updates:document.getElementById('notify-product-updates').checked,
        important_announcements:document.getElementById('notify-announcements').checked
      };
      await IZZY.request(`/rest/v1/suppliers?id=eq.${encodeURIComponent(account.id)}`,{method:'PATCH',body:JSON.stringify({notification_preferences:preferences,low_stock_threshold:threshold,updated_at:new Date().toISOString()})});
      status('Notification preferences saved.');
      await loadSettings();
    }catch(err){status(err.message,true)}
  };

  document.getElementById('settings-password-form').onsubmit=async e=>{
    e.preventDefault();status('Changing password…');
    const p=document.getElementById('settings-password').value,c=document.getElementById('settings-password-confirm').value;
    if(p!==c){status('Passwords do not match.',true);return}
    if(p.length<8){status('Use at least 8 characters.',true);return}
    try{await IZZY.updatePassword(p);e.target.reset();status('Password changed successfully.')}catch(err){status(err.message,true)}
  };

  const logoutButton=document.getElementById('settings-logout');
  if(logoutButton)logoutButton.onclick=()=>{IZZY.logout();location.href='login.html'};

  document.getElementById('settings-logout-all').onclick=async()=>{
    if(!confirm('Sign out of IzzyDrop on all devices?'))return;
    status('Signing out all devices…');
    try{await IZZY.logoutEverywhere();location.href='login.html'}catch(err){status(err.message,true)}
  };

  loadSettings().catch(err=>status(err.message,true));
})();