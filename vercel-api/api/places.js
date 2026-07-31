const BEACHES = {
  dadaepo: { name: "다대포해수욕장", lat: 35.0468, lon: 128.9657 },
  gwangalli: { name: "광안리해수욕장", lat: 35.1532, lon: 129.1187 },
  songjeong: { name: "송정해수욕장", lat: 35.1786, lon: 129.1997 },
  haeundae: { name: "해운대해수욕장", lat: 35.1587, lon: 129.1604 },
};

const PLACE_TYPES = {
  attraction: {
    query: "관광지",
    includedType: "tourist_attraction",
  },
  restaurant: {
    query: "식당",
    includedType: "restaurant",
  },
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
    return res.status(500).json({ error: "Google 지도 검색 설정이 완료되지 않았습니다." });
  }

  try {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": process.env.GEMINI_API_KEY,
        "X-Goog-FieldMask": "places.id,places.displayName,places.rating,places.location,places.googleMapsUri",
      },
      body: JSON.stringify({
        textQuery: `${beach.name} 근처 ${placeType.query}`,
        includedType: placeType.includedType,
        strictTypeFiltering: true,
        minRating: 4.5,
        maxResultCount: 10,
        languageCode: "ko",
        locationBias: {
          circle: {
            center: { latitude: beach.lat, longitude: beach.lon },
            radius: 2500,
          },
        },
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      console.error("Google Places search error", response.status, result?.error?.message);
      return res.status(502).json({
        error: "Google 지도 추천 장소를 불러오지 못했습니다.",
        upstreamStatus: response.status,
        upstreamCode: result?.error?.status || "UNKNOWN",
      });
    }

    const places = (result.places || [])
      .map((place) => {
        const rating = Number(place.rating);
        const lat = Number(place.location?.latitude);
        const lon = Number(place.location?.longitude);
        if (!place.id || !place.displayName?.text || !place.googleMapsUri) return null;
        if (!Number.isFinite(rating) || rating < 4.5 || rating > 5) return null;
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        const distance = distanceInMeters(beach.lat, beach.lon, lat, lon);
        if (distance > 2500) return null;
        return {
          id: place.id,
          type,
          name: place.displayName.text,
          rating,
          lat,
          lon,
          distance,
          googleMapsUri: place.googleMapsUri,
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
    });
  } catch (error) {
    console.error("Nearby rated places error", error);
    return res.status(500).json({ error: "추천 장소 검색 중 오류가 발생했습니다." });
  }
}
