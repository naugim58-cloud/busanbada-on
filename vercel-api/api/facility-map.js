const BEACHES = {
  dadaepo: { names: { ko: "다대포", en: "Dadaepo", ja: "多大浦", zh: "多大浦" }, lat: 35.0468, lon: 128.9657 },
  gwangalli: { names: { ko: "광안리", en: "Gwangalli", ja: "広安里", zh: "广安里" }, lat: 35.1532, lon: 129.1187 },
  songjeong: { names: { ko: "송정", en: "Songjeong", ja: "松亭", zh: "松亭" }, lat: 35.1786, lon: 129.1997 },
  haeundae: { names: { ko: "해운대", en: "Haeundae", ja: "海雲台", zh: "海云台" }, lat: 35.1587, lon: 129.1604 },
};

const COPY = {
  ko: { title: "시설·추천 장소 지도", choose: "표시할 항목을 선택하세요", toilet: "화장실", shower: "샤워실", parking: "주차장", attraction: "주변 관광지", restaurant: "주변 식당", loadingFacilities: "시설 위치를 확인하고 있습니다…", loadingPlaces: "OpenStreetMap에서 주변 장소를 확인하고 있습니다…", source: "OpenStreetMap 실제 등록 좌표 · 마커를 눌러 상세 위치 확인", empty: "선택한 항목의 등록 결과가 없습니다.", failure: "주변 장소를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.", facilityFailure: "시설 정보를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.", distance: "해변 중심에서 약", registered: "· OpenStreetMap 등록 장소", open: "OpenStreetMap에서 보기 ↗", beach: "해수욕장" },
  en: { title: "Facilities & nearby places", choose: "Choose what to show", toilet: "Restrooms", shower: "Showers", parking: "Parking", attraction: "Nearby sights", restaurant: "Nearby dining", loadingFacilities: "Checking facility locations…", loadingPlaces: "Searching nearby OpenStreetMap places…", source: "Real OpenStreetMap coordinates · Tap a marker for details", empty: "No registered results for this category.", failure: "Nearby places could not be loaded. Please retry shortly.", facilityFailure: "Facilities could not be loaded. Please retry shortly.", distance: "About", registered: "m from the beach center · OpenStreetMap place", open: "View on OpenStreetMap ↗", beach: "Beach" },
  ja: { title: "施設・周辺スポット地図", choose: "表示する項目を選択", toilet: "トイレ", shower: "シャワー", parking: "駐車場", attraction: "周辺観光地", restaurant: "周辺レストラン", loadingFacilities: "施設の位置を確認中…", loadingPlaces: "OpenStreetMapで周辺スポットを検索中…", source: "OpenStreetMapの登録座標 · マーカーで詳細を確認", empty: "この項目の登録結果はありません。", failure: "周辺スポットを読み込めませんでした。しばらくして再度お試しください。", facilityFailure: "施設情報を読み込めませんでした。しばらくして再度お試しください。", distance: "ビーチ中心から約", registered: "m · OpenStreetMap登録スポット", open: "OpenStreetMapで見る ↗", beach: "海水浴場" },
  zh: { title: "设施与周边地点地图", choose: "请选择要显示的项目", toilet: "卫生间", shower: "淋浴间", parking: "停车场", attraction: "周边景点", restaurant: "周边餐厅", loadingFacilities: "正在确认设施位置…", loadingPlaces: "正在 OpenStreetMap 搜索周边地点…", source: "OpenStreetMap 实际登记坐标 · 点击标记查看详情", empty: "该类别暂无登记结果。", failure: "无法加载周边地点，请稍后重试。", facilityFailure: "无法加载设施信息，请稍后重试。", distance: "距海滩中心约", registered: "米 · OpenStreetMap 登记地点", open: "在 OpenStreetMap 查看 ↗", beach: "海水浴场" },
};

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("Only GET requests are supported.");
  }
  const beachKey = typeof req.query?.beach === "string" ? req.query.beach : "";
  const lang = ["ko", "en", "ja", "zh"].includes(req.query?.lang) ? req.query.lang : "ko";
  const beach = BEACHES[beachKey];
  if (!beach) return res.status(400).send("Unsupported beach.");
  const copy = COPY[lang];
  const localizedBeach = { ...beach, name: beach.names[lang] };

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");
  res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline' https://unpkg.com; script-src 'unsafe-inline' https://unpkg.com; img-src data: https://*.tile.openstreetmap.org; connect-src 'self'");

  return res.status(200).send(`<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${localizedBeach.name} ${copy.title}</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <style>
    html,body,#map{height:100%;margin:0}body{font-family:Inter,Arial,"Malgun Gothic",sans-serif;color:#072d3d;background:#dff5f3}
    .panel{position:absolute;z-index:1000;left:12px;top:12px;right:12px;padding:12px;border:1px solid #fff9;border-radius:17px;background:#fafffff2;box-shadow:0 12px 30px #002f4940;backdrop-filter:blur(12px)}
    .panel b{display:block;margin:0 2px 9px;font-size:13px}.filters{display:flex;gap:6px;overflow-x:auto;padding-bottom:3px;scrollbar-width:thin}
    .filter{flex:0 0 auto;padding:8px 10px;border:1px solid #d4e8e6;border-radius:999px;background:#fff;color:#345b64;font:700 11px Inter,Arial,"Malgun Gothic",sans-serif;cursor:pointer}
    .filter[aria-pressed="true"]{border-color:#087f89;background:linear-gradient(135deg,#036985,#00a19a);color:#fff;box-shadow:0 5px 13px #037b8140}.filter strong{margin-left:3px;font-size:9px}
    .status{margin:7px 2px 0;color:#537b82;font-size:9px}.marker{display:grid;place-items:center;width:31px;height:31px;border:2px solid white;border-radius:50%;box-shadow:0 3px 10px #003f5c70;color:white;font-weight:900;font-size:10px}
    .leaflet-popup-content{margin:12px 15px;line-height:1.5}.leaflet-popup-content b{font-size:13px}.leaflet-popup-content small{display:block;color:#60787b}.leaflet-popup-content a{display:inline-block;margin-top:5px;color:#087f89;font-size:11px;font-weight:700;text-decoration:none}
  </style>
</head>
<body><div id="map"></div><div class="panel"><b>${localizedBeach.name} · ${copy.choose}</b><div class="filters">
  <button class="filter" data-type="toilet" aria-pressed="true">🚻 ${copy.toilet} <strong id="toilet-count">-</strong></button>
  <button class="filter" data-type="shower" aria-pressed="false">🚿 ${copy.shower} <strong id="shower-count">-</strong></button>
  <button class="filter" data-type="parking" aria-pressed="false">🅿 ${copy.parking} <strong id="parking-count">-</strong></button>
  <button class="filter" data-type="attraction" aria-pressed="false">★ ${copy.attraction} <strong id="attraction-count">-</strong></button>
  <button class="filter" data-type="restaurant" aria-pressed="false">🍽 ${copy.restaurant} <strong id="restaurant-count">-</strong></button>
</div><div class="status" id="status">${copy.loadingFacilities}</div></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>
const beachKey=${JSON.stringify(beachKey)},lang=${JSON.stringify(lang)},beach=${JSON.stringify(localizedBeach)},copy=${JSON.stringify(copy)};
const colors={toilet:"#1677d2",shower:"#00a89d",parking:"#f28c28",attraction:"#7655c5",restaurant:"#e05252"};
const symbols={toilet:"WC",shower:"S",parking:"P",attraction:"★",restaurant:"🍽"};
const labels={toilet:copy.toilet,shower:copy.shower,parking:copy.parking,attraction:copy.attraction,restaurant:copy.restaurant};
const layers={toilet:[],shower:[],parking:[],attraction:[],restaurant:[]},loaded={toilet:false,shower:false,parking:false,attraction:false,restaurant:false};
const map=L.map("map",{zoomControl:false}).setView([beach.lat,beach.lon],16);L.control.zoom({position:"bottomright"}).addTo(map);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'}).addTo(map);
function icon(color,text){return L.divIcon({className:"",html:'<span class="marker" style="background:'+color+'">'+text+'</span>',iconSize:[31,31],iconAnchor:[15,15],popupAnchor:[0,-16]})}
L.marker([beach.lat,beach.lon],{icon:icon("#e95f72","●")}).addTo(map).bindPopup(beach.name+" "+copy.beach);
function popup(item){const box=document.createElement("div"),title=document.createElement("b"),detail=document.createElement("small");title.textContent=item.name+" · "+labels[item.type];detail.textContent=copy.distance+" "+item.distance+copy.registered;box.append(title,detail);if(item.osmUri){const link=document.createElement("a");link.href=item.osmUri;link.target="_blank";link.rel="noopener noreferrer";link.textContent=copy.open;box.append(link)}return box}
function makeMarker(item){return L.marker([item.lat,item.lon],{icon:icon(colors[item.type],symbols[item.type])}).bindPopup(popup(item))}
function showType(type){Object.values(layers).flat().forEach(marker=>map.removeLayer(marker));document.querySelectorAll(".filter").forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.type===type)));layers[type].forEach(marker=>marker.addTo(map));const bounds=L.latLngBounds([[beach.lat,beach.lon]]);layers[type].forEach(marker=>bounds.extend(marker.getLatLng()));if(layers[type].length)map.fitBounds(bounds,{paddingTopLeft:[42,125],paddingBottomRight:[42,42],maxZoom:17});else map.setView([beach.lat,beach.lon],16);document.getElementById("status").textContent=layers[type].length?copy.source:copy.empty}
async function loadPlaces(type){if(loaded[type])return showType(type);document.getElementById("status").textContent=copy.loadingPlaces;try{const response=await fetch("/api/places?beach="+encodeURIComponent(beachKey)+"&type="+encodeURIComponent(type)+"&lang="+encodeURIComponent(lang));if(!response.ok)throw new Error("places request failed");const data=await response.json();layers[type]=data.places.map(makeMarker);loaded[type]=true;document.getElementById(type+"-count").textContent=data.places.length;showType(type)}catch(error){document.getElementById("status").textContent=copy.failure;document.getElementById(type+"-count").textContent="!"}}
document.querySelectorAll(".filter").forEach(button=>button.addEventListener("click",()=>{const type=button.dataset.type;if(type==="attraction"||type==="restaurant")loadPlaces(type);else showType(type)}));
fetch("/api/facilities?beach="+encodeURIComponent(beachKey)).then(response=>{if(!response.ok)throw new Error("facility request failed");return response.json()}).then(data=>{data.facilities.forEach(facility=>layers[facility.type].push(makeMarker(facility)));["toilet","shower","parking"].forEach(type=>{loaded[type]=true;document.getElementById(type+"-count").textContent=data.counts[type]});showType("toilet")}).catch(()=>{document.getElementById("status").textContent=copy.facilityFailure;["toilet","shower","parking"].forEach(type=>document.getElementById(type+"-count").textContent="!")});
</script></body></html>`);
}
