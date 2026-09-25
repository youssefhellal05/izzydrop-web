(()=>{
  const toggle=document.getElementById('v-vary-prices');
  if(!toggle)return;

  const setText=(el,text)=>{if(el&&el.textContent!==text)el.textContent=text};
  const costInput=document.getElementById('v-cost');
  const retailInput=document.getElementById('v-retail');
  const form=document.getElementById('variant-form');

  const pricingSection=toggle.closest('.variant-section');
  const pricingCopy=pricingSection?.querySelector('.variant-section-head p');
  setText(pricingCopy,'Choose whether every version uses the same price or each variant has its own price.');

  function setFieldLabel(id,text){
    const label=document.querySelector(`label[for="${id}"]`);
    if(!label)return;
    const required=label.querySelector('.required-mark');
    label.textContent=text+' ';
    if(required)label.appendChild(required);
  }
  setFieldLabel('v-cost','Supplier price — what the dropshipper pays you (EGP)');
  setFieldLabel('v-retail','Suggested customer price — what you recommend they sell it for (EGP)');

  const toggleRow=toggle.closest('.toggle-row');
  const toggleTitle=toggleRow?.querySelector('b');
  const toggleHelp=toggleRow?.querySelector('small');
  setText(toggleTitle,'Each variant has its own price');
  setText(toggleHelp,'Turn this on when Black, White, Large, Small, or any other version can have a different price.');

  let modeNote=document.getElementById('variant-price-mode-note');
  if(!modeNote&&toggleRow){
    modeNote=document.createElement('div');
    modeNote.id='variant-price-mode-note';
    modeNote.className='simple-hint variant-price-mode-note';
    toggleRow.insertAdjacentElement('afterend',modeNote);
  }

  const optionSection=[...document.querySelectorAll('.variant-section')].find(section=>section.querySelector('#v-option-list'));
  const optionCopy=optionSection?.querySelector('.variant-section-head p');
  setText(optionCopy,'Add colors, sizes, or other options. Then build the variants and edit the stock, photo, and price for every version.');

  const style=document.createElement('style');
  style.textContent=`
    .variant-price-mode-note{margin-top:8px}
    .variant-row.show-price .variant-pricing-fields{padding:10px;border:1px solid var(--line);border-radius:10px;background:var(--card)}
    .variant-row.show-price .variant-pricing-fields label{gap:4px}
    .variant-row-price-help{display:block;color:var(--muted);font-size:8px;font-weight:650;line-height:1.35}
    .variant-section.per-variant-pricing #v-cost,.variant-section.per-variant-pricing #v-retail{opacity:.72}
  `;
  document.head.appendChild(style);

  function decorateVariantRows(){
    document.querySelectorAll('[data-v-variant-row]').forEach(row=>{
      const cost=row.querySelector('[data-v-cost]');
      const retail=row.querySelector('[data-v-retail]');
      if(cost){
        const label=cost.closest('label');
        const span=label?.querySelector('span');
        setText(span,'Dropshipper pays you');
        if(label&&!label.querySelector('.variant-row-price-help')){
          const help=document.createElement('small');
          help.className='variant-row-price-help';
          help.textContent='Your price for this exact variant.';
          label.appendChild(help);
        }
      }
      if(retail){
        const label=retail.closest('label');
        const span=label?.querySelector('span');
        setText(span,'Suggested customer price');
        if(label&&!label.querySelector('.variant-row-price-help')){
          const help=document.createElement('small');
          help.className='variant-row-price-help';
          help.textContent='What you suggest the dropshipper sells this variant for.';
          label.appendChild(help);
        }
      }
    });
  }

  function syncPriceRequirements(){
    const varying=toggle.checked;
    if(costInput)costInput.required=!varying;
    if(retailInput)retailInput.required=!varying;
    pricingSection?.classList.toggle('per-variant-pricing',varying);
    ['v-cost','v-retail'].forEach(id=>{
      const mark=document.querySelector(`label[for="${id}"] .required-mark`);
      if(mark)mark.hidden=varying;
    });
  }

  function updateModeNote(){
    syncPriceRequirements();
    if(modeNote){
      const text=toggle.checked
        ? 'Set the price inside each variant below. The two prices above are optional starting values and will not block publishing.'
        : 'All variants will use the two prices above. Turn on “Each variant has its own price” only when the versions need different prices.';
      setText(modeNote,text);
    }
    decorateVariantRows();
  }

  // The product record still needs a summary price. When per-variant pricing is on
  // and the shared fields are blank, use the cheapest enabled variant as that summary.
  if(form)form.addEventListener('submit',()=>{
    if(!toggle.checked||!costInput||!retailInput)return;
    if(costInput.value!==''&&retailInput.value!=='')return;
    const rows=[...document.querySelectorAll('[data-v-variant-row]')]
      .filter(row=>row.querySelector('[data-v-enabled]')?.checked)
      .map(row=>({
        cost:Number(row.querySelector('[data-v-cost]')?.value),
        retail:Number(row.querySelector('[data-v-retail]')?.value)
      }))
      .filter(x=>Number.isFinite(x.cost)&&x.cost>=0&&Number.isFinite(x.retail)&&x.retail>=x.cost)
      .sort((a,b)=>a.cost-b.cost);
    if(rows.length){
      if(costInput.value==='')costInput.value=String(rows[0].cost);
      if(retailInput.value==='')retailInput.value=String(rows[0].retail);
    }
  },true);

  const list=document.getElementById('v-variant-list');
  if(list)new MutationObserver(()=>decorateVariantRows()).observe(list,{childList:true});
  toggle.addEventListener('change',updateModeNote);
  updateModeNote();
})();