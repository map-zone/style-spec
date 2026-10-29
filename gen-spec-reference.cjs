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
  'fill-extrusion': 'Fork thêm <b>property thật, giữ nguyên tên Mapbox v3</b> (dùng được với <code>setPaintProperty</code>): <code>fill-extrusion-vertical-scale</code>, bộ <code>fill-extrusion-ambient-occlusion-*</code>; style có đèn v3 (ambient + directional) thì building được chiếu sáng và đổ bóng như Mapbox — xem mục <a href="#buildings3d">★ Building 3D</a>. Qua <b>metadata</b>: <code>maplibre:fill-extrusion-line-width</code> (tường ribbon), <code>maplibre:fill-extrusion-emissive-strength</code>, <code>maplibre:fill-extrusion-cast-shadows</code> — xem mục MapZone extensions.',
  'symbol': 'Fork mở rộng qua metadata: <code>maplibre:symbol-elevation-reference</code> + <code>maplibre:symbol-z-offset</code> (nhãn/icon nằm trên mặt đường HD, nâng theo cầu), <code>maplibre:text/icon-occlusion-opacity</code>, bộ <code>maplibre:icon-param-*</code> (two-tone POI). Xem mục MapZone extensions.',
  'fill': 'Fork: <code>maplibre:fill-emissive-strength</code>, <code>maplibre:fill-elevation-reference</code> (HD roads), <code>maplibre:elevated-structures</code> + bộ <code>bridge-*</code>.',
  'line': 'Fork: <code>maplibre:line-elevation-reference</code>, <code>maplibre:line-z-offset</code>, <code>maplibre:line-trim-offset</code>, <code>maplibre:line-occlusion-opacity</code>, <code>maplibre:line-width-unit</code> (mét), <code>line-width</code> theo <code>line-progress</code> — route/ribbon 3D theo làn, xem mục MapZone extensions.',
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
<p class="intro">Port từ Mapbox v3 — <b>không có trong spec v8 upstream</b>. Đã kiểm chứng trên cả 3 nền tảng với full Mapbox Standard 3D (buildings + cây + landmark).</p>
<div class="forknote">Model đến từ <b>hai đường dữ liệu</b>: ① root <code>models</code> (map id → URL glTF) + feature trong vector tile mang tham chiếu model → vẽ GPU-instanced (ví dụ cây); ② source <code>batched-model</code> (mesh 3D building nén <b>Draco</b>).</div>`;
for (const [k, doc, sup] of MODEL_PROPS) {
  const id = 'model3d-' + k.replace(/[^a-zA-Z0-9_-]/g, '_');
  modelHtml += `<article class="prop mz" id="${id}" data-name="${esc(k.toLowerCase())}">
    <h4><a href="#${id}"><code class="exprname">${esc(k)}</code></a></h4>${mzSupport(sup)}<p class="doc">${doc}</p></article>`;
}
modelHtml += `<h3 class="exprgroup">Source · batched-model</h3>
<article class="prop mz" id="model3d-src" data-name="batched-model source">
<h4><a href="#model3d-src"><code class="exprname">{"type":"batched-model","url":"mapbox://mapbox.mapbox-3dbuildings-v1"}</code></a></h4>${mzSupport([1,1,1])}
<p class="doc">Tileset mesh 3D building nén Draco. Khi style có batched-model, fill-extrusion cùng footprint được hạ height 0 để không vẽ chồng khối lên landmark.</p></article></section>`;
sections.push({ id: 'models3d', title: '★ Models 3D', count: MODEL_PROPS.length + 1, html: modelHtml });

// ---- Building 3D (fill-extrusion, Mapbox v3) — property THẬT giữ tên Mapbox (không phải metadata).
// [key, kiểu/mặc định, doc, [web, android, ios]]
const BUILDING_PROPS = [
  ['fill-extrusion-vertical-scale', 'paint · number · mặc định 1 · ≥ 0 · zoom-expr · transition',
    'Nhân chiều cao + base của building. Style VietMap dùng <code>interpolate</code> zoom 15 → 0, 15.3 → 1 để building "mọc lên" khi zoom vào.', [1,1,1]],
  ['fill-extrusion-ambient-occlusion-intensity', 'paint · number 0..1 · mặc định 0 · zoom-expr · transition',
    'Cường độ AO: tường tối dần về phía chân, tối thêm ở góc lõm. 0 = tắt.', [1,1,1]],
  ['fill-extrusion-ambient-occlusion-wall-radius', 'paint · number (m) · mặc định 3 · zoom-expr · transition',
    'Chiều cao (mét) vùng chân tường bị tối khi style có đèn v3.', [1,1,1]],
  ['fill-extrusion-ambient-occlusion-radius', 'paint · number (m) · mặc định 3 · zoom-expr · transition',
    'Như trên khi style KHÔNG có đèn v3 (đèn legacy).', [1,1,1]],
  ['fill-extrusion-ambient-occlusion-ground-radius', 'paint · number (m) · mặc định 3 · zoom-expr · transition',
    'Bán kính quầng tối mềm trên mặt đất quanh chân nhà (cần đèn v3). Style VietMap: <code>step</code> zoom → 0 dưới z17, 5 từ z17.', [1,1,1]],
  ['fill-extrusion-ambient-occlusion-ground-attenuation', 'paint · number 0..1 · mặc định 0.69 · zoom-expr · transition',
    'Độ tắt dần của quầng tối mặt đất theo khoảng cách tới tường.', [1,1,1]],
];
let bldHtml = `<section id="buildings3d"><h2>Building 3D — fill-extrusion kiểu Mapbox v3 <span class="cnt">${BUILDING_PROPS.length}</span></h2>
<p class="intro">Các key của Mapbox v3 dưới đây là <b>property thật</b> trong spec của fork, <b>giữ nguyên tên Mapbox</b>: viết thẳng trong <code>paint</code>, đổi lúc runtime bằng <code>setPaintProperty</code>. Style Mapbox v3 dùng các key này nạp thẳng vào MapZone SDK, không cần sửa. Kết quả render được đối chiếu pixel với Mapbox GL JS 3.21.</p>
<div class="forknote"><b>Đèn v3 cho building.</b> Khi root <code>lights</code> có cả <code>ambient</code> lẫn <code>directional</code>, fill-extrusion được chiếu sáng theo mô hình ánh sáng của Mapbox v3 (đúng cả các preset ngày/đêm qua <code>config</code>; đèn và preset đổi được lúc runtime — xem nhóm <b>Đèn v3 · thời gian thực</b> trong ★ MapZone extensions). Style không có cặp đèn này giữ cách tô cũ, không đổi gì.<br>
<b>Bóng đổ.</b> Khi đèn <code>directional</code> có <code>cast-shadows: true</code> (độ đậm theo <code>shadow-intensity</code>), building đổ bóng xuống mặt đất và lên tường building khác — cả building nằm ngoài màn hình theo hướng sáng. Đặt <code>maplibre:fill-extrusion-cast-shadows</code> = <code>false</code> trong metadata của layer để loại layer đó khỏi bóng đổ (web).<br>
Native: chỉ hỗ trợ trên Vulkan (Android) và Metal (iOS). Building dùng <code>fill-extrusion-pattern</code> chưa có AO và bóng trên native.</div>`;
for (const [k, kind, doc, sup] of BUILDING_PROPS) {
  const id = 'bld3d-' + k.replace(/[^a-zA-Z0-9_-]/g, '_');
  bldHtml += `<article class="prop mz" id="${id}" data-name="${esc(k.toLowerCase())}">
    <h4><a href="#${id}"><code class="exprname">${esc(k)}</code></a></h4><div class="chips"><span class="chip">${esc(kind)}</span><span class="chip new">mới 10/2026</span></div>${mzSupport(sup)}<p class="doc">${doc}</p></article>`;
}
bldHtml += '</section>';
sections.push({ id: 'buildings3d', title: '★ Building 3D', count: BUILDING_PROPS.length, html: bldHtml });

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
    ['maplibre:circle-elevation-reference', 'Như trên cho circle.', [1,0,0]],
    ['maplibre:elevated-structures', 'Layer sinh parapet/deck cầu.', [1,1,1]],
    ['maplibre:bridge-structure-width-meters · -surface · maplibre:bridge-guard-rail-enabled', 'Thông số mesh cầu; guard-rail expr eval tại bucket zoom.', [1,1,1]],
    ['maplibre:line-width-unit', '"meters" → line-width (và line-blur, pattern) theo mét thực.', [1,1,1]],
  ]],
  ['Route / ribbon 3D theo làn (line Mapbox v3)', [
    ['maplibre:line-elevation-reference = "ground" | "sea"', 'Line nổi trong không gian 3D theo <code>maplibre:line-z-offset</code> (thay vì dán trên mặt đất); <code>"hd-road-markup"</code> = bám mặt đường HD như vạch sơn.', [1,1,1]],
    ['maplibre:line-z-offset', 'Độ cao (mét) của line: số, hoặc expression theo <code>line-progress</code> / <code>at-interpolated</code> để cao độ thay đổi dọc tuyến (route lên/xuống cầu). Cần source GeoJSON <code>lineMetrics: true</code>.', [1,1,1]],
    ['line-width theo line-progress', 'Spec <code>line-width</code> nhận expression theo <code>["line-progress"]</code> → bề rộng thay đổi dọc tuyến (ribbon thu hẹp/mở rộng theo làn). Cần <code>lineMetrics: true</code>.', [1,1,1]],
    ['maplibre:line-trim-offset · maplibre:line-trim-color · maplibre:line-trim-fade-range', '<code>[start, end]</code> theo line-progress: đoạn trong khoảng được tô màu trim (mặc định trong suốt) — dùng để "ăn dần" đoạn route đã đi; đổi mỗi frame không cần setData.', [1,1,1]],
    ['maplibre:line-occlusion-opacity', '≠ 0: phần line bị building / cầu che vẫn hiện mờ với độ mờ này (route không biến mất sau cầu vượt).', [1,1,1]],
    ['maplibre:line-cross-slope', 'Hằng số; có giá trị thì join tròn ngắn được đổi thành miter như Mapbox.', [1,1,1]],
    ['expression at-interpolated', '<code>["at-interpolated", index, array]</code>: index nguyên → phần tử đó; index lẻ → nội suy tuyến tính giữa 2 phần tử kề. Dùng với mảng cao độ/bề rộng theo điểm gãy.', [1,1,1]],
    ['GeoJSON + hd_road_elevation', 'Feature GeoJSON có <code>3d_elevation_id</code> và <code>source: "elevation"</code> được tách sang layer ảo <code>hd_road_elevation</code> → line <code>hd-road-markup</code> từ GeoJSON cũng nâng theo cầu.', [1,1,1]],
  ]],
  ['Indoor / fill-extrusion', [
    ['maplibre:fill-extrusion-line-width', 'Tường RIBBON: extrude chỉ đường bao dày W mét (winding-normalized, outset 4cm).', [1,0,0]],
    ['maplibre:fill-extrusion-emissive-strength', 'Lerp màu lit → màu phẳng (uniform u_emissive_strength; hằng số/zoom-expr).', [1,0,0]],
    ['maplibre:fill-extrusion-cast-shadows', 'false = loại khỏi shadow-caster pass (Standard flag false cho mọi layer indoor).', [1,0,0]],
    ['maplibre:fill-extrusion-line-skip-shared', 'Gate skip cạnh seam (hiện false — Mapbox vẽ tường mọi cạnh).', [1,0,0]],
  ]],
  ['Symbol / icon / camera', [
    ['maplibre:text-occlusion-opacity · maplibre:icon-occlusion-opacity', 'Depth-occlusion cho label (0/0.1).', [1,0,0]],
    ['maplibre:symbol-elevation-reference = "hd-road-markup" | "ground" | "sea"', '<code>"hd-road-markup"</code>: nhãn/icon nằm trên mặt đường HD (mũi tên sơn, điểm nhấn route), nghiêng theo dốc, che bởi cầu; va chạm nhãn tính ở đúng độ cao đó. <code>"ground"</code>/<code>"sea"</code>: không nâng.', [1,1,1]],
    ['maplibre:symbol-z-offset', 'Nâng nhãn/icon lên một độ cao (mét; số hoặc expression theo feature) — va chạm nhãn tính ở độ cao đó.', [1,1,1]],
    ['maplibre:icon-tint-enabled · maplibre:icon-param-icon · maplibre:icon-param-icon-stroke', 'Two-tone POI remap — scheme NEUTRAL native-parity (#a7a7a7): native vốn render neutral nên hành vi trùng.', [1,1,1]],
    ['global-state maplibre:camera-pitch', 'Filter camera của Mapbox (theo pitch) → global-state cập nhật mỗi frame.', [1,1,1]],
    ['maplibre:distance-from-center-filter', 'Lọc nhãn theo khoảng cách tới tâm màn hình, tính lúc đặt nhãn.', [1,0,0]],
    ['["image", ảnh-1, ảnh-2] + *-cross-fade', 'Biểu thức <code>image</code> có 2 tên ảnh là <b>cặp ảnh trộn theo</b> <code>icon-image-cross-fade</code> / <code>*-pattern-cross-fade</code> của Mapbox (không phải danh sách dự phòng): fork chọn ảnh theo giá trị cross-fade ở cấu hình mặc định (&gt; 0.5 → ảnh 2).', [1,1,1]],
  ]],
  ['Đèn v3 · thời gian thực (từ 13.3.1-mapzone.5)', [
    ['lights (root) — đổi lúc runtime', 'Thay toàn bộ <code>lights</code> (ambient + directional) khi đang chạy, không tải lại style: bản đồ vẽ y như style được tải với các đèn đó. Web <code>map.setLights(lights)</code> / <code>getLights()</code>; Android <code>Style.setLights(json)</code> / <code>getLights()</code>; iOS <code>MLNStyle.lights</code>.', [1,1,1]],
    ['Mặt trời theo giờ thật', 'Đặt đèn theo vị trí thật của mặt trời tại một thời điểm và toạ độ (thường là tâm camera): hướng nắng, màu, cường độ chuyển dần đêm → bình minh → ngày → hoàng hôn, ban đêm là ánh trăng; <code>lightPreset</code> của style được đặt theo. Gọi được mỗi khung hình (chỉ áp lại khi mặt trời dịch ≥ 0,5° hoặc màu đổi thấy được). Web <code>map.setSun(time, lngLat)</code>; Android <code>Style.setSun(epochMillis, lat, lng)</code>; iOS <code>-[MLNStyle setSunWithDate:latitude:longitude:]</code>.', [1,1,1]],
    ['["config", "lightPreset"] — đổi lúc runtime', 'Biểu thức <code>["config", "lightPreset"]</code> trong layer cập nhật khi đổi preset (<code>dawn</code> / <code>day</code> / <code>dusk</code> / <code>night</code>), không tải lại style. Web <code>map.setConfigProperty(\'basemap\', \'lightPreset\', \'night\')</code> / <code>getConfigProperty</code>; Android <code>Style.setLightPreset</code> / <code>getLightPreset</code>; iOS <code>MLNStyle.lightPreset</code>. Các <code>config</code> khác vẫn cố định từ lúc tải style.', [1,1,1]],
    ['["measure-light", "brightness"]', 'Độ sáng của đèn hiện tại, tính như Mapbox; cập nhật khi đổi đèn, preset, mặt trời hoặc zoom (dùng đổi màu nhãn / layer theo ngày–đêm).', [1,1,1]],
    ['Chiếu sáng lớp 2D (fill / line)', 'Style có cả đèn <code>ambient</code> lẫn <code>directional</code>: fill và line được chiếu sáng như Mapbox — ban đêm mặt đất, mặt đường tối đi. Style không có cặp đèn này giữ nguyên màu.', [1,1,1]],
    ['fill-emissive-strength · line-emissive-strength', 'Viết thẳng trong <code>paint</code> của style Mapbox v3 (fork lưu ở <code>maplibre:fill-emissive-strength</code> / <code>maplibre:line-emissive-strength</code>): 0 = chiếu sáng hoàn toàn theo đèn v3, 1 = giữ nguyên màu của layer; hằng số hoặc theo zoom. Chỉ có tác dụng khi style có đèn v3.', [1,1,1]],
    ['Bóng đổ của đường HD trên cao', 'Đèn <code>directional</code> có <code>cast-shadows: true</code>: cầu / đường trên cao đổ bóng xuống mặt đất và các lớp 2D bên dưới (độ đậm theo <code>shadow-intensity</code>).', [1,1,1]],
    ['Android: Style.setStandardLightShadowsEnabled(boolean)', 'Bật / tắt bóng đổ của đèn v3 lúc runtime (tiết kiệm GPU / pin trên máy yếu).', [0,1,0]],
  ]],
  ['Root / khác', [
    ['maplibre:mapbox-standard-lights (root metadata)', 'Lights v3 đã resolve config — native parse thành standard-lights.', [1,1,1]],
    ['maplibre:camera-projection = "orthographic"', 'Từ section camera của Mapbox.', [1,0,0]],
    ['imports · slot · maplibre:slots', 'Style Mapbox v3 có <code>imports</code> (ví dụ nền SD + lớp HD) nạp thẳng được; layer có <code>slot</code> được chèn đúng vị trí slot. Runtime: thêm layer vào slot (web <code>addLayer({slot})</code>; Android <code>Style.addLayerToSlot</code>; iOS <code>-[MLNStyle addLayer:toSlot:]</code>).', [1,1,1]],
    ['state · global-state', 'Biến toàn cục của style (<code>state</code> ở root) đọc bằng expression <code>["global-state", tên]</code>; đổi lúc runtime: web <code>setGlobalStateProperty</code>, Android <code>Style.setGlobalStateProperty</code>, iOS <code>-[MLNStyle setGlobalStateValue:forProperty:]</code>.', [1,1,1]],
  ]],
];
function mzSupport([w, a, i]) {
  return `<div class="support">` +
    `<span class="plat ${w ? 'ok' : 'no'}">Web ${w ? '✓' : '✗'}</span>` +
    `<span class="plat ${a ? 'ok' : 'no'}">Android ${a ? '✓' : '✗'}</span>` +
    `<span class="plat ${i ? 'ok' : 'no'}">iOS ${i ? '✓' : '✗'}</span></div>`;
}
const EXT_COUNT = EXT.reduce((n, [, items]) => n + items.length, 0);
let extHtml = `<section id="mapzone"><h2>MapZone extensions — hợp đồng <code>maplibre:*</code> <span class="cnt">${EXT_COUNT}</span></h2>
<p class="intro">Key Mapbox v3 nằm ngoài spec v8 được SDK tự chuyển (khi nạp style) vào <code>metadata</code> của layer với tiền tố <code>maplibre:</code>; style Mapbox gốc nạp thẳng được. Đổi lúc runtime: web nhận <code>setPaintProperty</code>/<code>setLayoutProperty</code> với tên key Mapbox cho các key line/symbol ở dưới; key khác sửa <code>layer.metadata</code> rồi <code>triggerRepaint()</code>. Android/iOS có API riêng cho line/symbol (ví dụ Android <code>LineMapboxProperties</code>, iOS category <code>MLNLineStyleLayer</code>).</p>`;
for (const [g, items] of EXT) {
  extHtml += `<h3 class="exprgroup">${esc(g)}</h3>`;
  for (const [k, doc, sup] of items) {
    const id = 'mz-' + k.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
    extHtml += `<article class="prop mz" id="${id}" data-name="${esc(k.toLowerCase())}">
      <h4><a href="#${id}"><code class="exprname">${esc(k)}</code></a></h4>${mzSupport(sup)}<p class="doc">${doc}</p></article>`;
  }
}
extHtml += `<h3 class="exprgroup">Cố ý KHÔNG hỗ trợ (đừng tìm trong fork)</h3>
<p class="doc" style="max-width:72ch">Layer <code>clip</code>/<code>building</code>; source <code>raster-array</code>; <code>fog</code>, <code>color-theme</code>, <code>featuresets</code>, <code>iconsets</code>; paint: <code>fill-extrusion-flood-light-*</code>, <code>cutoff-fade-range</code>, <code>icon-size-scale-range</code>, <code>symbol-z-elevate</code>; <code>shadow-draw-before-layer</code>. <code>icon-image-cross-fade</code> không trộn lúc runtime (xem mục ảnh 2 biến thể ở trên). Expression <code>random</code>, <code>measure-light</code> chưa hỗ trợ. Đang phát triển, chưa phát hành: <code>fill-extrusion-edge-radius</code>, <code>fill-extrusion-rounded-roof</code> (bo cạnh building).</p></section>`;
sections.push({ id: 'mapzone', title: '★ MapZone extensions', count: EXT_COUNT, html: extHtml });

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
.chip.new { background:var(--teal-soft); color:var(--teal); font-weight:700; }
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
  <b>Hỗ trợ 3 nền tảng MapZone</b> — mỗi prop có hàng chip <span class="plat ok">Web ✓</span> <span class="plat ok">Android ✓</span> <span class="plat ok">iOS ✓</span>: cột Web = fork MapLibre GL JS; Android/iOS = core maplibre-native mà SDK <code>13.3.1-mapzone.1</code> build từ đó (hover chip để xem phiên bản upstream bắt đầu hỗ trợ). <span class="plat dd">data-driven ✓</span> = prop nhận expression theo feature. Riêng phần mở rộng của mình xem mục <a href="#buildings3d">★ Building 3D</a> và <a href="#mapzone">★ MapZone extensions</a> — trạng thái đo từ code fork, không phải upstream. Mục đánh dấu <span class="chip new">mới 10/2026</span> (và các key route/symbol/slot ở MapZone extensions) có trong bản SDK phát hành sau <code>13.3.1-mapzone.1</code>.</div>
  ${sections.map(s => s.html).join('\n')}
</main>
<footer>Sinh tự động từ style spec v${esc(String(SPEC.$version))} + hợp đồng MapZone · cập nhật 2026-10-20</footer>
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
