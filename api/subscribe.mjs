// Vercel serverless function — MiroMesh notify capture for siliconchimps.com.
// Subscribes to the Genie Wars beehiiv publication (same list as geniewars.com
// and internetacid.com). UTM params tag this as a siliconchimps/miromesh signup.
// The referrer field carries document.referrer from the browser — the door they
// walked through (direct, x.com, a dispatch link, geniewars.com, etc.).

const BEEHIIV_PUB_ID = "pub_aca90456-8f9e-4430-a24e-54f818c93664";
const BEEHIIV_API_URL = `https://api.beehiiv.com/v2/publications/${BEEHIIV_PUB_ID}/subscriptions`;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const email = ((body && body.email) || "").trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    res.status(400).json({ error: "Enter a valid email." });
    return;
  }

  // Referrer: the URL the visitor came from. Capped at 500 chars, passed as-is
  // to beehiiv's referring_site field. Empty string → omit (undefined → not sent).
  const referrer = typeof body.referrer === "string" && body.referrer.length > 0
    ? body.referrer.slice(0, 500)
    : undefined;

  const apiKey = (process.env.BEEHIIV_API_KEY || "").trim();
  if (!apiKey) {
    res.status(503).json({ error: "Signup is temporarily unavailable. Try again shortly." });
    return;
  }

  try {
    const payload = {
      email,
      reactivate_existing: true,
      send_welcome_email: true,
      utm_source: "siliconchimps.com",
      utm_medium: "miromesh-notify",
      utm_campaign: "miromesh",
    };
    if (referrer !== undefined) payload.referring_site = referrer;

    const r = await fetch(BEEHIIV_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const text = await r.text();
      console.error("beehiiv subscribe failed", r.status, text.slice(0, 300));
      res.status(502).json({ error: "Couldn't sign you up just now. Please try again." });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("beehiiv subscribe error", err);
    res.status(502).json({ error: "Network hiccup. Please try again." });
  }
}
