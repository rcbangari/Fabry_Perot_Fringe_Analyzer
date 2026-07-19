const DEMO_O=[1848.2,1950.7,2053.5,2156.1,2258.9,2361.2,2464,2566.6];
const DEMO_E=[1876.4,1971.8,2067,2162.5,2257.8,2353.1,2448.6,2543.9];
let birefringent=false;
let cavityFactor=2;
let latest={};
const $=id=>document.getElementById(id);

document.querySelectorAll("a[href]").forEach((link) => {
  const destination = new URL(link.href, window.location.href);
  if (/^https?:$/.test(destination.protocol) && destination.origin !== window.location.origin) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }
});

function parsePositions(raw,unit){return [...new Set(raw.split(/[\s,;]+/).map(Number).filter(v=>Number.isFinite(v)&&v>0).map(v=>unit==="nm"?1e7/v:v))].sort((a,b)=>a-b)}
function spacingStats(values){if(values.length<2)return null;const gaps=values.slice(1).map((v,i)=>v-values[i]);const mean=gaps.reduce((a,b)=>a+b,0)/gaps.length;const variance=gaps.length>1?gaps.reduce((s,v)=>s+(v-mean)**2,0)/(gaps.length-1):0;return{mean,sem:Math.sqrt(variance)/Math.sqrt(gaps.length),gaps}}
function internalCos(index,angle){const sine=Math.sin(angle*Math.PI/180)/Math.max(index,1.0001);return Math.sqrt(Math.max(0,1-sine*sine))}
function thicknessFromSpacing(spacing,index,angle){return 1e4/(cavityFactor*spacing*index*internalCos(index,angle))}
function indexFromSpacing(spacing,thickness,angle){const optical=1e4/(cavityFactor*spacing*thickness);const sine=Math.sin(angle*Math.PI/180);return Math.sqrt(optical**2+sine**2)}
function fmt(value,digits=2){return value==null||!Number.isFinite(value)?"—":value.toFixed(digits)}
function number(id,fallback){const value=Number($(id).value);return Number.isFinite(value)?value:fallback}
function detectPeaks(rows){if(rows.length<5)return[];const ys=rows.map(row=>row[1]);const span=Math.max(...ys)-Math.min(...ys);const peaks=[];for(let i=2;i<rows.length-2;i++){const local=ys[i]>ys[i-1]&&ys[i]>=ys[i+1];const prominence=ys[i]-Math.min(ys[i-2],ys[i+2]);if(local&&prominence>span*.035)peaks.push(rows[i][0])}return peaks}

function setMode(next){birefringent=next;$("isotropic-button").classList.toggle("active",!next);$("birefringent-button").classList.toggle("active",next);$("isotropic-button").setAttribute("aria-pressed",String(!next));$("birefringent-button").setAttribute("aria-pressed",String(next));render()}
function setCavity(factor){cavityFactor=factor;$("full-cavity").classList.toggle("active",factor===2);$("half-cavity").classList.toggle("active",factor===4);$("full-cavity").setAttribute("aria-pressed",String(factor===2));$("half-cavity").setAttribute("aria-pressed",String(factor===4));$("cavity-equation").textContent=factor===2?"2n d cos θₜ = mλ":"4n d cos θₜ = mλ";render()}
function setStatus(message){$("status").textContent=`● ${message}`}

function calculate(){
  const unit=$("spectral-unit").value;
  const goal=$("goal").value;
  const ordinary=parsePositions($("ordinary-peaks").value,unit);
  const extraordinary=parsePositions($("extraordinary-peaks").value,unit);
  const oStats=spacingStats(ordinary),eStats=spacingStats(extraordinary);
  const epsilonO=Math.max(number("epsilon-o",5.76),1.0001),epsilonE=Math.max(number("epsilon-e",6.6564),1.0001);
  const knownThickness=Math.max(number("known-thickness",20.25),.001),knownUncertainty=Math.max(number("known-uncertainty",.02),0);
  const angle=Math.min(Math.max(number("angle",0),0),85),reference=Math.max(number("reference-wavelength",1550),1);
  const suppliedNO=Math.sqrt(epsilonO),suppliedNE=Math.sqrt(epsilonE);
  const inferredO=oStats?indexFromSpacing(oStats.mean,knownThickness,angle):null;
  const inferredE=birefringent&&eStats?indexFromSpacing(eStats.mean,knownThickness,angle):null;
  const oValue=oStats?(goal==="thickness"?thicknessFromSpacing(oStats.mean,suppliedNO,angle):inferredO**2):null;
  const eValue=birefringent&&eStats?(goal==="thickness"?thicknessFromSpacing(eStats.mean,suppliedNE,angle):inferredE**2):null;
  const nO=goal==="permittivity"?inferredO:suppliedNO,nE=goal==="permittivity"&&inferredE!=null?inferredE:suppliedNE;
  const deltaN=birefringent&&nO!=null&&nE!=null?nE-nO:0;
  const values=[oValue,eValue].filter(v=>v!=null);const thickness=goal==="thickness"?(values.length?values.reduce((a,b)=>a+b,0)/values.length:0):knownThickness;
  const retardance=deltaN*thickness*1000/reference;
  const knownRelative=goal==="thickness"?.5*knownUncertainty/Math.max(epsilonO,1e-9):2*knownUncertainty/Math.max(knownThickness,1e-9);
  const spacingRelative=oStats?(goal==="permittivity"?2:1)*oStats.sem/oStats.mean:0;
  const uncertainty=oValue==null?null:Math.abs(oValue*Math.sqrt(spacingRelative**2+knownRelative**2));
  const mismatch=oValue!=null&&eValue!=null?Math.abs(oValue-eValue)/((oValue+eValue)/2)*100:null;
  return{unit,goal,ordinary,extraordinary,oStats,eStats,oValue,eValue,deltaN,retardance,uncertainty,mismatch,angle,reference,axis:number("axis-angle",45)};
}

