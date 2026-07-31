const BEACHES = {
  dadaepo: { names: { ko: "다대포", en: "Dadaepo", ja: "多大浦", zh: "多大浦" }, lat: 35.0468, lon: 128.9657 },
  gwangalli: { names: { ko: "광안리", en: "Gwangalli", ja: "広安里", zh: "广安里" }, lat: 35.1532, lon: 129.1187 },
  songjeong: { names: { ko: "송정", en: "Songjeong", ja: "松亭", zh: "松亭" }, lat: 35.1786, lon: 129.1997 },
  haeundae: { names: { ko: "해운대", en: "Haeundae", ja: "海雲台", zh: "海云台" }, lat: 35.1587, lon: 129.1604 },
};

const FALLBACK_ATTRACTIONS = {
  dadaepo: [
    { names: { ko: "다대포 해변공원", en: "Dadaepo Beach Park", ja: "多大浦海浜公園", zh: "多大浦海滨公园" }, lat: 35.0458529, lon: 128.9669187 },
    { names: { ko: "아미산 전망대", en: "Amisan Observatory", ja: "峨嵋山展望台", zh: "峨嵋山展望台" }, lat: 35.0527, lon: 128.9634 },
  ],
  gwangalli: [
    { names: { ko: "민락수변공원", en: "Millak Waterside Park", ja: "民楽水辺公園", zh: "民乐水边公园" }, lat: 35.1547, lon: 129.1321 },
    { names: { ko: "남천해변공원", en: "Namcheon Seaside Park", ja: "南川海辺公園", zh: "南川海滨公园" }, lat: 35.1466, lon: 129.1152 },
  ],
  songjeong: [
    { names: { ko: "죽도공원", en: "Jukdo Park", ja: "竹島公園", zh: "竹岛公园" }, lat: 35.1815, lon: 129.2028 },
    { names: { ko: "청사포 다릿돌전망대", en: "Cheongsapo Daritdol Observatory", ja: "青沙浦タリットル展望台", zh: "青沙浦踏石观景台" }, lat: 35.1647, lon: 129.1920 },
  ],
  haeundae: [
    { names: { ko: "동백공원", en: "Dongbaek Park", ja: "冬柏公園", zh: "冬柏公园" }, lat: 35.1532, lon: 129.1514 },
    { names: { ko: "해운대 블루라인파크", en: "Haeundae Blueline Park", ja: "海雲台ブルーラインパーク", zh: "海云台蓝线公园" }, lat: 35.1594, lon: 129.1731 },
  ],
};

function distanceInMeters(lat1, lon1, lat2, lon2) {
  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function localizedName(item, lang) {
  return item.names?.[lang] || item.names?.ko || item.display_name?.split(",")[0] || "OpenStreetMap place";
}

function fallbackPlaces(beachKey, beach, lang) {
  return (FALLBACK_ATTRACTIONS[beachKey] || []).map((item, index) => ({
    id: `curated-${beachKey}-${index}`,
    name: localizedName(item, lang),
    lat: item.lat,
    lon: item.lon,
    type: "attraction",
    distance: distanceInMeters(beach.lat, beach.lon, item.lat, item.lon),
    osmUri: `https://www.openstreetmap.org/?mlat=${item.lat}&mlon=${item.lon}#map=17/${item.lat}/${item.lon}`,
    source: "OpenStreetMap",
  }));
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Only GET requests are supported." });

  const beachKey = typeof req.query?.beach === "string" ? req.query.beach : "";
  const type = typeof req.query?.type === "string" ? req.query.type : "";
  const lang = ["ko", "en", "ja", "zh"].includes(req.query?.lang) ? req.query.lang : "ko";
  const beach = BEACHES[beachKey];
  if (!beach || !["attraction", "restaurant"].includes(type)) {
    return res.status(400).json({ error: "Unsupported beach or place type." });
  }

  const halfWidth = type === "restaurant" ? 0.025 : 0.035;
  const viewbox = [
    beach.lon - halfWidth,
    beach.lat + halfWidth,
    beach.lon + halfWidth,
    beach.lat - halfWidth,
  ].join(",");
  const query = type === "restaurant" ? "restaurant" : "park";
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({
    format: "jsonv2",
    q: query,
    viewbox,
    bounded: "1",
    limit: "12",
    "accept-language": lang,
  }).toString();

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Language": lang,
        "User-Agent": "BusanBadaON/1.0 (https://naugim58-cloud.github.io/busanbada-on/)",
      },
      signal: AbortSignal.timeout(6500),
    });
    if (!response.ok) throw new Error(`Nominatim returned ${response.status}`);
    const results = await response.json();
    const places = results
      .map((item) => ({
        id: `osm-${item.osm_type}-${item.osm_id}`,
        name: item.display_name?.split(",")[0] || localizedName(beach, lang),
        lat: Number(item.lat),
        lon: Number(item.lon),
        type,
        distance: distanceInMeters(beach.lat, beach.lon, Number(item.lat), Number(item.lon)),
        osmUri: `https://www.openstreetmap.org/${item.osm_type === "node" ? "node" : item.osm_type === "way" ? "way" : "relation"}/${item.osm_id}`,
        source: "OpenStreetMap",
      }))
      .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lon))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 10);

    const finalPlaces = type === "attraction" && places.length < 2
      ? fallbackPlaces(beachKey, beach, lang)
      : places;
    return res.status(200).json({
      beach: localizedName(beach, lang),
      type,
      places: finalPlaces,
      source: "OpenStreetMap Nominatim",
      note: "OpenStreetMap does not provide a consistent rating field; no rating is inferred.",
    });
  } catch (error) {
    console.error("OpenStreetMap places error", error);
    if (type === "attraction") {
      return res.status(200).json({
        beach: localizedName(beach, lang),
        type,
        places: fallbackPlaces(beachKey, beach, lang),
        source: "OpenStreetMap curated fallback",
        note: "Live search was unavailable, so verified OpenStreetMap landmarks are shown.",
      });
    }
    return res.status(200).json({
      beach: localizedName(beach, lang),
      type,
      places: [],
      source: "OpenStreetMap Nominatim",
      note: "The free place search is temporarily unavailable. Please retry shortly.",
    });
  }
}
