const BEACHES = {
  dadaepo: { name: "Dadaepo Beach, Busan", lat: 35.0468, lon: 128.9657 },
  gwangalli: { name: "Gwangalli Beach, Busan", lat: 35.1532, lon: 129.1187 },
  songjeong: { name: "Songjeong Beach, Busan", lat: 35.1786, lon: 129.1997 },
  haeundae: { name: "Haeundae Beach, Busan", lat: 35.1587, lon: 129.1604 },
};

const PLACE_TYPES = {
  attraction: "tourist attractions and sightseeing places",
  restaurant: "restaurants",
};

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

function normalizeName(value = "") {
  return value.toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
}

function findSource(name, sources) {
  const normalizedName = normalizeName(name);
  return sources.find((source) => {
    const normalizedTitle = normalizeName(source.title);
    return normalizedName === normalizedTitle ||
      normalizedName.includes(normalizedTitle) ||
      normalizedTitle.includes(normalizedName);
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET 요청만 사용할 수 있습니다." });

  const beachKey = typeof req.query?.beach === "string" ? req.query.beach : "";
  const type = typeof req.query?.type === "string" ? req.query.type : "";
  const beach = BEACHES[beachKey];
  const placeType = PLACE_TYPES[type];
  if (!beach || !placeType) return res.status(400).json({ error: "지원하지 않는 검색입니다." });
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "지도 추천 검색 설정이 완료되지 않았습니다." });
  }

  const prompt = `You must use the Google Maps tool. Search Google Maps for up to 8 ${placeType} within 2 kilometers of ${beach.name}.
Only include places whose current Google Maps rating is at least 4.5.
Exclude any place unless its exact rating, latitude and longitude are available from Google Maps.
Return one place per line and nothing else, using this exact tab-separated format:
PLACE NAME<TAB>RATING<TAB>LATITUDE<TAB>LONGITUDE`;

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: {
              latLng: { latitude: beach.lat, longitude: beach.lon },
            },
          },
          generationConfig: { maxOutputTokens: 1400 },
        }),
      },
    );
    const result = await response.json();
    if (!response.ok) {
      console.error("Google Maps grounding error", response.status, result?.error?.message);
      return res.status(502).json({
        error: "Google Maps 추천 장소를 불러오지 못했습니다.",
        upstreamStatus: response.status,
        upstreamCode: result?.error?.status || "UNKNOWN",
      });
    }

    const candidate = result?.candidates?.[0];
    const answer = candidate?.content?.parts?.map((part) => part.text || "").join("").trim() || "";
    const sources = (candidate?.groundingMetadata?.groundingChunks || [])
      .map((chunk) => chunk.maps)
      .filter((maps) => maps?.title && maps?.uri)
      .map((maps) => ({
        title: maps.title,
        uri: maps.uri,
        placeId: maps.placeId || null,
      }));

    const places = answer
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*[-*]\s*/, "").trim())
      .map((line) => {
        const [name, ratingText, latText, lonText] = line.split("\t").map((value) => value?.trim());
        const rating = Number(ratingText);
        const lat = Number(latText);
        const lon = Number(lonText);
        const source = findSource(name, sources);
        if (!name || !source || !Number.isFinite(rating) || rating < 4.5 || rating > 5) return null;
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        const distance = distanceInMeters(beach.lat, beach.lon, lat, lon);
        if (distance > 2500) return null;
        return {
          id: source.placeId || `${type}-${normalizeName(name)}`,
          type,
          name,
          rating,
          lat,
          lon,
          distance,
          googleMapsUri: source.uri,
        };
      })
      .filter(Boolean)
      .slice(0, 8);

    return res.status(200).json({
      beach: beachKey,
      type,
      minimumRating: 4.5,
      places,
      source: "Google Maps",
      checkedAt: new Date().toISOString(),
      ...(req.query?.debug === "1" ? {
        debug: {
          answer,
          sources,
          candidateKeys: Object.keys(candidate || {}),
          groundingMetadata: candidate?.groundingMetadata || null,
        },
      } : {}),
    });
  } catch (error) {
    console.error("Nearby rated places error", error);
    return res.status(500).json({ error: "추천 장소 검색 중 오류가 발생했습니다." });
  }
}
