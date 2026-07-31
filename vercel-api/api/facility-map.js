const BEACHES = {
  dadaepo: { name: "다대포", lat: 35.0468, lon: 128.9657 },
  gwangalli: { name: "광안리", lat: 35.1532, lon: 129.1187 },
  songjeong: { name: "송정", lat: 35.1786, lon: 129.1997 },
  haeundae: { name: "해운대", lat: 35.1587, lon: 129.1604 },
};

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("GET 요청만 사용할 수 있습니다.");
  }

  const beachKey = typeof req.query?.beach === "string" ? req.query.beach : "";
  const beach = BEACHES[beachKey];
  if (!beach) return res.status(400).send("지원하지 않는 해변입니다.");

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");
  res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline' https://unpkg.com; script-src 'unsafe-inline' https://unpkg.com; img-src data: https://*.tile.openstreetmap.org; connect-src 'self'");

  return res.status(200).send(`<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${beach.name} 시설과 추천 장소 지도</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <style>
    html,body,#map{height:100%;margin:0}body{font-family:Arial,"Malgun Gothic",sans-serif;color:#07384a}
    .panel{position:absolute;z-index:1000;left:9px;top:9px;right:9px;padding:9px;border-radius:14px;background:#fffffff4;box-shadow:0 5px 18px #003f5c35}
    .panel b{display:block;margin:0 2px 7px;font-size:12px}.filters{display:flex;gap:5px;overflow-x:auto;padding-bottom:2px;scrollbar-width:thin}
    .filter{flex:0 0 auto;padding:7px 9px;border:1px solid #d8e8e6;border-radius:10px;background:#fff;color:#355f68;font:700 11px Arial,"Malgun Gothic",sans-serif;cursor:pointer}
    .filter[aria-pressed="true"]{border-color:#087f89;background:#087f89;color:#fff}.filter strong{margin-left:3px;font-size:9px}
    .status{margin:6px 2px 0;color:#537b82;font-size:9px}.marker{display:grid;place-items:center;width:29px;height:29px;border:2px solid white;border-radius:50%;box-shadow:0 2px 8px #003f5c66;color:white;font-weight:900;font-size:11px}
    .leaflet-popup-content{margin:11px 14px;line-height:1.5}.leaflet-popup-content b{font-size:13px}.leaflet-popup-content small{display:block;color:#60787b}.leaflet-popup-content a{display:inline-block;margin-top:5px;color:#087f89;font-size:11px;font-weight:700;text-decoration:none}
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="panel">
    <b>${beach.name} · 표시할 항목을 선택하세요</b>
    <div class="filters">
      <button class="filter" data-type="toilet" aria-pressed="true">🚻 화장실 <strong id="toilet-count">-</strong></button>
      <button class="filter" data-type="shower" aria-pressed="false">🚿 샤워실 <strong id="shower-count">-</strong></button>
      <button class="filter" data-type="parking" aria-pressed="false">🅿 주차장 <strong id="parking-count">-</strong></button>
      <button class="filter" data-type="attraction" aria-pressed="false">★ 관광지 4.5+ <strong id="attraction-count">-</strong></button>
      <button class="filter" data-type="restaurant" aria-pressed="false">★ 식당 4.5+ <strong id="restaurant-count">-</strong></button>
    </div>
    <div class="status" id="status">시설 위치를 확인하고 있습니다…</div>
  </div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const beachKey=${JSON.stringify(beachKey)};
    const beach=${JSON.stringify(beach)};
    const colors={toilet:"#1677d2",shower:"#00a89d",parking:"#f28c28",attraction:"#7a4bc8",restaurant:"#e05252"};
    const symbols={toilet:"WC",shower:"S",parking:"P",attraction:"★",restaurant:"맛"};
    const labels={toilet:"화장실",shower:"샤워실",parking:"주차장",attraction:"관광지",restaurant:"식당"};
    const layers={toilet:[],shower:[],parking:[],attraction:[],restaurant:[]};
    const loaded={toilet:false,shower:false,parking:false,attraction:false,restaurant:false};
    let activeType="toilet";
    const map=L.map("map",{zoomControl:false}).setView([beach.lat,beach.lon],15);
    L.control.zoom({position:"bottomright"}).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'}).addTo(map);
    function icon(color,text){return L.divIcon({className:"",html:'<span class="marker" style="background:'+color+'">'+text+'</span>',iconSize:[29,29],iconAnchor:[14,14],popupAnchor:[0,-15]})}
    const beachMarker=L.marker([beach.lat,beach.lon],{icon:icon("#e64b67","●")}).addTo(map).bindPopup(beach.name+" 해수욕장");

    function popup(item){
      const box=document.createElement("div"),title=document.createElement("b"),detail=document.createElement("small");
      title.textContent=item.name+" · "+labels[item.type];
      detail.textContent=item.rating ? "Google Maps 평점 "+item.rating.toFixed(1)+" · 약 "+item.distance+"m" : "해변 중심에서 약 "+item.distance+"m · OpenStreetMap 등록 위치";
      box.append(title,detail);
      if(item.googleMapsUri){
        const link=document.createElement("a");
        link.href=item.googleMapsUri;link.target="_blank";link.rel="noopener noreferrer";link.textContent="Google Maps에서 보기 ↗";
        box.append(link);
      }
      return box;
    }
    function makeMarker(item){
      return L.marker([item.lat,item.lon],{icon:icon(colors[item.type],symbols[item.type])}).bindPopup(popup(item));
    }
    function showType(type){
      Object.values(layers).flat().forEach((marker)=>map.removeLayer(marker));
      activeType=type;
      document.querySelectorAll(".filter").forEach((button)=>button.setAttribute("aria-pressed",String(button.dataset.type===type)));
      layers[type].forEach((marker)=>marker.addTo(map));
      const bounds=L.latLngBounds([[beach.lat,beach.lon]]);
      layers[type].forEach((marker)=>bounds.extend(marker.getLatLng()));
      if(layers[type].length)map.fitBounds(bounds,{paddingTopLeft:[35,105],paddingBottomRight:[35,35],maxZoom:16});
      else map.setView([beach.lat,beach.lon],15);
      const source=type==="attraction"||type==="restaurant"?"Google Maps 평점 4.5 이상 · 항목을 눌러 출처 확인":"OpenStreetMap 실제 등록 좌표";
      document.getElementById("status").textContent=layers[type].length?source:"선택한 항목의 등록 결과가 없습니다.";
    }
    async function loadPlaces(type){
      if(loaded[type])return showType(type);
      document.getElementById("status").textContent="Google Maps에서 평점 4.5 이상 장소를 확인하고 있습니다…";
      try{
        const response=await fetch("/api/places?beach="+encodeURIComponent(beachKey)+"&type="+encodeURIComponent(type));
        if(!response.ok)throw new Error("places request failed");
        const data=await response.json();
        layers[type]=data.places.map(makeMarker);
        loaded[type]=true;
        document.getElementById(type+"-count").textContent=data.places.length;
        showType(type);
      }catch(error){
        document.getElementById("status").textContent="Google Maps 추천 장소를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.";
        document.getElementById(type+"-count").textContent="—";
      }
    }
    document.querySelectorAll(".filter").forEach((button)=>button.addEventListener("click",()=>{
      const type=button.dataset.type;
      if(type==="attraction"||type==="restaurant")loadPlaces(type);else showType(type);
    }));
    fetch("/api/facilities?beach="+encodeURIComponent(beachKey))
      .then((response)=>{if(!response.ok)throw new Error("facility request failed");return response.json()})
      .then((data)=>{
        data.facilities.forEach((facility)=>layers[facility.type].push(makeMarker(facility)));
        ["toilet","shower","parking"].forEach((type)=>{
          loaded[type]=true;
          document.getElementById(type+"-count").textContent=data.counts[type];
        });
        showType("toilet");
      })
      .catch(()=>{
        document.getElementById("status").textContent="시설 정보를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.";
        ["toilet","shower","parking"].forEach((type)=>document.getElementById(type+"-count").textContent="—");
      });
  </script>
</body>
</html>`);
}
