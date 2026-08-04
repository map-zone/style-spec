// Generate a full style-spec reference page (docs.mapbox.com/style-spec/reference style)
// from the machine-readable spec the fork actually validates against, overlaid with the
// MapZone fork's metadata-contract extensions and intentionally-unsupported notes.
const fs = require('fs');
const path = require('path');
const SPEC = require('d:/RepoVietmap/gg-antigravity/3d-lanes-tilemap/references/maplibre/node_modules/@maplibre/maplibre-gl-style-spec/dist/latest.json');
const OUT = path.join(__dirname, 'style-spec-reference.html');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// markdown-lite: `code`, [text](url) -> text, preserve paragraphs
const md = (s) => esc(s || '')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  .replace(/`([^`]+)`/g, '<code>$1</code>');

// sdk-support -> 3-platform chip row. Android/iOS come from maplibre-native — the
// MapZone SDKs are built from that exact core (13.3.1), so upstream support == ours
// for everything outside the MapZone-extensions section.
function supportRow(sup) {
  if (!sup) return '';
  const basic = sup['basic functionality'] || {};
  const ddrv = sup['data-driven styling'];
  const cell = (k, label) => basic[k] !== undefined
    ? `<span class="plat ok" title="từ phiên bản ${esc(String(basic[k]))}">${label} ✓</span>`
    : `<span class="plat no">${label} ✗</span>`;
  let extra = '';
  if (ddrv) {
    const miss = ['js', 'android', 'ios'].filter(k => ddrv[k] === undefined);
    extra = miss.length === 0 ? '<span class="plat dd">data-driven ✓</span>'
      : miss.length === 3 ? '<span class="plat no">data-driven ✗</span>'
      : `<span class="plat dd">data-driven: ${['js','android','ios'].filter(k=>ddrv[k]!==undefined).map(k=>({js:'Web',android:'And',ios:'iOS'}[k])).join('/')}</span>`;
  }
  return `<div class="support">${cell('js', 'Web')}${cell('android', 'Android')}${cell('ios', 'iOS')}${extra}</div>`;
}

const dd = (pt) => ({
  'data-driven': ['data-driven', 'theo từng feature (tốn buffer per-vertex)'],
  'cross-faded': ['cross-faded', 'crossfade giữa 2 mức zoom (pattern/dash)'],
  'cross-faded-data-driven': ['cross-faded · data-driven', ''],
  'color-ramp': ['color-ramp', 'ramp màu (heatmap)'],
  'data-constant': ['data-constant', 'đổi theo zoom, không theo feature'],
  'constant': ['constant', 'hằng số'],
}[pt] || null);

function propCard(sectionId, name, p) {
  if (name.startsWith('*')) return '';
  const id = `${sectionId}-${name}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  const chips = [];
  if (p.type) chips.push(`<span class="chip t">${esc(Array.isArray(p.type) ? p.type.join('|') : p.type)}</span>`);
  if (p.required) chips.push('<span class="chip req">bắt buộc</span>');
  if (p.default !== undefined) chips.push(`<span class="chip">mặc định <code>${esc(JSON.stringify(p.default))}</code></span>`);
  if (p.units) chips.push(`<span class="chip">${esc(p.units)}</span>`);
  if (p.minimum !== undefined || p.maximum !== undefined)
    chips.push(`<span class="chip">${p.minimum !== undefined ? '≥ ' + p.minimum : ''}${p.minimum !== undefined && p.maximum !== undefined ? ' · ' : ''}${p.maximum !== undefined ? '≤ ' + p.maximum : ''}</span>`);
  const pt = dd(p['property-type']);
  if (pt) chips.push(`<span class="chip pt" title="${esc(pt[1])}">${esc(pt[0])}</span>`);
  if (p.expression && p.expression.parameters && p.expression.parameters.includes('zoom'))
    chips.push('<span class="chip">zoom-expr</span>');
  if (p.transition) chips.push('<span class="chip">transition</span>');

  let values = '';
  if (p.values && !Array.isArray(p.values) && typeof p.values === 'object') {
    const rows = Object.entries(p.values).map(([v, meta]) =>
      `<tr><td><code>${esc(v)}</code>${p.default === v ? ' <span class="def">mặc định</span>' : ''}</td><td>${md(meta && meta.doc)}</td></tr>`).join('');
    if (rows) values = `<table class="vals">${rows}</table>`;
  }
  let requires = '';
  if (p.requires) {
    const reqs = p.requires.map(r => typeof r === 'string' ? `<code>${esc(r)}</code>` : `<code>${esc(JSON.stringify(r))}</code>`).join(', ');
    requires = `<p class="req-note">Yêu cầu: ${reqs}</p>`;
  }
  return `<article class="prop" id="${id}" data-name="${esc(name.toLowerCase())}">
    <h4><a href="#${id}">${esc(name)}</a></h4>
    <div class="chips">${chips.join('')}</div>
    ${supportRow(p['sdk-support'])}
    <p class="doc">${md(p.doc)}</p>${values}${requires}
  </article>`;
}

