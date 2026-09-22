(()=>{
  const $=s=>document.querySelector(s);
  let signupRole='';

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

    $('#go-admin').hidden=!isAdmin;

    const choices=(hasDrop?1:0)+(hasSup?1:0)+(isAdmin?1:0);
    if(choices>1){
      $('#role-choice').hidden=false;
      $('#auth-status').textContent='Choose which workspace you want to open.';
      return;
    }

    if(isAdmin){location.href='admin.html';return}
    if(hasSup||requested==='supplier'){location.href='supplier.html';return}
    if(hasDrop||requested==='dropshipper'){location.href='app.html';return}

    $('#auth-status').textContent='Your account is signed in, but no IzzyDrop workspace is attached yet.';
    $('#auth-status').className='status auth-status bad';
  }

  function updateSignupRole(role){
    signupRole=role||'';
    $('#signup-type').value=signupRole;

    document.querySelectorAll('[data-signup-role]').forEach(btn=>{
      const on=btn.dataset.signupRole===signupRole;
      btn.classList.toggle('on',on);
      btn.setAttribute('aria-pressed',on?'true':'false');
    });

    const businessLabel=$('#signup-business-label');
    const businessHelp=$('#signup-business-help');
    const business=$('#signup-business');
    const submit=$('#signup-submit');

    if(signupRole==='supplier'){
      business.required=true;
      businessLabel.innerHTML='Business name';
      business.placeholder='Your supplier business name';
      businessHelp.textContent='Required for supplier accounts.';
      submit.disabled=false;
      submit.textContent='Create supplier account';
    }else if(signupRole==='dropshipper'){
      business.required=false;
      businessLabel.innerHTML='Store / business name <span class="muted">(optional)</span>';
      business.placeholder='Your store or business';
      businessHelp.textContent='You can add or change this later in Settings.';
      submit.disabled=false;
      submit.textContent='Create dropshipper account';
    }else{
      business.required=false;
      businessLabel.innerHTML='Store / business name <span class="muted">(optional)</span>';
      business.placeholder='Your store or business';
      businessHelp.textContent='Choose an account type first.';
      submit.disabled=true;
      submit.textContent='Choose an account type';
    }
  }

  function setMode(mode){
    document.querySelectorAll('.auth-switch-btn').forEach(x=>x.classList.toggle('on',x.dataset.mode===mode));
    $('#login-form').hidden=mode!=='login';
    $('#signup-form').hidden=mode!=='signup';
    $('#auth-title').textContent=mode==='login'?'Welcome back':'Create your IzzyDrop account';
    $('#auth-description').textContent=mode==='login'
      ?'Log in and we’ll take you to the right workspace.'
      :'Choose how you’ll use IzzyDrop. You can sign in from this same page later.';
    $('#auth-status').textContent='';
    $('#auth-status').className='status auth-status';
    $('#role-choice').hidden=true;
  }

  document.querySelectorAll('.auth-switch-btn').forEach(t=>t.onclick=()=>setMode(t.dataset.mode));
  document.querySelectorAll('[data-signup-role]').forEach(btn=>btn.onclick=()=>updateSignupRole(btn.dataset.signupRole));

  const requestedType=new URLSearchParams(location.search).get('type');
  if(requestedType==='supplier'||requestedType==='dropshipper'){
    setMode('signup');
    updateSignupRole(requestedType);
  }else{
    updateSignupRole('');
  }

  $('#login-form').onsubmit=async e=>{
    e.preventDefault();
    const st=$('#auth-status'),btn=$('#login-submit');
    st.textContent='Logging in…';st.className='status auth-status';
    btn.disabled=true;btn.textContent='Opening IzzyDrop…';
    try{
      await IZZY.login($('#login-email').value.trim(),$('#login-password').value);
      await route();
    }catch(err){
      const raw=String(err.message||'Could not log in.');
      st.textContent=/invalid login credentials/i.test(raw)
        ?'That email or password doesn’t match an IzzyDrop account.'
        :raw;
      st.className='status auth-status bad';
    }finally{
      btn.disabled=false;btn.textContent='Log in to IzzyDrop';
    }
  };

  $('#signup-form').onsubmit=async e=>{
    e.preventDefault();
    const st=$('#auth-status'),btn=$('#signup-submit');
    st.className='status auth-status';

    if(!signupRole){
      st.textContent='Choose Dropshipper or Supplier first.';
      st.className='status auth-status bad';
      return;
    }

    const business=$('#signup-business').value.trim();
    if(signupRole==='supplier'&&!business){
      st.textContent='Business name is required for supplier accounts.';
      st.className='status auth-status bad';
      return;
    }

    const password=$('#signup-password').value;
    if(password.length<8){
      st.textContent='Use at least 8 characters for your password.';
      st.className='status auth-status bad';
      return;
    }

    btn.disabled=true;btn.textContent='Creating account…';
    st.textContent='Creating your IzzyDrop account…';

    try{
      const d=await IZZY.signup({
        email:$('#signup-email').value.trim(),
        password,
        fullName:$('#signup-name').value.trim(),
        businessName:business,
        type:signupRole
      });

      if(d?.access_token){
        await route();
      }else{
        st.textContent='Account created. Check your email to confirm it, then come back and log in.';
        st.className='status auth-status';
      }
    }catch(err){
      const raw=String(err.message||'Could not create account.');
      st.textContent=/already registered|already been registered|user already registered/i.test(raw)
        ?'An IzzyDrop account already exists with this email. Try logging in instead.'
        :raw;
      st.className='status auth-status bad';
    }finally{
      btn.disabled=false;
      btn.textContent=signupRole==='supplier'?'Create supplier account':'Create dropshipper account';
    }
  };

  $('#invite-password-form').onsubmit=async e=>{
    e.preventDefault();
    const st=$('#invite-status'),p=$('#invite-password').value,c=$('#invite-password-confirm').value;
    st.className='status auth-status';

    if(p!==c){
      st.textContent='Passwords do not match.';
      st.className='status auth-status bad';
      return;
    }
    if(p.length<8){
      st.textContent='Use at least 8 characters.';
      st.className='status auth-status bad';
      return;
    }

    st.textContent='Finishing your IzzyDrop admin account…';
    try{
      await IZZY.updatePassword(p);
      st.textContent='Admin account ready. Opening Control Center…';
      await route();
    }catch(err){
      st.textContent=err.message;
      st.className='status auth-status bad';
    }
  };

  (async()=>{
    try{
      const event=await IZZY.consumeAuthRedirect();
      if(event?.type==='invite'){
        $('#auth-standard').hidden=true;
        $('#invite-password-form').hidden=false;
        return;
      }

      if(IZZY.session()?.access_token){
        $('#auth-status').textContent='You’re already signed in. Opening your workspace…';
        await route();
      }
    }catch(err){
      $('#auth-status').textContent=err.message;
      $('#auth-status').className='status auth-status bad';
    }
  })();
})();