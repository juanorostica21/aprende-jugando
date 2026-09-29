import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const image = formData.get('image') as File | null;
    const instructions = formData.get('instructions') as string;
    const subject = formData.get('subject') as string || 'General';

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

    let subjectInstructions = "";
    if (subject === "Matemáticas") {
       subjectInstructions = `
       ESTRATEGIA PEDAGÓGICA PARA MATEMÁTICAS 🧮:
       - No uses textos largos ni teoría aburrida.
       - En las láminas (lessons), enseña CÓMO resolver los problemas paso a paso. Muestra ejemplos numéricos claros.
       - En el mini_check y el quiz, enfócate en resolución de problemas (problemas de planteo o ejercicios directos).
       - En "matching", haz que una operaciones con su resultado (ej. "5 x 4" con "20") o conceptos geométricos con su fórmula.
       `;
    } else if (subject === "Inglés") {
       subjectInstructions = `
       ESTRATEGIA PEDAGÓGICA PARA INGLÉS 🇬🇧:
       - Enfócate en vocabulario, reglas gramaticales y comprensión.
       - En las láminas, pon oraciones de ejemplo en inglés con su traducción al español.
       - En "matching" (términos pareados), obliga al niño a cruzar palabras o frases cortas en inglés con su significado en español.
       - En "short_answer", pide que traduzca frases o aplique reglas (ej. "Escribe esta oración en pasado").
       `;
    } else {
       subjectInstructions = `
       ESTRATEGIA PEDAGÓGICA CONCEPTUAL (Ciencias, Historia, General) 🧬:
       - Desglosa bien los conceptos (ej. qué es, por qué pasa, ejemplos).
       - Usa metáforas, datos curiosos, y analogías infantiles.
       - "content" debe ser un texto explicativo (2 o 3 párrafos por tarjeta).
       `;
    }

    const prompt = `
      Eres el mejor profesor y agente pedagógico del mundo, especialista en niños y micro-learning. 
      Analiza los documentos adjuntos minuciosamente. El apoderado solicita: "${instructions || 'Enséñale los conceptos clave.'}"
      
      Asignatura detectada: ${subject}
      ${subjectInstructions}

      MISIÓN: Generar una sesión de estudio profunda, entretenida y altamente interactiva.

      PARTE 1: LA CLASE MAGISTRAL (10 a 15 tarjetas)
      Crea entre 10 y 15 tarjetas ("lessons") aplicando la estrategia pedagógica de la asignatura.
      - IMPORTANTE: Al final de cada tarjeta, debes incluir un "mini_check" (una pregunta rápida de alternativas de 3 opciones) para asegurarte de que el niño entendió ESA lámina antes de avanzar.
      
      PARTE 2: EVALUACIÓN MASIVA (20 preguntas en total)
      Genera EXACTAMENTE 20 preguntas sobre lo enseñado, mezclando 4 tipos equitativamente:
      1. "multiple_choice": Alternativas (4 opciones).
      2. "true_false": Verdadero o falso.
      3. "short_answer": Pregunta de desarrollo o cálculo matemático. Provee una "correct_answer" como respuesta ideal.
      4. "matching": Unión de conceptos. Debe incluir un array "pairs" con 3 o 4 pares de conceptos.

      Retorna un JSON ESTRICTAMENTE con esta estructura:
      {
        "lessons": [
          { 
            "title": "...", 
            "content": "Contenido de la clase. Usa \\n\\n para separar párrafos o pasos. NO uses saltos de línea literales...", 
            "icon": "🌋",
            "mini_check": {
              "question": "¿...",
              "options": ["Opción 1", "Opción 2", "Opción 3"],
              "correct_answer": "Opción 1"
            }
          }
        ],
        "quiz": [
          { "type": "multiple_choice", "question": "...", "options": ["A", "B", "C", "D"], "correct_answer": "A" },
          { "type": "true_false", "question": "...", "options": ["Verdadero", "Falso"], "correct_answer": "Falso" },
          { "type": "short_answer", "question": "...", "correct_answer": "Respuesta ideal..." },
          { "type": "matching", "question": "...", "pairs": [ {"left": "Concepto 1", "right": "Definición 1"} ] }
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