function section(id, title, intro, props, extraHtml = '') {
  const cards = Object.entries(props || {}).map(([n, p]) => propCard(id, n, p)).join('');
  const count = Object.keys(props || {}).filter(k => !k.startsWith('*')).length;
  return { id, title, count, html: `<section id="${id}">
    <h2>${esc(title)} <span class="cnt">${count}</span></h2>
    ${intro ? `<p class="intro">${intro}</p>` : ''}${extraHtml}${cards}
  </section>` };
}

const sections = [];

// ---- Root
sections.push(section('root', 'Root — cấp cao nhất', 'Các field ngay dưới <code>{}</code> của style.json.', SPEC.$root));

// ---- Sources
const srcTypes = [['source_vector','vector'],['source_raster','raster'],['source_raster_dem','raster-dem'],['source_geojson','geojson'],['source_video','video'],['source_image','image']];
for (const [key, label] of srcTypes) {
  sections.push(section(key, `Source · ${label}`, null, SPEC[key]));
}

// ---- Layer common
sections.push(section('layer', 'Layer — field chung mọi layer', 'Bộ khung của một layer bất kỳ (id/type/source/filter/zoom); phần vẽ nằm ở layout_* và paint_* theo type bên dưới.', SPEC.layer));

// fork notes injected per layer type
const forkNotes = {
  'fill-extrusion': 'Fork mở rộng qua <b>metadata</b> (không phải paint — <code>setPaintProperty</code> sẽ throw): <code>maplibre:fill-extrusion-line-width</code> (tường ribbon), <code>maplibre:fill-extrusion-emissive-strength</code>, <code>maplibre:fill-extrusion-cast-shadows</code>. Xem mục MapZone extensions.',
  'symbol': 'Fork mở rộng qua metadata: <code>maplibre:text/icon-occlusion-opacity</code>, <code>maplibre:symbol-z-offset</code>, bộ <code>maplibre:icon-param-*</code> (two-tone POI). Xem mục MapZone extensions.',
  'fill': 'Fork: <code>maplibre:fill-emissive-strength</code>, <code>maplibre:fill-elevation-reference</code> (HD roads), <code>maplibre:elevated-structures</code> + bộ <code>bridge-*</code>.',
  'line': 'Fork: <code>maplibre:line-emissive-strength</code>, <code>maplibre:line-elevation-reference</code>, <code>maplibre:line-width-unit</code> (mét).',
};

// ---- Layers per type
const layerTypes = ['background','fill','line','symbol','circle','fill-extrusion','heatmap','raster','hillshade','color-relief'];
for (const t of layerTypes) {
  const lay = SPEC[`layout_${t}`] || {};
  const pai = SPEC[`paint_${t}`] || {};
  const note = forkNotes[t] ? `<div class="forknote">${forkNotes[t]}</div>` : '';
  const s1 = section(`layout_${t}`, `${t} · layout`, null, lay, note);
  const s2 = section(`paint_${t}`, `${t} · paint`, null, pai);
  sections.push({ id: `type_${t}`, title: `Layer · ${t}`, count: s1.count + s2.count,
    html: `<section id="type_${t}"><h1 class="typehead">${esc(t)}</h1></section>` + s1.html + s2.html });
}

