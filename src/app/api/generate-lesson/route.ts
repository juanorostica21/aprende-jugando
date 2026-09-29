import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import pdfParse from 'pdf-parse';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const instructions = formData.get('instructions') as string;

    if (!file) {
      return NextResponse.json({ error: 'No se subió ningún archivo' }, { status: 400 });
    }

    // Parse the PDF
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const pdfData = await pdfParse(buffer);
    const pdfText = pdfData.text;

    // Connect to Gemini
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'Pega_tu_API_key_aqui') {
        return NextResponse.json({ error: 'Falta configurar la API Key de Gemini en el servidor (.env.local).' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash', 
        generationConfig: { responseMimeType: "application/json" } 
    });

    const prompt = `
      Eres un experto agente pedagógico. Se te entregará el texto extraído de un PDF educativo y unas instrucciones del apoderado.
      Tu objetivo es generar una sesión de estudio interactiva que consta de dos partes:
      
      PARTE 1: LECCIONES DIDÁCTICAS (Micro-learning)
      Resume los conceptos más importantes en 2 o 3 "tarjetas" breves. Usa analogías simples, emojis y lenguaje adecuado para un niño.
      
      PARTE 2: EVALUACIÓN (Quiz)
      Genera 2 preguntas basadas EXACTAMENTE en lo que enseñaste en la Parte 1.
      - 1 pregunta de alternativas (multiple choice)
      - 1 pregunta de verdadero/falso (true_false)

      Instrucciones del apoderado: ${instructions || 'Enseñar los conceptos principales del texto.'}
      
      Texto del PDF (fragmento):
      ${pdfText.substring(0, 20000)}

      Debes retornar un JSON ESTRICTAMENTE con esta estructura (sin formato de markdown, solo el raw JSON):
      {
        "lessons": [
          { "title": "Título corto", "content": "Explicación simple y divertida...", "icon": "🌎" }
        ],
        "quiz": [
          { "type": "multiple_choice", "question": "...", "options": ["Opción A", "Opción B", "Opción C"], "correct_answer": "Opción A" },
          { "type": "true_false", "question": "...", "options": ["Verdadero", "Falso"], "correct_answer": "Verdadero" }
        ]
      }
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Parse to ensure it is valid JSON before sending
    const jsonResponse = JSON.parse(responseText);

    return NextResponse.json(jsonResponse);
    
  } catch (error) {
    console.error('Error generating lesson:', error);
    return NextResponse.json({ error: 'Error procesando el documento o conectando con IA.' }, { status: 500 });
  }
}
