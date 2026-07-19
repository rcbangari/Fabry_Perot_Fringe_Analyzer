"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";

type Family = "ordinary" | "extraordinary";
type SpectralUnit = "cm-1" | "nm";
type Goal = "thickness" | "permittivity";

const DEMO_O = [1848.2, 1950.7, 2053.5, 2156.1, 2258.9, 2361.2, 2464.0, 2566.6];
const DEMO_E = [1876.4, 1971.8, 2067.0, 2162.5, 2257.8, 2353.1, 2448.6, 2543.9];

function parsePositions(raw: string, unit: SpectralUnit) {
  const values = raw
    .split(/[\s,;]+/)
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0)
    .map((value) => (unit === "nm" ? 1e7 / value : value));
  return [...new Set(values)].sort((a, b) => a - b);
}

function spacingStats(values: number[]) {
  if (values.length < 2) return null;
  const gaps = values.slice(1).map((value, index) => value - values[index]);
  const mean = gaps.reduce((sum, value) => sum + value, 0) / gaps.length;
  const variance = gaps.length > 1
    ? gaps.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (gaps.length - 1)
    : 0;
  return { mean, sem: Math.sqrt(variance) / Math.sqrt(gaps.length), gaps };
}

function internalCos(index: number, angleDeg: number) {
  const sine = Math.sin((angleDeg * Math.PI) / 180) / Math.max(index, 1.0001);
  return Math.sqrt(Math.max(0, 1 - sine * sine));
}

function thicknessFromSpacing(spacing: number, index: number, angle: number) {
  return 1e4 / (2 * spacing * index * internalCos(index, angle));
}

function indexFromSpacing(spacing: number, thicknessUm: number, angle: number) {
  const opticalTerm = 1e4 / (2 * spacing * thicknessUm);
  const externalSine = Math.sin((angle * Math.PI) / 180);
  return Math.sqrt(opticalTerm ** 2 + externalSine ** 2);
}

function fmt(value: number | null | undefined, digits = 2) {
  return value == null || !Number.isFinite(value) ? "—" : value.toFixed(digits);
}

function detectPeaks(rows: number[][]) {
  if (rows.length < 5) return [];
  const ys = rows.map((row) => row[1]);
  const span = Math.max(...ys) - Math.min(...ys);
  const peaks: number[] = [];
  for (let i = 2; i < rows.length - 2; i += 1) {
    const local = ys[i] > ys[i - 1] && ys[i] >= ys[i + 1];
    const prominence = ys[i] - Math.min(ys[i - 2], ys[i + 2]);
    if (local && prominence > span * 0.035) peaks.push(rows[i][0]);
  }
  return peaks;
}