// ---- Models 3D (fork port của Mapbox v3 — không có trong spec v8, liệt kê từ code thật:
// web model_style_layer_properties.g.ts = 15 props; native model_layer_properties.cpp = 9)
const MODEL_PROPS = [
  ['model-id', 'layout · data-driven. Tên model: trỏ vào root <code>models</code> (id → URL glTF) hoặc lấy từ trường model của feature trong vector tile (cây của Standard). Bắt buộc.', [1,1,1]],
  ['model-opacity', 'Độ mờ toàn model (có transition).', [1,1,1]],
  ['model-color', 'Màu nhuộm (tint) trộn vào vật liệu gốc của glTF.', [1,1,1]],
  ['model-color-mix-intensity', '0 → giữ nguyên texture gốc, 1 → nhuộm hoàn toàn bằng model-color. Standard dùng đổi màu cây theo mùa/preset.', [1,1,1]],
  ['model-scale', '[x,y,z] hệ số phóng.', [1,1,1]],
  ['model-rotation', '[x,y,z] độ xoay quanh từng trục.', [1,1,1]],
  ['model-translation', '[x,y,z] mét dịch chuyển.', [1,1,1]],
  ['model-emissive-strength', 'Tự phát sáng — Standard tăng ban đêm (cửa sổ landmark).', [1,1,1]],
  ['model-ambient-occlusion-intensity', 'Cường độ AO bake trong glTF.', [1,1,1]],
  ['model-cast-shadows', 'Model đổ bóng xuống đất/nhà (shadow pipeline).', [1,0,0]],
  ['model-receive-shadows', 'Model nhận bóng từ vật khác.', [1,0,0]],
  ['model-roughness', 'Override roughness của vật liệu PBR.', [1,0,0]],
  ['model-cutoff-fade-range', 'Fade model ở rìa vùng nhìn (giảm pop-in).', [1,0,0]],
  ['model-height-based-emissive-strength-multiplier', 'Emissive tăng theo chiều cao (tầng cao sáng hơn về đêm).', [1,0,0]],
  ['model-elevation-reference', 'Neo model theo mặt đất hay mặt đường trên cao (HD).', [1,0,0]],
];
let modelHtml = `<section id="models3d"><h2>Models 3D — <code>model</code> / <code>batched-model</code> <span class="cnt">${MODEL_PROPS.length}</span></h2>
<p class="intro">Port từ Mapbox v3 — <b>không có trong spec v8 upstream</b>; danh sách dưới đây liệt kê từ code fork (web <code>model_style_layer_properties.g.ts</code>, native <code>model_layer_properties.cpp</code>). Đã device-verified cả 3 nền tảng với full Mapbox Standard 3D (buildings + trees + Eiffel/landmark, TestFlight 1.0(10) + emulator Vulkan).</p>
<div class="forknote">Model đến từ <b>hai đường dữ liệu</b>: ① root <code>models</code> (32 URL glTF <code>mapbox://models/…</code>) + feature trong vector tile mang tham chiếu model → <b>GPU-instanced</b> (cây — 1 draw/mesh, commit <code>ef456ff</code>); ② source <code>batched-model</code> (tileset <code>mapbox-3dbuildings-v1</code>, nén <b>Draco</b> — vendor <code>google/draco 1.5.7</code> tại <code>vendor/draco</code>, KHÔNG có sẵn trong repo). <b>Bẫy native:</b> ModelLayerFactory phải đăng ký ở CẢ BA layer-manager (default + darwin <code>MLNStyleLayerManager.mm</code> + android <code>layer_manager.cpp</code>) — thiếu là "Null factory for type: model" và layer bị drop im lặng; SDK iOS build <code>-fno-rtti</code> nên code model không dùng dynamic_cast.</div>`;
for (const [k, doc, sup] of MODEL_PROPS) {
  const id = 'model3d-' + k.replace(/[^a-zA-Z0-9_-]/g, '_');
  modelHtml += `<article class="prop mz" id="${id}" data-name="${esc(k.toLowerCase())}">
    <h4><a href="#${id}"><code class="exprname">${esc(k)}</code></a></h4>${mzSupport(sup)}<p class="doc">${doc}</p></article>`;
}
modelHtml += `<h3 class="exprgroup">Source · batched-model</h3>
<article class="prop mz" id="model3d-src" data-name="batched-model source">
<h4><a href="#model3d-src"><code class="exprname">{"type":"batched-model","url":"mapbox://mapbox.mapbox-3dbuildings-v1"}</code></a></h4>${mzSupport([1,1,1])}
<p class="doc">Tileset mesh 3D building nén Draco. Fork kèm <b>landmark conflation</b>: khi style có batched-model, fill-extrusion cùng footprint bị ép height 0 để không vẽ chồng khối lên landmark. Web: <code>batched_model_source.ts</code> · native: <code>SourceType::BatchedModel</code>.</p></article></section>`;
sections.push({ id: 'models3d', title: '★ Models 3D', count: MODEL_PROPS.length + 1, html: modelHtml });

