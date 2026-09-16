const express=require('express');
const path=require('path');
const crypto=require('crypto');
const app=express(); const PORT=process.env.PORT||3000; const SC_BASE='https://app.sellerchamp.com';
app.use(express.json({limit:'1mb'})); app.use(express.static(path.join(__dirname,'public')));
const AUTH_COOKIE='sc_auction_auth', AUTH_MAX_AGE=30*24*60*60;
function cookies(req){const o={};String(req.headers.cookie||'').split(';').forEach(p=>{const i=p.indexOf('=');if(i>0)o[decodeURIComponent(p.slice(0,i).trim())]=decodeURIComponent(p.slice(i+1).trim())});return o}
function secret(){return process.env.APP_PIN||''}
function makeToken(){const exp=Math.floor(Date.now()/1000)+AUTH_MAX_AGE,s=crypto.createHmac('sha256',secret()).update(String(exp)).digest('hex');return `${exp}.${s}`}
function valid(req){if(!process.env.APP_PIN)return true;const [e,s]=(cookies(req)[AUTH_COOKIE]||'').split('.');if(!e||!s||Number(e)<Date.now()/1000)return false;const x=crypto.createHmac('sha256',secret()).update(e).digest('hex');try{return crypto.timingSafeEqual(Buffer.from(s),Buffer.from(x))}catch{return false}}
function needPin(req,res,next){return valid(req)?next():res.status(401).json({error:'PIN required.',pin_required:true})}
function token(){if(!process.env.SELLERCHAMP_API_TOKEN)throw Error('SELLERCHAMP_API_TOKEN is not configured.');return process.env.SELLERCHAMP_API_TOKEN}
let scQueue=Promise.resolve(), lastScAt=0;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function scDirect(ep,opt={}){
  for(let attempt=0;attempt<6;attempt++){
    const wait=Math.max(0,700-(Date.now()-lastScAt)); if(wait)await sleep(wait); lastScAt=Date.now();
    const r=await fetch(SC_BASE+ep,{...opt,headers:{Token:token(),'Content-Type':'application/json',...(opt.headers||{})}});
    const t=await r.text();let b={};try{b=t?JSON.parse(t):{}}catch{b={raw:t}}
    if(r.status===429){await sleep(Math.min(12000,2000*Math.pow(1.7,attempt)));continue}
    if(!r.ok)throw Error(b?.error||b?.message||`SellerChamp returned ${r.status}`);return b;
  }
  throw Error('SellerChamp is still rate-limiting requests. Please wait about 30 seconds and tap Refresh again.');
}
function sc(ep,opt={}){const job=scQueue.then(()=>scDirect(ep,opt));scQueue=job.catch(()=>{});return job}
const first=(o,...ks)=>{for(const k of ks)if(o&&o[k]!=null&&o[k]!=='')return o[k];return null};
function tagsOf(p){let v=first(p,'tags_array','tags','tag_list','product_tags');if(Array.isArray(v))return v.map(x=>typeof x==='string'?x:(x.name||x.tag||'')).filter(Boolean);if(typeof v==='string')return v.split(',').map(x=>x.trim()).filter(Boolean);return []}
function imageOf(p){let v=first(p,'image_url','main_image_url','thumbnail_url','primary_image_url');if(v)return v;let a=first(p,'image_urls','images');if(Array.isArray(a)&&a.length){let x=a[0];return typeof x==='string'?x:(x.url||x.image_url||'')}if(typeof a==='string')return a.split(',')[0].trim();return ''}
function statusOf(p){return String(first(p,'marketplace_status','status')||'unknown').toLowerCase()}
async function fullProduct(id){const j=await sc(`/api/products/${id}`);return j.product||j}
async function invOf(id){try{return (await sc(`/api/products/${id}/inventory_locations`)).inventory_locations||[]}catch{return []}}
function normInv(a){return a.map(x=>({id:x.id,location:x.location||'',quantity:Number(x.quantity_available||0),priority:x.priority||1,delete_if_empty:x.delete_if_empty!==false})).sort((a,b)=>(a.location||'').localeCompare(b.location||'',undefined,{numeric:true,sensitivity:'base'}))}
function summary(p,inv){const locations=normInv(inv),tags=tagsOf(p),auctionTags=tags.filter(t=>['auction','auction some'].includes(t.toLowerCase()));return {id:p.id,sku:p.sku||'',title:p.title||'',image:imageOf(p),tags,auction_tags:auctionTags,status:statusOf(p),locations,location:locations.map(x=>x.location).filter(Boolean).join(', ')||first(p,'item_location','bin_location','warehouse_location')||'',quantity:locations.length?locations.reduce((n,x)=>n+x.quantity,0):Number(first(p,'quantity_available','quantity','quantity_on_hand')||0)}}
async function setLocationQty(id,loc,qty){const inv=await invOf(id);const row=inv.find(x=>String(x.location||'').toLowerCase()===String(loc||'').toLowerCase());if(!row)throw Error(`Inventory location ${loc||'(blank)'} was not found.`);await sc(`/api/products/${id}/inventory_locations/${row.id}`,{method:'PUT',body:JSON.stringify({inventory_location:{location:row.location,quantity_available:qty,delete_if_empty:row.delete_if_empty!==false,priority:row.priority||1}})})}
async function updateTags(id,tags){await sc(`/api/products/${id}`,{method:'PUT',body:JSON.stringify({product:{tags}})});const p=await fullProduct(id),actual=tagsOf(p).map(x=>x.toLowerCase());for(const t of tags)if(!actual.includes(t.toLowerCase()))throw Error('SellerChamp did not confirm the tag update. Quantity changes were kept, but the auction tag was not removed.');return p}
async function endListing(id){
  // SellerChamp installations can differ. Zero quantity is set first; then request inactive status.
  await sc(`/api/products/${id}`,{method:'PUT',body:JSON.stringify({product:{marketplace_status:'inactive'}})});
  const p=await fullProduct(id),s=statusOf(p);
  if(!['inactive','ended','ended_listing','not_listed'].includes(s)) throw Error(`Quantity is zero, but SellerChamp still reports listing status ${s.toUpperCase()}. The auction tag was left in place so this item remains visible for follow-up.`);
  return p;
}
app.get('/api/config',(req,res)=>res.json({pinRequired:!!process.env.APP_PIN,authenticated:valid(req),loginDays:30}));
app.post('/api/pin',(req,res)=>{const ok=!process.env.APP_PIN||String(req.body.pin||'')===process.env.APP_PIN;if(ok&&process.env.APP_PIN)res.setHeader('Set-Cookie',`${AUTH_COOKIE}=${encodeURIComponent(makeToken())}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${AUTH_MAX_AGE}; Secure`);res.json({ok})});
app.use('/api',needPin);
app.get('/api/diagnostic/sku/:sku',async(req,res)=>{
  try{
    const sku=String(req.params.sku||'').trim();
    if(!sku)return res.status(400).json({error:'SKU required.'});
    const list=await sc(`/api/products?sku=${encodeURIComponent(sku)}&page=1&page_size=50`);
    const row=(list.products||[]).find(x=>String(x.sku||'').toLowerCase()===sku.toLowerCase())||(list.products||[])[0];
    if(!row)return res.status(404).json({error:`SKU ${sku} was not found.`});
    let full=null, fullError='';
    try{full=await fullProduct(row.id)}catch(e){fullError=e.message}
    const candidate=full||row;
    const tagLike={};
    for(const [k,v] of Object.entries(candidate||{})) if(/tag/i.test(k)) tagLike[k]=v;
    const listTagLike={};
    for(const [k,v] of Object.entries(row||{})) if(/tag/i.test(k)) listTagLike[k]=v;
    res.json({
      sku,
      id:row.id,
      list_keys:Object.keys(row||{}).sort(),
      full_keys:Object.keys(full||{}).sort(),
      list_tag_fields:listTagLike,
      full_tag_fields:tagLike,
      parsed_tags_from_list:tagsOf(row),
      parsed_tags_from_full:tagsOf(full||{}),
      full_lookup_error:fullError,
      list_product:row,
      full_product:full
    });
  }catch(e){res.status(500).json({error:e.message})}
});
app.get('/api/auction-products',async(req,res)=>{
  try{
    // SellerChamp exposes tags in `tags_array`. Scan the paginated product LIST only;
    // do not fetch every product individually. This is fast and avoids API rate limits.
    const found=[]; const seen=new Set();
    for(let page=1;page<=500;page++){
      const j=await sc(`/api/products?page=${page}&page_size=100`);
      const batch=j.products||[];
      for(const p of batch){
        const ts=tagsOf(p).map(x=>String(x).trim().toLowerCase());
        if((ts.includes('auction')||ts.includes('auction some'))&&!seen.has(p.id)){
          seen.add(p.id);
          // Inventory locations are only requested for the small number of matching items.
          found.push(summary(p,await invOf(p.id)));
        }
      }
      if(batch.length<100) break;
    }
    found.sort((a,b)=>(a.location||'ZZZZ').localeCompare(b.location||'ZZZZ',undefined,{numeric:true,sensitivity:'base'})||(a.title||'').localeCompare(b.title||''));
    res.json({products:found,count:found.length});
  }catch(e){res.status(e.status||500).json({error:e.message})}
});

