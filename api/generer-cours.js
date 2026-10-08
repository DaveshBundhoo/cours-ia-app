import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const config = {
  runtime: 'edge', 
};

// Fonction spéciale pour envoyer le PDF à l'API "File" de Gemini depuis le serveur Edge
async function uploadFileToGemini(base64Data, mimeType, apiKey) {
  // Convertir le texte Base64 en fichier binaire
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Téléverser le fichier sur les serveurs temporaires de Google
  const res = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'raw',
      'X-Goog-Upload-Command': 'start, upload, finalize',
      'X-Goog-Upload-Header-Content-Length': bytes.length.toString(),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'Content-Type': mimeType
    },
    body: bytes
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error("Échec de l'envoi du PDF vers Gemini : " + err);
  }
  
  const data = await res.json();
  return data.file; // Retourne un objet contenant l'URI du fichier
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), { status: 405 });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Non autorisé.' }), { status: 401 });
    }
    const token = authHeader.split(' ')[1];

    const body = await req.json();
    const { matiere, chapitre, fichiers } = body;

    if (!matiere || !fichiers || fichiers.length === 0) {
      return new Response(JSON.stringify({ error: 'Matière ou fichiers manquants' }), { status: 400 });
    }

    const GKEY = process.env.GEMINI_API_KEY;
    const SB_URL = process.env.VITE_SUPABASE_URL;
    const SB_KEY = process.env.VITE_SUPABASE_ANON_KEY;

    if (!GKEY || !SB_URL || !SB_KEY) throw new Error("Clés API manquantes.");

    // 1. Vérification de l'utilisateur
    const supabase = createClient(SB_URL, SB_KEY);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Session expirée.");

    // 2. On prépare les fichiers pour Gemini
    const parts = [
        { text: `Voici le support du cours de "${matiere}" (Chapitre : ${chapitre}). Synthétise ce document pour créer une fiche de révision complète et lisible en Markdown.` }
    ];

    for (const f of fichiers) {
        if (f.mimeType === 'application/pdf') {
            // Règle stricte de Google : Les PDF doivent passer par l'API File
            const uploadedFile = await uploadFileToGemini(f.data, f.mimeType, GKEY);
            parts.push({
                fileData: { mimeType: uploadedFile.mimeType, fileUri: uploadedFile.uri }
            });
        } else {
            // Les images (PNG, JPG) peuvent être envoyées directement
            parts.push({
                inlineData: { mimeType: f.mimeType, data: f.data }
            });
        }
    }

    // 3. Appel de Gemini (on repasse sur Flash pour avoir 15 requêtes/minute !)
    const genAI = new GoogleGenerativeAI(GKEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent(parts);
    const text = result.response.text();

    return new Response(JSON.stringify({ cours_markdown: text }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("Erreur Backend Edge:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}