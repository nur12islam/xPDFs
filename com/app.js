const $ = id => document.getElementById(id);

const input = $("htmlInput");
const preview = $("preview");
const status = $("status");

function setStatus(message){
  status.textContent = message || "";
}

function buildDocument(html){
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  /*
    Keep the body content, but also copy useful styles from the
    supplied <style> elements. This allows complete HTML documents
    to work instead of rendering only plain body text.
  */
  const styleText = [...doc.querySelectorAll("style")]
    .map(style => style.textContent)
    .join("\n");

  const body = doc.body ? doc.body.innerHTML : html;

  return { styleText, body };
}

function sanitizeForPreview(container){
  /*
    Prevent embedded scripts from executing inside the compiler.
    Styles are preserved because CSS is the point of this tool.
  */
  container.querySelectorAll("script,base").forEach(el => el.remove());

  /*
    Keep content inside the printable A4 width.
  */
  container.querySelectorAll("*").forEach(el => {
    el.style.maxWidth = "100%";
    el.style.boxSizing = "border-box";
  });

  container.querySelectorAll("img,video,canvas,svg").forEach(el => {
    el.style.maxWidth = "100%";
    el.style.height = "auto";
  });

  container.querySelectorAll("table").forEach(table => {
    table.style.width = "100%";
    table.style.maxWidth = "100%";
    table.style.tableLayout = "fixed";
  });

  container.querySelectorAll("td,th").forEach(cell => {
    cell.style.maxWidth = "100%";
    cell.style.overflowWrap = "anywhere";
    cell.style.wordBreak = "break-word";
  });

  container.querySelectorAll("pre,code").forEach(el => {
    el.style.maxWidth = "100%";
    el.style.whiteSpace = "pre-wrap";
    el.style.overflowWrap = "anywhere";
    el.style.wordBreak = "break-word";
  });
}

function render(){
  const html = input.value;
  const orientation = $("orientation").value;
  const margin = $("margin").value;

  const paper = document.createElement("div");

  paper.className =
    "paper" +
    (orientation === "landscape" ? " landscape" : "");

  paper.style.padding = `${margin}mm`;

  if(!html.trim()){
    paper.innerHTML = `
      <div class="empty">
        Paste HTML into the editor to preview it here.
      </div>
    `;
    preview.replaceChildren(paper);
    setStatus("");
    return;
  }

  const source = buildDocument(html);

  if(source.styleText){
    const style = document.createElement("style");
    style.textContent = source.styleText;
    paper.appendChild(style);
  }

  const content = document.createElement("div");
  content.innerHTML = source.body;

  paper.appendChild(content);

  sanitizeForPreview(paper);

  preview.replaceChildren(paper);

  setStatus("Preview updated.");
}

function getFileName(){
  const heading =
    preview.querySelector("h1,h2,h3,title");

  let name = heading
    ? heading.textContent.trim()
    : "xark-document";

  name = name
    .replace(/[\\/:*?"<>|]/g,"")
    .replace(/\s+/g,"-")
    .slice(0,70);

  return name || "xark-document";
}

async function downloadPDF(){

  if(!input.value.trim()){
    alert("Please paste some HTML first.");
    return;
  }

  if(typeof html2pdf === "undefined"){
    alert("PDF engine could not be loaded. Check your internet connection and try again.");
    return;
  }

  render();

  const element = preview.querySelector(".paper");

  if(!element) return;

  const button = $("pdfBtn");
  button.disabled = true;
  setStatus("Preparing PDF…");

  /*
    Wait for images/fonts/layout to settle before capturing.
  */
  if(document.fonts && document.fonts.ready){
    await document.fonts.ready;
  }

  const images = [...element.querySelectorAll("img")];

  await Promise.all(
    images.map(img => {
      if(img.complete) return Promise.resolve();

      return new Promise(resolve => {
        img.addEventListener("load", resolve, {once:true});
        img.addEventListener("error", resolve, {once:true});
      });
    })
  );

  const orientation =
    $("orientation").value;

  const margin =
    Number($("margin").value);

  const pageFormat =
    $("pageSize").value;

  const options = {
    margin: margin,
    filename: `${getFileName()}.pdf`,

    image:{
      type:"jpeg",
      quality:0.98
    },

    html2canvas:{
      scale:2,
      useCORS:true,
      allowTaint:false,
      backgroundColor:"#ffffff",
      logging:false,
      windowWidth:element.scrollWidth
    },

    jsPDF:{
      unit:"mm",
      format:pageFormat,
      orientation:orientation,
      compress:true
    },

    pagebreak:{
      mode:["css","legacy"],
      avoid:["tr","img","pre","blockquote","table"]
    }
  };

  try{
    await html2pdf()
      .set(options)
      .from(element)
      .save();

    setStatus("PDF created successfully.");
  }catch(error){
    console.error(error);
    setStatus("PDF creation failed. Try Print / Save PDF.");
    alert("PDF creation failed. Try Print / Save PDF instead.");
  }finally{
    button.disabled = false;
  }
}

function clearAll(){
  input.value = "";
  render();
}

$("previewBtn").addEventListener("click", render);
$("pdfBtn").addEventListener("click", downloadPDF);
$("clearBtn").addEventListener("click", clearAll);

$("printBtn").addEventListener("click", () => {
  render();
  window.print();
});

input.addEventListener("input", render);
$("orientation").addEventListener("change", render);
$("margin").addEventListener("change", render);
$("pageSize").addEventListener("change", render);

render();


function isHTMLFile(file){
  const name = file.name.toLowerCase();
  return name.endsWith(".html") || name.endsWith(".htm") || file.type === "text/html";
}

async function loadHTMLFile(file){
  if(!isHTMLFile(file)){
    setStatus("Ignored: only HTML files (.html / .htm) are accepted.");
    return;
  }

  try{
    const html = await file.text();
    input.value = html;
    setStatus(`Loaded ${file.name}.`);
    render();
  }catch(error){
    console.error(error);
    setStatus("Could not read the HTML file.");
  }
}

const fileInput = $("htmlFile");
const dropZone = $("htmlDropZone");

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if(file) loadHTMLFile(file);
});

["dragenter","dragover"].forEach(eventName => {
  dropZone.addEventListener(eventName, event => {
    event.preventDefault();
    event.stopPropagation();
    dropZone.classList.add("dragover");
  });
});

["dragleave","drop"].forEach(eventName => {
  dropZone.addEventListener(eventName, event => {
    event.preventDefault();
    event.stopPropagation();
    dropZone.classList.remove("dragover");
  });
});

dropZone.addEventListener("drop", event => {
  const file = event.dataTransfer?.files?.[0];
  if(file) loadHTMLFile(file);
});

dropZone.addEventListener("keydown", event => {
  if(event.key === "Enter" || event.key === " "){
    event.preventDefault();
    fileInput.click();
  }
});
