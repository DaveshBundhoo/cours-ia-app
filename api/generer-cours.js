// api/generer-cours.js

// C'EST LA LIGNE MAGIQUE : Elle indique à Vercel d'utiliser un serveur "Edge" 
// pour ne pas subir la coupure des 10 secondes.
export const config = {
  runtime: 'edge', 
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), { status: 405 });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Non autorisé. Connectez-vous.' }), { status: 401 });
    }

    // Récupération des données envoyées par ton App React
    const body = await req.json();
    const { matiere, chapitre, fichiers } = body;

    if (!matiere || !fichiers || fichiers.length === 0) {
      return new Response(JSON.stringify({ error: 'Matière ou fichiers manquants' }), { status: 400 });
    }

    const GKEY = process.env.GEMINI_API_KEY;
    const SB_URL = process.env.VITE_SUPABASE_URL;
    const SB_KEY = process.env.VITE_SUPABASE_ANON_KEY;

    if (!GKEY || !SB_URL || !SB_KEY) {
        throw new Error("Clés API manquantes dans les paramètres Vercel.");
    }

    // 1. Vérifier que l'étudiant est bien connecté (sécurité Supabase)
    const sbRes = await fetch(`${SB_URL}/auth/v1/user`, {
        headers: { 'apikey': SB_KEY, 'Authorization': authHeader }
    });
    if (!sbRes.ok) throw new Error("Session expirée. Veuillez recharger la page.");

    // 2. Préparer les instructions et intégrer le PDF pour Gemini
    const parts = [
        { text: `Voici le support (PDF ou photos) du cours de "${matiere}" (Chapitre : ${chapitre}). Ton objectif est de synthétiser ce document pour créer une fiche de révision complète et facile à lire en Markdown (avec des titres ## et des listes). Ne perds aucune définition importante.` }
    ];

    for (const f of fichiers) {
        parts.push({
            inlineData: { mimeType: f.mimeType, data: f.data }
        });
    }

    // 3. Demander à Gemini de travailler (l'attente peut durer 20s, Edge l'autorise)
    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GKEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ role: "user", parts }],
            generationConfig: { temperature: 0.2 }
        })
    });

    const geminiData = await geminiRes.json();

    if (!geminiRes.ok) {
        throw new Error((geminiData.error && geminiData.error.message) || "Gemini a refusé la requête.");
    }

    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "Erreur : L'IA n'a rien renvoyé.";

    // 4. Renvoyer la synthèse à ton application React
    return new Response(JSON.stringify({ cours_markdown: text }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("Erreur Backend Edge:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}