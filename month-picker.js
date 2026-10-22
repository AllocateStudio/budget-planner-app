/* Standalone markup renderer; one delegated listener, one transient modal. */
(() => {
 'use strict';
 const first = 1900 * 12, last = 2199 * 12 + 11;
 const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const parse = value => /^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(value) ? Number(value.slice(0,4))*12+Number(value.slice(5))-1 : null;
 const stamp = n => `${Math.floor(n/12)}-${String(n%12+1).padStart(2,'0')}`;
 const today = () => {const d=new Date();return d.getFullYear()*12+d.getMonth();};
 const formatter = (locale, options) => {try{return new Intl.DateTimeFormat(locale,options);}catch{return new Intl.DateTimeFormat('en-US',options);}};
 const label = (n, locale, short=false) => formatter(locale,{month:short?'short':'long',...(short?{}:{year:'numeric'}),timeZone:'UTC'}).format(new Date(Date.UTC(Math.floor(n/12),n%12,1)));
 const allowed = (c,n) => n>=c.min && n<=c.max && (!c.available || c.available.includes(n));
 const yearAllowed = (c,y) => Array.from({length:12},(_,m)=>y*12+m).some(n=>allowed(c,n));
 const icon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v15H5zM5 10h14M8 3v5M16 3v5"/></svg>';
 let active=null;
 window.renderMonthPicker = ({value,min='1900-01',max='2199-12',id='month-selector',availableMonths,addMonth=false,locale}={}) => {
  const c={min:parse(min)??first,max:parse(max)??last,available:availableMonths?.map(parse).filter(n=>n!==null),addMonth:!!addMonth,locale};
  if(c.min>c.max)throw new RangeError('Invalid month picker range');
  const n=Math.max(c.min,Math.min(c.max,parse(value)??today()));
  return `<div class="mp-picker" data-mp-config="${escape(JSON.stringify(c))}"><input type="hidden" id="${escape(id)}" value="${stamp(n)}"><button type="button" class="mp-step" data-mp-step="-1" aria-label="Previous month" ${allowed(c,n-1)?'':'disabled'}>‹</button><button type="button" class="mp-trigger" aria-haspopup="dialog" aria-expanded="false" aria-label="Budget month and year: ${escape(label(n,locale))}">${icon}<span>${escape(label(n,locale))}</span></button><button type="button" class="mp-step" data-mp-step="1" aria-label="Next month" ${allowed(c,n+1)?'':'disabled'}>›</button></div>`;
 };
 function close(restore=true){
  if(!active)return;
  const a=active;active=null;a.abort.abort();a.observer.disconnect();a.dialog.close();a.dialog.remove();a.trigger.setAttribute('aria-expanded','false');a.trigger.removeAttribute('aria-controls');
  if(restore&&a.trigger.isConnected)a.trigger.focus();
 }
 window.closeMonthPicker=close;
 function select(root,c,n){
  if(n!=='add-month'&&!allowed(c,n))return;
  const input=root.querySelector('input'),id=input.id,previous=input.value;
  close();input.value=n==='add-month'?n:stamp(n);input.dispatchEvent(new Event('change',{bubbles:true}));
  // The legacy add-month handler can clear the value; retain the selected month.
  if(n==='add-month'&&input.isConnected)input.value=previous;
  if(n!=='add-month')document.getElementById(id)?.closest('.mp-picker')?.querySelector('.mp-trigger').focus();
 }
 function open(root){
  close();const c=JSON.parse(root.dataset.mpConfig),trigger=root.querySelector('.mp-trigger'),selected=parse(root.querySelector('input').value);
  const dialog=document.createElement('dialog');dialog.className='mp-dialog';dialog.id=root.querySelector('input').id+'-dialog';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-label','Choose budget month and year');dialog.setAttribute('aria-modal','true');
  const abort=new AbortController(),on=(target,name,fn,options={})=>target.addEventListener(name,fn,{...options,signal:abort.signal});
  let cursor=selected,year=Math.floor(selected/12),years=false,page=1900+Math.floor((year-1900)/12)*12;
  const observer=new MutationObserver(()=>{if(!root.isConnected)close(false);});observer.observe(document.body,{childList:true,subtree:true});
  active={dialog,trigger,abort,observer};document.body.append(dialog);trigger.setAttribute('aria-expanded','true');trigger.setAttribute('aria-controls',dialog.id);
  function position(){
   if(matchMedia('(max-width:600px)').matches){dialog.style.left='8px';dialog.style.top='auto';return;}
   const r=trigger.getBoundingClientRect(),h=dialog.getBoundingClientRect().height,w=dialog.getBoundingClientRect().width;
   dialog.style.left=Math.max(8,Math.min(r.left,innerWidth-w-8))+'px';
   dialog.style.top=Math.max(8,Math.min(r.bottom+8+h<=innerHeight-8?r.bottom+8:r.top-h-8,innerHeight-h-8))+'px';
  }
  const navPossible = delta => years ? (delta<0?page>Math.floor(c.min/12):page+12<=Math.floor(c.max/12)) : year+delta>=Math.floor(c.min/12)&&year+delta<=Math.floor(c.max/12);
  function draw(focus=true){
   const cells=Array.from({length:12},(_,i)=>years?page+i:year*12+i);
   dialog.innerHTML=`<div class="mp-header"><button type="button" class="mp-arrow" data-mp-nav="-1" aria-label="${years?'Previous 12 years':'Previous year'}" ${navPossible(-1)?'':'disabled'}>‹</button><button type="button" class="mp-year" data-mp-year aria-label="${years?'Show months':'Choose year'}">${years?`${page}–${Math.min(2199,page+11)}`:year}</button><button type="button" class="mp-arrow" data-mp-nav="1" aria-label="${years?'Next 12 years':'Next year'}" ${navPossible(1)?'':'disabled'}>›</button></div><div class="mp-grid" role="grid" aria-label="${years?'Years':'Months'}">${[0,1,2].map(row=>`<div class="mp-row" role="row">${cells.slice(row*4,row*4+4).map(n=>{const enabled=years?yearAllowed(c,n):allowed(c,n),chosen=years?n===Math.floor(selected/12):n===selected;return `<button type="button" role="gridcell" class="mp-cell ${!years&&n===today()?'mp-today':''}" data-mp-cell="${n}" tabindex="${n===(years?year:cursor)?0:-1}" aria-selected="${chosen}" aria-disabled="${!enabled}" ${enabled?'':'disabled'} aria-label="${escape(years?n:label(n,c.locale))}">${escape(years?n:label(n,c.locale,true))}</button>`;}).join('')}</div>`).join('')}</div><div class="mp-footer"><button type="button" data-mp-today ${allowed(c,today())?'':'disabled'}>This month</button>${c.addMonth?'<button type="button" data-mp-add>+ Add month</button>':''}<button type="button" class="mp-close" data-mp-close aria-label="Close month picker">×</button></div>`;
   let cell=dialog.querySelector('.mp-cell[tabindex="0"]:not(:disabled)')||dialog.querySelector('.mp-cell:not(:disabled)');
   dialog.querySelectorAll('.mp-cell').forEach(el=>el.tabIndex=el===cell?0:-1);
   if(focus)(cell||dialog.querySelector('[data-mp-year]')).focus();position();
  }
  on(dialog,'click',e=>{
   const b=e.target.closest('button');if(!b)return;
   if(b.hasAttribute('data-mp-cell')){const n=Number(b.dataset.mpCell);if(years){year=n;cursor=year*12+selected%12;years=false;draw();}else select(root,c,n);}
   else if(b.hasAttribute('data-mp-nav')){const d=Number(b.dataset.mpNav);if(years)page+=d*12;else {year+=d;cursor=year*12+cursor%12;}draw();}
   else if(b.hasAttribute('data-mp-year')){years=!years;page=1900+Math.floor((year-1900)/12)*12;draw();}
   else if(b.hasAttribute('data-mp-today'))select(root,c,today());
   else if(b.hasAttribute('data-mp-add'))select(root,c,'add-month');
   else if(b.hasAttribute('data-mp-close'))close();
  });
  on(dialog,'keydown',e=>{
   if(e.key==='Escape'){e.preventDefault();close();return;}
   if(e.key==='Tab'){
    const items=[...dialog.querySelectorAll('button:not(:disabled)')].filter(el=>el.tabIndex>=0),i=items.indexOf(document.activeElement);
    if(e.shiftKey?i<=0:i===items.length-1){e.preventDefault();items[e.shiftKey?items.length-1:0].focus();}return;
   }
   const cell=e.target.closest('[data-mp-cell]');if(!cell)return;
   let n=Number(cell.dataset.mpCell),next=n;
   const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-4,ArrowDown:4,PageUp:-12,PageDown:12};
   if(e.key in delta)next+=delta[e.key];
   else if(e.key==='Home')next=years?page:year*12;
   else if(e.key==='End')next=years?Math.min(2199,page+11):year*12+11;
   else return;
   e.preventDefault();const lo=years?Math.floor(c.min/12):c.min,hi=years?Math.floor(c.max/12):c.max,valid=years?n=>yearAllowed(c,n):n=>allowed(c,n);
   const direction=next>=n?1:-1;
   while(next>=lo&&next<=hi&&!valid(next))next+=direction;
   if(next<lo||next>hi)return;
   if(years){year=next;page=1900+Math.floor((year-1900)/12)*12;}else{cursor=next;year=Math.floor(next/12);}draw();
  });
  on(dialog,'cancel',e=>{e.preventDefault();close();});
  on(dialog,'pointerdown',e=>{const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();});
  on(window,'resize',position);on(window,'scroll',position,{capture:true});
  draw(false);dialog.showModal();position();draw();
 }
 document.addEventListener('click',e=>{
  const root=e.target.closest('.mp-picker');if(!root)return;
  if(e.target.closest('.mp-trigger'))open(root);
  const step=e.target.closest('[data-mp-step]');if(step&&!step.disabled){const c=JSON.parse(root.dataset.mpConfig);select(root,c,parse(root.querySelector('input').value)+Number(step.dataset.mpStep));}
 });
})();
