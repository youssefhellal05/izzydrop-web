(()=>{
  const form=document.getElementById('product-request-form');
  const urlInput=document.getElementById('request-image');
  if(!form||!urlInput||!window.IZZY||!window.IZZY_CONFIG)return;

  const originalSubmit=form.onsubmit;
  urlInput.type='hidden';
  urlInput.value='';
  urlInput.removeAttribute('placeholder');

  const fileInput=document.createElement('input');
  fileInput.id='request-image-file';
  fileInput.type='file';
  fileInput.accept='image/jpeg,image/png,image/webp';
  fileInput.setAttribute('aria-label','Product image');
  fileInput.className=urlInput.className;
  urlInput.parentNode.insertBefore(fileInput,urlInput);

  const hint=document.createElement('small');
  hint.className='muted';
  hint.textContent='Product image (optional) · JPG, PNG or WebP · max 5 MB';
  fileInput.insertAdjacentElement('afterend',hint);

  async function readJson(response){
    const text=await response.text();
    if(!text)return null;
    try{return JSON.parse(text)}catch{return {text}}
  }

  async function upload(file){
    if(!file)return null;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Use a JPG, PNG, or WebP image.');
    if(file.size>5*1024*1024)throw Error('Image must be 5 MB or smaller.');

    let session=IZZY.session();
    if(!session?.user?.id||!session?.access_token)throw Error('Please log in again.');

    const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
    const unique=(globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^a-zA-Z0-9-]/g,'');
    const path=`${session.user.id}/${unique}.${ext}`;
    const encodedPath=path.split('/').map(encodeURIComponent).join('/');
    const endpoint=`${IZZY_CONFIG.supabaseUrl}/storage/v1/object/request-images/${encodedPath}`;

    const send=async token=>fetch(endpoint,{
      method:'POST',
      headers:{
        apikey:IZZY_CONFIG.supabaseKey,
        Authorization:`Bearer ${token}`,
        'Content-Type':file.type,
        'x-upsert':'false'
      },
      body:file
    });

    let response=await send(session.access_token);
    if(response.status===401&&session.refresh_token){
      const refreshed=await IZZY.refresh();
      if(refreshed){session=IZZY.session();response=await send(session.access_token)}
    }
    const data=await readJson(response);
    if(!response.ok)throw Error(data?.message||data?.error||data?.text||'Image upload failed.');

    return `${IZZY_CONFIG.supabaseUrl}/storage/v1/object/public/request-images/${encodedPath}`;
  }

  form.onsubmit=async function(event){
    const file=fileInput.files?.[0]||null;
    if(!file||urlInput.value){
      return originalSubmit?originalSubmit.call(this,event):undefined;
    }

    event.preventDefault();
    const button=document.getElementById('request-submit');
    const status=document.getElementById('request-status');
    if(button){button.disabled=true;button.textContent='Uploading image…'}
    if(status){status.textContent='Uploading product image…';status.className='status'}

    try{
      urlInput.value=await upload(file);
      return originalSubmit?originalSubmit.call(this,event):undefined;
    }catch(error){
      if(status){status.textContent=error.message||'Could not upload image.';status.className='status bad'}
      if(button){button.disabled=false;button.textContent='Send sourcing request'}
    }
  };
})();
