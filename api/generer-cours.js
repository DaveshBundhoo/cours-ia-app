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

// Limites de l'offre gratuite (à recopier depuis aistudio.google.com/rate-limit si elles changent).
// rpm = requêtes par minute, rpd = requêtes par jour (remis à zéro à minuit, heure du Pacifique).
const LIMITES = {
  "gemini-3.8-flash": { rpm: 5, rpd: 20 },
  "gemini-3.5-flash": { rpm: 5, rpd: 20 },
};
const TYPES_OK = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"];
const MAX_FICHIERS = 20;

const erreur = (res, code, message) => res.status(code).json({ error: message });

function debutJourPacifique(now) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Los_Angeles", hourCycle: "h23", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(now);
  const g = (t) => Number(parts.find((p) => p.type === t).value);
  return new Date(now.getTime() - (g("hour") * 3600 + g("minute") * 60 + g("second")) * 1000 - now.getMilliseconds());
}
const duree = (ms) => {
  const s = Math.max(1, Math.ceil(ms / 1000));
  return s >= 3600 ? Math.floor(s / 3600) + " h " + Math.floor((s % 3600) / 60) + " min" : s >= 60 ? Math.ceil(s / 60) + " min" : s + " s";
};
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
        `Les fichiers suivants sont dans l'ordre des séances (plusieurs feuilles ou photos peuvent appartenir à la même séance).\n` +
        `Fusionne-les en UNE SEULE fiche de révision cohérente du chapitre, en français, en Markdown, à usage personnel :\n` +
        `- regroupe les idées par thème, supprime les répétitions entre les feuilles ;\n` +
        `- reformule avec tes propres mots, sans recopier le document mot pour mot ;\n` +
        `- structure avec des titres (##), des listes à puces, les notions clés en gras ;\n` +
        `- garde les définitions, formules et exemples importants ;\n` +
        `- si un passage est illisible, écris [illisible] sans rien inventer ;\n` +
        `- termine par une section « À retenir » avec l'essentiel.`,
    }];
    for (const f of fichiers) {
      const mime = String((f && f.mimeType) || "").toLowerCase();
      if (!TYPES_OK.includes(mime) || !f.data) return erreur(res, 400, "Format non pris en charge (utilise PDF, JPG, PNG ou WEBP).");
      parts.push({ text: `--- Fichier ${parts.length > 1 ? Math.ceil(parts.length / 2) : 1} : ${String(f.nom || "sans nom").slice(0, 120)} ---` });
      parts.push({ inline_data: { mime_type: mime, data: f.data } });
    }

    // 4) quotas : on regarde combien de générations la classe a déjà utilisées
    const maintenant = new Date();
    const debutJour = debutJourPacifique(maintenant);
    let usage = [];
    try {
      const ur = await fetch(`${SB_URL}/rest/v1/ia_usage?select=modele,created_at&created_at=gte.${encodeURIComponent(debutJour.toISOString())}&order=created_at.asc&limit=1000`, { headers: sbHeaders });
      if (ur.ok) usage = await ur.json(); // si la table n'existe pas encore, on ne bloque pas
    } catch (e) {}
    const compte = (m, depuisMs) => usage.filter((r) => r.modele === m && new Date(r.created_at).getTime() >= depuisMs).length;
    const MODELES = Object.keys(LIMITES).filter((m) =>
      compte(m, debutJour.getTime()) < LIMITES[m].rpd && compte(m, maintenant.getTime() - 60000) < LIMITES[m].rpm);
    if (MODELES.length === 0) {
      const jourPlein = Object.keys(LIMITES).every((m) => compte(m, debutJour.getTime()) >= LIMITES[m].rpd);
      const attente = jourPlein
        ? debutJour.getTime() + 86400000 - maintenant.getTime()
        : Math.min(...usage.filter((r) => new Date(r.created_at).getTime() > maintenant.getTime() - 60000).map((r) => new Date(r.created_at).getTime() + 60000 - maintenant.getTime()));
      return erreur(res, 429, jourPlein
        ? "Le quota gratuit de la journée est épuisé pour toute la classe. Il revient dans environ " + duree(attente) + "."
        : "Trop de générations en même temps (limite par minute). Réessaie dans " + duree(attente) + ".");
    }
    const noter = async (modele) => {
      try {
        await fetch(`${SB_URL}/rest/v1/ia_usage`, {
          method: "POST",
          headers: { ...sbHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ modele }),
        });
      } catch (e) {}
    };

    // 5) Gemini : on essaie les modèles qui ont encore de la place, avec une nouvelle tentative si Google est surchargé
    let texte = "", derniere = "";
    for (const modele of MODELES) {
      for (let essai = 0; essai < 2 && !texte; essai++) {
        const g = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": GKEY },
          body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { temperature: 0.3 } }),
        });
        const brut = await g.text();
        if (g.status !== 404 && g.status !== 503) await noter(modele); // compte comme une requête utilisée
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