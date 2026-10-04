const input=document.getElementById("input");
const analyze=document.getElementById("analyze");
const clear=document.getElementById("clear");
const status=document.getElementById("status");
const results=document.getElementById("results");
const mistakes=document.getElementById("mistakes");
const count=document.getElementById("count");
let engine="gramformer";

document.querySelectorAll(".engine").forEach(btn=>btn.addEventListener("click",()=>{
  document.querySelectorAll(".engine").forEach(x=>x.classList.remove("active"));
  btn.classList.add("active"); engine=btn.dataset.engine;
}));

analyze.addEventListener("click",async()=>{
  const text=input.value.trim();
  if(!text){status.textContent="Enter some text first.";return}
  analyze.disabled=true; status.textContent="Analyzing…";
  try{
    const r=await fetch("/api/grammar-lens/"+engine,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text})});
    const data=await r.json();
    if(!r.ok) throw new Error(data.error||"Analysis failed");
    render(data.mistakes||[]);
    status.textContent=engine==="ai"?"AI analysis complete.":"Gramformer analysis complete.";
  }catch(e){status.textContent=e.message||"Analysis failed.";results.classList.remove("hidden");mistakes.innerHTML='<div class="empty">The engine could not complete this analysis. Check the API configuration.</div>'}
  finally{analyze.disabled=false}
});

clear.addEventListener("click",()=>{input.value="";results.classList.add("hidden");mistakes.innerHTML="";count.textContent="";status.textContent="Ready."});

function render(items){
  results.classList.remove("hidden"); count.textContent=items.length+" issue"+(items.length===1?"":"s");
  if(!items.length){mistakes.innerHTML='<div class="empty">No mistakes found. ✨</div>';return}
  mistakes.innerHTML=items.map(m=>`<article class="mistake"><b>${esc(m.shortTitle||m.category||"Issue")}</b><div class="original">“${esc(m.originalText||"")}”</div><div class="suggestion">→ ${esc((m.suggestions||[])[0]||"No correction suggested")}</div><p>${esc(m.explanation||"")}</p></article>`).join("");
}
function esc(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}