"use client";

import { useState, useMemo, useEffect } from "react";
import { UploadCloud, BrainCircuit, Loader2, PlayCircle, Award, ImageIcon, ArrowLeft, ArrowRight, CheckCircle2, XCircle, LogOut, History, Volume2 } from "lucide-react";
import { auth, db } from "../lib/firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, User } from "firebase/auth";
import { collection, addDoc, getDocs, query, where, orderBy } from "firebase/firestore";

const SUBJECTS = [
  { id: "General", icon: "🧠", label: "General" },
  { id: "Matemáticas", icon: "🧮", label: "Matemáticas" },
  { id: "Inglés", icon: "🇬🇧", label: "Inglés" },
  { id: "Ciencias", icon: "🧬", label: "Ciencias" },
  { id: "Historia", icon: "📜", label: "Historia" }
];

export default function Home() {
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  // History State
  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // App State
  const [phase, setPhase] = useState<"setup" | "loading" | "teach" | "quiz" | "result">("setup");
  const [file, setFile] = useState<File | null>(null);
  const [syllabusImage, setSyllabusImage] = useState<File | null>(null);
  const [instructions, setInstructions] = useState("");
  const [subject, setSubject] = useState("General");
  
  const [lessonData, setLessonData] = useState<any>(null);
  const [currentLessonIdx, setCurrentLessonIdx] = useState(0);
  const [miniCheckStatus, setMiniCheckStatus] = useState<"pending" | "correct" | "incorrect">("pending");
  
  const [currentQuizIdx, setCurrentQuizIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  const [quizState, setQuizState] = useState<"answering" | "feedback">("answering");
  const [isCorrect, setIsCorrect] = useState(false);
  const [correctAnswerStr, setCorrectAnswerStr] = useState("");
  const [quizError, setQuizError] = useState("");

  const [textAnswer, setTextAnswer] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [aiFeedback, setAiFeedback] = useState("");

  const [matchingAnswers, setMatchingAnswers] = useState<Record<string, string>>({});
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const currentQuestion = lessonData?.quiz?.[currentQuizIdx];
  const shuffledRights = useMemo(() => {
    if (currentQuestion?.type === "matching" && currentQuestion.pairs) {
      const rights = currentQuestion.pairs.map((p: any) => p.right);
      return rights.sort(() => Math.random() - 0.5);
    }
    return [];
  }, [currentQuizIdx, lessonData]);

  useEffect(() => {
    setMiniCheckStatus("pending");
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, [currentLessonIdx, phase]);

  // --- FIREBASE METHODS ---
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    if(!email || !password) { setAuthError("Ingresa correo y contraseña"); return; }
    try {
      if (authMode === "login") await signInWithEmailAndPassword(auth, email, password);
      else await createUserWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setAuthError("Error de autenticación. Verifica tus datos o contraseña (mínimo 6 caracteres).");
    }
  };

  const loadHistory = async () => {
    if (!user) return;
    setHistoryLoading(true);
    setShowHistory(true);
    try {
      const q = query(collection(db, "results"), where("userId", "==", user.uid), orderBy("date", "desc"));
      const querySnapshot = await getDocs(q);
      const results: any[] = [];
      querySnapshot.forEach((doc) => results.push({ id: doc.id, ...doc.data() }));
      setHistoryData(results);
    } catch (err) {
      console.error("Error cargando historial", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const saveResultToFirebase = async (finalScore: number, total: number) => {
    if (!user) return;
    try {
      await addDoc(collection(db, "results"), {
        userId: user.uid,
        subject,
        score: finalScore,
        total,
        date: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error guardando el puntaje:", error);
    }
  };

  // --- AUDIO METHOD ---
  const playVoice = (text: string) => {
    if (!window.speechSynthesis) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-ES";
    utterance.rate = 0.9; 
    utterance.onend = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  // --- MAIN APP METHODS ---
  const handleStartClass = async () => {
    if (!file) { setErrorMsg("Por favor, sube el PDF base primero."); return; }
    if (file.size > 19 * 1024 * 1024) { setErrorMsg("El PDF pesa más de 19MB."); return; }

    setErrorMsg("");
    setPhase("loading");

    try {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) throw new Error("Falta configurar NEXT_PUBLIC_GEMINI_API_KEY en Vercel.");

      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash', generationConfig: { responseMimeType: "application/json" } });

      let subjectInstructions = "";
      if (subject === "Matemáticas") subjectInstructions = `ESTRATEGIA PEDAGÓGICA PARA MATEMÁTICAS 🧮:\n- Enseña CÓMO resolver paso a paso.\n- Usa ejercicios numéricos en el quiz.\n- Menos texto, más fórmulas y números.`;
      else if (subject === "Inglés") subjectInstructions = `ESTRATEGIA PEDAGÓGICA PARA INGLÉS 🇬🇧:\n- Enfócate en vocabulario y reglas gramaticales.\n- Pide traducciones en las preguntas.`;
      else subjectInstructions = `ESTRATEGIA PEDAGÓGICA CONCEPTUAL 🧬:\n- Desglosa conceptos, usa metáforas y analogías.\n- Textos explicativos profundos.`;

      const prompt = `
        Eres un profesor experto y estratégico. El apoderado solicita: "${instructions || 'Enséñale los conceptos clave.'}"
        Asignatura: ${subject}. ${subjectInstructions}

        REGLA DE FILTRADO ESTRICTO (CRÍTICO):
        Si se incluye una imagen de un temario, debes cruzar esa información con el PDF. IGNORA por completo cualquier tema, página o concepto del PDF que NO esté explícitamente mencionado en el temario. Eres un filtro láser: enseña SOLO lo que entra en la prueba.

        ESTRUCTURA DE LA SESIÓN:
        PARTE 1: LA CLASE MAGISTRAL ("lessons")
        - Adapta la cantidad de tarjetas a la cantidad de materia real. Pueden ser 4 tarjetas (para un temario corto) o hasta 15 (si es extenso). No inventes relleno.
        - Incluye siempre un "mini_check" (pregunta de 3 alternativas) al final de cada tarjeta.
        
        PARTE 2: LA EVALUACIÓN ("quiz")
        - Genera una evaluación proporcional a la materia enseñada (idealmente 20 preguntas, o al menos 10 si el tema es muy corto). 
        - Usa de manera equilibrada los 4 tipos de preguntas: multiple_choice, true_false, short_answer, matching.

        Retorna un JSON ESTRICTAMENTE con la estructura: { "lessons": [{ "title": "", "content": "", "icon": "🌋", "mini_check": { "question": "", "options": ["","",""], "correct_answer": "" } }], "quiz": [{ "type": "multiple_choice", "question": "", "options": ["",""], "correct_answer": "" }] }
        REGLA TÉCNICA: NO incluyas saltos de línea literales (Enter) dentro del JSON. Usa '\\n'.
      `;

      const getBase64 = (f: File): Promise<string> => new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(f);
      });

      const parts: any[] = [ prompt, { inlineData: { data: await getBase64(file), mimeType: "application/pdf" } } ];
      if (syllabusImage) parts.push({ inlineData: { data: await getBase64(syllabusImage), mimeType: syllabusImage.type || "image/jpeg" } });

      const result = await model.generateContent(parts);
      const responseText = result.response.text();
      
      let jsonResponse;
      try { jsonResponse = JSON.parse(responseText.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '')); } 
      catch (e) { jsonResponse = JSON.parse(responseText); }

      setLessonData(jsonResponse);
      setPhase("teach");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Error al generar la clase.");
      setPhase("setup");
    }
  };

  const handlePrevLesson = () => { if (currentLessonIdx > 0) { setCurrentLessonIdx(prev => prev - 1); window.scrollTo(0,0); } };
  const handleNextLesson = () => {
    if (currentLessonIdx < lessonData.lessons.length - 1) { setCurrentLessonIdx(prev => prev + 1); window.scrollTo(0,0); } 
    else { setPhase("quiz"); window.scrollTo(0,0); }
  };

  const handleMiniCheck = (opt: string) => {
    setMiniCheckStatus(opt === lessonData.lessons[currentLessonIdx].mini_check.correct_answer ? "correct" : "incorrect");
  };

  const submitQuizAnswer = (correct: boolean, idealAnswer: string) => {
    setQuizError("");
    setIsCorrect(correct);
    setCorrectAnswerStr(idealAnswer);
    if (correct) setScore(prev => prev + 1);
    setQuizState("feedback");
  };

  const handleTextSubmit = async () => {
    if (textAnswer.trim().length < 1) { setQuizError("Por favor, escribe tu respuesta."); return; }
    setIsEvaluating(true);
    setQuizError("");
    try {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey!);
      const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash', generationConfig: { responseMimeType: "application/json" } });

      const prompt = `Pregunta: "${currentQuestion.question}"\nRespuesta ideal: "${currentQuestion.correct_answer}"\nDel estudiante: "${textAnswer}"\nRetorna JSON: { "isCorrect": true/false, "feedback": "mensaje 1 oración" }`;
      const result = await model.generateContent(prompt);
      const data = JSON.parse(result.response.text().replace(/\`\`\`json/g, '').replace(/\`\`\`/g, ''));

      setAiFeedback(data.feedback);
      submitQuizAnswer(data.isCorrect, currentQuestion.correct_answer);
    } catch (err) {
      setQuizError("Hubo un error al evaluar tu respuesta con IA. Intenta de nuevo.");
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleMatchingSubmit = () => {
    const answeredCount = Object.keys(matchingAnswers).filter(k => matchingAnswers[k] !== "").length;
    if (answeredCount < currentQuestion.pairs.length) { setQuizError("Empareja todos los conceptos."); return; }
    let allCorrect = true;
    const correctStringArray = [];
    for (const pair of currentQuestion.pairs) {
      correctStringArray.push(`${pair.left} ➡️ ${pair.right}`);
      if (matchingAnswers[pair.left] !== pair.right) allCorrect = false;
    }
    submitQuizAnswer(allCorrect, correctStringArray.join(" | "));
  };

  const nextQuizQuestion = () => {
    setQuizState("answering");
    setTextAnswer("");
    setAiFeedback("");
    setMatchingAnswers({});
    if (currentQuizIdx < lessonData.quiz.length - 1) {
      setCurrentQuizIdx(prev => prev + 1);
      window.scrollTo(0,0);
    } else {
      const finalScore = isCorrect ? score + 1 : score; // add last point if correct
      saveResultToFirebase(finalScore, lessonData.quiz.length);
      setPhase("result");
    }
  };

  const restart = () => {
    setPhase("setup");
    setFile(null); setSyllabusImage(null); setInstructions(""); setLessonData(null);
    setCurrentLessonIdx(0); setCurrentQuizIdx(0); setScore(0); setQuizState("answering"); setAiFeedback("");
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-indigo-600 w-10 h-10" /></div>;

  // --- AUTH UI ---
  if (!user) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="bg-white p-8 rounded-3xl shadow-sm max-w-md w-full text-center border border-slate-200">
          <img src="/logo.svg" alt="AprendeJugando Logo" className="w-20 h-20 rounded-3xl mx-auto mb-4" />
          <h1 className="text-3xl font-extrabold text-indigo-600 mb-2">AprendeJugando</h1>
          <p className="text-slate-500 mb-8">{authMode === "login" ? "Inicia sesión para continuar" : "Crea tu cuenta de Apoderado"}</p>
          
          <form onSubmit={handleAuth} className="space-y-4">
            <input type="email" placeholder="Correo electrónico" value={email} onChange={e=>setEmail(e.target.value)} className="w-full border border-slate-300 p-3 rounded-xl focus:border-indigo-500 outline-none" required />
            <input type="password" placeholder="Contraseña" value={password} onChange={e=>setPassword(e.target.value)} className="w-full border border-slate-300 p-3 rounded-xl focus:border-indigo-500 outline-none" required />
            {authError && <div className="text-red-500 text-sm font-medium">{authError}</div>}
            <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700">{authMode === "login" ? "Ingresar" : "Registrarse"}</button>
          </form>
          <button onClick={() => setAuthMode(authMode === "login" ? "register" : "login")} className="mt-6 text-sm text-indigo-600 font-medium hover:underline">
            {authMode === "login" ? "¿No tienes cuenta? Regístrate aquí" : "¿Ya tienes cuenta? Inicia sesión"}
          </button>
        </div>
      </main>
    );
  }

  // --- HISTORY UI ---
  if (showHistory) {
    return (
      <main className="min-h-screen bg-slate-100 text-slate-800 font-sans p-4 flex flex-col items-center">
        <div className="w-full max-w-2xl mt-8">
          <header className="mb-8 flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <button onClick={() => setShowHistory(false)} className="text-slate-500 hover:text-indigo-600 font-bold text-sm flex items-center gap-1"><ArrowLeft size={16}/> Volver</button>
            <h2 className="font-extrabold text-indigo-600 text-xl flex items-center gap-2"><History size={20}/> Historial de Estudio</h2>
            <div className="w-16"></div>
          </header>
          
          {historyLoading ? (
            <div className="text-center p-10"><Loader2 className="animate-spin w-8 h-8 text-indigo-600 mx-auto" /></div>
          ) : historyData.length === 0 ? (
            <div className="bg-white p-10 text-center rounded-3xl border border-slate-200 text-slate-500">Aún no hay pruebas registradas. ¡Anímense a estudiar!</div>
          ) : (
            <div className="space-y-4">
              {historyData.map(res => (
                <div key={res.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-lg">{res.subject}</h3>
                    <p className="text-sm text-slate-500">{new Date(res.date).toLocaleString('es-CL')}</p>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-extrabold ${res.score / res.total >= 0.6 ? 'text-green-500' : 'text-orange-500'}`}>{res.score} <span className="text-slate-400 text-sm">/ {res.total}</span></div>
                    <div className="text-xs font-bold text-slate-400 uppercase">Aciertos</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    );
  }

  // --- MAIN APP UI ---
  return (
    <main className="min-h-screen bg-slate-100 text-slate-800 font-sans p-4 flex flex-col items-center">
      <div className="w-full max-w-2xl mt-8">
        
        <header className="mb-8 text-center relative flex flex-col items-center">
          {phase === "setup" ? (
             <div className="absolute left-0 top-0 w-full flex justify-between px-2">
               <button onClick={loadHistory} className="text-slate-500 hover:text-indigo-600 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1 transition-colors"><History size={14}/> Notas</button>
               <button onClick={() => signOut(auth)} className="text-slate-500 hover:text-red-600 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1 transition-colors"><LogOut size={14}/> Salir</button>
             </div>
          ) : (
            <button onClick={restart} className="absolute left-0 top-2 text-slate-500 hover:text-indigo-600 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1 transition-colors"><ArrowLeft size={14}/> Salir</button>
          )}
          <h1 className={`text-3xl font-extrabold text-indigo-600 mb-2 flex items-center justify-center gap-3 ${phase === "setup" ? 'mt-10' : ''}`}>
            <img src="/logo.svg" alt="AprendeJugando Logo" className="w-12 h-12 rounded-2xl shadow-sm" /> AprendeJugando
          </h1>
          <p className="text-slate-500">Misiones interactivas para mentes curiosas</p>
        </header>

        {phase === "setup" && (
          <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
            <h2 className="text-xl font-bold mb-6">Prepara la Sesión de Estudio</h2>
            <div className="space-y-6">
              <div>
                <label className="block font-bold mb-3 text-sm">1. Elige la Asignatura</label>
                <div className="flex flex-wrap gap-2">
                   {SUBJECTS.map(s => (
                      <button key={s.id} onClick={() => setSubject(s.id)} className={`px-4 py-2 rounded-full border font-bold text-sm flex items-center gap-2 transition-colors ${subject === s.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}><span>{s.icon}</span> {s.label}</button>
                   ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                <label className="block border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:bg-slate-50 transition-colors cursor-pointer group">
                  <input type="file" accept="application/pdf" className="hidden" onChange={(e) => e.target.files && setFile(e.target.files[0])} />
                  <UploadCloud className="mx-auto w-8 h-8 text-slate-400 group-hover:text-indigo-500 mb-2" />
                  <div className="font-bold text-sm">{file ? file.name : "2. Subir PDF del Libro"}</div>
                </label>
                <label className="block border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:bg-slate-50 transition-colors cursor-pointer group">
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files && setSyllabusImage(e.target.files[0])} />
                  <ImageIcon className="mx-auto w-8 h-8 text-slate-400 group-hover:text-indigo-500 mb-2" />
                  <div className="font-bold text-sm">{syllabusImage ? syllabusImage.name : "3. Subir Temario"}</div>
                </label>
              </div>
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                <label className="block font-bold mb-2 text-sm text-slate-700">Instrucciones para el Profesor IA (Opcional)</label>
                <p className="text-xs text-slate-500 mb-3">Dile cómo quieres que le enseñe a tu hijo. La IA adaptará su lenguaje y dificultad.</p>
                <textarea className="w-full bg-white border border-slate-300 rounded-xl p-3 min-h-[80px] focus:outline-none focus:border-indigo-500 text-sm shadow-sm" placeholder="Ej: 'Fíjate en lo que entra en la foto del temario. Explícale como si fuera una historia de piratas.'" value={instructions} onChange={(e) => setInstructions(e.target.value)} />
                <div className="flex flex-wrap gap-2 mt-3 items-center">
                  <span className="text-xs text-slate-500 font-bold mr-1">💡 Autocompletar:</span>
                  {["Explícalo súper simple (niño de 8 años)", "Usa ejemplos de videojuegos", "Haz que las preguntas sean muy difíciles", "Enfócate solo en la Unidad 2"].map((s, i) => (
                    <button key={i} onClick={() => setInstructions(prev => prev ? prev + " " + s : s)} className="text-[11px] bg-white text-slate-600 px-3 py-1.5 rounded-full hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 transition-colors border border-slate-200 shadow-sm">+ {s}</button>
                  ))}
                </div>
              </div>
              {errorMsg && <div className="text-red-600 font-medium text-sm">⚠️ {errorMsg}</div>}
            </div>
            <button onClick={handleStartClass} className="mt-6 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 w-full flex justify-center items-center gap-2"><PlayCircle size={20}/> Generar Clase Inteligente</button>
          </div>
        )}

        {phase === "loading" && (
          <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center shadow-sm">
             <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
             <h2 className="text-xl font-bold mb-2">Preparando clase de {subject}...</h2>
             <p className="text-slate-500 text-sm">La IA está adaptando su método de enseñanza especialmente para esta materia.</p>
          </div>
        )}

        {phase === "teach" && lessonData && (
          <div className="animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-4">
              <div className="bg-green-100 text-green-800 font-bold px-3 py-1 rounded-full text-xs">📖 Lección {currentLessonIdx + 1} de {lessonData.lessons.length}</div>
              <div className="flex gap-2">
                <button onClick={handlePrevLesson} disabled={currentLessonIdx === 0} className="p-2 rounded-full hover:bg-slate-200 disabled:opacity-30"><ArrowLeft size={20}/></button>
              </div>
            </div>
            
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm mb-8 relative overflow-hidden">
              <button onClick={() => playVoice(lessonData.lessons[currentLessonIdx].content)} className={`absolute top-6 right-6 p-3 rounded-full flex items-center gap-2 font-bold text-sm transition-all ${isSpeaking ? 'bg-indigo-600 text-white shadow-lg animate-pulse' : 'bg-slate-100 text-indigo-600 hover:bg-indigo-100'}`}>
                <Volume2 size={20}/> {isSpeaking ? "Pausar" : "Escuchar"}
              </button>
              <div className="text-5xl mb-4 mt-2">{lessonData.lessons[currentLessonIdx].icon}</div>
              <h3 className="text-2xl font-bold mb-4 text-indigo-700 w-3/4">{lessonData.lessons[currentLessonIdx].title}</h3>
              <div className="text-lg leading-relaxed text-slate-700 bg-slate-50 p-5 rounded-2xl border-l-4 border-indigo-500 whitespace-pre-wrap mb-8">
                {lessonData.lessons[currentLessonIdx].content}
              </div>

              <div className="bg-indigo-50 rounded-2xl p-6 border border-indigo-100">
                <h4 className="font-bold text-indigo-900 mb-3 flex items-center gap-2"><BrainCircuit size={18}/> Repaso Rápido</h4>
                <p className="mb-4 text-slate-800">{lessonData.lessons[currentLessonIdx].mini_check.question}</p>
                <div className="grid gap-3">
                  {lessonData.lessons[currentLessonIdx].mini_check.options.map((opt: string, i: number) => (
                    <button key={i} onClick={() => handleMiniCheck(opt)} className="text-left bg-white border border-slate-200 p-3 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-colors text-sm font-medium">{opt}</button>
                  ))}
                </div>
                {miniCheckStatus === "incorrect" && <div className="mt-4 text-red-600 font-medium text-sm flex items-center gap-1"><XCircle size={16}/> ¡Ups! Esa no es la correcta. Vuelve a leer e intenta de nuevo.</div>}
                {miniCheckStatus === "correct" && (
                  <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in slide-in-from-top-4">
                    <div className="text-green-600 font-bold flex items-center gap-1"><CheckCircle2 size={18}/> ¡Excelente! Entendiste el concepto.</div>
                    <button onClick={handleNextLesson} className="w-full sm:w-auto bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-sm flex items-center justify-center gap-2">
                      {currentLessonIdx < lessonData.lessons.length - 1 ? "Siguiente Concepto" : "¡Ir a la Prueba!"} <ArrowRight size={18}/>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {phase === "quiz" && currentQuestion && (
          <div className="animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-4">
               <div className="inline-block bg-orange-100 text-orange-800 font-bold px-3 py-1 rounded-full text-xs">🎯 Pregunta {currentQuizIdx + 1} de {lessonData.quiz.length}</div>
               <button onClick={() => playVoice(currentQuestion.question)} className={`px-3 py-1.5 rounded-full flex items-center gap-1 font-bold text-xs transition-all ${isSpeaking ? 'bg-indigo-600 text-white animate-pulse' : 'bg-white text-indigo-600 border border-indigo-200'}`}><Volume2 size={14}/> Escuchar</button>
            </div>
            
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm mb-8">
              <h3 className="text-xl font-bold mb-6 text-slate-800 whitespace-pre-wrap">{currentQuestion.question}</h3>
              
              {quizState === "answering" ? (
                <>
                  {(currentQuestion.type === "multiple_choice" || currentQuestion.type === "true_false") && (
                    <div className="grid grid-cols-1 gap-3">
                      {currentQuestion.options.map((opt: string, i: number) => (
                        <button key={i} onClick={() => handleMultipleChoice(opt)} className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50 font-medium text-slate-700">{opt}</button>
                      ))}
                    </div>
                  )}

                  {currentQuestion.type === "short_answer" && (
                    <div>
                      <textarea className="w-full border border-slate-300 rounded-xl p-4 text-sm focus:border-indigo-500 min-h-[120px] mb-4" placeholder="Escribe tu respuesta aquí..." value={textAnswer} onChange={(e) => setTextAnswer(e.target.value)} disabled={isEvaluating} />
                      <button onClick={handleTextSubmit} disabled={isEvaluating} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-sm w-full flex justify-center items-center gap-2 disabled:opacity-70">
                        {isEvaluating ? <><Loader2 className="animate-spin" size={18}/> Evaluando con IA...</> : "Revisar Respuesta"}
                      </button>
                    </div>
                  )}

                  {currentQuestion.type === "matching" && (
                    <div className="space-y-4">
                      {currentQuestion.pairs.map((pair: any, i: number) => (
                        <div key={i} className="flex flex-col sm:flex-row gap-2 sm:items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                          <div className="font-bold flex-1 text-sm text-center sm:text-right">{pair.left}</div>
                          <div className="text-slate-400 font-bold hidden sm:block">→</div>
                          <div className="flex-1 w-full">
                            <select className="w-full p-2 rounded-lg border border-slate-300 text-sm" value={matchingAnswers[pair.left] || ""} onChange={(e) => setMatchingAnswers({...matchingAnswers, [pair.left]: e.target.value})}>
                              <option value="">-- Selecciona --</option>
                              {shuffledRights.map((right: string, j: number) => <option key={j} value={right}>{right}</option>)}
                            </select>
                          </div>
                        </div>
                      ))}
                      <button onClick={handleMatchingSubmit} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-sm w-full mt-4">Confirmar Emparejamiento</button>
                    </div>
                  )}
                  {quizError && <div className="mt-4 text-red-600 font-medium text-sm text-center">⚠️ {quizError}</div>}
                </>
              ) : (
                <div className="animate-in zoom-in-95 duration-200">
                  <div className={`p-6 rounded-2xl mb-6 ${isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    <h4 className={`text-lg font-bold flex items-center gap-2 ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                      {isCorrect ? <CheckCircle2 /> : <XCircle />} {isCorrect ? "¡Respuesta Correcta!" : "¡Ups! Incorrecto"}
                    </h4>
                    {!isCorrect && currentQuestion.type !== "short_answer" && <p className="mt-3 text-sm text-slate-700">La respuesta correcta era:<br/><strong className="text-red-800">{correctAnswerStr}</strong></p>}
                    {currentQuestion.type === "short_answer" && (
                      <div className="mt-4 text-sm text-slate-700 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                        <strong className="block mb-2 text-indigo-700 flex items-center gap-2"><BrainCircuit size={16}/> Comentario del Profesor IA:</strong>
                        <p className="mb-4 text-base">{aiFeedback}</p>
                        <div className="border-t border-slate-100 pt-4 mt-2">
                           <strong className="block mb-1 text-slate-500 text-xs uppercase tracking-wider">Concepto ideal para comparar:</strong>
                           <p className="text-slate-600">{correctAnswerStr}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <button onClick={nextQuizQuestion} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold w-full flex items-center justify-center gap-2 hover:bg-indigo-700">
                    {currentQuizIdx < lessonData.quiz.length - 1 ? "Siguiente Pregunta" : "Finalizar Prueba"} <ArrowRight size={18}/>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        
        {phase === "result" && (
          <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center shadow-sm animate-in zoom-in">
              <Award className="w-20 h-20 text-yellow-400 mx-auto mb-4" />
              <h2 className="text-3xl font-extrabold text-indigo-700 mb-2">¡Prueba Finalizada!</h2>
              <div className="inline-block bg-slate-50 border border-slate-200 rounded-2xl p-5 mb-6 mt-4">
                <div className="text-2xl font-bold mb-1">Acertaste <span className="text-green-500">{score}</span> de {lessonData?.quiz?.length}</div>
                <div className="text-sm text-slate-500 mt-2">✨ ¡Tu puntaje ha sido guardado en la nube!</div>
              </div>
              <br/>
              <button onClick={restart} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors">Volver al Menú Principal</button>
          </div>
        )}
      </div>
    </main>
  );
}
