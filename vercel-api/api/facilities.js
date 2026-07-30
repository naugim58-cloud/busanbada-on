const BEACHES = {
  dadaepo: { name: "다대포", lat: 35.0468, lon: 128.9657 },
  gwangalli: { name: "광안리", lat: 35.1532, lon: 129.1187 },
  songjeong: { name: "송정", lat: 35.1786, lon: 129.1997 },
  haeundae: { name: "해운대", lat: 35.1587, lon: 129.1604 },
};

const OVERPASS_ENDPOINTS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

function distanceInMeters(lat1, lon1, lat2, lon2) {
  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;
  return Math.round(earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function getType(tags = {}) {
  if (tags.amenity === "shower" || tags.shower === "yes") return "shower";
  if (tags.amenity === "toilets" || tags.toilets === "yes") return "toilet";
  if (tags.amenity === "parking") return "parking";
  return null;
}

function getName(tags, type) {
  const fallback = { toilet: "공중화장실", shower: "샤워시설", parking: "주차장" };
  return tags["name:ko"] || tags.name || fallback[type];
}

async function fetchOverpass(query) {
  let lastError;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18000);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "User-Agent": "BusanBadaON/1.0 (public beach facility map)",
        },
        body: new URLSearchParams({ data: query }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Overpass response ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError || new Error("OpenStreetMap facility query failed");
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET 요청만 사용할 수 있습니다." });

  const beachKey = typeof req.query?.beach === "string" ? req.query.beach : "";
  const beach = BEACHES[beachKey];
  if (!beach) return res.status(400).json({ error: "지원하지 않는 해변입니다." });

  const radius = 1200;
  const around = `${radius},${beach.lat},${beach.lon}`;
  const query = `[out:json][timeout:15];
(
  nwr["amenity"="toilets"](around:${around});
  nwr["toilets"="yes"](around:${around});
  nwr["amenity"="shower"](around:${around});
  nwr["shower"="yes"](around:${around});
  nwr["amenity"="parking"](around:${around});
);
out center tags;`;

  try {
    const data = await fetchOverpass(query);
    const seen = new Set();
    const facilities = (data.elements || [])
      .map((element) => {
        const type = getType(element.tags);
        const lat = element.lat ?? element.center?.lat;
        const lon = element.lon ?? element.center?.lon;
        if (!type || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        if (element.tags?.access === "private" || element.tags?.access === "no") return null;

        const key = `${type}:${lat.toFixed(6)}:${lon.toFixed(6)}`;
        if (seen.has(key)) return null;
        seen.add(key);
        return {
          id: `${element.type}/${element.id}`,
          type,
          name: getName(element.tags || {}, type),
          lat,
          lon,
          distance: distanceInMeters(beach.lat, beach.lon, lat, lon),
          wheelchair: element.tags?.wheelchair || null,
          fee: element.tags?.fee || null,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.distance - b.distance);

    const limits = { toilet: 8, shower: 5, parking: 10 };
    const selected = [];
    const counts = { toilet: 0, shower: 0, parking: 0 };
    for (const facility of facilities) {
      if (counts[facility.type] >= limits[facility.type]) continue;
      counts[facility.type] += 1;
      selected.push(facility);
    }

    return res.status(200).json({
      beach: beachKey,
      beachName: beach.name,
      center: { lat: beach.lat, lon: beach.lon },
      radius,
      facilities: selected,
      counts,
      source: "OpenStreetMap contributors",
      sourceUrl: "https://www.openstreetmap.org/copyright",
      dataTimestamp: data.osm3s?.timestamp_osm_base || null,
    });
  } catch (error) {
    console.error("Beach facility map error", error);
    return res.status(502).json({ error: "지도 시설 정보를 불러오지 못했습니다." });
  }
}