app.post('/api/products/:id/quantity',async(req,res)=>{try{const qty=Number(req.body.quantity),loc=String(req.body.location||'');if(!Number.isInteger(qty)||qty<0)return res.status(400).json({error:'Enter a whole-number quantity of 0 or more.'});await setLocationQty(req.params.id,loc,qty);let p=await fullProduct(req.params.id),inv=await invOf(req.params.id),s=summary(p,inv);if(s.quantity===0){await endListing(req.params.id);let tags=tagsOf(await fullProduct(req.params.id)).filter(t=>!['auction','auction some'].includes(t.toLowerCase()));if(!tags.some(t=>t.toLowerCase()==='sent to auction'))tags.push('Sent to Auction');await updateTags(req.params.id,tags);return res.json({ok:true,removed:true,quantity:0})}res.json({ok:true,product:s})}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/products/:id/send-some',async(req,res)=>{try{const amount=Number(req.body.amount),loc=String(req.body.location||'');if(!Number.isInteger(amount)||amount<=0)return res.status(400).json({error:'Enter a whole number greater than zero.'});const p=await fullProduct(req.params.id),tags=tagsOf(p).map(x=>x.toLowerCase());if(!tags.includes('auction some'))return res.status(400).json({error:'Send Some is only available for products tagged auction some.'});const inv=normInv(await invOf(req.params.id)),row=inv.find(x=>String(x.location).toLowerCase()===loc.toLowerCase());if(!row)return res.status(400).json({error:'Choose an inventory location.'});if(amount>row.quantity)return res.status(400).json({error:`Only ${row.quantity} available at ${row.location}.`});await setLocationQty(req.params.id,row.location,row.quantity-amount);const after=summary(await fullProduct(req.params.id),await invOf(req.params.id));if(after.quantity===0){await endListing(req.params.id);let nt=tagsOf(await fullProduct(req.params.id)).filter(t=>t.toLowerCase()!=='auction some'&&t.toLowerCase()!=='auction');if(!nt.some(t=>t.toLowerCase()==='sent to auction'))nt.push('Sent to Auction');await updateTags(req.params.id,nt);return res.json({ok:true,removed:true,quantity:0,sent:amount})}res.json({ok:true,product:after,sent:amount})}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/products/:id/send-all',async(req,res)=>{try{const p=await fullProduct(req.params.id),inv=normInv(await invOf(req.params.id));for(const row of inv)if(row.quantity>0)await setLocationQty(req.params.id,row.location,0);await endListing(req.params.id);let nt=tagsOf(await fullProduct(req.params.id)).filter(t=>!['auction','auction some'].includes(t.toLowerCase()));if(!nt.some(t=>t.toLowerCase()==='sent to auction'))nt.push('Sent to Auction');await updateTags(req.params.id,nt);res.json({ok:true,removed:true})}catch(e){res.status(500).json({error:e.message})}});
app.listen(PORT,()=>console.log(`SellerChamp Auction Inventory running on ${PORT}`));
