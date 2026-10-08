// api/generer-cours.js
// Reçoit les fichiers (photos / PDF en base64), les envoie à Gemini et renvoie une synthèse.
// Rien n'est sauvegardé ici : les fichiers passent juste par le serveur.
//
// Variables Vercel (Settings > Environment Variables) :
//   GEMINI_API_KEY          (obligatoire)
//   VITE_SUPABASE_URL       (déjà présente)
//   VITE_SUPABASE_ANON_KEY  (déjà présente)
//   GEMINI_MODEL            (facultatif : modèle à essayer en premier)
//
// Aucun paquet à installer : tout passe par fetch.

const MODELES = [process.env.GEMINI_MODEL, "gemini-3.8-flash", "gemini-3.5-flash", "gemini-2.5-flash"].filter(Boolean);
const TYPES_OK = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"];
const MAX_FICHIERS = 10;

const erreur = (res, code, message) => res.status(code).json({ error: message });
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method !== "POST") return erreur(res, 405, "Méthode non autorisée.");

    const GKEY = process.env.GEMINI_API_KEY;
    const SB_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
    const SB_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!GKEY) return erreur(res, 500, "GEMINI_API_KEY est absente de Vercel (Settings > Environment Variables), puis fais Redeploy.");
    if (!SB_URL || !SB_KEY) return erreur(res, 500, "VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY manque dans Vercel.");

    // 1) la personne doit être connectée
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return erreur(res, 401, "Non autorisé : recharge la page et reconnecte-toi.");
    const u = await fetch(SB_URL + "/auth/v1/user", { headers: { apikey: SB_KEY, Authorization: "Bearer " + token } });
    if (!u.ok) return erreur(res, 401, "Session expirée : reconnecte-toi puis réessaie.");

    // 2) lire la demande
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    const matiere = String((body && body.matiere) || "").trim();
    const chapitre = String((body && body.chapitre) || "Général").trim();
    const fichiers = Array.isArray(body && body.fichiers) ? body.fichiers : [];
    if (!matiere || fichiers.length === 0) return erreur(res, 400, "Matière ou fichiers manquants.");
    if (fichiers.length > MAX_FICHIERS) return erreur(res, 400, `Maximum ${MAX_FICHIERS} fichiers à la fois.`);

    // 3) préparer les fichiers pour Gemini
    const parts = [{
      text:
        `Voici le support d'un cours de « ${matiere} » (chapitre : ${chapitre}).\n` +
        `Rédige une fiche de révision en français, en Markdown, à usage personnel :\n` +
        `- reformule avec tes propres mots, sans recopier le document mot pour mot ;\n` +
        `- structure avec des titres (##), des listes à puces, les notions clés en gras ;\n` +
        `- garde les définitions, formules et exemples importants ;\n` +
        `- si un passage est illisible, écris [illisible] sans rien inventer ;\n` +
        `- termine par une section « À retenir » avec l'essentiel.`,
    }];
    for (const f of fichiers) {
      const mime = String((f && f.mimeType) || "").toLowerCase();
      if (!TYPES_OK.includes(mime) || !f.data) return erreur(res, 400, "Format non pris en charge (utilise PDF, JPG, PNG ou WEBP).");
      parts.push({ inline_data: { mime_type: mime, data: f.data } });
    }

    // 4) Gemini : on essaie plusieurs modèles, avec une nouvelle tentative si Google est surchargé
    let texte = "", derniere = "";
    for (const modele of MODELES) {
      for (let essai = 0; essai < 2 && !texte; essai++) {
        const g = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": GKEY },
          body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { temperature: 0.3 } }),
        });
        const brut = await g.text();
        let data = null; try { data = JSON.parse(brut); } catch (e) {}

        if (g.ok) {
          const p = (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
          texte = p.map((x) => x.text || "").join("").trim();
          if (!texte) derniere = "Réponse vide (contenu bloqué ?).";
          break;
        }
        derniere = `${modele} (${g.status}) : ` + ((data && data.error && data.error.message) || brut.slice(0, 200));
        if (g.status === 503 || g.status === 429) { await pause(1500); continue; } // surcharge : on réessaie
        break; // 404, 400… : on passe au modèle suivant
      }
      if (texte) break;
    }
    if (!texte) return erreur(res, 502, "Gemini n'a pas pu répondre. " + derniere);

    return res.status(200).json({ cours_markdown: texte });
  } catch (e) {
    return erreur(res, 500, "Erreur du serveur : " + (e && e.message ? e.message : e));
  }
}