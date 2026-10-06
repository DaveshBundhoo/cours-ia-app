// Fonction Vercel : récupère l'agenda TimeEdit côté serveur
// (le navigateur ne peut pas le lire directement à cause du CORS).
//
// Pour changer de lien sans toucher au code :
// Vercel > Settings > Environment Variables > EDT_ICS_URL
//
// Diagnostic : ouvre /api/edt?debug=1 dans le navigateur
const DEFAULT_URL =
  "https://cloud.timeedit.net/fr_gge/web/public/s.ics?i=6Z9Q0Q6n5Z5aQu988632YoyZZQ0Q55";

export default async function handler(req, res) {
  const url = process.env.EDT_ICS_URL || DEFAULT_URL;
  const debug = req.query && req.query.debug;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 9000);
    const r = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CoursClasse/1.0)",
        Accept: "text/calendar,text/plain,*/*",
      },
    });
    clearTimeout(timer);
    const text = await r.text();

    if (debug) {
      return res.status(200).json({
        status: r.status,
        contentType: r.headers.get("content-type"),
        longueur: text.length,
        commenceParBeginVcalendar: text.includes("BEGIN:VCALENDAR"),
        nombreDeCours: (text.match(/BEGIN:VEVENT/g) || []).length,
        premieresDates: (text.match(/DTSTART[^:\n]*:[^\r\n]+/g) || []).slice(0, 5),
        dernieresDates: (text.match(/DTSTART[^:\n]*:[^\r\n]+/g) || []).slice(-5),
        debut: text.slice(0, 300),
      });
    }

    if (!r.ok) throw new Error("TimeEdit a répondu " + r.status);
    if (!text.includes("BEGIN:VCALENDAR")) {
      throw new Error("Le lien ne renvoie pas un agenda (.ics) valide");
    }

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=3600, stale-if-error=86400");
    res.status(200).send(text);
  } catch (e) {
    res.status(502).json({ error: e.name === "AbortError" ? "TimeEdit met trop de temps à répondre" : e.message });
  }
}