function renderPlot(data){
  const all=[...data.ordinary,...(birefringent?data.extraordinary:[])];const min=all.length?Math.min(...all)-35:1800,max=all.length?Math.max(...all)+35:2600;
  const x=v=>54+(v-min)/Math.max(max-min,1)*766;
  const wave=Array.from({length:181},(_,i)=>{const px=54+i/180*766,coordinate=min+i/180*(max-min);const response=all.reduce((sum,peak,index)=>sum+Math.exp(-(((coordinate-peak)/(birefringent&&index>=data.ordinary.length?10:12))**2)),0);return`${px.toFixed(1)},${(242-Math.min(response,1.1)*155).toFixed(1)}`}).join(" ");
  const horizontal=[0,1,2,3,4].map(t=>`<line x1="54" x2="820" y1="${30+t*53}" y2="${30+t*53}" class="grid"/>`).join("");
  const vertical=[0,1,2,3,4,5].map(t=>{const value=min+t/5*(max-min),px=54+t/5*766;return`<g><line x1="${px}" x2="${px}" y1="30" y2="242" class="grid"/><text x="${px}" y="268" text-anchor="middle">${Math.round(value)}</text></g>`}).join("");
  const o=data.ordinary.map(p=>`<g><line x1="${x(p)}" x2="${x(p)}" y1="75" y2="242" class="peak-line o"/><circle cx="${x(p)}" cy="76" r="6" class="peak o"/></g>`).join("");
  const e=birefringent?data.extraordinary.map(p=>`<g><line x1="${x(p)}" x2="${x(p)}" y1="112" y2="242" class="peak-line e"/><rect x="${x(p)-5}" y="107" width="10" height="10" class="peak e"/></g>`).join(""):"";
  $("spectrum-plot").innerHTML=`<rect x="54" y="30" width="766" height="212" class="plot-bg"/>${horizontal}${vertical}<polyline points="${wave}" class="trace"/>${o}${e}<text x="437" y="296" text-anchor="middle" class="axis-label">WAVENUMBER (cm⁻¹)</text>`;
}

function render(){
  const data=calculate();latest=data;const thickness=data.goal==="thickness",unit=thickness?" µm":"";
  $("goal-thickness").classList.toggle("active",thickness);$("goal-permittivity").classList.toggle("active",!thickness);$("goal-thickness").setAttribute("aria-pressed",String(thickness));$("goal-permittivity").setAttribute("aria-pressed",String(!thickness));$("birefringent-button").disabled=thickness;
  $("known-thickness-field").hidden=thickness;$("epsilon-o-field").hidden=!thickness;$("epsilon-e-field").hidden=!thickness||!birefringent;
  $("axis-field").hidden=!birefringent;$("retardance-field").hidden=!birefringent;$("extraordinary-peaks-field").hidden=!birefringent;$("e-result-card").hidden=!birefringent;$("e-legend").hidden=!birefringent;
  $("upload-family").disabled=!birefringent;$("epsilon-o-label").textContent=birefringent?"ORDINARY PERMITTIVITY εₒ":"RELATIVE PERMITTIVITY εᵣ";
  $("o-result-label").textContent=thickness?"O THICKNESS":"ORDINARY PERMITTIVITY εₒ";$("e-result-label").textContent=thickness?"E THICKNESS":"EXTRAORDINARY PERMITTIVITY εₑ";
  $("o-result").textContent=`${fmt(data.oValue,thickness?2:3)}${unit}`;$("e-result").textContent=`${fmt(data.eValue,thickness?2:3)}${unit}`;
  $("o-result-sub").textContent=data.oStats?`Δσ ${fmt(data.oStats.mean,2)} ± ${fmt(data.oStats.sem,2)} cm⁻¹`:"Need ≥2 peaks";
  $("e-result-sub").textContent=data.eStats?`Δσ ${fmt(data.eStats.mean,2)} ± ${fmt(data.eStats.sem,2)} cm⁻¹`:"Need ≥2 peaks";
  $("birefringence-result").textContent=birefringent?fmt(data.deltaN,4):"—";$("birefringence-sub").textContent=birefringent?`${fmt(data.retardance,2)} waves at ${data.reference} nm`:"Enable birefringent mode";
  $("comparison-label").textContent=thickness?"CONSISTENCY":"ANISOTROPY CONTRAST";$("comparison-result").textContent=data.mismatch==null?"—":`${fmt(data.mismatch,2)}%`;
  $("comparison-sub").textContent=data.mismatch==null?`Estimated uncertainty ${fmt(data.uncertainty,3)}`:thickness?"O/E thickness mismatch":"(εₑ − εₒ) / mean ε";
  $("axis-value").textContent=`${data.axis}°`;$("peak-count").textContent=`${data.ordinary.length} O PEAKS${birefringent?` · ${data.extraordinary.length} E PEAKS`:""}`;$("plot-settings").textContent=`ANGLE: ${data.angle.toFixed(1)}° · POLARIZATION: ${data.axis.toFixed(0)}°`;
  renderPlot(data);
}

