import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const maxDuration = 60; 

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { matiere, chapitre, fichiers } = req.body;
  if (!matiere || !fichiers || fichiers.length === 0) {
    return res.status(400).json({ error: 'Matière ou fichiers manquants' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Non autorisé. Token manquant.' });
  }
  const token = authHeader.split(' ')[1];

  try {
    if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
      throw new Error("Clés Supabase manquantes côté serveur.");
    }
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Clé GEMINI_API_KEY manquante dans Vercel.");
    }

    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // Vérifier que l'utilisateur est bien connecté à l'application
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Session invalide ou expirée.");

    // Transformer les fichiers Base64 du front en format lisible par Gemini
    const imageParts = fichiers.map(f => ({
      inlineData: { data: f.data, mimeType: f.mimeType }
    }));

    // Demande à l'IA
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Voici le support (PDF ou photos) du cours de "${matiere}" (Chapitre : ${chapitre}).
    Ton objectif est de synthétiser parfaitement ce document pour créer une fiche de révision complète et facile à lire.
    - Sois précis et garde toutes les définitions, schémas logiques et formules importantes. Ne perds aucune information cruciale du cours.
    - Mets le texte en forme de manière claire en Markdown (titres avec ##, listes à puces, mets les concepts clés en **gras**).`;

    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const text = response.text();

    return res.status(200).json({ cours_markdown: text });

  } catch (error) {
    console.error("Erreur Backend IA:", error);
    return res.status(500).json({ error: error.message || "Erreur interne du serveur lors de la génération." });
  }
}