// ---- Expressions grouped
const groups = {};
for (const [name, meta] of Object.entries(SPEC.expression_name.values)) {
  (groups[meta.group || 'Khác'] ||= []).push([name, meta]);
}
let exprHtml = `<section id="expressions"><h2>Expressions <span class="cnt">${Object.keys(SPEC.expression_name.values).length}</span></h2>
<p class="intro">Ngôn ngữ hàm dạng mảng JSON: <code>["tên-hàm", tham_số...]</code>. Nhóm theo phân loại của spec.</p>`;
for (const [g, items] of Object.entries(groups)) {
  exprHtml += `<h3 class="exprgroup">${esc(g)}</h3>`;
  for (const [name, meta] of items.sort((a, b) => a[0].localeCompare(b[0]))) {
    const id = 'expr-' + name.replace(/[^a-zA-Z0-9_-]/g, '_');
    exprHtml += `<article class="prop" id="${id}" data-name="${esc(name.toLowerCase())}">
      <h4><a href="#${id}"><code class="exprname">${esc(name)}</code></a></h4>
      ${supportRow(meta['sdk-support'])}
      <p class="doc">${md(meta.doc)}</p></article>`;
  }
}
exprHtml += '</section>';
sections.push({ id: 'expressions', title: 'Expressions', count: Object.keys(SPEC.expression_name.values).length, html: exprHtml });

// ---- Light / Sky / Terrain / Projection / Transition
sections.push(section('light', 'Light', 'Nguồn sáng legacy (fork convert lights v3 của Mapbox về đây + metadata <code>maplibre:mapbox-standard-lights</code>).', SPEC.light));
sections.push(section('sky', 'Sky', null, SPEC.sky));
sections.push(section('terrain', 'Terrain', null, SPEC.terrain));
sections.push(section('projection', 'Projection', null, SPEC.projection));
sections.push(section('transition', 'Transition', null, SPEC.transition));

