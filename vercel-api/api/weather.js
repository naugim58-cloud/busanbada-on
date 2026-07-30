const BEACH_IDS = {
  dadaepo: 308,
  gwangalli: 306,
  songjeong: 305,
  haeundae: 304,
};

function readValue(html, labelPattern, valuePattern = "([^<]+)") {
  const pattern = new RegExp(
    `<dt(?:\\s+class=['"][^'"]*['"])?[^>]*>${labelPattern}<\\/dt>[\\s\\S]{0,180}?<strong>${valuePattern}<\\/strong>`,
  );
  return html.match(pattern)?.[1]?.trim() ?? null;
}

function readPlainValue(html, labelPattern) {
  const pattern = new RegExp(
    `<dt(?:\\s+class=['"][^'"]*['"])?[^>]*>${labelPattern}<\\/dt>\\s*<dd[^>]*>([^<]+)<\\/dd>`,
  );
  return html.match(pattern)?.[1]?.trim() ?? null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=300");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET 요청만 사용할 수 있습니다." });

  const beach = typeof req.query?.beach === "string" ? req.query.beach : "";
  const beachId = BEACH_IDS[beach];
  if (!beachId) return res.status(400).json({ error: "지원하지 않는 해변입니다." });

  try {
    const response = await fetch(
      `https://www.weather.go.kr/special/CRP/beach/rpt_beach_${beachId}.html`,
      { headers: { "User-Agent": "BusanBadaON/1.0" } },
    );
    if (!response.ok) throw new Error(`KMA response ${response.status}`);

    const buffer = await response.arrayBuffer();
    const html = new TextDecoder("euc-kr").decode(buffer);
    const temperature = Number(readValue(html, "기온", "([\\d.]+)"));
    const humidity = Number(readValue(html, "습도", "([\\d.]+)"));
    const windSpeed = Number(readValue(html, "풍속", "([\\d.]+)"));
    const windDirection = readPlainValue(html, "풍향");
    const precipitationText = readValue(html, "1시간 강수량");
    const precipitation = precipitationText === "-" ? 0 : Number(precipitationText);
    const provided = html.match(/제공:(\d{4})년\s*(\d{2})월\s*(\d{2})일\s*(\d{2}):(\d{2})/);

    if (!Number.isFinite(temperature) || !Number.isFinite(precipitation)) {
      throw new Error("KMA page format changed");
    }

    return res.status(200).json({
      beach,
      temperature,
      precipitation,
      humidity: Number.isFinite(humidity) ? humidity : null,
      windSpeed: Number.isFinite(windSpeed) ? windSpeed : null,
      windDirection,
      observedAt: provided ? `${provided[4]}:${provided[5]}` : null,
      source: "KMA",
      sourceUrl: `https://www.weather.go.kr/special/CRP/beach/rpt_beach_${beachId}.html`,
    });
  } catch (error) {
    console.error("KMA beach weather error", error);
    return res.status(502).json({ error: "기상청 실황을 불러오지 못했습니다." });
  }
}
