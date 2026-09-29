import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const maxDuration = 60; // Configuración para evitar timeouts en Vercel

export async function POST(req: NextRequest) {
  try {
    const { question, idealAnswer, studentAnswer } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: 'Falta configurar la API Key.' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
        model: 'gemini-3.5-flash', 
        generationConfig: { responseMimeType: "application/json" } 
    });

    const prompt = `
      Eres un profesor comprensivo y alentador evaluando la respuesta de desarrollo de un estudiante.
      
      Pregunta que se le hizo al estudiante: "${question}"
      Respuesta ideal esperada: "${idealAnswer}"
      Respuesta que escribió el estudiante: "${studentAnswer}"

      Tu tarea: 
      1. Determinar si la respuesta del estudiante es "correcta" (es decir, demuestra que entendió el concepto base, aunque use otras palabras, cometa faltas de ortografía o lo explique muy simple).
      2. Si el estudiante dice "no sé", insulta, escribe letras al azar o dice algo sin sentido o totalmente incorrecto, entonces evalúa como INCORRECTA (false).
      3. Dale un 'feedback' directo al estudiante: un comentario corto, amigable y constructivo (1 o 2 oraciones). Si estuvo bien, felicítalo y complementa. Si estuvo mal, explícale con cariño por qué no es correcto.

      Retorna un JSON ESTRICTAMENTE con esta estructura (sin formato de markdown extra):
      {
        "isCorrect": true o false,
        "feedback": "Tu mensaje directo al estudiante aquí..."
      }
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    let jsonResponse;
    try {
      jsonResponse = JSON.parse(responseText.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, ''));
    } catch (e) {
      jsonResponse = JSON.parse(responseText);
    }

    return NextResponse.json(jsonResponse);
    
  } catch (error: any) {
    console.error('Error evaluate-answer:', error);
    return NextResponse.json({ error: 'Error de Inteligencia Artificial: ' + error.message }, { status: 500 });
  }
}
