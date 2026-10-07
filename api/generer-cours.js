// api/generer-cours.js
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { matiere } = req.body;
  if (!matiere) return res.status(400).json({ error: 'Matière manquante' });

  try {
    // 1. Initialiser Supabase et Gemini en utilisant les variables d'environnement de Vercel
    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // 2. Trouver tous les fichiers de cette matière dans la BDD Supabase
    const { data: cours, error } = await supabase
      .from('cours')
      .select('fichier')
      .eq('matiere', matiere);

    if (error) throw new Error("Erreur base de données : " + error.message);
    if (!cours || cours.length === 0) throw new Error("Aucun fichier trouvé pour cette matière.");

    // 3. Télécharger les fichiers depuis Supabase Storage et les préparer pour Gemini
    const imageParts = [];
    for (const c of cours) {
      const { data: fileData, error: dlError } = await supabase.storage.from('cours').download(c.fichier);
      if (dlError) continue;

      // Convertir l'image ou le PDF en format compréhensible par l'API Gemini (Base64)
      const buffer = await fileData.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const mimeType = fileData.type || 'image/jpeg';

      imageParts.push({
        inlineData: { data: base64, mimeType }
      });
    }

    if (imageParts.length === 0) {
      throw new Error("Impossible de télécharger ou de lire les images.");
    }

    // 4. Appel de l'IA (Gemini 1.5 Flash : rapide et excellent avec les images)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Voici plusieurs photos de notes manuscrites et de diapositives concernant le cours de "${matiere}".
    Ton objectif est de lire ces notes, de comprendre l'écriture de tout le monde, et de fusionner toutes ces informations pour créer un document de cours unique, propre, complet et bien structuré.
    - Ignore les informations en double (si plusieurs élèves ont pris la même chose en photo).
    - Corrige les fautes d'orthographe ou les abréviations.
    - Mets le texte en forme de manière claire et professionnelle en Markdown. Utilise des titres de section (##), des listes à puces, et mets en gras les concepts clés.
    - Sois précis et garde toutes les définitions et formules importantes. Ne perds aucune information cruciale du cours.`;

    // On envoie le texte d'instruction + toutes les images d'un coup
    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const text = response.text();

    // 5. Renvoyer le texte final généré au front-end React
    res.status(200).json({ cours_markdown: text });

  } catch (error) {
    console.error("Erreur Backend IA:", error);
    res.status(500).json({ error: error.message });
  }
}