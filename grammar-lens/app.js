const $=id=>document.getElementById(id);
let engine="gramformer", mistakes=[], selected=-1, originalText="", correctedText="", view="highlights", exportType="corrected", format="txt", undoStack=[], redoStack=[];

const welcome=$("welcome"), workspace=$("workspace"), choices=$("engineChoices"), consent=$("consent"), editor=$("editor"), inputModule=$("inputModule"), review=$("review"), loading=$("loading"), fileInput=$("fileInput");

function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove("show"),2200)}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function words(s){return (s.trim().match(/\S+/g)||[]).length}
function setEngine(e){engine=e;$("enginePill").className="engine-pill "+e;$("enginePill").innerHTML="<i></i><b>"+(e==="ai"?"AI Engine":"Gramformer Engine")+"</b>"}
function enter(e){engine=e;setEngine(e);welcome.classList.add("hidden");workspace.classList.remove("hidden");editor.focus()}
choices.querySelector('[data-engine="ai"]').onclick=()=>{choices.classList.add("hidden");consent.classList.remove("hidden")}
choices.querySelector('[data-engine="gramformer"]').onclick=()=>enter("gramformer")
$("consentBack").onclick=()=>{consent.classList.add("hidden");choices.classList.remove("hidden")}
$("consentYes").onclick=()=>enter("ai")
$("exitBtn").onclick=()=>{workspace.classList.add("hidden");welcome.classList.remove("hidden");consent.classList.add("hidden");choices.classList.remove("hidden");review.classList.add("hidden");inputModule.classList.remove("hidden")}
$("historyBtn").onclick=$("navHistory").onclick=()=>toast("Session history is available in the full AI Studio version; this static port keeps the current session locally.")
$("restoreBtn").onclick=()=>fileInput.click()
$("restoreFile").onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const d=JSON.parse(await f.text());const s=d.session||d;editor.value=s.inputText||"";originalText=editor.value;toast("Session restored")}catch{toast("Invalid session file")}}

document.querySelectorAll(".input-tab").forEach(b=>b.onclick=()=>{document.querySelectorAll(".input-tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");const type=b.dataset.type;if(type==="text"){$("fileDrop").classList.add("hidden");editor.classList.remove("hidden")}else{$("fileDrop").classList.remove("hidden");editor.classList.add("hidden");fileInput.accept=type==="image"?"image/*":".txt,.md,.html,.htm,.doc,.docx,.pdf"}})
$("fileDrop").onclick=()=>fileInput.click()
fileInput.addEventListener("change",async e=>{const f=e.target.files?.[0];if(!f)return;if(f.type.startsWith("image/")){toast("Image OCR is not available in the static port yet.");return}try{editor.value=await f.text();document.querySelector('[data-type="text"]').click();toast("Document loaded")}catch{toast("Could not read this file")}})
editor.addEventListener("input",()=>{$("inputMeta").textContent=words(editor.value)+" words · "+editor.value.length+" characters"})

async function analyzeText(){
 const text=editor.value.trim();if(!text){toast("Enter some text first.");return}
 originalText=text;$("analyzeBtn").disabled=true;loading.classList.remove("hidden");$("loadingTitle").textContent="Analyzing…";$("loadingText").textContent=engine==="ai"?"Processing with AI engine":"Running Gramformer cross-check";
 try{
   const r=await fetch("/api/grammar-lens/"+engine,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text})});
   const data=await r.json();if(!r.ok)throw new Error(data.error||"Analysis failed");
   mistakes=(data.mistakes||[]).map((m,i)=>({...m,id:m.id||"m"+i}));selected=mistakes.length?0:-1;correctedText=text;
   undoStack=[];redoStack=[];renderReview();inputModule.classList.add("hidden");review.classList.remove("hidden");$("exportBtn").classList.remove("hidden");
 }catch(e){toast(e.message||"Analysis failed")}finally{loading.classList.add("hidden");$("analyzeBtn").disabled=false}
}
$("analyzeBtn").onclick=analyzeText;

