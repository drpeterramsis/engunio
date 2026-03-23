/// <reference types="vite/client" />
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { User, CheckCircle, XCircle, History, Trophy, Loader2, Play, ArrowRight, Settings, Rocket, Trash2, ChevronDown, ChevronUp, Search, Award, Share2, MessageSquare, FileText, FileUp, Upload, BookOpen, Volume2, PlayCircle, Info, Sparkles, Calendar, Square } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';

const questionSchema = {
  type: Type.OBJECT,
  properties: {
    question: { type: Type.STRING, description: "The question text or sentence." },
    context: { type: Type.STRING, description: "A small paragraph or sentence providing context for listening questions (IELTS-style). Leave empty if not in listening mode." },
    choices: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING }, 
      description: "Exactly 4 choices if MCQ, empty array otherwise." 
    },
    answer: { type: Type.STRING, description: "The correct answer." },
    explanation: { type: Type.STRING, description: "Explanation of why the answer is correct." },
    rule: { type: Type.STRING },
    difficulty: { type: Type.STRING }
  },
  required: ["question", "choices", "answer", "explanation", "rule", "difficulty"]
};

const batchSchema = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: questionSchema,
      description: "An array of generated questions."
    }
  },
  required: ["questions"]
};

interface Attempt {
  id: string;
  sessionId: string;
  question: string;
  type: string;
  rule: string;
  difficulty: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation: string;
  timestamp: number;
  duration?: number; // Duration of the session in milliseconds
}

interface Question {
  question: string;
  context?: string;
  choices: string[];
  answer: string;
  explanation: string;
  rule: string;
  difficulty: string;
}

// Categorized and sorted grammar rules
const GRAMMAR_CATEGORIES = {
  'Tenses': [
    'Future Continuous', 'Future Perfect', 'Future Perfect Continuous', 'Future Simple',
    'Past Continuous', 'Past Perfect', 'Past Perfect Continuous', 'Past Simple',
    'Present Continuous', 'Present Perfect', 'Present Perfect Continuous', 'Present Simple'
  ],
  'Parts of Speech': [
    'Adjectives', 'Adverbs', 'Articles (a, an, the)', 'Conjunctions', 'Interjections', 'Nouns', 'Prepositions', 'Pronouns'
  ],
  'Sentence Structure': [
    'Conditionals (Mixed)', 'Conditionals (Type 0)', 'Conditionals (Type 1)', 'Conditionals (Type 2)', 'Conditionals (Type 3)',
    'Direct and Indirect Objects', 'Noun Clauses', 'Passive Voice', 'Question Tags', 'Relative Clauses', 'Reported Speech', 'Subject-Verb Agreement'
  ],
  'Advanced & Vocabulary': [
    'Collocations', 'Gerunds vs Infinitives', 'Idioms', 'Modal Verbs', 'Participle Clauses', 'Phrasal Verbs'
  ],
  'Academy Series Grammar': [
    'Pronouns (Subject, Object, Possessive, Reflexive)',
    'Yes/No Questions',
    'Wh- Questions',
    'How Questions (How many, How much, etc.)',
    'Present Simple Tense',
    'Past Simple Tense',
    'Future Simple Tense',
    'Present Continuous Tense',
    'Past Continuous Tense',
    'Irregular Verbs',
    'If Conditionals (1st, 2nd, 3rd) & Unless',
    'Prepositions of Time and Place (in, on, at)',
    'Pronunciation Rules (Silent letters, C, H, etc.)'
  ]
};

// Flatten rules for "Select All" functionality
const ALL_RULES = Object.values(GRAMMAR_CATEGORIES).flat().sort();

// Expanded and sorted question types
const ALL_TYPES = [
  'Error Correction', 'Fill in the blank', 'Matching', 'MCQ', 'Rewrite', 'Sentence Ordering', 'Short Answer', 'True/False', 'Word Formation'
].sort();

const THEMES = [
  { id: 'indigo', name: 'Indigo', color: 'bg-indigo-500' },
  { id: 'emerald', name: 'Emerald', color: 'bg-emerald-500' },
  { id: 'rose', name: 'Rose', color: 'bg-rose-500' },
  { id: 'blue', name: 'Blue', color: 'bg-blue-500' },
  { id: 'amber', name: 'Amber', color: 'bg-amber-500' }
];

const themeColors: Record<string, { primary: string; secondary: string }> = {
  indigo: { primary: '#4f46e5', secondary: '#818cf8' },
  emerald: { primary: '#10b981', secondary: '#34d399' },
  rose: { primary: '#f43f5e', secondary: '#fb7185' },
  blue: { primary: '#3b82f6', secondary: '#60a5fa' },
  amber: { primary: '#f59e0b', secondary: '#fbbf24' }
};

const ACADEMY_LIBRARY = [
  {
    id: 'pronouns',
    title: 'Pronouns - الضمائر',
    description: 'Subject, Object, Possessive, and Reflexive pronouns.',
    sections: [
      {
        name: 'Pronoun Table - جدول الضمائر',
        details: [
          { en: 'Subject: I, He, She, It, You, We, They', ar: 'الفاعل: أنا، هو، هي، هو/هي لغير العاقل، أنت، نحن، هم' },
          { en: 'Object: me, him, her, it, you, us, them', ar: 'المفعول: ني، ه، ها، ه/ها لغير العاقل، ك، نا، هم' },
          { en: 'Possessive Adj: my, his, her, its, your, our, their', ar: 'صفات الملكية: ي، ه، ها، ه/ها لغير العاقل، ك، نا، هم (يتبعها اسم)' },
          { en: 'Possessive Pron: mine, his, hers, its, yours, ours, theirs', ar: 'ضمائر الملكية: ملكي، ملكه، ملكها، ملكه/ها لغير العاقل، ملكك، ملكنا، ملكهم' },
          { en: 'Reflexive: myself, himself, herself, itself, yourself, ourselves, themselves', ar: 'الضمائر المنعكسة: نفسي، نفسه، نفسها، نفسه/ها لغير العاقل، نفسك، أنفسنا، أنفسهم' }
        ]
      }
    ]
  },
  {
    id: 'questions',
    title: 'Questions - الجملة الاستفهامية',
    description: 'Yes/No and Wh- questions.',
    sections: [
      {
        name: 'Yes/No Questions - السؤال بهل',
        details: [
          { en: 'Start with auxiliary verb (am, is, are, was, were, has, have, had, do, does, did) or modal (will, would, shall, should, can, could, may, might, must).', ar: 'السؤال المبدوء بفعل مساعد أو ناقص.' }
        ]
      },
      {
        name: 'Question Words - أدوات الاستفهام',
        details: [
          { en: 'Who: For subject (person)', ar: 'من: للفاعل العاقل' },
          { en: 'Whose: For possession', ar: 'لمن: للملكية' },
          { en: 'Where: For place', ar: 'أين: للمكان' },
          { en: 'When: For time', ar: 'متى: للزمان' },
          { en: 'What: For object/action', ar: 'ما / ماذا: للفاعل والمفعول غير العاقل' },
          { en: 'Which: For choice', ar: 'أي / أيهما: للتفضيل والتمييز' },
          { en: 'Why: For reason', ar: 'لماذا: للسبب' },
          { en: 'How: For manner/state', ar: 'كيف: للطريقة أو الحالة' }
        ]
      }
    ]
  },
  {
    id: 'tenses',
    title: 'Tenses - الأزمنة',
    description: 'Present Simple, Past Simple, Future Simple, Present Continuous, Past Continuous.',
    sections: [
      {
        name: 'Present Simple - المضارع البسيط',
        details: [
          { en: 'Form: He/She/It + (s/es). I/You/We/They + Inf.', ar: 'التكوين: المفرد يضاف للفعل s/es، والجمع يأخذ المصدر.' },
          { en: 'Usage: Facts, Habits, Routine.', ar: 'الاستخدام: الحقائق العلمية، العادات والأحداث المتكررة.' }
        ]
      },
      {
        name: 'Past Simple - الماضي البسيط',
        details: [
          { en: 'Form: Verb + (d/ed) or Irregular.', ar: 'التكوين: الفعل مضاف له d/ed أو فعل شاذ.' },
          { en: 'Usage: Completed actions in the past.', ar: 'الاستخدام: أحداث ماضية اكتملت وانتهت.' }
        ]
      }
    ]
  },
  {
    id: 'conditionals',
    title: 'Conditionals - قاعدة If',
    description: 'First, Second, and Third Conditionals, and Unless.',
    sections: [
      {
        name: 'First Conditional - الحالة الأولى',
        details: [
          { en: 'If + Present Simple -> Will + Inf.', ar: 'توقعات مستقبلية، وعود، تهديدات.' }
        ]
      },
      {
        name: 'Second Conditional - الحالة الثانية',
        details: [
          { en: 'If + Past Simple -> Would + Inf.', ar: 'أحداث غير حقيقية أو مفترضة.' }
        ]
      }
    ]
  },
  {
    id: 'prepositions',
    title: 'Prepositions - حروف الجر',
    description: 'Usage of in, on, at for time and place.',
    sections: [
      {
        name: 'At / On / In (Time) - حروف جر للزمان',
        details: [
          { en: 'At: Specific times, night, festivals.', ar: 'At: أوقات محددة، الليل، المهرجانات.' },
          { en: 'On: Specific days, dates.', ar: 'On: أيام محددة، تواريخ.' },
          { en: 'In: Parts of the day, months, years, seasons.', ar: 'In: أجزاء اليوم، الشهور، السنين، الفصول.' }
        ]
      }
    ]
  },
  {
    id: 'pronunciation',
    title: 'Pronunciation - قواعد النطق',
    description: 'Vowels, Consonants, and specific letter combinations.',
    sections: [
      {
        name: 'Letters - الحروف',
        details: [
          { en: 'Vowels: a, e, i, o, u.', ar: 'الحروف المتحركة.' },
          { en: 'Consonants: The other 21 letters.', ar: 'الحروف الساكنة.' }
        ]
      },
      {
        name: 'Combinations - المقاطع',
        details: [
          { en: 'tion, scien, cion, ssion -> (shun)', ar: 'تنطق (شن)' },
          { en: 'sion -> (zhun) or (shun)', ar: 'تنطق (جن) أو (شن)' },
          { en: 'cial -> (shal)', ar: 'تنطق (شال)' },
          { en: 'cious -> (shus)', ar: 'تنطق (شص)' }
        ]
      }
    ]
  }
];