// ---- MapZone extensions (the fork contract)
// [key, doc, [web, android, ios]] — android/ios là core maplibre-native chung nên hầu như
// đi cặp; nguồn: STYLE-SPEC-SURFACE.md §3 @ web 1cd52e0 / native f6a5b8b.
const EXT = [
  ['HD roads / cầu vượt', [
    ['maplibre:fill-elevation-reference', 'Gate đưa feature của layer fill vào elevated stream (hd-road).', [1,1,1]],
    ['maplibre:line-elevation-reference', 'Như trên cho line.', [1,1,1]],
    ['maplibre:circle-elevation-reference / maplibre:symbol-elevation-reference', 'Như trên cho circle/symbol.', [1,0,0]],
    ['maplibre:elevated-structures', 'Layer sinh parapet/deck cầu.', [1,1,1]],
    ['maplibre:bridge-structure-width-meters · -surface · maplibre:bridge-guard-rail-enabled', 'Thông số mesh cầu; guard-rail expr eval tại bucket zoom.', [1,1,1]],
    ['maplibre:line-width-unit', '"meters" → line-width theo mét thực.', [1,1,1]],
  ]],
  ['Indoor / fill-extrusion', [
    ['maplibre:fill-extrusion-line-width', 'Tường RIBBON: extrude chỉ đường bao dày W mét (winding-normalized, outset 4cm).', [1,0,0]],
    ['maplibre:fill-extrusion-emissive-strength', 'Lerp màu lit → màu phẳng (uniform u_emissive_strength; hằng số/zoom-expr).', [1,0,0]],
    ['maplibre:fill-extrusion-cast-shadows', 'false = loại khỏi shadow-caster pass (Standard flag false cho mọi layer indoor).', [1,0,0]],
    ['maplibre:fill-extrusion-line-skip-shared', 'Gate skip cạnh seam (hiện false — Mapbox vẽ tường mọi cạnh).', [1,0,0]],
    ['maplibre:fill-emissive-strength · maplibre:line-emissive-strength', 'Emissive cho fill/line (draw đọc mỗi frame).', [1,0,0]],
  ]],
  ['Symbol / icon / camera', [
    ['maplibre:text-occlusion-opacity · maplibre:icon-occlusion-opacity', 'Depth-occlusion cho label (0/0.1).', [1,0,0]],
    ['maplibre:symbol-z-offset', 'Label nâng theo cầu.', [1,0,0]],
    ['maplibre:icon-tint-enabled · maplibre:icon-param-icon · maplibre:icon-param-icon-stroke', 'Two-tone POI remap — scheme NEUTRAL native-parity (#a7a7a7): native vốn render neutral nên hành vi trùng.', [1,1,1]],
    ['maplibre:distance-from-center-filter + global-state maplibre:camera-pitch / maplibre:distance-from-center', 'Filter camera của Mapbox → global-state cập nhật mỗi frame.', [1,0,0]],
  ]],
  ['Root / khác', [
    ['maplibre:mapbox-standard-lights (root metadata)', 'Lights v3 đã resolve config — native parse thành standard-lights.', [1,1,1]],
    ['maplibre:camera-projection = "orthographic"', 'Từ section camera của Mapbox.', [1,0,0]],
  ]],
];
function mzSupport([w, a, i]) {
  return `<div class="support">` +
    `<span class="plat ${w ? 'ok' : 'no'}">Web ${w ? '✓' : '✗'}</span>` +
    `<span class="plat ${a ? 'ok' : 'no'}">Android ${a ? '✓' : '✗'}</span>` +
    `<span class="plat ${i ? 'ok' : 'no'}">iOS ${i ? '✓' : '✗'}</span></div>`;
}
let extHtml = `<section id="mapzone"><h2>MapZone extensions — hợp đồng <code>maplibre:*</code> <span class="cnt">26</span></h2>
<p class="intro">Prop Mapbox v3 ngoài spec v8 được normalize (<code>mapbox_standard_compat.ts</code>) preserve vào <code>metadata</code> của layer. <b>Bẫy:</b> chúng KHÔNG phải paint prop — <code>setPaintProperty</code> sẽ throw; runtime mutate <code>layer.metadata</code> + <code>triggerRepaint()</code>. Nguồn sự thật: <code>references/maplibre-native/STYLE-SPEC-SURFACE.md</code>.</p>`;
for (const [g, items] of EXT) {
  extHtml += `<h3 class="exprgroup">${esc(g)}</h3>`;
  for (const [k, doc, sup] of items) {
    const id = 'mz-' + k.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
    extHtml += `<article class="prop mz" id="${id}" data-name="${esc(k.toLowerCase())}">
      <h4><a href="#${id}"><code class="exprname">${esc(k)}</code></a></h4>${mzSupport(sup)}<p class="doc">${doc}</p></article>`;
  }
}
extHtml += `<h3 class="exprgroup">Cố ý KHÔNG hỗ trợ (đừng tìm trong fork)</h3>
<p class="doc" style="max-width:72ch">Layer <code>clip</code>/<code>building</code>/<code>slot</code>; source <code>raster-array</code>; <code>fog</code>, <code>color-theme</code>, <code>featuresets</code>, <code>iconsets</code>; paint: <code>fill-extrusion-ambient-occlusion-*</code>, <code>flood-light-*</code>, <code>edge-radius</code> (thay bằng outset 4cm), <code>vertical-scale</code>, <code>cutoff-fade-range</code>, <code>icon-image-cross-fade</code>, <code>icon-size-scale-range</code>, <code>symbol-z-elevate</code>. Expression <code>random</code> chưa verify.</p></section>`;
sections.push({ id: 'mapzone', title: '★ MapZone extensions', count: 26, html: extHtml });

// ---- assemble page
const nav = sections.map(s => `<a href="#${s.id.startsWith('type_') ? s.id : s.id}" data-nav>${esc(s.title)} <em>${s.count}</em></a>`).join('');

