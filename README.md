# MapZone style-spec reference

Tài liệu tra cứu **style-spec** cho MapZone Maps SDK (fork MapLibre) — kiểu
`docs.mapbox.com/style-spec/reference`, sinh tự động từ spec machine-readable.

**Xem online:** https://map-zone.github.io/style-spec/

| Trang | Nội dung |
|---|---|
| [Reference](https://map-zone.github.io/style-spec/) (`index.html`) | Mọi property/expression của spec v8 (MapLibre) + **ma trận hỗ trợ Web/Android/iOS** + 38 khóa mở rộng `maplibre:*` của MapZone. Có ô lọc nhanh. |
| [Mindmap](https://map-zone.github.io/style-spec/mindmap.html) | Sơ đồ tư duy: style JSON qua 4 câu hỏi, giải phẫu layer, cheat-sheet expression, pipeline. |

Trang này là **tài liệu API** cho người viết style — dùng kèm SDK
[`vn.mapzone:maplibre-android`](https://github.com/map-zone/maps-sdk) / `MapZoneMaps` (iOS).
API render là MapLibre chuẩn nên **docs maplibre.org/mapbox style-spec cũng áp dụng**;
trang này bổ sung phần MapZone-specific (HD roads, indoor, model, các khóa `maplibre:*`).

## Cập nhật

`index.html` sinh bởi `gen-spec-reference.cjs` từ `@maplibre/maplibre-gl-style-spec` +
danh sách extension. Khi spec/contract đổi: chạy lại generator (trong workspace nội bộ) rồi
copy `style-spec-reference.html` → `index.html`.
