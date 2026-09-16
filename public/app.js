const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));let products=[];
async function api(url,opt={}){const r=await fetch(url,opt),j=await r.json().catch(()=>({}));if(r.status===401&&j.pin_required){$('#pinGate').classList.remove('hidden');throw Error('PIN required.')}if(!r.ok)throw Error(j.error||`Request failed (${r.status})`);return j}
async function init(){const c=await fetch('/api/config').then(r=>r.json());if(c.pinRequired&&!c.authenticated){$('#pinGate').classList.remove('hidden');return}load()}
$('#pinForm').onsubmit=async e=>{e.preventDefault();const j=await fetch('/api/pin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:$('#pin').value})}).then(r=>r.json());if(!j.ok){$('#pinMsg').textContent='Incorrect PIN.';return}$('#pinGate').classList.add('hidden');$('#pin').value='';load()};$('#refresh').onclick=()=>load(true);
let loadTimer=null,loadStarted=0;
function elapsedText(ms){const total=Math.floor(ms/1000),m=Math.floor(total/60),sec=total%60;return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`}
function startLoadClock(){clearInterval(loadTimer);loadStarted=Date.now();const tick=()=>{const el=$('#loadElapsed');if(el)el.textContent=elapsedText(Date.now()-loadStarted)};tick();loadTimer=setInterval(tick,250)}
function stopLoadClock(){clearInterval(loadTimer);loadTimer=null;return elapsedText(Date.now()-loadStarted)}
async function load(force=false){try{$('#msg').innerHTML='<div class="loadingbox"><p>Loading auction inventory from SellerChamp…</p><div class="stopwatch">⏱ <span id="loadElapsed">00:00</span></div></div>';startLoadClock();$('#refresh').disabled=true;const j=await api('/api/auction-products'+(force?'?refresh=1':''));products=j.products||[];window.lastUpdated=j.updatedAt||null;window.lastLoadTime=stopLoadClock();$('#msg').innerHTML='';render()}catch(e){const t=loadTimer?stopLoadClock():'';if(e.message!=='PIN required.')$('#msg').innerHTML=`<p class="error">${esc(e.message)}${t?`<br><small>Stopped after ${esc(t)}</small>`:''}</p>`}finally{$('#refresh').disabled=false}}
function skuHtml(sku){
  const s=String(sku??'');
  if(s.length<=4)return esc(s);
  return `${esc(s.slice(0,4))}<strong class="sku-emphasis">${esc(s.slice(4,10))}</strong>${esc(s.slice(10))}`;
}
function sellerChampUrl(sku){
  return `https://app2.sellerchamp.com/products?utf8=%E2%9C%93&listings_filter=all&product%5Bmarketplace_manually_removed%5D=false&product%5Bquery%5D=${encodeURIComponent(sku||'')}`;
}
function render(){
 const total=products.reduce((n,p)=>n+p.quantity,0),when=window.lastUpdated?new Date(window.lastUpdated).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}):'';
 $('#stats').innerHTML=`<div class="stats"><b>${products.length}</b> products · <b>${total}</b> total units · sorted by location${when?`<div class="updated">Last updated: ${esc(when)}${window.lastLoadTime?` · Loaded in ${esc(window.lastLoadTime)}`:''}</div>`:''}</div>`;
 let last=null,out='';
 for(const p of products){
  const loc=p.location||'NO LOCATION';
  if(loc!==last){out+=`<div class="location-head"><span class="pin-dot">📍</span><span>${esc(loc)}</span></div>`;last=loc}
  const isSome=p.auction_tags.some(t=>t.toLowerCase()==='auction some');
  out+=`<div class="card" id="p-${p.id}">
   <div class="product-layout">
    <div class="image-wrap">${p.image?`<img class="photo" src="${esc(p.image)}" onerror="this.outerHTML='<div class=noimg>No image</div>'">`:'<div class="noimg">No image</div>'}</div>
    <div class="product-info">
      <div class="sku-label">SKU</div><div class="sku-value">${skuHtml(p.sku)}</div>
      <div class="title">${esc(p.title)}</div>
      <div class="meta"><span class="pill auction">${esc(p.auction_tags.join(', '))}</span><span class="pill ${p.status==='active'?'active':'inactive'}">${esc(p.status.toUpperCase())}</span><span class="pill"><b>Qty ${p.quantity}</b></span></div>
    </div>
    <div class="controls">
      <div class="control-title">Adjust quantity<br>by location</div>
      ${p.locations.length?p.locations.map((x,i)=>`<div class="locrow"><span class="locname">${esc(x.location||'NO LOCATION')}</span><input id="q-${p.id}-${i}" type="number" inputmode="numeric" min="0" step="1" value="${x.quantity}"><button class="secondary" onclick="setQty('${p.id}',${i})">Update</button></div>`).join(''):'<p class="error">No SellerChamp inventory locations returned.</p>'}
      ${isSome&&p.quantity>0?`<div class="sendrow"><select id="sl-${p.id}">${p.locations.filter(x=>x.quantity>0).map(x=>`<option value="${esc(x.location)}">${esc(x.location||'NO LOCATION')} (${x.quantity})</option>`).join('')}</select><input id="sa-${p.id}" type="number" inputmode="numeric" min="1" step="1" placeholder="Qty"><button class="some" onclick="sendSome('${p.id}')">Send Some</button></div>`:''}
    </div>
   </div>
   <div class="card-actions"><button class="danger send-all" onclick="sendAll('${p.id}')">${isSome?'Send ALL Remaining to Auction':'Send to Auction'}</button><a class="sellerchamp-link" href="${sellerChampUrl(p.sku)}" target="_blank" rel="noopener">↗ View in SellerChamp</a></div>
  </div>`
 }
 $('#list').innerHTML=out||'<div class="card"><h2>All caught up</h2><p>No products currently have the auction or auction some tag.</p></div>'
}
function pby(id){return products.find(p=>String(p.id)===String(id))}
window.setQty=async(id,i)=>{const p=pby(id),row=p.locations[i],qty=Number($(`#q-${id}-${i}`).value);if(!Number.isInteger(qty)||qty<0)return alert('Enter a whole-number quantity of 0 or more.');let extra=qty===0&&p.quantity-row.quantity===0?' This will make the total quantity zero, end the listing, remove the auction tag, and add Sent to Auction.':'';if(!confirm(`Change ${row.location||'this location'} from ${row.quantity} to ${qty}?${extra}`))return;try{await api(`/api/products/${id}/quantity`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:row.location,quantity:qty})});await load()}catch(e){alert(e.message);await load()}};
window.sendSome=async id=>{const p=pby(id),loc=$(`#sl-${id}`).value,amount=Number($(`#sa-${id}`).value);if(!Number.isInteger(amount)||amount<=0)return alert('Enter how many units you are sending.');if(!confirm(`Send ${amount} unit${amount===1?'':'s'} from ${loc} to auction? SellerChamp inventory will be reduced by ${amount}.`))return;try{await api(`/api/products/${id}/send-some`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:loc,amount})});await load()}catch(e){alert(e.message);await load()}};
window.sendAll=async id=>{const p=pby(id);if(!confirm(`Send ALL ${p.quantity} remaining unit${p.quantity===1?'':'s'} to auction?\n\nThis will set inventory to zero, end the listing, remove the auction tag, and add Sent to Auction.`))return;try{await api(`/api/products/${id}/send-all`,{method:'POST'});await load()}catch(e){alert(e.message);await load()}};init();