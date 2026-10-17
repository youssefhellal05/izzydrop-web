/* IzzyDrop V2 preview switch. Session-scoped per tab; production V1 is default.
 * ?design=v2 opts in; ?design=v1 restores the original styling.
 * No business logic, auth, requests or stored account preferences are changed.
 */
(()=>{
  'use strict';
  const key='izzydrop:design-preview';
  const selected=new URLSearchParams(location.search).get('design');
  try{
    if(selected==='v2'||selected==='v1')sessionStorage.setItem(key,selected);
    if(sessionStorage.getItem(key)==='v2')document.documentElement.dataset.izzyDesign='v2';
  }catch{
    if(selected==='v2')document.documentElement.dataset.izzyDesign='v2';
  }
})();