async function handleFile(file){
  if(!file)return;const text=await file.text();const rows=text.split(/\r?\n/).map(line=>line.trim().split(/[\s,;\t]+/).slice(0,2).map(Number)).filter(row=>row.length===2&&row.every(Number.isFinite)).sort((a,b)=>a[0]-b[0]);const peaks=detectPeaks(rows);
  if(peaks.length<2){setStatus("Could not detect enough peaks — try manual entry");return}const family=$("upload-family").value;$(family==="ordinary"?"ordinary-peaks":"extraordinary-peaks").value=peaks.map(p=>p.toFixed(3)).join(", ");setStatus(`${peaks.length} ${family} peaks detected from ${file.name}`);render();$("spectrum-file").value="";
}
function exportResults(){const d=latest;const rows=[["Fabry-Perot fringe analysis","value","unit"],["mode",birefringent?"birefringent":"isotropic",""],["ordinary spacing",fmt(d.oStats?.mean,5),"cm^-1"],["extraordinary spacing",birefringent?fmt(d.eStats?.mean,5):"","cm^-1"],[d.goal==="thickness"?"ordinary thickness":"ordinary relative permittivity",fmt(d.oValue,6),d.goal==="thickness"?"um":""],[d.goal==="thickness"?"extraordinary thickness":"extraordinary relative permittivity",birefringent?fmt(d.eValue,6):"",d.goal==="thickness"?"um":""],["birefringence",birefringent?fmt(d.deltaN,6):"",""],["retardance",birefringent?fmt(d.retardance,6):"","waves"]];const blob=new Blob([rows.map(r=>r.join(",")).join("\n")],{type:"text/csv"});const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="fabry-perot-analysis.csv";a.click();URL.revokeObjectURL(url)}

$("ordinary-peaks").value=DEMO_O.join(", ");$("extraordinary-peaks").value=DEMO_E.join(", ");
document.querySelectorAll("input:not(#spectrum-file),select,textarea").forEach(element=>element.addEventListener("input",render));
$("goal-thickness").addEventListener("click",()=>{$("goal").value="thickness";setMode(false)});$("goal-permittivity").addEventListener("click",()=>{$("goal").value="permittivity";render()});
$("full-cavity").addEventListener("click",()=>setCavity(2));$("half-cavity").addEventListener("click",()=>setCavity(4));
$("upload-button").addEventListener("click",()=>$("spectrum-file").click());$("spectrum-file").addEventListener("change",event=>handleFile(event.target.files?.[0]));
$("isotropic-button").addEventListener("click",()=>setMode(false));$("birefringent-button").addEventListener("click",()=>setMode(true));
$("reset-button").addEventListener("click",()=>{$("ordinary-peaks").value=DEMO_O.join(", ");$("extraordinary-peaks").value=DEMO_E.join(", ");setStatus("Demo fringe families restored");render()});
$("export-button").addEventListener("click",exportResults);
const themeToggle=document.querySelector(".theme-toggle");
const setTheme=theme=>{document.documentElement.dataset.theme=theme;localStorage.setItem("theme",theme);themeToggle.dataset.current=theme;themeToggle.setAttribute("aria-pressed",String(theme==="dark"));themeToggle.setAttribute("aria-label",`Switch to ${theme==="dark"?"light":"dark"} theme`)};
const currentTheme=document.documentElement.dataset.theme||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");
themeToggle.dataset.current=currentTheme;themeToggle.setAttribute("aria-pressed",String(currentTheme==="dark"));themeToggle.setAttribute("aria-label",`Switch to ${currentTheme==="dark"?"light":"dark"} theme`);themeToggle.addEventListener("click",()=>setTheme(themeToggle.dataset.current==="dark"?"light":"dark"));
render();
