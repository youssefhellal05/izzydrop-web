/* IzzyDrop V2 and Atlas visual preview switch. Session-scoped per tab; production V1 is default.
 * ?design=v2 or ?design=atlas opts in; ?design=v1 restores V1 styling.
 * No business logic, auth, requests or stored account preferences are changed.
 */
(()=>{
  'use strict';
  const key='izzydrop:design-preview';
  const selected=new URLSearchParams(location.search).get('design');
  try{
    if(selected==='v2'||selected==='v1'||selected==='atlas')sessionStorage.setItem(key,selected);
    const active=sessionStorage.getItem(key);
    if(active==='v2'||active==='atlas')document.documentElement.dataset.izzyDesign=active;
  }catch{
    if(selected==='v2'||selected==='atlas')document.documentElement.dataset.izzyDesign=selected;
  }
})();