const html = `<title>Style Spec Reference — MapZone</title>
<style>
:root {
  --paper:#fafbfc; --card:#fff; --ink:#1c2733; --muted:#5b6b7c; --line:#dde4ec;
  --accent:#2563c9; --accent-soft:#e8effc; --teal:#0e8a7d; --teal-soft:#e3f2f0;
  --amber:#b7791f; --amber-soft:#faf1de; --code-bg:#f1f5f9;
}
@media (prefers-color-scheme: dark) { :root {
  --paper:#10161d; --card:#171f28; --ink:#dfe7ef; --muted:#93a3b4; --line:#2a3644;
  --accent:#6ea3f5; --accent-soft:#1b2c47; --teal:#4cc4b4; --teal-soft:#123531;
  --amber:#e0b463; --amber-soft:#3a2f16; --code-bg:#1d2733; } }
:root[data-theme="dark"] {
  --paper:#10161d; --card:#171f28; --ink:#dfe7ef; --muted:#93a3b4; --line:#2a3644;
  --accent:#6ea3f5; --accent-soft:#1b2c47; --teal:#4cc4b4; --teal-soft:#123531;
  --amber:#e0b463; --amber-soft:#3a2f16; --code-bg:#1d2733; }
:root[data-theme="light"] {
  --paper:#fafbfc; --card:#fff; --ink:#1c2733; --muted:#5b6b7c; --line:#dde4ec;
  --accent:#2563c9; --accent-soft:#e8effc; --teal:#0e8a7d; --teal-soft:#e3f2f0;
  --amber:#b7791f; --amber-soft:#faf1de; --code-bg:#f1f5f9; }
* { box-sizing:border-box; }
body { margin:0; background:var(--paper); color:var(--ink);
  font:15px/1.6 "Segoe UI Variable Text","Segoe UI",ui-sans-serif,system-ui,sans-serif; }
.wrap { display:grid; grid-template-columns:270px 1fr; max-width:1280px; margin:0 auto; gap:0 36px; padding:0 18px; }
nav { position:sticky; top:0; align-self:start; height:100vh; overflow-y:auto; padding:22px 8px 40px 0;
  border-right:1px solid var(--line); font-size:13px; }
nav .brand { font-weight:700; font-size:15px; margin:0 0 4px; }
nav .sub { color:var(--muted); font-size:11.5px; margin:0 0 14px; }
nav a { display:flex; justify-content:space-between; gap:8px; color:var(--ink); text-decoration:none;
  padding:4px 10px; border-radius:6px; }
nav a em { color:var(--muted); font-style:normal; font-variant-numeric:tabular-nums; }
nav a:hover { background:var(--accent-soft); }
#q { width:100%; margin:0 0 12px; padding:7px 10px; border:1px solid var(--line); border-radius:8px;
  background:var(--card); color:var(--ink); font:inherit; }
main { padding:26px 0 120px; min-width:0; }
h1.typehead { font-size:26px; margin:64px 0 0; padding-top:18px; border-top:2px solid var(--ink); letter-spacing:-.01em; }
section > h2 { font-size:20px; margin:46px 0 6px; font-weight:650; }
.cnt { font-size:12px; color:var(--muted); font-weight:600; background:var(--code-bg);
  border-radius:99px; padding:2px 9px; vertical-align:2px; }
.intro { color:var(--muted); max-width:72ch; margin:4px 0 14px; }
.forknote { border-left:3px solid var(--teal); background:var(--teal-soft); padding:10px 14px;
  border-radius:0 8px 8px 0; margin:12px 0 16px; max-width:72ch; font-size:14px; }
.prop { background:var(--card); border:1px solid var(--line); border-radius:10px;
  padding:14px 18px 12px; margin:10px 0; }
.prop.mz { border-left:3px solid var(--teal); }
.prop h4 { margin:0 0 6px; font-size:15.5px; font-family:ui-monospace,Consolas,monospace; }
.prop h4 a { color:var(--accent); text-decoration:none; }
.prop h4 a:hover { text-decoration:underline; }
.exprname { background:none; padding:0; }
.chips { display:flex; flex-wrap:wrap; gap:6px; margin:0 0 8px; }
.chip { font-size:11.5px; background:var(--code-bg); border-radius:99px; padding:2px 9px; color:var(--muted); }
.chip.t { background:var(--accent-soft); color:var(--accent); font-weight:600; }
.chip.pt { background:var(--amber-soft); color:var(--amber); font-weight:600; }
.chip.req { background:var(--amber-soft); color:var(--amber); font-weight:700; }
.support { display:flex; flex-wrap:wrap; gap:6px; margin:0 0 8px; }
.plat { font-size:11.5px; font-weight:650; border-radius:5px; padding:2px 8px; }
.plat.ok { background:var(--teal-soft); color:var(--teal); }
.plat.no { background:var(--code-bg); color:var(--muted); text-decoration:line-through; }
.plat.dd { background:var(--amber-soft); color:var(--amber); }
.doc { margin:0; max-width:76ch; color:var(--ink); }
.doc code, .chip code { font-family:ui-monospace,Consolas,monospace; font-size:.9em;
  background:var(--code-bg); border-radius:4px; padding:0 4px; }
table.vals { border-collapse:collapse; margin:10px 0 2px; font-size:13.5px; width:100%; }
table.vals td { border-top:1px solid var(--line); padding:6px 10px 6px 0; vertical-align:top; }
table.vals td:first-child { white-space:nowrap; padding-right:16px; }
.def { font-size:11px; color:var(--teal); font-weight:700; }
.req-note { font-size:13px; color:var(--muted); margin:8px 0 0; }
h3.exprgroup { font-size:13px; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); margin:26px 0 4px; }
footer { grid-column:1/-1; padding:20px 18px 60px; color:var(--muted); font-size:12.5px; border-top:1px solid var(--line); }
@media (max-width: 860px) { .wrap { grid-template-columns:1fr; } nav { position:static; height:auto; border-right:0; border-bottom:1px solid var(--line);} }
</style>
<div class="wrap">
<nav>
  <p class="brand">Style Spec Reference</p>
  <p class="sub">spec v8 (MapLibre) + hợp đồng MapZone · sinh tự động</p>
  <input id="q" type="search" placeholder="Lọc property… (vd line-width)">
  ${nav}
</nav>
<main>
  <p style="color:var(--muted);max-width:72ch">Tài liệu tra cứu đầy đủ kiểu <i>docs.mapbox.com/style-spec/reference</i>, sinh tự động từ <code>@maplibre/maplibre-gl-style-spec</code> (bản fork validate thật) — mô tả prop giữ nguyên tiếng Anh của spec; phần khung + hợp đồng MapZone bằng tiếng Việt. Gõ vào ô lọc để tìm prop bất kỳ.</p>
  <div class="forknote" style="border-left-color:var(--accent);background:var(--accent-soft)">
  <b>Hỗ trợ 3 nền tảng MapZone</b> — mỗi prop có hàng chip <span class="plat ok">Web ✓</span> <span class="plat ok">Android ✓</span> <span class="plat ok">iOS ✓</span>: cột Web = fork MapLibre GL JS; Android/iOS = core maplibre-native mà SDK <code>13.3.1-mapzone.1</code> build từ đó (hover chip để xem phiên bản upstream bắt đầu hỗ trợ). <span class="plat dd">data-driven ✓</span> = prop nhận expression theo feature. Riêng phần mở rộng của mình xem mục <a href="#mapzone">★ MapZone extensions</a> — trạng thái đo từ code fork, không phải upstream.</div>
  ${sections.map(s => s.html).join('\n')}
</main>
<footer>Sinh bởi <code>gen-spec-reference.cjs</code> từ spec ${esc(String(SPEC.$version))} · hợp đồng fork: <code>STYLE-SPEC-SURFACE.md</code> @ web <code>1cd52e0</code> / native <code>f6a5b8b</code> · 2026-07-08</footer>
</div>
<script>
const q = document.getElementById('q');
q.addEventListener('input', () => {
  const v = q.value.trim().toLowerCase();
  document.querySelectorAll('.prop').forEach(el => {
    el.style.display = !v || el.dataset.name.includes(v) ? '' : 'none';
  });
  document.querySelectorAll('main section').forEach(sec => {
    const any = !v || sec.querySelector('.prop:not([style*="none"])');
    sec.style.display = any ? '' : 'none';
  });
});
</script>`;

fs.writeFileSync(OUT, html);
console.log('written', OUT, (fs.statSync(OUT).size / 1024).toFixed(0) + 'KB');
console.log('sections:', sections.map(s => s.title + ':' + s.count).join(' | '));
