const BEACHES = {
  dadaepo: { name: "다대포", lat: 35.0468, lon: 128.9657 },
  gwangalli: { name: "광안리", lat: 35.1532, lon: 129.1187 },
  songjeong: { name: "송정", lat: 35.1786, lon: 129.1997 },
  haeundae: { name: "해운대", lat: 35.1587, lon: 129.1604 },
};

// OpenStreetMap에서 2026-07-30에 조회한 각 해변 중심 반경 1.2km의 공개 시설 좌표입니다.
// 위치가 지도에 등록되지 않은 시설은 정확성을 위해 임의로 추가하지 않습니다.
const FACILITIES = {
  dadaepo: [
    ["toilet", 35.0451206, 128.967895],
    ["toilet", 35.044849, 128.9690434],
    ["toilet", 35.0496481, 128.9606826],
    ["toilet", 35.0420134, 128.9741498],
    ["toilet", 35.0382479, 128.9703669],
    ["toilet", 35.0547689, 128.9576738],
    ["parking", 35.0479216, 128.9656192],
    ["parking", 35.0478151, 128.9644776],
    ["parking", 35.0450357, 128.9685118],
    ["parking", 35.0536794, 128.9618872],
    ["parking", 35.0542546, 128.9620779],
    ["parking", 35.0547386, 128.962202],
    ["parking", 35.055454, 128.9624172],
  ],
  gwangalli: [
    ["toilet", 35.1538419, 129.1186734],
    ["toilet", 35.1515099, 129.1161352],
    ["toilet", 35.1543491, 129.1238725],
    ["toilet", 35.1544608, 129.1238333],
    ["toilet", 35.1471399, 129.1144675],
    ["toilet", 35.146159, 129.1155773],
    ["toilet", 35.1547136, 129.1311456],
    ["shower", 35.1503536, 129.1161667],
    ["parking", 35.1555583, 129.121376],
    ["parking", 35.1564005, 129.1211179],
    ["parking", 35.1560498, 129.122621],
    ["parking", 35.1570667, 129.1256696],
    ["parking", 35.1487438, 129.1113914],
    ["parking", 35.145552, 129.1168904],
    ["parking", 35.1451121, 129.116875],
    ["parking", 35.1465613, 129.1110408],
    ["parking", 35.1548388, 129.1313005],
    ["parking", 35.1549466, 129.131728],
  ],
  songjeong: [
    ["toilet", 35.1762134, 129.197126],
    ["toilet", 35.1873485, 129.2022733],
    ["parking", 35.1821116, 129.2008194],
    ["parking", 35.1805228, 129.2050559],
    ["parking", 35.1809906, 129.2053792],
    ["parking", 35.1864324, 129.2018658],
    ["parking", 35.1827739, 129.209401],
    ["parking", 35.1827306, 129.2108989],
    ["parking", 35.1821926, 129.2114239],
  ],
  haeundae: [
    ["toilet", 35.1589254, 129.1597873],
    ["toilet", 35.158571, 129.1579248],
    ["toilet", 35.1597399, 129.1624788],
    ["toilet", 35.1603724, 129.1688642],
    ["toilet", 35.1596022, 129.1695437],
    ["toilet", 35.1540957, 129.1510113],
    ["toilet", 35.1582128, 129.1728087],
    ["shower", 35.1585092, 129.1578755],
    ["shower", 35.1585351, 129.1578636],
    ["parking", 35.1612195, 129.1653282],
    ["parking", 35.1630554, 129.1640208],
    ["parking", 35.1639267, 129.1576119],
    ["parking", 35.1563659, 129.1538074],
    ["parking", 35.161132, 129.1532992],
    ["parking", 35.164664, 129.1551507],
    ["parking", 35.1608027, 129.1696236],
    ["parking", 35.1650239, 129.1541849],
    ["parking", 35.1535094, 129.1506175],
    ["parking", 35.1684578, 129.1581178],
  ],
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

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET 요청만 사용할 수 있습니다." });

  const beachKey = typeof req.query?.beach === "string" ? req.query.beach : "";
  const beach = BEACHES[beachKey];
  if (!beach) return res.status(400).json({ error: "지원하지 않는 해변입니다." });

  const genericNames = { toilet: "공중화장실", shower: "샤워시설", parking: "주차장" };
  const facilities = FACILITIES[beachKey].map(([type, lat, lon, customName], index) => ({
    id: `${beachKey}-${type}-${index + 1}`,
    type,
    name: customName || genericNames[type],
    lat,
    lon,
    distance: distanceInMeters(beach.lat, beach.lon, lat, lon),
  }));
  const counts = facilities.reduce(
    (result, facility) => ({ ...result, [facility.type]: result[facility.type] + 1 }),
    { toilet: 0, shower: 0, parking: 0 },
  );

  return res.status(200).json({
    beach: beachKey,
    beachName: beach.name,
    center: { lat: beach.lat, lon: beach.lon },
    radius: 1200,
    facilities,
    counts,
    source: "OpenStreetMap contributors",
    sourceUrl: "https://www.openstreetmap.org/copyright",
    checkedAt: "2026-07-30",
    note: "OpenStreetMap에 등록된 공개 시설 위치만 표시합니다.",
  });
}
