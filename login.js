(()=>{
  const $=s=>document.querySelector(s);
  async function route(){
    const s=IZZY.session();
    if(!s?.user?.id)return;
    const id=encodeURIComponent(s.user.id);
    const [drops,sups,profiles,roles]=await Promise.all([
      IZZY.request(`/rest/v1/dropshippers?select=id,status&profile_id=eq.${id}`),
      IZZY.request(`/rest/v1/suppliers?select=id,status&profile_id=eq.${id}`),
      IZZY.request(`/rest/v1/profiles?select=requested_account_type&id=eq.${id}&limit=1`),
      IZZY.request(`/rest/v1/user_roles?select=role&user_id=eq.${id}`)
    ]);
    const hasDrop=Array.isArray(drops)&&drops.length>0;
    const hasSup=Array.isArray(sups)&&sups.length>0;
    const requested=profiles?.[0]?.requested_account_type;
    const isAdmin=roles?.some(r=>r.role==='admin');
    if(isAdmin)$('#go-admin').hidden=false;
    const choices=(hasDrop?1:0)+(hasSup?1:0)+(isAdmin?1:0);
    if(choices>1){$('#role-choice').hidden=false;$('#auth-status').textContent='Choose which dashboard you want to open.';return}
    if(isAdmin){location.href='admin.html';return}
    if(hasSup||requested==='supplier'){location.href='supplier.html';return}
    if(hasDrop||requested==='dropshipper'){location.href='app.html';return}
    $('#auth-status').textContent='Account found, but no IzzyDrop role is attached yet.';
    $('#auth-status').className='status bad';
  }
  document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));t.classList.add('on');
    $('#login-form').hidden=t.dataset.mode!=='login';$('#signup-form').hidden=t.dataset.mode!=='signup';
    $('#auth-status').textContent='';$('#role-choice').hidden=true;
  });
  const requestedType=new URLSearchParams(location.search).get('type');
  if(requestedType==='supplier'||requestedType==='dropshipper'){
    document.querySelector('[data-mode="signup"]').click();
    $('#signup-type').value=requestedType;
  }
  $('#login-form').onsubmit=async e=>{
    e.preventDefault();const st=$('#auth-status');st.textContent='Logging in…';st.className='status';
    try{await IZZY.login($('#login-email').value.trim(),$('#login-password').value);await route()}
    catch(err){st.textContent=err.message;st.className='status bad'}
  };
  $('#signup-form').onsubmit=async e=>{
    e.preventDefault();const st=$('#auth-status');st.textContent='Creating account…';st.className='status';
    try{
      const d=await IZZY.signup({
        email:$('#signup-email').value.trim(),
        password:$('#signup-password').value,
        fullName:$('#signup-name').value.trim(),
        businessName:$('#signup-business').value.trim(),
        type:$('#signup-type').value
      });
      if(d?.access_token)await route();
      else st.textContent='Account created. Confirm your email, then come back here and log in.';
    }catch(err){st.textContent=err.message;st.className='status bad'}
  };
  if(IZZY.session()?.access_token)route().catch(()=>{});
})();