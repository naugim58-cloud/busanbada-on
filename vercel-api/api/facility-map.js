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
  <title>${beach.name} 편의시설 지도</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <style>
    html,body,#map{height:100%;margin:0}body{font-family:Arial,"Malgun Gothic",sans-serif;color:#07384a}
    .legend{position:absolute;z-index:1000;left:10px;top:10px;max-width:calc(100% - 20px);padding:9px 11px;border-radius:12px;background:#fffffff2;box-shadow:0 5px 18px #003f5c35;font-size:12px}
    .legend b{display:block;margin-bottom:6px}.items{display:flex;gap:10px;flex-wrap:wrap}.item{display:flex;align-items:center;gap:4px}.dot{width:11px;height:11px;border-radius:50%}.toilet{background:#1677d2}.shower{background:#00a89d}.parking{background:#f28c28}.status{margin-top:6px;color:#537b82;font-size:10px}
    .marker{display:grid;place-items:center;width:28px;height:28px;border:2px solid white;border-radius:50%;box-shadow:0 2px 8px #003f5c66;color:white;font-weight:900;font-size:12px}
    .leaflet-popup-content{margin:11px 14px;line-height:1.5}.leaflet-popup-content b{font-size:13px}.leaflet-popup-content small{display:block;color:#60787b}
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="legend">
    <b>${beach.name} 지도 등록 편의시설</b>
    <div class="items">
      <span class="item"><i class="dot toilet"></i>화장실 <strong id="toilet-count">-</strong></span>
      <span class="item"><i class="dot shower"></i>샤워실 <strong id="shower-count">-</strong></span>
      <span class="item"><i class="dot parking"></i>주차장 <strong id="parking-count">-</strong></span>
    </div>
    <div class="status" id="status">시설 위치를 확인하고 있습니다…</div>
  </div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const beachKey=${JSON.stringify(beachKey)};
    const beach=${JSON.stringify(beach)};
    const colors={toilet:"#1677d2",shower:"#00a89d",parking:"#f28c28"};
    const symbols={toilet:"WC",shower:"S",parking:"P"};
    const labels={toilet:"화장실",shower:"샤워실",parking:"주차장"};
    const map=L.map("map",{zoomControl:false}).setView([beach.lat,beach.lon],15);
    L.control.zoom({position:"bottomright"}).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'}).addTo(map);
    function icon(color,text){return L.divIcon({className:"",html:'<span class="marker" style="background:'+color+'">'+text+'</span>',iconSize:[28,28],iconAnchor:[14,14],popupAnchor:[0,-15]})}
    function popup(facility){
      const box=document.createElement("div"),title=document.createElement("b"),detail=document.createElement("small");
      title.textContent=facility.name+" · "+labels[facility.type];
      detail.textContent="해변 중심에서 약 "+facility.distance+"m · OpenStreetMap 등록 위치";
      box.append(title,detail);return box;
    }
    const bounds=L.latLngBounds([[beach.lat,beach.lon]]);
    L.marker([beach.lat,beach.lon],{icon:icon("#e64b67","●")}).addTo(map).bindPopup(beach.name+" 해수욕장");
    fetch("/api/facilities?beach="+encodeURIComponent(beachKey))
      .then((response)=>{if(!response.ok)throw new Error("facility request failed");return response.json()})
      .then((data)=>{
        data.facilities.forEach((facility)=>{
          L.marker([facility.lat,facility.lon],{icon:icon(colors[facility.type],symbols[facility.type])}).addTo(map).bindPopup(popup(facility));
          bounds.extend([facility.lat,facility.lon]);
        });
        ["toilet","shower","parking"].forEach((type)=>document.getElementById(type+"-count").textContent=data.counts[type]);
        document.getElementById("status").textContent="반경 1.2km · OpenStreetMap 실제 등록 좌표";
        if(data.facilities.length)map.fitBounds(bounds,{padding:[35,35],maxZoom:16});
      })
      .catch(()=>{
        document.getElementById("status").textContent="시설 정보를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.";
        ["toilet","shower","parking"].forEach((type)=>document.getElementById(type+"-count").textContent="—");
      });
  </script>
</body>
</html>`);
}
