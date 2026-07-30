const ALLOWED_ORIGINS = new Set([
  "https://naugim58-cloud.github.io",
]);

const SYSTEM_INSTRUCTION = `당신은 '부산바다 ON'의 친절한 AI 고객센터 상담원입니다.
부산의 다대포, 광안리, 송정, 해운대 해수욕장과 날씨, 인파, 주차장,
화장실, 샤워실, 관광 및 해양 레저에 관한 질문에 간결하고 도움 되게 답하세요.
확실하지 않은 실시간 정보는 추측하지 말고 현장 안내 또는 공식 정보를 확인하라고 말하세요.
사용자가 질문한 언어로 답하세요.`;

export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST 요청만 사용할 수 있습니다." });
  if (!ALLOWED_ORIGINS.has(origin)) return res.status(403).json({ error: "허용되지 않은 사이트입니다." });

  const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-6) : [];
  if (!question || question.length > 800) {
    return res.status(400).json({ error: "질문은 1~800자로 입력해 주세요." });
  }
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "AI 고객센터 설정이 아직 완료되지 않았습니다." });
  }

  const contents = history
    .filter((item) => item && typeof item.text === "string")
    .map((item) => ({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: item.text.slice(0, 800) }],
    }));
  contents.push({ role: "user", parts: [{ text: question }] });

  try {
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          contents,
          generationConfig: { maxOutputTokens: 500 },
        }),
      },
    );
    const result = await response.json();
    if (!response.ok) {
      console.error("Gemini API error", response.status, result?.error?.message);
      return res.status(502).json({ error: "AI 답변을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." });
    }
    const answer = result?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();
    return res.status(200).json({ answer: answer || "답변을 만들지 못했습니다. 질문을 다시 표현해 주세요." });
  } catch (error) {
    console.error("Customer center error", error);
    return res.status(500).json({ error: "고객센터 연결 중 오류가 발생했습니다." });
  }
}