function SpectrumPlot({ ordinary, extraordinary, birefringent }: {
  ordinary: number[];
  extraordinary: number[];
  birefringent: boolean;
}) {
  const all = [...ordinary, ...(birefringent ? extraordinary : [])];
  const min = all.length ? Math.min(...all) - 35 : 1800;
  const max = all.length ? Math.max(...all) + 35 : 2600;
  const x = (value: number) => 54 + ((value - min) / Math.max(max - min, 1)) * 766;
  const wave = Array.from({ length: 181 }, (_, i) => {
    const px = 54 + (i / 180) * 766;
    const coordinate = min + (i / 180) * (max - min);
    const response = all.reduce((sum, peak, index) => {
      const width = birefringent && index >= ordinary.length ? 10 : 12;
      return sum + Math.exp(-(((coordinate - peak) / width) ** 2));
    }, 0);
    const y = 242 - Math.min(response, 1.1) * 155;
    return `${px.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  return (
    <div className="plot-wrap" aria-label="Fringe-position visualization">
      <div className="plot-topline">
        <span>SPECTRAL RESPONSE</span>
        <div className="legend"><i className="dot red" /> O peaks {birefringent && <><i className="dot blue" /> E peaks</>}</div>
      </div>
      <svg viewBox="0 0 860 300" role="img" aria-label="Detected Fabry–Pérot fringe peaks plotted against wavenumber">
        <rect x="54" y="30" width="766" height="212" className="plot-bg" />
        {[0, 1, 2, 3, 4].map((tick) => <line key={`h${tick}`} x1="54" x2="820" y1={30 + tick * 53} y2={30 + tick * 53} className="grid" />)}
        {[0, 1, 2, 3, 4, 5].map((tick) => {
          const value = min + (tick / 5) * (max - min);
          const px = 54 + (tick / 5) * 766;
          return <g key={tick}><line x1={px} x2={px} y1="30" y2="242" className="grid" /><text x={px} y="268" textAnchor="middle">{Math.round(value)}</text></g>;
        })}
        <polyline points={wave} className="trace" />
        {ordinary.map((peak) => <g key={`o${peak}`}><line x1={x(peak)} x2={x(peak)} y1="75" y2="242" className="peak-line o" /><circle cx={x(peak)} cy="76" r="6" className="peak o" /></g>)}
        {birefringent && extraordinary.map((peak) => <g key={`e${peak}`}><line x1={x(peak)} x2={x(peak)} y1="112" y2="242" className="peak-line e" /><rect x={x(peak) - 5} y="107" width="10" height="10" className="peak e" /></g>)}
        <text x="437" y="296" textAnchor="middle" className="axis-label">WAVENUMBER (cm⁻¹)</text>
      </svg>
    </div>
  );
}

export default function Home() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [unit, setUnit] = useState<SpectralUnit>("cm-1");
  const [goal, setGoal] = useState<Goal>("thickness");
  const [birefringent, setBirefringent] = useState(true);
  const [ordinaryRaw, setOrdinaryRaw] = useState(DEMO_O.join(", "));
  const [extraordinaryRaw, setExtraordinaryRaw] = useState(DEMO_E.join(", "));
  const [uploadFamily, setUploadFamily] = useState<Family>("ordinary");
  const [epsilonO, setEpsilonO] = useState(5.76);
  const [epsilonE, setEpsilonE] = useState(6.6564);
  const [knownThickness, setKnownThickness] = useState(20.25);
  const [knownUncertainty, setKnownUncertainty] = useState(0.02);
  const [angle, setAngle] = useState(0);
  const [axisAngle, setAxisAngle] = useState(45);
  const [referenceWavelength, setReferenceWavelength] = useState(1550);
  const [status, setStatus] = useState("Demo fringe families loaded");

  const ordinary = useMemo(() => parsePositions(ordinaryRaw, unit), [ordinaryRaw, unit]);
  const extraordinary = useMemo(() => parsePositions(extraordinaryRaw, unit), [extraordinaryRaw, unit]);
  const oStats = useMemo(() => spacingStats(ordinary), [ordinary]);
  const eStats = useMemo(() => spacingStats(extraordinary), [extraordinary]);

  const results = useMemo(() => {
    const suppliedNO = Math.sqrt(Math.max(epsilonO, 1.0001));
    const suppliedNE = Math.sqrt(Math.max(epsilonE, 1.0001));
    const inferredOIndex = oStats ? indexFromSpacing(oStats.mean, knownThickness, angle) : null;
    const inferredEIndex = birefringent && eStats ? indexFromSpacing(eStats.mean, knownThickness, angle) : null;
    const oValue = oStats ? (goal === "thickness" ? thicknessFromSpacing(oStats.mean, suppliedNO, angle) : inferredOIndex! ** 2) : null;
    const eValue = birefringent && eStats ? (goal === "thickness" ? thicknessFromSpacing(eStats.mean, suppliedNE, angle) : inferredEIndex! ** 2) : null;
    const inferredNO = goal === "permittivity" ? inferredOIndex : suppliedNO;
    const inferredNE = goal === "permittivity" && inferredEIndex != null ? inferredEIndex : suppliedNE;
    const deltaN = birefringent && inferredNO != null && inferredNE != null ? inferredNE - inferredNO : 0;
    const thickness = goal === "thickness" ? ([oValue, eValue].filter((v): v is number => v != null).reduce((a, b) => a + b, 0) / (eValue == null ? 1 : 2)) : knownThickness;
    const retardanceWaves = deltaN * thickness * 1000 / referenceWavelength;
    const knownRelative = goal === "thickness"
      ? 0.5 * knownUncertainty / Math.max(epsilonO, 1e-9)
      : 2 * knownUncertainty / Math.max(knownThickness, 1e-9);
    const spacingRelative = oStats ? (goal === "permittivity" ? 2 : 1) * oStats.sem / oStats.mean : 0;
    const relativeO = Math.sqrt(spacingRelative ** 2 + knownRelative ** 2);
    const uncertainty = oValue == null ? null : Math.abs(oValue * relativeO);
    const mismatch = oValue != null && eValue != null ? Math.abs(oValue - eValue) / ((oValue + eValue) / 2) * 100 : null;
    return { oValue, eValue, inferredNO, inferredNE, deltaN, thickness, retardanceWaves, uncertainty, mismatch };
  }, [oStats, eStats, goal, epsilonO, epsilonE, angle, knownThickness, knownUncertainty, birefringent, referenceWavelength]);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = text.split(/\r?\n/).map((line) => line.trim().split(/[\s,;\t]+/).slice(0, 2).map(Number)).filter((row) => row.length === 2 && row.every(Number.isFinite)).sort((a, b) => a[0] - b[0]);
    const peaks = detectPeaks(rows);
    if (peaks.length < 2) {
      setStatus("Could not detect enough peaks — try manual entry");
      return;
    }
    const value = peaks.map((peak) => peak.toFixed(3)).join(", ");
    if (uploadFamily === "ordinary") setOrdinaryRaw(value); else setExtraordinaryRaw(value);
    setStatus(`${peaks.length} ${uploadFamily === "ordinary" ? "ordinary" : "extraordinary"} peaks detected from ${file.name}`);
  }

  function exportResults() {
    const rows = [
      ["Fabry-Perot fringe analysis", "value", "unit"],
      ["mode", birefringent ? "birefringent" : "isotropic", ""],
      ["ordinary spacing", fmt(oStats?.mean, 5), "cm^-1"],
      ["extraordinary spacing", birefringent ? fmt(eStats?.mean, 5) : "", "cm^-1"],
      [goal === "thickness" ? "ordinary thickness" : "ordinary relative permittivity", fmt(results.oValue, 6), goal === "thickness" ? "um" : ""],
      [goal === "thickness" ? "extraordinary thickness" : "extraordinary relative permittivity", birefringent ? fmt(results.eValue, 6) : "", goal === "thickness" ? "um" : ""],
      ["birefringence", birefringent ? fmt(results.deltaN, 6) : "", ""],
      ["retardance", birefringent ? fmt(results.retardanceWaves, 6) : "", "waves"],
    ];
    const blob = new Blob([rows.map((row) => row.join(",")).join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "fabry-perot-analysis.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const oLabel = goal === "thickness" ? "O THICKNESS" : "ORDINARY PERMITTIVITY  εₒ";
  const eLabel = goal === "thickness" ? "E THICKNESS" : "EXTRAORDINARY PERMITTIVITY  εₑ";
  const resultUnit = goal === "thickness" ? " µm" : "";

  return (
    <main>
      <header className="masthead"><span>FRINGE / 01</span><span className="crosshair">⊕</span><span>FP ANALYZER v1.0</span></header>

      <section className="hero">
        <div><h1>FABRY–PÉROT<br />FRINGE ANALYZER</h1><p>Turn spectral fringes into film thickness and birefringence.</p></div>
        <div className="upload-panel">
          <input ref={fileRef} type="file" accept=".csv,.txt,.dat" onChange={handleFile} hidden />
          <button className="upload" onClick={() => fileRef.current?.click()}><span className="upload-icon">↑</span><span><b>UPLOAD SPECTRUM</b><small>CSV, TXT · TWO COLUMNS</small></span></button>
          <label>IMPORT AS<select value={uploadFamily} onChange={(e) => setUploadFamily(e.target.value as Family)} disabled={!birefringent}><option value="ordinary">ordinary family</option><option value="extraordinary">extraordinary family</option></select></label>
        </div>
        <div className="manual-callout"><span className="keycap">⌨</span><a href="#inputs">ENTER PEAKS MANUALLY</a></div>
      </section>

      <section className="modebar">
        <div className="segmented" aria-label="Optical model">
          <button className={!birefringent ? "active" : ""} onClick={() => setBirefringent(false)}>ISOTROPIC</button>
          <button className={birefringent ? "active" : ""} onClick={() => setBirefringent(true)}>BIREFRINGENT</button>
        </div>
        <span className="status">● {status}</span>
        <button className="demo" onClick={() => { setOrdinaryRaw(DEMO_O.join(", ")); setExtraordinaryRaw(DEMO_E.join(", ")); setStatus("Demo fringe families restored"); }}>RESET DEMO</button>
      </section>

      <section className="workspace">
        <div className="visual-column">
          <SpectrumPlot ordinary={ordinary} extraordinary={extraordinary} birefringent={birefringent} />
          <div className="plot-foot"><span>{ordinary.length} O PEAKS {birefringent ? `· ${extraordinary.length} E PEAKS` : ""}</span><span>ANGLE: {angle.toFixed(1)}° · POLARIZATION: {axisAngle.toFixed(0)}°</span></div>
        </div>

        <aside className="results" aria-live="polite">
          <Result label={oLabel} value={`${fmt(results.oValue, goal === "thickness" ? 2 : 3)}${resultUnit}`} accent="red" sub={oStats ? `Δσ ${fmt(oStats.mean, 2)} ± ${fmt(oStats.sem, 2)} cm⁻¹` : "Need ≥2 peaks"} />
          {birefringent && <Result label={eLabel} value={`${fmt(results.eValue, goal === "thickness" ? 2 : 3)}${resultUnit}`} accent="blue" sub={eStats ? `Δσ ${fmt(eStats.mean, 2)} ± ${fmt(eStats.sem, 2)} cm⁻¹` : "Need ≥2 peaks"} />}
          <Result label="BIREFRINGENCE  Δn" value={birefringent ? fmt(results.deltaN, 4) : "—"} sub={birefringent ? `${fmt(results.retardanceWaves, 2)} waves at ${referenceWavelength} nm` : "Enable birefringent mode"} />
          <Result label={goal === "thickness" ? "CONSISTENCY" : "ANISOTROPY CONTRAST"} value={results.mismatch == null ? "—" : `${fmt(results.mismatch, 2)}%`} sub={results.mismatch == null ? `Estimated uncertainty ${fmt(results.uncertainty, 3)}` : goal === "thickness" ? "O/E thickness mismatch" : "(εₑ − εₒ) / mean ε"} />
          <button className="export" onClick={exportResults}>⇩&nbsp;&nbsp; EXPORT RESULTS <span>→</span></button>
        </aside>
      </section>

      <section className="controls" id="inputs">
        <div className="control-title"><span>ANALYSIS INPUTS</span><span>Assumes adjacent extrema and negligible index dispersion over each selected range.</span></div>
        <div className="control-grid">
          <Field label="SOLVE FOR"><select value={goal} onChange={(e) => setGoal(e.target.value as Goal)}><option value="thickness">film thickness</option><option value="permittivity">relative permittivity</option></select></Field>
          <Field label="SPECTRAL UNIT"><select value={unit} onChange={(e) => setUnit(e.target.value as SpectralUnit)}><option value="cm-1">wavenumber (cm⁻¹)</option><option value="nm">wavelength (nm)</option></select></Field>
          <Field label="INCIDENCE ANGLE"><input type="number" min="0" max="85" step="0.1" value={angle} onChange={(e) => setAngle(Number(e.target.value))} /><em>deg</em></Field>
          {goal === "permittivity" && <Field label="KNOWN THICKNESS"><input type="number" min="0.001" step="0.01" value={knownThickness} onChange={(e) => setKnownThickness(Number(e.target.value))} /><em>µm</em></Field>}
          {goal === "thickness" && <Field label={birefringent ? "ORDINARY PERMITTIVITY  εₒ" : "RELATIVE PERMITTIVITY  εᵣ"}><input type="number" min="1.001" step="0.01" value={epsilonO} onChange={(e) => setEpsilonO(Number(e.target.value))} /></Field>}
          {goal === "thickness" && birefringent && <Field label="EXTRAORDINARY PERMITTIVITY  εₑ"><input type="number" min="1.001" step="0.01" value={epsilonE} onChange={(e) => setEpsilonE(Number(e.target.value))} /></Field>}
          <Field label={`KNOWN-VALUE UNCERTAINTY`}><input type="number" min="0" step="0.001" value={knownUncertainty} onChange={(e) => setKnownUncertainty(Number(e.target.value))} /></Field>
          {birefringent && <Field label="POLARIZATION / OPTIC AXIS"><input type="range" min="0" max="90" value={axisAngle} onChange={(e) => setAxisAngle(Number(e.target.value))} /><em>{axisAngle}°</em></Field>}
          {birefringent && <Field label="RETARDANCE WAVELENGTH"><input type="number" min="1" value={referenceWavelength} onChange={(e) => setReferenceWavelength(Number(e.target.value))} /><em>nm</em></Field>}
        </div>
        <div className="peak-entry">
          <label><span><i className="dot red" /> ORDINARY PEAK POSITIONS</span><textarea value={ordinaryRaw} onChange={(e) => setOrdinaryRaw(e.target.value)} /></label>
          {birefringent && <label><span><i className="dot blue" /> EXTRAORDINARY PEAK POSITIONS</span><textarea value={extraordinaryRaw} onChange={(e) => setExtraordinaryRaw(e.target.value)} /></label>}
        </div>
        <p className="method-note"><b>MODEL NOTE —</b> At oblique incidence the calculator applies Snell’s law separately to each principal phase index, using n = √εᵣ. In birefringent mode, O and E fringe families must be identified independently; polarization angle reports expected intensity weights Iₒ ∝ sin²φ and Iₑ ∝ cos²φ, not a full Berreman simulation. Fringe spacing alone estimates real εᵣ under low-loss, weak-dispersion assumptions; complex ε requires additional intensity or phase data.</p>
      </section>

      <footer><span>CLIENT-SIDE · NO DATA UPLOADED TO A SERVER</span><span>FABRY–PÉROT CONDITION: 2n d cos θₜ = mλ</span></footer>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span><div>{children}</div></label>;
}

function Result({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: "red" | "blue" }) {
  return <div className={`result ${accent ?? ""}`}><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>;
}