function renderReview(){renderToolbar();renderHighlighted();renderList();renderExplanation();$("issueCount").textContent=mistakes.length+" issue"+(mistakes.length===1?"":"s")}
function renderToolbar(){$(".view-switch .view-btn.active")?.classList.remove("active");document.querySelector('.view-btn[data-view="'+view+'"]').classList.add("active");$("undoBtn").disabled=!undoStack.length;$("redoBtn").disabled=!redoStack.length}
function renderHighlighted(){
 const host=$("highlightEditor");host.innerHTML="";
 let pos=0;
 const sorted=[...mistakes].filter(m=>!m.ignored&&!m.applied).sort((a,b)=>(a.startIndex??originalText.indexOf(a.originalText))-(b.startIndex??originalText.indexOf(b.originalText)));
 sorted.forEach(m=>{let idx=m.startIndex??originalText.indexOf(m.originalText,pos);if(idx<pos||idx<0)return;host.append(document.createTextNode(originalText.slice(pos,idx)));const b=document.createElement("button");b.className="mark "+(m.id===mistakes[selected]?.id?"selected":"");b.textContent=m.originalText;b.onclick=()=>{selected=mistakes.indexOf(m);renderList();renderExplanation();renderHighlighted()};host.append(b);pos=idx+m.originalText.length});
 host.append(document.createTextNode(originalText.slice(pos)));host.classList.toggle("editable",view==="edit");$("editEditor").classList.toggle("hidden",view!=="edit");if(view==="edit")$("editEditor").value=correctedText;
}
function renderList(){const q=$("search").value?.toLowerCase()||"";const list=$("issueList");const arr=mistakes.map((m,i)=>[m,i]).filter(([m])=>(m.shortTitle+" "+m.category+" "+m.originalText).toLowerCase().includes(q));if(!arr.length){list.innerHTML='<div class="empty">No issues found. ✨</div>';return}list.innerHTML=arr.map(([m,i])=>'<button class="issue '+(i===selected?"selected":"")+'" data-i="'+i+'"><span class="issue-dot '+String(m.severity||"Minor").toLowerCase()+'"></span><span><b>'+esc(m.shortTitle||m.category||"Issue")+'</b><small>'+esc(m.originalText||"")+'</small></span></button>').join("");list.querySelectorAll(".issue").forEach(b=>b.onclick=()=>{selected=+b.dataset.i;renderList();renderExplanation();renderHighlighted()})}
function renderExplanation(){const box=$("explanation"),m=mistakes[selected];if(!m){box.innerHTML='<div class="empty">Select an issue to see its explanation.</div>';return}const sug=(m.suggestions||[])[0]||"No correction suggested";box.innerHTML='<div class="ex-head"><div><span class="category">'+esc(m.category||"Grammar")+'</span><span class="severity">'+esc(m.severity||"Minor")+'</span></div><button id="closeExp">×</button></div><h3>'+esc(m.shortTitle||"Grammar issue")+'</h3><div class="compare"><div><label>Original</label><del>'+esc(m.originalText)+'</del></div><div><label>Suggested</label><strong>'+esc(sug)+'</strong></div></div><p>'+esc(m.explanation||"No explanation provided.")+'</p><div class="ex-actions"><button id="applyOne" class="success">✓ Apply Fix</button><button id="ignoreOne" class="danger">× Ignore</button></div><div class="nav-issue"><button id="prevIssue">‹ Previous</button><button id="nextIssue">Next ›</button></div>';$("applyOne").onclick=()=>applyFix(m,sug);$("ignoreOne").onclick=()=>{m.ignored=true;toast("Mistake ignored");renderReview()};$("prevIssue").onclick=()=>{if(selected>0){selected--;renderReview()}};$("nextIssue").onclick=()=>{if(selected<mistakes.length-1){selected++;renderReview()}}}
function applyFix(m,sug){const before=correctedText;const idx=before.indexOf(m.originalText);if(idx>=0){undoStack.push(correctedText);redoStack=[];correctedText=before.slice(0,idx)+sug+before.slice(idx+m.originalText.length);m.applied=true;m.suggestionApplied=sug;toast("Fix applied");renderReview()}}
$("applyAllBtn").onclick=()=>{mistakes.filter(m=>!m.applied&&!m.ignored).forEach(m=>{const s=(m.suggestions||[])[0];if(s)applyFix(m,s)});toast("Available fixes applied")}
$("ignoreAllBtn").onclick=()=>{mistakes.forEach(m=>{if(!m.applied)m.ignored=true});renderReview();toast("Issues ignored")}
$("resetBtn").onclick=()=>{correctedText=originalText;mistakes.forEach(m=>{m.applied=false;m.ignored=false});undoStack=[];redoStack=[];renderReview();toast("Document reset")}
$("undoBtn").onclick=()=>{if(undoStack.length){redoStack.push(correctedText);correctedText=undoStack.pop();renderReview()}}
$("redoBtn").onclick=()=>{if(redoStack.length){undoStack.push(correctedText);correctedText=redoStack.pop();renderReview()}}
document.querySelectorAll(".view-btn").forEach(b=>b.onclick=()=>{view=b.dataset.view;renderReview()})
$("editEditor").addEventListener("input",()=>{correctedText=$("editEditor").value})
$("searchToggle").onclick=()=>{$("search").classList.toggle("hidden");$("search").focus()}
$("search").oninput=renderList

function buildExport(){if(exportType==="original")return originalText;if(exportType==="corrected")return correctedText;if(exportType==="report")return mistakes.map((m,i)=>`${i+1}. ${m.shortTitle||m.category}\nOriginal: ${m.originalText}\nSuggestion: ${(m.suggestions||[])[0]||"—"}\nExplanation: ${m.explanation||""}`).join("\n\n");return JSON.stringify({version:"1.0",session:{mode:engine,inputText:originalText,analysisResult:{mistakes}}},null,2)}
function filename(){return "GrammarLens_"+exportType.charAt(0).toUpperCase()+exportType.slice(1)+"."+format}
document.querySelectorAll("#exportTypes button").forEach(b=>b.onclick=()=>{document.querySelectorAll("#exportTypes button").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");exportType=b.dataset.type;document.querySelector(".json-format").style.display=exportType==="session"?"inline-block":"none";if(exportType==="session")format="json";updateFilename()})
document.querySelectorAll("#formats button").forEach(b=>b.onclick=()=>{if(b.style.display==="none")return;document.querySelectorAll("#formats button").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");format=b.dataset.format;updateFilename()})
function updateFilename(){$("filename").textContent=filename()}
$("exportBtn").onclick=()=>$("exportModal").classList.remove("hidden");$("closeExport").onclick=()=>$("exportModal").classList.add("hidden")
$("downloadExport").onclick=()=>{const data=buildExport();const blob=new Blob([data],{type:format==="json"?"application/json":"text/plain"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename();a.click();URL.revokeObjectURL(a.href);toast("Export downloaded")}
$("copyExport").onclick=async()=>{await navigator.clipboard.writeText(buildExport());toast("Copied to clipboard")}
$("printExport").onclick=()=>{const w=window.open("","_blank");if(w){w.document.write("<pre style='white-space:pre-wrap;font:14px Inter,sans-serif'>"+esc(buildExport())+"</pre>");w.document.close();w.print()}}
document.querySelector('[data-type="session"]').style.display="none";document.querySelector(".json-format").style.display="none";
$("inputMeta").textContent="0 words · 0 characters";