export default function App() {
  const [userName, setUserName] = useState<string>('');
  const [score, setScore] = useState({ total: 0, correct: 0 });
  const [history, setHistory] = useState<Attempt[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [config, setConfig] = useState({
    rules: ['Present Simple'],
    types: ['MCQ'],
    difficulty: 'Medium',
    count: 1,
    useAcademyLibrary: false,
    speechVoice: '',
    speechRate: 1.0,
    isTeacherMode: false
  });

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
    };
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const [collapsedSessions, setCollapsedSessions] = useState<Record<string, boolean>>({});

  const [isRulesExpanded, setIsRulesExpanded] = useState(false);
  const [isTypesExpanded, setIsTypesExpanded] = useState(false);
  
  const rulesRef = useRef<HTMLDivElement>(null);
  const typesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (rulesRef.current && !rulesRef.current.contains(event.target as Node)) {
        setIsRulesExpanded(false);
      }
      if (typesRef.current && !typesRef.current.contains(event.target as Node)) {
        setIsTypesExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const [rulesSearch, setRulesSearch] = useState('');
  const [typesSearch, setTypesSearch] = useState('');

  const filteredCategories: Record<string, string[]> = useMemo(() => {
    const search = rulesSearch.toLowerCase();
    if (!search) return GRAMMAR_CATEGORIES;
    
    const result: Record<string, string[]> = {};
    Object.entries(GRAMMAR_CATEGORIES).forEach(([category, rules]) => {
      const filteredRules = rules.filter(rule => rule.toLowerCase().includes(search));
      if (filteredRules.length > 0) {
        result[category] = filteredRules;
      }
    });
    return result;
  }, [rulesSearch]);

  const filteredTypes = useMemo(() => {
    const search = typesSearch.toLowerCase();
    if (!search) return ALL_TYPES;
    return ALL_TYPES.filter(type => type.toLowerCase().includes(search));
  }, [typesSearch]);

  const groupedHistory = useMemo(() => {
    const groups: Record<string, Attempt[]> = {};
    history.forEach(attempt => {
      const sessionId = attempt.sessionId || 'Previous Sessions';
      if (!groups[sessionId]) {
        groups[sessionId] = [];
      }
      groups[sessionId].push(attempt);
    });
    return Object.entries(groups).sort((a, b) => {
      const timeA = parseInt(a[0]) || 0;
      const timeB = parseInt(b[0]) || 0;
      return timeB - timeA;
    });
  }, [history]);

  const formatSessionDate = (sessionId: string) => {
    const timestamp = parseInt(sessionId);
    if (isNaN(timestamp)) return 'Previous Sessions';
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(timestamp));
  };

  const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'setup' | 'practice' | 'history' | 'library'>('setup');
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [feedbacks, setFeedbacks] = useState<Record<number, { isCorrect: boolean; explanation: string }>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [sessionScore, setSessionScore] = useState(0);
  const [showCertificate, setShowCertificate] = useState(false);
  
  // New state for v1.0.007
  const [examMode, setExamMode] = useState<'question' | 'exam'>('exam');
  const [generationProgress, setGenerationProgress] = useState(0);
  const [showFastLesson, setShowFastLesson] = useState(false);
  const [fastLessonContent, setFastLessonContent] = useState<string | null>(null);
  const [isListeningMode, setIsListeningMode] = useState(false);
  const [isGeneratingLesson, setIsGeneratingLesson] = useState(false);
  // New state for v1.0.010
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [printData, setPrintData] = useState<{
    title: string;
    type: 'all-history' | 'session' | 'practice' | 'exam' | 'answer-key';
    data: any;
  } | null>(null);
  const [isCorrecting, setIsCorrecting] = useState(false);
  
  const [theme, setTheme] = useState('indigo');
  const [showSettings, setShowSettings] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    const savedName = localStorage.getItem('userName');
    if (savedName) setUserName(savedName);

    const savedScore = localStorage.getItem('score');
    if (savedScore) setScore(JSON.parse(savedScore));

    const savedHistory = localStorage.getItem('history');
    if (savedHistory) setHistory(JSON.parse(savedHistory));

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) setTheme(savedTheme);

    const savedRules = localStorage.getItem('configRules');
    if (savedRules) setConfig(prev => ({ ...prev, rules: JSON.parse(savedRules) }));

    const savedTypes = localStorage.getItem('configTypes');
    if (savedTypes) setConfig(prev => ({ ...prev, types: JSON.parse(savedTypes) }));

    const savedVoice = localStorage.getItem('configVoice');
    if (savedVoice) setConfig(prev => ({ ...prev, speechVoice: savedVoice }));

    const savedRate = localStorage.getItem('configRate');
    if (savedRate) setConfig(prev => ({ ...prev, speechRate: parseFloat(savedRate) }));

    const savedTeacherMode = localStorage.getItem('isTeacherMode');
    if (savedTeacherMode) setConfig(prev => ({ ...prev, isTeacherMode: savedTeacherMode === 'true' }));
  }, []);

  useEffect(() => { localStorage.setItem('userName', userName); }, [userName]);
  useEffect(() => { localStorage.setItem('score', JSON.stringify(score)); }, [score]);
  useEffect(() => { localStorage.setItem('history', JSON.stringify(history)); }, [history]);
  useEffect(() => { localStorage.setItem('theme', theme); }, [theme]);
  useEffect(() => { localStorage.setItem('configRules', JSON.stringify(config.rules)); }, [config.rules]);
  useEffect(() => { localStorage.setItem('configTypes', JSON.stringify(config.types)); }, [config.types]);
  useEffect(() => { localStorage.setItem('configVoice', config.speechVoice); }, [config.speechVoice]);
  useEffect(() => { localStorage.setItem('configRate', config.speechRate.toString()); }, [config.speechRate]);
  useEffect(() => { localStorage.setItem('isTeacherMode', config.isTeacherMode.toString()); }, [config.isTeacherMode]);

  // Apply theme class to body to ensure it cascades properly
  useEffect(() => {
    document.body.className = `theme-${theme} bg-slate-50 text-slate-900 font-sans`;
  }, [theme]);

  const handleGenerate = async () => {
    if (config.rules.length === 0) {
      setErrorMsg('Please select at least one grammar rule.');
      return;
    }
    if (config.types.length === 0) {
      setErrorMsg('Please select at least one question type.');
      return;
    }
    
    let apiKey = '';
    try {
      apiKey = typeof process !== 'undefined' && process.env ? process.env.GEMINI_API_KEY || '' : '';
    } catch (e) {}
    if (!apiKey) {
      try {
        apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
      } catch (e) {}
    }

    if (!apiKey) {
      setErrorMsg('API Key is missing. Please set VITE_GEMINI_API_KEY in your environment variables.');
      return;
    }

    setErrorMsg('');
    setLoading(true);
    setGeneratedQuestions([]);
    setCurrentSessionId(Date.now().toString());
    setSessionStartTime(Date.now());
    setUserAnswers({});
    setFeedbacks({});
    setIsSubmitted(false);
    setSessionScore(0);
    setCurrentQuestionIndex(0);
    setShowCertificate(false);
    setActiveTab('practice');

    try {
      setGenerationProgress(10);
      const ai = new GoogleGenAI({ apiKey });
      setGenerationProgress(30);
      
      let contextInfo = "";
      if (config.useAcademyLibrary) {
        const libraryContext = ACADEMY_LIBRARY.map(sector => 
          `Sector: ${sector.title} (${sector.description}). Rules: ${sector.sections.map(s => `${s.name}: ${s.details.map(d => `${d.en} - ${d.ar}`).join(', ')}`).join('; ')}`
        ).join('\n');
        contextInfo = `Base the questions strictly on the Academy Series Library content: ${libraryContext}. `;
      }

      const prompt = `
You are an expert English teacher and assessment creator. ${contextInfo}
Generate EXACTLY ${config.count} English learning question(s) based on the following parameters:
- Rules to cover: ${config.rules.join(', ')} (distribute questions among these rules)
- Question Types: ${config.types.join(', ')} (distribute questions among these types)
- Difficulty: ${config.difficulty}
${isListeningMode ? "IMPORTANT: These are IELTS-style listening questions. For each question, you MUST provide a 'context' field which is a small paragraph or a series of sentences (like a dialogue or a short story) that the student will listen to. The 'question' field should then be a specific question about that context. CRITICAL: Do NOT include any underscores, dots, or placeholders like '_ _ _' in the 'context' or 'question' fields. The student will listen to the context and then answer the question. " : ""}

INSTRUCTIONS:
1. Generate EXACTLY ${config.count} question(s).
2. Align strictly with the selected grammar rules.
3. Match the difficulty level: Easy (simple), Medium (moderate), Hard (tricky).
4. If MCQ: Provide exactly 4 choices. Only ONE correct answer.
5. If Fill in the blank: Provide the correct word/phrase.
6. If Error Correction: Provide the incorrect sentence as the question, and the corrected version as the answer.
7. If Rewrite: Provide original sentence as the question, and rewritten correct version as the answer.

Previous mistakes to focus on (if any):
${history.filter(h => !h.isCorrect).slice(-5).map(h => `- Rule: ${h.rule}, Mistake: ${h.userAnswer}`).join('\n')}
`;

      setGenerationProgress(50);
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: batchSchema,
          temperature: 0.7,
        }
      });

      setGenerationProgress(80);
      const data = JSON.parse(response.text);
      if (!data.questions || data.questions.length === 0) {
        throw new Error("No questions were returned by the AI.");
      }
      setGeneratedQuestions(data.questions);
      setGenerationProgress(100);
      
      // Small delay to show 100%
      setTimeout(() => setLoading(false), 500);
    } catch (error: any) {
      console.error("Error generating question:", error);
      setErrorMsg(`Failed to generate questions: ${error.message || 'Please try again.'}`);
      setLoading(false);
    }
  };

  const handleFastLesson = async () => {
    if (config.rules.length === 0) {
      setErrorMsg('Please select at least one grammar rule for the lesson.');
      return;
    }

    let apiKey = '';
    try {
      apiKey = typeof process !== 'undefined' && process.env ? process.env.GEMINI_API_KEY || '' : '';
    } catch (e) {}
    if (!apiKey) {
      try {
        apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
      } catch (e) {}
    }

    if (!apiKey) {
      setErrorMsg('API Key is missing for the lesson.');
      return;
    }

    setIsGeneratingLesson(true);
    setShowFastLesson(true);
    setFastLessonContent(null);

    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `
        Provide a fast, professional English grammar lesson about: ${config.rules.join(', ')}.
        Include:
        1. A clear, concise explanation.
        2. Three practical examples with explanations.
        3. A "Pro Tip" for learners.
        Format the output in clean Markdown.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      });

      setFastLessonContent(response.text);
    } catch (err) {
      console.error(err);
      setFastLessonContent("Failed to generate lesson. Please try again.");
    } finally {
      setIsGeneratingLesson(false);
    }
  };

  const handleSpeak = (text: string, index: number, context?: string) => {
    // Stop any current speech
    window.speechSynthesis.cancel();
    
    // Only read the context (paragraph) if it exists, otherwise read the text (question)
    // This allows the student to focus on the listening part while reading the question
    const textToSpeak = context || text;
    
    // Clean text: remove underscores and dots that might be read as "underscore underscore..."
    const cleanText = textToSpeak.replace(/_{2,}/g, '').replace(/\.{3,}/g, '');
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'en-US';
    
    // Set voice if selected
    if (config.speechVoice) {
      const selectedVoice = voices.find(v => v.voiceURI === config.speechVoice);
      if (selectedVoice) utterance.voice = selectedVoice;
    }
    
    // Set rate
    utterance.rate = config.speechRate;
    
    utterance.onstart = () => setSpeakingIndex(index);
    utterance.onend = () => setSpeakingIndex(null);
    utterance.onerror = () => setSpeakingIndex(null);
    
    window.speechSynthesis.speak(utterance);
  };

  const handleStop = () => {
    window.speechSynthesis.cancel();
    setSpeakingIndex(null);
  };

  const handlePrint = (title: string, type: 'all-history' | 'session' | 'practice' | 'exam' | 'answer-key', data: any) => {
    setPrintData({ title, type, data });
    setTimeout(() => {
      window.print();
      setPrintData(null);
    }, 500);
  };

  const handleCheckAnswer = (index: number) => {
    const q = generatedQuestions[index];
    const uAnswer = userAnswers[index] || '';
    const normalize = (str: string) => str.toLowerCase().replace(/[.,!?]/g, '').trim();
    
    const isMCQ = q.choices && q.choices.length > 0;
    const isCorrect = isMCQ 
      ? uAnswer === q.answer
      : normalize(uAnswer) === normalize(q.answer);
    
    setFeedbacks(prev => ({
      ...prev,
      [index]: { isCorrect, explanation: q.explanation }
    }));

    if (isCorrect) {
      setSessionScore(prev => prev + 1);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#4f46e5', '#10b981', '#3b82f6']
      });
    }

    const newAttempt: Attempt = {
      id: Math.random().toString(36).substring(7),
      sessionId: currentSessionId || Date.now().toString(),
      question: q.question,
      type: config.types.length === 1 ? config.types[0] : 'Mixed',
      rule: q.rule,
      difficulty: q.difficulty,
      userAnswer: uAnswer,
      correctAnswer: q.answer,
      isCorrect,
      explanation: q.explanation,
      timestamp: Date.now()
    };
    setHistory(prev => [newAttempt, ...prev]);
  };

  const handleFinishSession = () => {
    const correctCount = Object.values(feedbacks).filter((f: any) => f.isCorrect).length;
    setSessionScore(correctCount);
    
    setScore(prev => ({
      correct: prev.correct + correctCount,
      total: prev.total + generatedQuestions.length
    }));
    
    setIsSubmitted(true);

    const percentage = (correctCount / generatedQuestions.length) * 100;
    if (percentage >= 90) {
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        colors: [themeColors[config.theme].primary, '#ffffff']
      });
    }
  };

  const handleSubmitAll = () => {
    let correctCount = 0;
    const newFeedbacks: Record<number, { isCorrect: boolean; explanation: string }> = {};
    const newHistory: Attempt[] = [];
    const sessionId = currentSessionId || Date.now().toString();

    const duration = sessionStartTime ? Date.now() - sessionStartTime : undefined;

    generatedQuestions.forEach((q, index) => {
      const uAnswer = userAnswers[index] || '';
      const normalize = (str: string) => str.toLowerCase().replace(/[.,!?]/g, '').trim();
      
      const isMCQ = q.choices && q.choices.length > 0;
      const isCorrect = isMCQ 
        ? uAnswer === q.answer
        : normalize(uAnswer) === normalize(q.answer);
      
      if (isCorrect) correctCount++;
      
      newFeedbacks[index] = {
        isCorrect,
        explanation: q.explanation
      };

      newHistory.push({
        id: Math.random().toString(36).substring(7),
        sessionId,
        question: q.question,
        type: config.types.length === 1 ? config.types[0] : 'Mixed',
        rule: q.rule,
        difficulty: q.difficulty,
        userAnswer: uAnswer,
        correctAnswer: q.answer,
        isCorrect,
        explanation: q.explanation,
        timestamp: Date.now(),
        duration
      });
    });

    setFeedbacks(newFeedbacks);
    setIsSubmitted(true);
    setSessionScore(correctCount);
    
    setScore(prev => ({
      correct: prev.correct + correctCount,
      total: prev.total + generatedQuestions.length
    }));
    
    setHistory(prev => [...newHistory, ...prev]);

    const percentage = (correctCount / generatedQuestions.length) * 100;
    if (percentage >= 90) {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#4f46e5', '#10b981', '#f59e0b', '#ec4899']
      });
    }
  };

  const handleShareCertificate = async () => {
    const percentage = Math.round((sessionScore / generatedQuestions.length) * 100);
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My ENGUNIO Certificate',
          text: `I just scored ${percentage}% on my English Grammar Assessment on ENGUNIO!`,
          url: window.location.href,
        });
      } catch (err) {
        console.error('Error sharing', err);
      }
    } else {
      alert('Sharing is not supported on this browser.');
    }
  };

  const handleResetProgress = () => {
    setScore({ total: 0, correct: 0 });
    setHistory([]);
    localStorage.removeItem('score');
    localStorage.removeItem('history');
    setShowResetConfirm(false);
    setShowSettings(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Rocket className="w-6 h-6 text-[var(--theme-primary-600)]" />
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold text-slate-800 tracking-tight leading-none">ENGUNIO</h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">ENGlish Upgrade Now</p>
            </div>
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200">
              <Trophy className="w-4 h-4 text-amber-500" />
              <span className="font-semibold text-amber-700 text-sm">
                {score.correct} / {score.total}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-slate-400" />
              <input 
                type="text" 
                value={userName} 
                onChange={e => setUserName(e.target.value)}
                placeholder="Your Name"
                className="bg-transparent border-none focus:ring-0 p-0 font-medium w-24 sm:w-32 text-slate-700 placeholder:text-slate-400"
              />
            </div>
            <button onClick={() => setShowSettings(true)} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        
        {/* Tabs Navigation */}
        <div className="flex justify-center mb-8 border-b border-slate-200">
          <div className="flex gap-8">
            <button 
              onClick={() => setActiveTab('setup')} 
              className={`pb-4 font-medium text-sm transition-colors relative ${activeTab === 'setup' ? 'text-[var(--theme-primary-600)]' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Setup
              {activeTab === 'setup' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--theme-primary-600)]" />}
            </button>
            <button 
              onClick={() => setActiveTab('practice')} 
              className={`pb-4 font-medium text-sm transition-colors relative ${activeTab === 'practice' ? 'text-[var(--theme-primary-600)]' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Practice
              {activeTab === 'practice' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--theme-primary-600)]" />}
            </button>
            <button 
              onClick={() => setActiveTab('library')} 
              className={`pb-4 font-medium text-sm transition-colors relative ${activeTab === 'library' ? 'text-[var(--theme-primary-600)]' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Library
              {activeTab === 'library' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--theme-primary-600)]" />}
            </button>
            <button 
              onClick={() => setActiveTab('history')} 
              className={`pb-4 font-medium text-sm transition-colors relative ${activeTab === 'history' ? 'text-[var(--theme-primary-600)]' : 'text-slate-500 hover:text-slate-700'}`}
            >
              History
              {activeTab === 'history' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--theme-primary-600)]" />}
            </button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          {/* Setup Tab */}
          {activeTab === 'setup' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h2 className="text-lg font-semibold mb-4 text-slate-800">Setup Practice</h2>
                
                <div className="space-y-4">
                  {/* Exam Mode Selection */}
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setExamMode('question')}
                      className={`p-3 rounded-lg border flex flex-col items-center gap-1 transition-all ${examMode === 'question' ? 'border-[var(--theme-primary-600)] bg-[var(--theme-primary-50)] text-[var(--theme-primary-700)]' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                    >
                      <MessageSquare className="w-5 h-5" />
                      <span className="text-xs font-bold">Question by Question</span>
                    </button>
                    <button
                      onClick={() => setExamMode('exam')}
                      className={`p-3 rounded-lg border flex flex-col items-center gap-1 transition-all ${examMode === 'exam' ? 'border-[var(--theme-primary-600)] bg-[var(--theme-primary-50)] text-[var(--theme-primary-700)]' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                    >
                      <FileText className="w-5 h-5" />
                      <span className="text-xs font-bold">Full Exam Mode</span>
                    </button>
                  </div>

                  {/* Academy Library Selection */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="border border-slate-200 rounded-lg p-4 bg-amber-50/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-5 h-5 text-amber-600" />
                          <span className="text-sm font-bold text-slate-800">Academy Series Library</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={config.useAcademyLibrary}
                            onChange={() => setConfig(prev => ({...prev, useAcademyLibrary: !prev.useAcademyLibrary}))}
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                        </label>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-2">
                        Questions based on Academy Series grammar rules.
                      </p>
                    </div>

                    {/* Teacher Mode Selection */}
                    <div className="border border-slate-200 rounded-lg p-4 bg-indigo-50/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Award className="w-5 h-5 text-indigo-600" />
                          <span className="text-sm font-bold text-slate-800">Teacher Mode</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={config.isTeacherMode}
                            onChange={() => setConfig(prev => ({...prev, isTeacherMode: !prev.isTeacherMode}))}
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-2">
                        Enable exam generation and model answers printing.
                      </p>
                    </div>
                  </div>

                  {/* Listening Options Category */}
                  <div className={`border rounded-lg overflow-hidden transition-all duration-300 ${isListeningMode ? 'border-[var(--theme-primary-300)] bg-[var(--theme-primary-50)]/30' : 'border-slate-200 bg-white'}`}>
                    <div className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-2">
                        <Volume2 className={`w-5 h-5 ${isListeningMode ? 'text-[var(--theme-primary-600)]' : 'text-slate-500'}`} />
                        <div>
                          <span className={`block text-sm font-bold ${isListeningMode ? 'text-[var(--theme-primary-900)]' : 'text-slate-800'}`}>Listening Comprehension</span>
                          <span className="text-[10px] text-slate-500">Generate audio-based questions</span>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={isListeningMode}
                          onChange={() => setIsListeningMode(!isListeningMode)}
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--theme-primary-600)]"></div>
                      </label>
                    </div>

                    {/* Conditional Listening Settings */}
                    <AnimatePresence>
                      {isListeningMode && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden border-t border-[var(--theme-primary-200)]"
                        >
                          <div className="p-3 space-y-4 bg-white/50">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Voice Selection</label>
                                <select 
                                  value={config.speechVoice} 
                                  onChange={e => setConfig({...config, speechVoice: e.target.value})}
                                  className="w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-[var(--theme-primary-500)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-primary-500)] bg-white text-xs"
                                >
                                  <option value="">Default Voice</option>
                                  {voices.map(voice => (
                                    <option key={voice.voiceURI} value={voice.voiceURI}>
                                      {voice.name} ({voice.lang})
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Speed: {config.speechRate}x</label>
                                <div className="flex items-center gap-2 mt-2">
                                  <span className="text-[10px] text-slate-400">0.5x</span>
                                  <input 
                                    type="range" 
                                    min="0.5" 
                                    max="2" 
                                    step="0.1"
                                    value={config.speechRate}
                                    onChange={e => setConfig({...config, speechRate: parseFloat(e.target.value)})}
                                    className="flex-grow h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[var(--theme-primary-600)]"
                                  />
                                  <span className="text-[10px] text-slate-400">2x</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Teacher Mode Section */}
                  {config.isTeacherMode && (
                    <div className="border border-indigo-200 rounded-lg p-4 bg-indigo-50/50 space-y-4">
                      <div className="flex items-center gap-2">
                        <Award className="w-5 h-5 text-indigo-600" />
                        <h3 className="text-sm font-bold text-slate-800">Teacher Tools</h3>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Auto-Correct Student PDF</label>
                          <div className="relative">
                            <input 
                              type="file" 
                              accept=".pdf,image/*"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file || generatedQuestions.length === 0) return;
                                
                                setIsCorrecting(true);
                                try {
                                  // Convert file to base64
                                  const reader = new FileReader();
                                  const base64Promise = new Promise<string>((resolve) => {
                                    reader.onload = () => resolve(reader.result as string);
                                    reader.readAsDataURL(file);
                                  });
                                  const base64 = await base64Promise;
                                  const base64Data = base64.split(',')[1];

                                  let apiKey = '';
                                  try {
                                    apiKey = typeof process !== 'undefined' && process.env ? process.env.GEMINI_API_KEY || '' : '';
                                  } catch (e) {}
                                  if (!apiKey) {
                                    try {
                                      apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
                                    } catch (e) {}
                                  }

                                  const ai = new GoogleGenAI({ apiKey });
                                  const prompt = `
                                    You are an expert English teacher. I am providing a student's answer sheet (PDF or Image).
                                    I will also provide the model questions and answers.
                                    Extract the student's answers from the file and compare them with the model answers.
                                    Return a JSON object with the extracted answers for each question index.
                                    
                                    Model Questions:
                                    ${generatedQuestions.map((q, i) => `${i + 1}. ${q.question} (Answer: ${q.answer})`).join('\n')}
                                    
                                    Return format: {"answers": {"0": "student answer 1", "1": "student answer 2", ...}}
                                  `;

                                  const response = await ai.models.generateContent({
                                    model: 'gemini-3-flash-preview',
                                    contents: [
                                      { text: prompt },
                                      { inlineData: { data: base64Data, mimeType: file.type } }
                                    ],
                                    config: {
                                      responseMimeType: "application/json",
                                      responseSchema: {
                                        type: Type.OBJECT,
                                        properties: {
                                          answers: {
                                            type: Type.OBJECT,
                                            additionalProperties: { type: Type.STRING }
                                          }
                                        },
                                        required: ["answers"]
                                      }
                                    }
                                  });

                                  const result = JSON.parse(response.text);
                                  if (result.answers) {
                                    setUserAnswers(prev => ({ ...prev, ...result.answers }));
                                    handleSubmitAll();
                                  }
                                } catch (error) {
                                  console.error("Correction error:", error);
                                  setErrorMsg("Failed to auto-correct the file. Please try again.");
                                } finally {
                                  setIsCorrecting(false);
                                }
                              }}
                              className="hidden" 
                              id="teacher-file-upload"
                            />
                            <label 
                              htmlFor="teacher-file-upload"
                              className={`flex items-center justify-center gap-2 w-full p-3 border-2 border-dashed border-indigo-300 rounded-lg cursor-pointer hover:bg-indigo-100 transition-colors ${isCorrecting ? 'opacity-50 cursor-wait' : ''}`}
                            >
                              {isCorrecting ? (
                                <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                              ) : (
                                <Upload className="w-5 h-5 text-indigo-600" />
                              )}
                              <span className="text-xs font-bold text-indigo-700">
                                {isCorrecting ? 'Analyzing...' : 'Upload Student Work'}
                              </span>
                            </label>
                          </div>
                        </div>
                        
                        <div className="flex flex-col justify-end">
                          <p className="text-[10px] text-slate-500 italic">
                            Upload a student's completed exam (PDF or photo) to automatically extract their answers and grade them against the current session.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
              <div ref={rulesRef} className="border border-slate-200 rounded-lg overflow-hidden">
                <button 
                  onClick={() => setIsRulesExpanded(!isRulesExpanded)}
                  className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <div className="text-left">
                    <span className="block text-sm font-medium text-slate-800">Grammar Rules</span>
                    {!isRulesExpanded && (
                      <span className="text-xs text-slate-500 mt-0.5 block">
                        {config.rules.length} selected {config.rules.length > 0 ? `(${config.rules.slice(0, 2).join(', ')}${config.rules.length > 2 ? '...' : ''})` : ''}
                      </span>
                    )}
                  </div>
                  {isRulesExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </button>
                
                {isRulesExpanded && (
                  <div className="p-3 bg-white border-t border-slate-200">
                    <div className="flex flex-col gap-2 mb-3">
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                          type="text" 
                          placeholder="Search grammar rules..." 
                          value={rulesSearch}
                          onChange={(e) => setRulesSearch(e.target.value)}
                          className="w-full pl-9 pr-8 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--theme-primary-500)] focus:border-[var(--theme-primary-500)]"
                        />
                        {rulesSearch && (
                          <button 
                            onClick={() => setRulesSearch('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="flex justify-end">
                        <button 
                          onClick={() => setConfig({...config, rules: config.rules.length === ALL_RULES.length ? [] : ALL_RULES})}
                          className="text-xs text-[var(--theme-primary-600)] hover:text-[var(--theme-primary-700)] font-medium"
                        >
                          {config.rules.length === ALL_RULES.length ? 'Deselect All' : 'Select All'}
                        </button>
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-4 pr-1">
                      {Object.keys(filteredCategories).length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-4">No rules found matching "{rulesSearch}"</p>
                      ) : (
                        Object.entries(filteredCategories).map(([category, rules]) => (
                          <div key={category} className="space-y-1">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1 mb-2">{category}</h4>
                            {rules.map(rule => (
                              <label key={rule} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  checked={config.rules.includes(rule)}
                                  onChange={(e) => {
                                    const newRules = e.target.checked 
                                      ? [...config.rules, rule] 
                                      : config.rules.filter(r => r !== rule);
                                    setConfig({...config, rules: newRules});
                                  }}
                                  className="rounded border-slate-300 text-[var(--theme-primary-600)] focus:ring-[var(--theme-primary-500)] w-4 h-4"
                                />
                                <span className="text-sm text-slate-700">{rule}</span>
                              </label>
                            ))}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Types Selection (Collapsible) */}
              <div ref={typesRef} className="border border-slate-200 rounded-lg overflow-hidden">
                <button 
                  onClick={() => setIsTypesExpanded(!isTypesExpanded)}
                  className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <div className="text-left">
                    <span className="block text-sm font-medium text-slate-800">Question Types</span>
                    {!isTypesExpanded && (
                      <span className="text-xs text-slate-500 mt-0.5 block">
                        {config.types.length} selected {config.types.length > 0 ? `(${config.types.slice(0, 2).join(', ')}${config.types.length > 2 ? '...' : ''})` : ''}
                      </span>
                    )}
                  </div>
                  {isTypesExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </button>
                
                {isTypesExpanded && (
                  <div className="p-3 bg-white border-t border-slate-200">
                    <div className="flex flex-col gap-2 mb-3">
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                          type="text" 
                          placeholder="Search question types..." 
                          value={typesSearch}
                          onChange={(e) => setTypesSearch(e.target.value)}
                          className="w-full pl-9 pr-8 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--theme-primary-500)] focus:border-[var(--theme-primary-500)]"
                        />
                        {typesSearch && (
                          <button 
                            onClick={() => setTypesSearch('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="flex justify-end">
                        <button 
                          onClick={() => setConfig({...config, types: config.types.length === ALL_TYPES.length ? [] : ALL_TYPES})}
                          className="text-xs text-[var(--theme-primary-600)] hover:text-[var(--theme-primary-700)] font-medium"
                        >
                          {config.types.length === ALL_TYPES.length ? 'Deselect All' : 'Select All'}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                      {filteredTypes.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-4">No types found matching "{typesSearch}"</p>
                      ) : (
                        filteredTypes.map(type => (
                          <label key={type} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={config.types.includes(type)}
                              onChange={(e) => {
                                const newTypes = e.target.checked 
                                  ? [...config.types, type] 
                                  : config.types.filter(t => t !== type);
                                setConfig({...config, types: newTypes});
                              }}
                              className="rounded border-slate-300 text-[var(--theme-primary-600)] focus:ring-[var(--theme-primary-500)] w-4 h-4"
                            />
                            <span className="text-sm text-slate-700">{type}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Difficulty & Count */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Difficulty</label>
                  <select 
                    value={config.difficulty} 
                    onChange={e => setConfig({...config, difficulty: e.target.value})}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-[var(--theme-primary-500)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-primary-500)] bg-white text-sm"
                  >
                    <option>Easy</option>
                    <option>Medium</option>
                    <option>Hard</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Questions</label>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setConfig({...config, count: Math.max(1, config.count - 1)})}
                      className="w-10 h-10 flex items-center justify-center rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
                    >
                      -
                    </button>
                    <input 
                      type="number" 
                      min="1" 
                      max="10" 
                      value={config.count}
                      onFocus={(e) => e.target.select()}
                      onChange={e => setConfig({...config, count: Math.max(1, Math.min(10, parseInt(e.target.value) || 1))})}
                      className="flex-grow rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-[var(--theme-primary-500)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-primary-500)] bg-white text-sm text-center font-bold"
                    />
                    <button 
                      onClick={() => setConfig({...config, count: Math.min(10, config.count + 1)})}
                      className="w-10 h-10 flex items-center justify-center rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Voice & Speed Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Voice</label>
                  <select 
                    value={config.speechVoice} 
                    onChange={e => setConfig({...config, speechVoice: e.target.value})}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-[var(--theme-primary-500)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-primary-500)] bg-white text-sm"
                  >
                    <option value="">Default Voice</option>
                    {voices.map(voice => (
                      <option key={voice.voiceURI} value={voice.voiceURI}>
                        {voice.name} ({voice.lang})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Speed: {config.speechRate}x</label>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] text-slate-400">0.5x</span>
                    <input 
                      type="range" 
                      min="0.5" 
                      max="2" 
                      step="0.1"
                      value={config.speechRate}
                      onChange={e => setConfig({...config, speechRate: parseFloat(e.target.value)})}
                      className="flex-grow h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[var(--theme-primary-600)]"
                    />
                    <span className="text-[10px] text-slate-400">2x</span>
                  </div>
                </div>
              </div>

              {errorMsg && (
                <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700 flex items-start gap-2">
                  <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <p>{errorMsg}</p>
                </div>
              )}

              <button 
                onClick={handleGenerate}
                disabled={loading}
                className="w-full mt-6 bg-[var(--theme-primary-600)] text-white py-2.5 px-4 rounded-lg font-medium hover:bg-[var(--theme-primary-700)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary-500)] focus:ring-offset-2 disabled:opacity-70 flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                {loading ? 'Generating...' : 'Generate Questions'}
              </button>

              <div className="mt-4 grid grid-cols-1 gap-3">
                <button 
                  onClick={handleFastLesson}
                  className="w-full py-2.5 px-4 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Give me a Fast Lesson
                </button>
              </div>

              {/* Grammar Flash Card Section */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-6 p-5 bg-gradient-to-br from-[var(--theme-primary-600)] to-[var(--theme-primary-800)] rounded-2xl shadow-xl text-white relative overflow-hidden group"
              >
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
                <div className="absolute -left-4 -bottom-4 w-24 h-24 bg-black/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
                
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
                      <Rocket className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest opacity-80">Grammar Flash Card</span>
                  </div>
                  
                  <h4 className="text-lg font-bold mb-2">Did you know?</h4>
                  <p className="text-sm leading-relaxed opacity-90 italic">
                    {config.rules.length > 0 
                      ? `In ${config.rules[0]}, remember that consistency is key to mastering the nuances of English grammar.`
                      : "Mastering the 'Present Simple' is the first step towards fluent English communication."}
                  </p>
                  
                  <div className="mt-4 flex justify-end">
                    <button 
                      onClick={() => setActiveTab('library')}
                      className="text-[10px] font-bold uppercase tracking-widest bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full backdrop-blur-sm transition-colors flex items-center gap-1"
                    >
                      Explore Library <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Fast Lesson Modal */}
          <AnimatePresence>
            {showFastLesson && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
              >
                <motion.div 
                  initial={{ scale: 0.95, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.95, opacity: 0, y: 20 }}
                  className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col border border-slate-100"
                >
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-amber-50">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-amber-500" />
                      Fast Grammar Lesson
                    </h2>
                    <button onClick={() => setShowFastLesson(false)} className="text-slate-400 hover:text-slate-600 hover:bg-amber-100 p-1 rounded-full transition-colors">
                      <XCircle className="w-6 h-6" />
                    </button>
                  </div>
                  <div className="p-8 overflow-y-auto">
                    {isGeneratingLesson ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <Loader2 className="w-10 h-10 text-amber-500 animate-spin mb-4" />
                        <p className="text-slate-500 font-medium">Preparing your custom lesson...</p>
                      </div>
                    ) : (
                      <div className="prose prose-slate max-w-none">
                        <div className="whitespace-pre-wrap font-sans text-slate-700 leading-relaxed">
                          {fastLessonContent}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <button 
                      onClick={() => setShowFastLesson(false)}
                      className="px-6 py-2 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-900 transition-colors"
                    >
                      Got it!
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

        </motion.div>
          )}

          {/* Practice Tab */}
          {activeTab === 'practice' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.div 
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="bg-white p-12 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center min-h-[400px]"
                  >
                    <Loader2 className="w-12 h-12 text-[var(--theme-primary-600)] animate-spin mb-4" />
                    <p className="text-slate-500 font-medium animate-pulse mb-6">Crafting the perfect questions...</p>
                    
                    <div className="w-full max-w-xs bg-slate-100 h-2 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${generationProgress}%` }}
                        className="h-full bg-[var(--theme-primary-600)]"
                      />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest">{generationProgress}% Complete</span>
                  </motion.div>
                ) : generatedQuestions.length > 0 ? (
                  <motion.div 
                    key="questions"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-8"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
                      <div className="flex items-center gap-2">
                        <Rocket className="w-6 h-6 text-[var(--theme-primary-600)]" />
                        <h2 className="text-xl font-bold text-slate-800">Practice Session</h2>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handlePrint('Practice Session', 'practice', generatedQuestions.map((q, i) => ({ ...q, userAnswer: userAnswers[i], isCorrect: feedbacks[i]?.isCorrect })))}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Print Practice
                        </button>
                        {config.isTeacherMode && (
                          <>
                            <button 
                              onClick={() => handlePrint('Exam Paper', 'exam', generatedQuestions)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg text-xs font-bold transition-colors"
                            >
                              <Award className="w-3.5 h-3.5" />
                              Print Exam
                            </button>
                            <button 
                              onClick={() => handlePrint('Model Answer Key', 'answer-key', generatedQuestions)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg text-xs font-bold transition-colors"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Print Key
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {!isSubmitted ? (
                      <>
                        {examMode === 'exam' ? (
                          generatedQuestions.map((q, index) => {
                            const feedback = feedbacks[index];
                            const isMCQ = q.choices && q.choices.length > 0;
                            const uAnswer = userAnswers[index] || '';

                            return (
                              <div key={index} className="bg-white p-6 sm:p-8 rounded-xl shadow-sm border border-slate-200 flex flex-col">
                                <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                                  <div className="flex items-center gap-2">
                                    <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-full uppercase tracking-wider border border-slate-200">
                                      {config.types.length === 1 ? config.types[0] : 'Mixed Practice'}
                                    </span>
                                  </div>
                                  <span className="text-sm text-slate-500 font-medium flex items-center gap-1.5">
                                    Question {index + 1} of {generatedQuestions.length}
                                  </span>
                                </div>

                                <h3 className="text-xl sm:text-2xl font-medium text-slate-900 mb-8 leading-relaxed flex items-start gap-3">
                                  {isListeningMode && (
                                    <button 
                                      onClick={() => speakingIndex === index ? handleStop() : handleSpeak(q.question, index, q.context)}
                                      className={`mt-1 p-2 rounded-full transition-colors ${
                                        speakingIndex === index 
                                          ? 'bg-rose-100 text-rose-600 hover:bg-rose-200' 
                                          : 'bg-[var(--theme-primary-50)] text-[var(--theme-primary-600)] hover:bg-[var(--theme-primary-100)]'
                                      }`}
                                      title={speakingIndex === index ? "Stop listening" : "Listen to question"}
                                    >
                                      {speakingIndex === index ? <Square className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                                    </button>
                                  )}
                                  <span>{q.question}</span>
                                </h3>

                                <div className="flex-grow">
                                  <div className="space-y-6">
                                    {isMCQ ? (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                        {q.choices.map((choice, idx) => (
                                          <button
                                            key={idx}
                                            onClick={() => !isSubmitted && setUserAnswers(prev => ({...prev, [index]: choice}))}
                                            disabled={isSubmitted}
                                            className={`p-4 text-left rounded-xl border-2 transition-all ${
                                              uAnswer === choice 
                                                ? 'border-[var(--theme-primary-600)] bg-[var(--theme-primary-50)] text-[var(--theme-primary-900)] shadow-sm' 
                                                : 'border-slate-200 hover:border-[var(--theme-primary-300)] hover:bg-slate-50 text-slate-700'
                                            } ${isSubmitted ? 'cursor-default' : ''}`}
                                          >
                                            <span className="font-medium">{choice}</span>
                                          </button>
                                        ))}
                                      </div>
                                    ) : (
                                      <input
                                        type="text"
                                        value={uAnswer}
                                        onChange={e => setUserAnswers(prev => ({...prev, [index]: e.target.value}))}
                                        disabled={isSubmitted}
                                        placeholder="Type your answer here..."
                                        className="w-full p-4 text-lg rounded-xl border-2 border-slate-200 focus:border-[var(--theme-primary-600)] focus:ring-0 transition-colors bg-slate-50 focus:bg-white disabled:opacity-70"
                                      />
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="bg-white p-6 sm:p-8 rounded-xl shadow-sm border border-slate-200 flex flex-col">
                            {/* Question by Question Mode */}
                            {(() => {
                              const index = currentQuestionIndex;
                              const q = generatedQuestions[index];
                              const feedback = feedbacks[index];
                              const isMCQ = q.choices && q.choices.length > 0;
                              const uAnswer = userAnswers[index] || '';
                              const isAnswered = !!feedback;

                              return (
                                <>
                                  <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                                    <div className="flex items-center gap-2">
                                      <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-full uppercase tracking-wider border border-slate-200">
                                        {q.rule}
                                      </span>
                                      <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-full uppercase tracking-wider border border-slate-200">
                                        {q.difficulty}
                                      </span>
                                    </div>
                                    <span className="text-sm text-slate-500 font-medium flex items-center gap-1.5">
                                      Question {index + 1} of {generatedQuestions.length}
                                    </span>
                                  </div>

                                  <h3 className="text-xl sm:text-2xl font-medium text-slate-900 mb-8 leading-relaxed flex items-start gap-3">
                                    {isListeningMode && (
                                      <button 
                                        onClick={() => speakingIndex === index ? handleStop() : handleSpeak(q.question, index, q.context)}
                                        className={`mt-1 p-2 rounded-full transition-colors ${
                                          speakingIndex === index 
                                            ? 'bg-rose-100 text-rose-600 hover:bg-rose-200' 
                                            : 'bg-[var(--theme-primary-50)] text-[var(--theme-primary-600)] hover:bg-[var(--theme-primary-100)]'
                                        }`}
                                        title={speakingIndex === index ? "Stop listening" : "Listen to question"}
                                      >
                                        {speakingIndex === index ? <Square className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                                      </button>
                                    )}
                                    <span>{q.question}</span>
                                  </h3>

                                  <div className="flex-grow">
                                    <div className="space-y-6">
                                      {isMCQ ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                          {q.choices.map((choice, idx) => (
                                            <button
                                              key={idx}
                                              onClick={() => !isAnswered && setUserAnswers(prev => ({...prev, [index]: choice}))}
                                              disabled={isAnswered}
                                              className={`p-4 text-left rounded-xl border-2 transition-all ${
                                                uAnswer === choice 
                                                  ? 'border-[var(--theme-primary-600)] bg-[var(--theme-primary-50)] text-[var(--theme-primary-900)] shadow-sm' 
                                                  : 'border-slate-200 hover:border-[var(--theme-primary-300)] hover:bg-slate-50 text-slate-700'
                                              } ${isAnswered ? 'cursor-default' : ''}`}
                                            >
                                              <span className="font-medium">{choice}</span>
                                            </button>
                                          ))}
                                        </div>
                                      ) : (
                                        <input
                                          type="text"
                                          value={uAnswer}
                                          onChange={e => setUserAnswers(prev => ({...prev, [index]: e.target.value}))}
                                          disabled={isAnswered}
                                          placeholder="Type your answer here..."
                                          className="w-full p-4 text-lg rounded-xl border-2 border-slate-200 focus:border-[var(--theme-primary-600)] focus:ring-0 transition-colors bg-slate-50 focus:bg-white disabled:opacity-70"
                                        />
                                      )}
                                    </div>

                                    {isAnswered && feedback && (
                                      <motion.div 
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        className={`mt-6 p-6 rounded-xl border ${
                                          feedback.isCorrect 
                                            ? 'bg-emerald-50 border-emerald-200' 
                                            : 'bg-rose-50 border-rose-200'
                                        }`}
                                      >
                                        <div className="flex items-start gap-4">
                                          {feedback.isCorrect ? (
                                            <CheckCircle className="w-8 h-8 text-emerald-600 shrink-0 mt-1" />
                                          ) : (
                                            <XCircle className="w-8 h-8 text-rose-600 shrink-0 mt-1" />
                                          )}
                                          <div className="flex-grow">
                                            <h4 className={`text-xl font-bold mb-2 ${
                                              feedback.isCorrect ? 'text-emerald-800' : 'text-rose-800'
                                            }`}>
                                              {feedback.isCorrect ? 'Excellent!' : 'Not quite right'}
                                            </h4>
                                            
                                            {!feedback.isCorrect && (
                                              <div className="mb-4 p-3 bg-white rounded-lg border border-rose-100 shadow-sm">
                                                <span className="text-xs font-bold text-rose-500 uppercase tracking-wider block mb-1">Correct Answer</span>
                                                <p className="text-slate-900 font-medium">{q.answer}</p>
                                              </div>
                                            )}
                                            
                                            <div className="mb-2">
                                              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Explanation</span>
                                              <p className="text-slate-700 leading-relaxed">
                                                {feedback.explanation}
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      </motion.div>
                                    )}

                                    <div className="flex justify-between mt-8">
                                      <button
                                        onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                                        disabled={currentQuestionIndex === 0}
                                        className="px-6 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-colors"
                                      >
                                        Previous
                                      </button>
                                      
                                      {!isAnswered ? (
                                        <button
                                          onClick={() => handleCheckAnswer(index)}
                                          disabled={!uAnswer}
                                          className="px-8 py-2 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-sm"
                                        >
                                          Check Answer
                                        </button>
                                      ) : (
                                        index < generatedQuestions.length - 1 ? (
                                          <button
                                            onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                                            className="px-8 py-2 bg-[var(--theme-primary-600)] text-white rounded-lg font-medium hover:bg-[var(--theme-primary-700)] transition-colors shadow-sm"
                                          >
                                            Next Question
                                          </button>
                                        ) : (
                                          <button
                                            onClick={handleFinishSession}
                                            className="px-8 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors shadow-sm"
                                          >
                                            Finish Session
                                          </button>
                                        )
                                      )}
                                    </div>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        )}

                        {examMode === 'exam' && (
                          <div className="flex justify-end pt-4">
                            <button
                              onClick={handleSubmitAll}
                              disabled={Object.keys(userAnswers).length < generatedQuestions.length}
                              className="bg-slate-900 text-white py-3 px-8 rounded-xl font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-sm flex items-center gap-2"
                            >
                              Submit All Answers
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center">
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Session Complete!</h3>
                        <p className="text-lg text-slate-600 mb-6">
                          You scored <strong className="text-[var(--theme-primary-600)]">{sessionScore}</strong> out of {generatedQuestions.length}
                        </p>
                        <div className="flex justify-center gap-4">
                          {sessionScore / generatedQuestions.length >= 0.9 && (
                            <button
                              onClick={() => setShowCertificate(true)}
                              className="bg-[var(--theme-primary-600)] text-white py-2.5 px-6 rounded-lg font-medium hover:bg-[var(--theme-primary-700)] transition-colors shadow-sm flex items-center gap-2"
                            >
                              <Award className="w-5 h-5" />
                              View Certificate
                            </button>
                          )}
                          <button
                            onClick={() => setActiveTab('setup')}
                            className="bg-slate-100 text-slate-700 py-2.5 px-6 rounded-lg font-medium hover:bg-slate-200 transition-colors shadow-sm"
                          >
                            Practice Again
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <div className="bg-white p-12 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center min-h-[400px] text-center">
                    <div className="w-16 h-16 bg-[var(--theme-primary-50)] rounded-full flex items-center justify-center mb-4">
                      <Rocket className="w-8 h-8 text-[var(--theme-primary-600)]" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Ready to practice?</h3>
                    <p className="text-slate-500 max-w-md mx-auto">
                      Select your grammar rules, question types, and difficulty in the Setup tab, then click "Generate Questions" to start learning.
                    </p>
                  </div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {history.length > 0 ? (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <h2 className="text-lg font-semibold flex items-center gap-2 text-slate-800">
                        <History className="w-5 h-5 text-slate-500" />
                        Recent History
                      </h2>
                      <button 
                        onClick={() => handlePrint('Full Activity Summary', 'all-history', history)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Print All Summary
                      </button>
                    </div>
                    <span className="text-sm text-slate-500">{history.length} attempts</span>
                  </div>
                  
                  <div className="space-y-4">
                    {groupedHistory.map(([sessionId, attempts], sIdx) => {
                      const isCollapsed = collapsedSessions[sessionId] ?? (sIdx !== 0);
                      return (
                        <div key={sessionId} className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/30">
                          <button 
                            onClick={() => setCollapsedSessions(prev => ({ ...prev, [sessionId]: !isCollapsed }))}
                            className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50 transition-colors border-b border-slate-100"
                          >
                            <div className="flex items-center gap-3">
                              <Calendar className="w-4 h-4 text-slate-400" />
                              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                                {formatSessionDate(sessionId)}
                              </h3>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2 mr-2">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePrint(`Session Report - ${formatSessionDate(sessionId)}`, 'session', attempts);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-[var(--theme-primary-600)] hover:bg-[var(--theme-primary-50)] rounded-md transition-all"
                                  title="Print Session"
                                >
                                  <FileText className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="flex items-center gap-3 mr-2">
                                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                  <CheckCircle className="w-3 h-3" /> {attempts.filter(a => a.isCorrect).length}
                                </span>
                                <span className="flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                                  <XCircle className="w-3 h-3" /> {attempts.filter(a => !a.isCorrect).length}
                                </span>
                              </div>
                              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                {attempts.length} attempts
                              </span>
                              {isCollapsed ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
                            </div>
                          </button>
                          
                          {!isCollapsed && (
                            <div className="p-4 space-y-4">
                              {attempts.map((attempt, idx) => (
                                <motion.div 
                                  key={attempt.id} 
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ duration: 0.3, delay: idx * 0.05 }}
                                  className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm"
                                >
                                  <div className="flex items-start justify-between gap-4 mb-3">
                                    <div className="flex flex-col gap-1">
                                      <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded uppercase font-bold border border-slate-200">
                                          {attempt.type}
                                        </span>
                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded uppercase font-bold border border-slate-200">
                                          {attempt.rule}
                                        </span>
                                      </div>
                                      <p className="text-sm font-medium text-slate-900 leading-relaxed">{attempt.question}</p>
                                    </div>
                                    {attempt.isCorrect ? (
                                      <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                                    ) : (
                                      <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
                                    )}
                                  </div>
                                  
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 pt-3 border-t border-slate-100">
                                    <div>
                                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Your answer</span>
                                      <p className={`text-sm font-medium ${attempt.isCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>
                                        {attempt.userAnswer || '(Empty)'}
                                      </p>
                                    </div>
                                    {!attempt.isCorrect && (
                                      <div>
                                        <span className="text-xs font-semibold text-rose-500 uppercase tracking-wider block mb-1">Correct answer</span>
                                        <p className="text-sm font-medium text-slate-900">{attempt.correctAnswer}</p>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {!attempt.isCorrect && (
                                    <div className="mt-3 p-3 bg-rose-50 rounded-lg border border-rose-100">
                                      <span className="text-[10px] font-bold text-rose-600 uppercase tracking-widest block mb-1">Why it's wrong & Rule explanation</span>
                                      <p className="text-xs text-rose-800 leading-relaxed">
                                        {attempt.explanation}
                                      </p>
                                    </div>
                                  )}
                                </motion.div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="bg-white p-12 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center min-h-[400px] text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <History className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2">No history yet</h3>
                  <p className="text-slate-500 max-w-md mx-auto">
                    Your practice history will appear here once you complete some questions.
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* Library Tab */}
          {activeTab === 'library' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold flex items-center gap-2 text-slate-800">
                    <BookOpen className="w-5 h-5 text-amber-500" />
                    Academy Series Library - مكتبة أكاديمي
                  </h2>
                  <span className="text-sm text-slate-500">{ACADEMY_LIBRARY.length} Sectors</span>
                </div>

                <div className="space-y-8">
                  {ACADEMY_LIBRARY.map((sector) => (
                    <div key={sector.id} className="border border-slate-100 rounded-xl overflow-hidden">
                      <div className="bg-slate-50 p-4 border-b border-slate-100">
                        <h3 className="font-bold text-slate-800">{sector.title}</h3>
                        <p className="text-xs text-slate-500">{sector.description}</p>
                      </div>
                      <div className="p-4 space-y-6">
                        {sector.sections.map((section, idx) => (
                          <div key={idx} className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-bold text-[var(--theme-primary-700)] uppercase tracking-wider">
                                {section.name}
                              </h4>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                              {section.details.map((detail, dIdx) => (
                                <div key={dIdx} className="p-3 bg-white border border-slate-100 rounded-lg shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <span className="text-sm text-slate-700 font-medium">{detail.en}</span>
                                  <span className="text-sm text-slate-500 font-arabic text-right" dir="rtl">{detail.ar}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </div>
        
        {/* Spacer for fixed footer */}
        <div className="h-24 sm:h-20"></div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 py-3 z-40 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-2">
          <div className="flex items-center gap-4">
            <p className="text-slate-600 text-xs font-medium">
              &copy; {new Date().getFullYear()} <span className="text-[var(--theme-primary-600)] font-bold">ENGUNIO</span>
            </p>
            <div className="h-4 w-px bg-slate-200 hidden sm:block"></div>
            <p className="text-slate-500 text-[10px] hidden sm:block">
              Created by <span className="font-semibold text-slate-700">Dr. Peter Ramsis [El-Pedro]</span> • <span className="font-mono">+201550452122</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded font-mono font-bold border border-slate-200">
              v1.0.017
            </span>
            <div className="flex gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">System Online</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Print Report Component */}
      {printData && (
        <div className="hidden print:block fixed inset-0 bg-white z-[100] p-8 overflow-auto">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between border-b-2 border-slate-800 pb-4 mb-8">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">ENGUNIO - English Grammar Master</h1>
                <p className="text-slate-600 font-medium">Report: {printData.title}</p>
                {printData.data.duration && (
                  <p className="text-slate-500 text-sm">Duration: {Math.floor(printData.data.duration / 60000)}m {Math.floor((printData.data.duration % 60000) / 1000)}s</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-800">Student: {userName || 'Guest'}</p>
                <p className="text-xs text-slate-500">Date: {new Date().toLocaleDateString()}</p>
              </div>
            </div>

            {printData.type === 'all-history' && (
              <div className="space-y-8">
                {Object.entries(
                  printData.data.reduce((acc: any, attempt: any) => {
                    if (!acc[attempt.sessionId]) acc[attempt.sessionId] = [];
                    acc[attempt.sessionId].push(attempt);
                    return acc;
                  }, {})
                ).map(([sessionId, attempts]: [string, any]) => {
                  const correct = attempts.filter((a: any) => a.isCorrect).length;
                  const total = attempts.length;
                  const firstAttempt = attempts[0];
                  return (
                    <div key={sessionId} className="border border-slate-200 rounded-lg p-6 break-inside-avoid">
                      <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                        <h3 className="font-bold text-lg">Session: {new Date(firstAttempt.timestamp).toLocaleString()}</h3>
                        <span className="font-bold text-[var(--theme-primary-700)]">Score: {correct}/{total} ({Math.round((correct/total)*100)}%)</span>
                      </div>
                      <div className="space-y-4">
                        {attempts.map((a: any, idx: number) => (
                          <div key={idx} className="text-sm">
                            <p className="font-medium mb-1">{idx + 1}. {a.question}</p>
                            <p className={`${a.isCorrect ? 'text-emerald-600' : 'text-rose-600'} flex gap-2`}>
                              <span>Your Answer: {a.userAnswer || '(No answer)'}</span>
                              {!a.isCorrect && <span>• Correct: {a.correctAnswer}</span>}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {(printData.type === 'session' || printData.type === 'practice') && (
              <div className="space-y-6">
                {printData.data.map((q: any, idx: number) => (
                  <div key={idx} className="border border-slate-100 p-4 rounded-lg break-inside-avoid">
                    <p className="font-bold text-slate-800 mb-2">{idx + 1}. {q.question}</p>
                    {q.choices && q.choices.length > 0 && (
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        {q.choices.map((c: any, cIdx: number) => (
                          <div key={cIdx} className={`text-sm p-2 rounded border ${q.userAnswer === c ? (q.isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200') : 'border-slate-100'}`}>
                            {String.fromCharCode(65 + cIdx)}. {c}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="text-sm space-y-1">
                      <p className="font-medium">Correct Answer: <span className="text-emerald-600">{q.correctAnswer || q.answer}</span></p>
                      {q.userAnswer && <p className="font-medium">Your Answer: <span className={q.isCorrect ? 'text-emerald-600' : 'text-rose-600'}>{q.userAnswer}</span></p>}
                      <p className="text-slate-500 italic">Explanation: {q.explanation}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(printData.type === 'exam' || printData.type === 'answer-key') && (
              <div className="space-y-8">
                {/* Group by Question Type */}
                {Object.entries(
                  printData.data.reduce((acc: any, q: any) => {
                    const type = q.type || 'General';
                    if (!acc[type]) acc[type] = [];
                    acc[type].push(q);
                    return acc;
                  }, {})
                ).map(([type, questions]: [string, any]) => (
                  <div key={type} className="space-y-4">
                    <h3 className="text-xl font-bold text-slate-800 border-b border-slate-200 pb-2 uppercase tracking-wider">{type}</h3>
                    <div className="space-y-6">
                      {questions.map((q: any, idx: number) => (
                        <div key={idx} className="break-inside-avoid">
                          <p className="font-bold text-slate-900 mb-3">{idx + 1}. {q.question}</p>
                          {q.choices && q.choices.length > 0 && (
                            <div className="grid grid-cols-2 gap-4 ml-4 mb-3">
                              {q.choices.map((c: any, cIdx: number) => (
                                <div key={cIdx} className="text-sm flex items-center gap-2">
                                  <div className="w-4 h-4 rounded-full border border-slate-400"></div>
                                  <span>{String.fromCharCode(65 + cIdx)}. {c}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {printData.type === 'answer-key' && (
                            <div className="mt-2 p-3 bg-slate-50 rounded border border-slate-200 text-sm">
                              <p className="font-bold text-emerald-700">Correct Answer: {q.answer}</p>
                              <p className="text-slate-600 italic">Explanation: {q.explanation}</p>
                            </div>
                          )}
                          {printData.type === 'exam' && <div className="h-8"></div>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-12 pt-8 border-t border-slate-200 text-center text-slate-400 text-xs">
              <p>Generated by ENGUNIO - English Grammar Master</p>
              <p>© {new Date().getFullYear()} Dr. Peter Ramsis [El-Pedro]</p>
            </div>
          </div>
        </div>
      )}

      {/* Global Print Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          @page { margin: 2cm; }
          .break-inside-avoid { break-inside: avoid; }
        }
      `}} />

      {/* Certificate Modal */}
      <AnimatePresence>
        {showCertificate && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-xl shadow-2xl max-w-3xl w-full p-8 md:p-12 border-8 border-double border-[var(--theme-primary-600)] relative text-center"
            >
              <button 
                onClick={() => setShowCertificate(false)} 
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded-full transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
              
              <div className="mb-8 flex justify-center">
                <div className="w-20 h-20 bg-[var(--theme-primary-50)] rounded-full flex items-center justify-center">
                  <Award className="w-10 h-10 text-[var(--theme-primary-600)]" />
                </div>
              </div>
              
              <h1 className="text-4xl md:text-5xl font-serif text-[var(--theme-primary-700)] mb-6">
                Certificate of Achievement
              </h1>
              
              <p className="text-lg text-slate-600 mb-4">This is proudly presented to</p>
              
              <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-6 border-b-2 border-slate-200 inline-block pb-2 px-8">
                {userName || 'English Learner'}
              </h2>
              
              <p className="text-lg text-slate-600 mb-12 max-w-xl mx-auto leading-relaxed">
                For successfully passing the English Grammar Assessment with an outstanding score of 
                <strong className="text-[var(--theme-primary-600)] ml-1">{sessionScore}/{generatedQuestions.length}</strong> 
                ({Math.round((sessionScore / generatedQuestions.length) * 100)}%).
              </p>
              
              <div className="flex justify-between items-end mt-12 px-4 md:px-12">
                <div className="text-left">
                  <p className="border-t-2 border-slate-300 pt-2 text-sm font-medium text-slate-600 w-32 text-center">
                    {new Date().toLocaleDateString()}
                  </p>
                  <p className="text-xs text-slate-400 text-center mt-1">Date</p>
                </div>
                <div className="text-right">
                  <p className="border-t-2 border-slate-300 pt-2 text-sm font-medium text-slate-600 w-32 text-center">
                    ENGUNIO
                  </p>
                  <p className="text-xs text-slate-400 text-center mt-1">Platform</p>
                </div>
              </div>
              
              <div className="mt-12 flex justify-center gap-4">
                <button 
                  onClick={handleShareCertificate}
                  className="bg-[var(--theme-primary-600)] text-white py-3 px-8 rounded-lg font-medium hover:bg-[var(--theme-primary-700)] transition-colors flex items-center gap-2 shadow-sm"
                >
                  <Share2 className="w-5 h-5" />
                  Share Certificate
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-100"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-[var(--theme-primary-600)]" />
                  Settings
                </h2>
                <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded-full transition-colors">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            
            <div className="space-y-6">
              {/* Theme Selection */}
              <div>
                <h3 className="text-sm font-medium text-slate-700 mb-3">Theme Color</h3>
                <div className="flex gap-3">
                  {THEMES.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id)}
                      className={`w-8 h-8 rounded-full border-2 ${theme === t.id ? 'border-slate-800 scale-110' : 'border-transparent'} ${t.color} transition-transform`}
                      title={t.name}
                    />
                  ))}
                </div>
              </div>

              {/* Reset Progress */}
              <div className="pt-6 border-t border-slate-200">
                <h3 className="text-sm font-medium text-slate-700 mb-3">Danger Zone</h3>
                {!showResetConfirm ? (
                  <button 
                    onClick={() => setShowResetConfirm(true)}
                    className="flex items-center gap-2 text-rose-600 hover:text-rose-700 font-medium px-4 py-2 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors w-full justify-center"
                  >
                    <Trash2 className="w-4 h-4" />
                    Reset All Progress
                  </button>
                ) : (
                  <div className="bg-rose-50 p-4 rounded-lg border border-rose-200">
                    <p className="text-sm text-rose-800 font-medium mb-3">Are you sure? This cannot be undone.</p>
                    <div className="flex gap-2">
                      <button 
                        onClick={handleResetProgress}
                        className="flex-1 bg-rose-600 text-white py-2 rounded-md font-medium hover:bg-rose-700 transition-colors text-sm"
                      >
                        Yes, Reset
                      </button>
                      <button 
                        onClick={() => setShowResetConfirm(false)}
                        className="flex-1 bg-white text-slate-700 border border-slate-300 py-2 rounded-md font-medium hover:bg-slate-50 transition-colors text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
