import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const image = formData.get('image') as File | null;
    const instructions = formData.get('instructions') as string;

    if (!file) {
      return NextResponse.json({ error: 'Falta el archivo principal (PDF)' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString('base64');

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'Pega_tu_API_key_aqui') {
        return NextResponse.json({ error: 'Falta configurar la API Key de Gemini en el servidor.' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
        model: 'gemini-3.5-flash', 
        generationConfig: { responseMimeType: "application/json" } 
    });

    const prompt = `
      Eres el mejor profesor y agente pedagógico del mundo, especialista en niños y micro-learning. 
      Analiza los documentos adjuntos minuciosamente. El apoderado solicita: "${instructions || 'Enséñale los conceptos clave.'}"
      
      MISIÓN: Generar una sesión de estudio profunda, entretenida y altamente interactiva.

      PARTE 1: LA CLASE MAGISTRAL (10 a 15 tarjetas)
      Crea entre 10 y 15 tarjetas ("lessons") con explicaciones detalladas (2 o 3 párrafos por tarjeta).
      - Usa metáforas, datos curiosos, analogías infantiles y emojis.
      - IMPORTANTE: Al final de cada tarjeta, debes incluir un "mini_check" (una pregunta rápida de alternativas de 3 opciones) para asegurarte de que el niño entendió ESA lámina antes de avanzar.
      
      PARTE 2: EVALUACIÓN MASIVA (20 preguntas en total)
      Genera EXACTAMENTE 20 preguntas sobre lo enseñado, mezclando 4 tipos (5 de cada uno):
      1. "multiple_choice": Alternativas (4 opciones).
      2. "true_false": Verdadero o falso.
      3. "short_answer": Pregunta de desarrollo donde el niño deba pensar y escribir. Provee una "correct_answer" como respuesta ideal.
      4. "matching": Unión de conceptos. Debe incluir un array "pairs" con 3 o 4 pares de conceptos.

      Retorna un JSON ESTRICTAMENTE con esta estructura:
      {
        "lessons": [
          { 
            "title": "...", 
            "content": "Párrafos largos de explicación. Usa \\n\\n para separar párrafos. NO uses saltos de línea reales...", 
            "icon": "🌋",
            "mini_check": {
              "question": "¿Qué es el magma?",
              "options": ["Roca derretida", "Agua", "Viento"],
              "correct_answer": "Roca derretida"
            }
          }
        ],
        "quiz": [
          { "type": "multiple_choice", "question": "...", "options": ["A", "B", "C", "D"], "correct_answer": "A" },
          { "type": "true_false", "question": "...", "options": ["Verdadero", "Falso"], "correct_answer": "Falso" },
          { "type": "short_answer", "question": "...", "correct_answer": "Puntos clave de la respuesta ideal..." },
          { "type": "matching", "question": "...", "pairs": [ {"left": "Concepto 1", "right": "Definición 1"}, {"left": "Concepto 2", "right": "Definición 2"} ] }
        ]
      }

      REGLA CRÍTICA: NO incluyas saltos de línea literales ni tabulaciones dentro de los textos. Si necesitas separar párrafos en 'content', debes escribir los caracteres '\\n' literalmente. Tu salida debe ser un JSON perfecto.
    `;

    const parts: any[] = [
      prompt,
      { inlineData: { data: base64Data, mimeType: "application/pdf" } }
    ];

    if (image) {
      const imageArrayBuffer = await image.arrayBuffer();
      const imageBuffer = Buffer.from(imageArrayBuffer);
      const imageBase64 = imageBuffer.toString('base64');
      parts.push({
        inlineData: {
          data: imageBase64,
          mimeType: image.type || "image/jpeg"
        }
      });
    }

    const result = await model.generateContent(parts);
    const responseText = result.response.text();
    
    let jsonResponse;
    try {
      jsonResponse = JSON.parse(responseText.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, ''));
    } catch (e) {
      jsonResponse = JSON.parse(responseText);
    }

    return NextResponse.json(jsonResponse);
    
  } catch (error: any) {
    console.error('Error generating lesson:', error);
    return NextResponse.json({ error: 'Error de Inteligencia Artificial: ' + error.message }, { status: 500 });
  }
}
