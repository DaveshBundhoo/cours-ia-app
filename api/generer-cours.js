import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// La ligne magique pour empêcher Vercel de couper au bout de 10 secondes
export const config = {
  runtime: 'edge', 
};

export default async function handler(req) {
  // Sur un serveur Edge, on utilise les standards du Web (comme Response)
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), { status: 405 });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Non autorisé. Connectez-vous.' }), { status: 401 });
    }
    const token = authHeader.split(' ')[1];

    // Récupération des données envoyées par ton application React
    const body = await req.json();
    const { matiere, chapitre, fichiers } = body;

    if (!matiere || !fichiers || fichiers.length === 0) {
      return new Response(JSON.stringify({ error: 'Matière ou fichiers manquants' }), { status: 400 });
    }

    const GKEY = process.env.GEMINI_API_KEY;
    const SB_URL = process.env.VITE_SUPABASE_URL;
    const SB_KEY = process.env.VITE_SUPABASE_ANON_KEY;

    if (!GKEY || !SB_URL || !SB_KEY) {
        throw new Error("Clés API manquantes dans Vercel.");
    }

    // 1. Vérification de la session utilisateur dans Supabase
    const supabase = createClient(SB_URL, SB_KEY);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Session expirée. Veuillez recharger la page.");

    // 2. Utilisation du SDK OFFICIEL de Google (qui gère l'URL et les modèles tout seul)
    const genAI = new GoogleGenerativeAI(GKEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Voici le support (PDF ou photos) du cours de "${matiere}" (Chapitre : ${chapitre}). Ton objectif est de synthétiser ce document pour créer une fiche de révision complète et facile à lire en Markdown (avec des titres ## et des listes). Ne perds aucune définition importante.`;
    
    // On prépare le tableau des éléments à envoyer à Gemini
    const parts = [prompt];
    for (const f of fichiers) {
        parts.push({
            inlineData: { mimeType: f.mimeType, data: f.data }
        });
    }

    // 3. Appel de l'IA (Le serveur Edge permet d'attendre la réponse complète sans couper)
    const result = await model.generateContent(parts);
    const text = result.response.text();

    // 4. Renvoi du texte généré au frontend
    return new Response(JSON.stringify({ cours_markdown: text }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("Erreur Backend Edge:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}