"use client";

import { useState } from "react";
import { BookOpen, UploadCloud, CheckCircle, BrainCircuit, Loader2, PlayCircle, Award } from "lucide-react";

export default function Home() {
  const [phase, setPhase] = useState<"setup" | "loading" | "teach" | "quiz" | "result">("setup");
  const [file, setFile] = useState<File | null>(null);
  const [instructions, setInstructions] = useState("");
  
  const [lessonData, setLessonData] = useState<any>(null);
  const [currentLessonIdx, setCurrentLessonIdx] = useState(0);
  const [currentQuizIdx, setCurrentQuizIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleStartClass = async () => {
    if (!file) {
      setErrorMsg("Por favor, sube un archivo PDF primero.");
      return;
    }
    setErrorMsg("");
    setPhase("loading");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("instructions", instructions);

    try {
      const res = await fetch("/api/generate-lesson", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Error desconocido");

      setLessonData(data);
      setPhase("teach");
    } catch (err: any) {
      setErrorMsg(err.message);
      setPhase("setup");
    }
  };

  const handleNextLesson = () => {
    if (currentLessonIdx < lessonData.lessons.length - 1) {
      setCurrentLessonIdx(prev => prev + 1);
    } else {
      setPhase("quiz");
    }
  };

  const handleAnswer = (answer: string) => {
    const isCorrect = answer === lessonData.quiz[currentQuizIdx].correct_answer;
    if (isCorrect) setScore(prev => prev + 1);

    if (currentQuizIdx < lessonData.quiz.length - 1) {
      setCurrentQuizIdx(prev => prev + 1);
    } else {
      setPhase("result");
    }
  };

  const restart = () => {
    setPhase("setup");
    setFile(null);
    setInstructions("");
    setLessonData(null);
    setCurrentLessonIdx(0);
    setCurrentQuizIdx(0);
    setScore(0);
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 font-sans p-6 flex flex-col items-center">
      <div className="w-full max-w-3xl mt-10">
        
        {/* Encabezado Principal */}
        <header className="mb-10 text-center">
          <h1 className="text-4xl font-extrabold text-indigo-600 mb-3 flex items-center justify-center gap-3">
            <BrainCircuit size={40} /> AprendeJugando
          </h1>
          <p className="text-lg text-slate-500">Transforma tus apuntes en misiones interactivas</p>
        </header>

        {/* FASE 1: Configuración (Setup) */}
        {phase === "setup" && (
          <div className="bg-white border border-slate-200 rounded-3xl p-10 shadow-lg transition-all animate-in fade-in zoom-in duration-500">
            <div className="inline-block bg-indigo-100 text-indigo-800 font-bold px-4 py-1 rounded-full text-sm mb-6">Paso 1: Configuración (Para el Apoderado)</div>
            <h2 className="text-2xl font-bold mb-6">Prepara la sesión de estudio</h2>
            
            <div className="space-y-6">
              {/* PDF Upload */}
              <label className="block border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center hover:bg-slate-50 transition-colors cursor-pointer group relative">
                <input type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />
                <UploadCloud className="mx-auto w-12 h-12 text-slate-400 group-hover:text-indigo-500 mb-3" />
                <div className="font-bold text-lg">{file ? file.name : "Subir PDF del Libro o Materia"}</div>
                <div className="text-sm text-slate-500">{file ? "Haz clic para cambiar de archivo" : "Haz clic para buscar en tu computador"}</div>
              </label>

              {/* Instructions Textarea */}
              <div>
                <label className="block font-bold mb-2">¿Qué debe aprender y evaluar hoy?</label>
                <textarea 
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl p-4 min-h-[120px] focus:outline-none focus:border-indigo-500 text-sm" 
                  placeholder="Ej: Páginas 12 a la 18. Debe entender el ciclo del agua. Enfócate en la evaporación."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                />
              </div>

              {errorMsg && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl font-medium border border-red-200">
                  ⚠️ {errorMsg}
                </div>
              )}
            </div>

            <div className="mt-8 text-right">
              <button 
                onClick={handleStartClass} 
                className="bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-colors shadow-lg flex items-center gap-2 ml-auto"
              >
                <PlayCircle /> Generar Clase Interactiva
              </button>
            </div>
          </div>
        )}

        {/* FASE 2: Loading */}
        {phase === "loading" && (
          <div className="bg-white border border-slate-200 rounded-3xl p-16 text-center shadow-lg animate-in fade-in duration-500 flex flex-col items-center">
             <Loader2 className="w-16 h-16 text-indigo-600 animate-spin mb-6" />
             <h2 className="text-2xl font-bold mb-2">El Agente de IA está preparando la clase...</h2>
             <p className="text-slate-500">Extrayendo información del PDF, resumiendo conceptos y creando el cuestionario.</p>
          </div>
        )}

        {/* FASE 3: Fase Didáctica (Micro-learning) */}
        {phase === "teach" && lessonData && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-500">
            <div className="inline-block bg-green-100 text-green-800 font-bold px-4 py-1 rounded-full text-sm mb-4">Fase de Aprendizaje 📖</div>
            
            <div className="bg-white border-2 border-indigo-200 rounded-3xl p-10 shadow-lg mb-8 relative overflow-hidden">
              <div className="text-6xl mb-4">{lessonData.lessons[currentLessonIdx].icon}</div>
              <h3 className="text-3xl font-bold mb-6 text-indigo-700">{lessonData.lessons[currentLessonIdx].title}</h3>
              
              <div className="text-xl leading-relaxed text-slate-700 bg-slate-50 p-6 rounded-2xl border-l-4 border-indigo-500">
                {lessonData.lessons[currentLessonIdx].content}
              </div>

              <div className="mt-10 flex justify-between items-center">
                <div className="text-slate-400 font-medium">Tarjeta {currentLessonIdx + 1} de {lessonData.lessons.length}</div>
                <button 
                  onClick={handleNextLesson} 
                  className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-md flex items-center gap-2"
                >
                  {currentLessonIdx < lessonData.lessons.length - 1 ? "Siguiente Concepto ➡️" : "¡Entendido! A jugar 🎮"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FASE 4: Fase de Evaluación (Quiz) */}
        {phase === "quiz" && lessonData && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-500">
            <div className="inline-block bg-orange-100 text-orange-800 font-bold px-4 py-1 rounded-full text-sm mb-4">Fase de Evaluación 🎯</div>
            
            <div className="bg-white border border-slate-200 rounded-3xl p-10 shadow-lg mb-8">
              <div className="text-sm font-bold text-slate-400 mb-2">Pregunta {currentQuizIdx + 1} de {lessonData.quiz.length}</div>
              <h3 className="text-2xl font-bold mb-8 text-slate-800">{lessonData.quiz[currentQuizIdx].question}</h3>
              
              <div className="grid grid-cols-1 gap-4">
                {lessonData.quiz[currentQuizIdx].options.map((opt: string, i: number) => (
                  <button 
                    key={i}
                    onClick={() => handleAnswer(opt)}
                    className="w-full text-left p-6 rounded-2xl border-2 border-slate-200 hover:border-indigo-500 hover:bg-indigo-50 transition-all font-medium text-lg text-slate-700 group"
                  >
                    <span className="inline-block w-8 h-8 bg-slate-100 text-center rounded-full mr-3 group-hover:bg-indigo-200 transition-colors">{["A","B","C","D"][i]}</span>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* FASE 5: Resultados */}
        {phase === "result" && (
          <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center shadow-xl animate-in fade-in zoom-in duration-500">
              <Award className="w-24 h-24 text-yellow-400 mx-auto mb-6" />
              <h2 className="text-4xl font-extrabold text-indigo-700 mb-4">¡Misión Completada!</h2>
              <div className="inline-block bg-slate-50 border border-slate-200 rounded-2xl p-6 mb-8">
                <div className="text-3xl font-bold mb-2 text-slate-800">
                  Acertaste <span className="text-green-500">{score}</span> de {lessonData?.quiz?.length}
                </div>
                <p className="text-slate-500">¡Sigue así, estás haciendo un trabajo increíble!</p>
              </div>
              <br/>
              <button 
                onClick={restart} 
                className="bg-slate-100 border border-slate-300 text-slate-700 px-8 py-4 rounded-xl font-bold hover:bg-slate-200 transition-colors"
              >
                Volver al Inicio y Configurar Otra Clase
              </button>
          </div>
        )}

      </div>
    </main>
  );
}
