// Fonction Vercel : lit les fichiers d'une matière (photos / PDF) et demande à Gemini
// de retranscrire et organiser le cours. La clé Gemini reste côté serveur (Vercel).
//
// Variables à mettre dans Vercel (Settings > Environment Variables) :
//   GEMINI_API_KEY   (obligatoire)  -> ta clé Google AI Studio
//   GEMINI_MODEL     (facultatif)   -> par défaut gemini-3.8-flash
// Les variables VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY déjà présentes sont réutilisées.

const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const MAX_FICHIERS = 15;
const MAX_OCTETS = 14 * 1024 * 1024; // Gemini accepte ~20 Mo par requête, on garde de la marge

const MIME = {
  pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  webp: "image/webp", heic: "image/heic", heif: "image/heif",
};

const PROMPT = `Tu es un assistant qui transforme des notes de cours manuscrites (photos ou PDF) en un cours propre.
Tu reçois les fichiers d'une même matière, classés par dossier / chapitre.

Consignes :
- Retranscris fidèlement ce qui est écrit. N'invente rien : si un passage est illisible, écris [illisible].
- Regroupe les fichiers par chapitre, dans l'ordre. Fusionne les doublons entre élèves sans perdre d'information.
- Mets en forme en Markdown : un titre par chapitre (##), des sous-titres, des listes à puces, les définitions et formules mises en évidence.
- Termine par une courte section « À retenir » avec les points essentiels.
- Écris en français.`;

const sortie = (res, code, error) => res.status(code).json({ error });

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method !== "POST") return sortie(res, 405, "Méthode non autorisée.");

    const GKEY = process.env.GEMINI_API_KEY;
    const SB_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
    const SB_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!GKEY) return sortie(res, 500, "GEMINI_API_KEY est absente de Vercel. Ajoute-la dans Settings > Environment Variables, puis fais Redeploy.");
    if (!SB_URL || !SB_KEY) return sortie(res, 500, "VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY manque dans Vercel.");

    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return sortie(res, 401, "Tu dois être connecté (jeton manquant). Recharge la page et réessaie.");

    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    const matiere = String((body && body.matiere) || "").trim();
    if (!matiere) return sortie(res, 400, "Matière manquante.");

    const sbHeaders = { apikey: SB_KEY, Authorization: "Bearer " + token };

    // 1) vérifier que la personne est bien connectée
    const u = await fetch(SB_URL + "/auth/v1/user", { headers: sbHeaders });
    if (!u.ok) return sortie(res, 401, "Session expirée. Reconnecte-toi puis réessaie.");

    // 2) lister les fichiers de la matière
    const r = await fetch(`${SB_URL}/rest/v1/cours?select=*&matiere=eq.${encodeURIComponent(matiere)}&order=created_at.asc`, { headers: sbHeaders });
    if (!r.ok) return sortie(res, 502, "Lecture de la base impossible : " + (await r.text()).slice(0, 200));
    let lignes = await r.json();
    if (!Array.isArray(lignes) || lignes.length === 0) return sortie(res, 404, "Aucun fichier dans cette matière.");
    lignes.sort((a, b) => String(a.chapitre || "Général").localeCompare(String(b.chapitre || "Général"), "fr", { numeric: true }));

    // 3) télécharger les fichiers
    const parts = [{ text: PROMPT + `\n\nMatière : ${matiere}` }];
    let total = 0, lus = 0, ignores = [];
    for (const l of lignes) {
      if (lus >= MAX_FICHIERS) { ignores.push(l.fichier_name || l.fichier); continue; }
      const ext = String(l.fichier || "").split(".").pop().toLowerCase();
      const mime = MIME[ext];
      const nom = l.fichier_name || String(l.fichier).split("/").pop().split("-").slice(1).join("-") || "document";
      if (!mime) { ignores.push(nom); continue; }

      const chemin = String(l.fichier).split("/").map(encodeURIComponent).join("/");
      const f = await fetch(`${SB_URL}/storage/v1/object/authenticated/cours/${chemin}`, { headers: sbHeaders });
      if (!f.ok) { ignores.push(nom); continue; }
      const buf = Buffer.from(await f.arrayBuffer());
      if (total + buf.length > MAX_OCTETS) { ignores.push(nom); continue; }
      total += buf.length; lus++;

      parts.push({ text: `--- Fichier « ${nom} » — dossier / chapitre : ${l.chapitre || "Général"} ---` });
      parts.push({ inline_data: { mime_type: mime, data: buf.toString("base64") } });
    }
    if (lus === 0) return sortie(res, 422, "Aucun fichier lisible (photos ou PDF) n'a pu être récupéré.");

    // 4) Gemini
    const g = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GKEY },
      body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { temperature: 0.2 } }),
    });
    const raw = await g.text();
    let data; try { data = JSON.parse(raw); } catch (e) { data = null; }
    if (!g.ok) {
      const m = (data && data.error && data.error.message) || raw.slice(0, 200);
      return sortie(res, 502, `Gemini a refusé la demande (${g.status}) : ${m}`);
    }
    const texte = ((data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [])
      .map((p) => p.text || "").join("").trim();
    if (!texte) return sortie(res, 502, "Gemini n'a rien renvoyé (contenu bloqué ou vide). Réessaie.");

    const note = ignores.length ? `\n\n---\n_Fichiers non lus (trop nombreux, trop lourds ou format non pris en charge) : ${ignores.join(", ")}_` : "";
    return res.status(200).json({ cours_markdown: texte + note });
  } catch (e) {
    return sortie(res, 500, "Erreur du serveur : " + (e && e.message ? e.message : e));
  }
}