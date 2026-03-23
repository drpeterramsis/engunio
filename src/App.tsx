/// <reference types="vite/client" />
import React, { useState, useEffect, useMemo } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { User, CheckCircle, XCircle, History, Trophy, Loader2, Play, ArrowRight, Settings, Rocket, Trash2, ChevronDown, ChevronUp, Search, Award, Share2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';

const questionSchema = {
  type: Type.OBJECT,
  properties: {
    question: { type: Type.STRING, description: "The question text or sentence." },
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
}

interface Question {
  question: string;
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

export default function App() {
  const [userName, setUserName] = useState<string>('');
  const [score, setScore] = useState({ total: 0, correct: 0 });
  const [history, setHistory] = useState<Attempt[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [config, setConfig] = useState({
    rules: ['Present Perfect'],
    types: ['MCQ'],
    difficulty: 'Medium',
    count: 1
  });

  const [isRulesExpanded, setIsRulesExpanded] = useState(false);
  const [isTypesExpanded, setIsTypesExpanded] = useState(false);
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
  
  const [activeTab, setActiveTab] = useState<'setup' | 'practice' | 'history'>('setup');
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [feedbacks, setFeedbacks] = useState<Record<number, { isCorrect: boolean; explanation: string }>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [sessionScore, setSessionScore] = useState(0);
  const [showCertificate, setShowCertificate] = useState(false);
  
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
  }, []);

  useEffect(() => { localStorage.setItem('userName', userName); }, [userName]);
  useEffect(() => { localStorage.setItem('score', JSON.stringify(score)); }, [score]);
  useEffect(() => { localStorage.setItem('history', JSON.stringify(history)); }, [history]);
  useEffect(() => { localStorage.setItem('theme', theme); }, [theme]);

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
    setUserAnswers({});
    setFeedbacks({});
    setIsSubmitted(false);
    setSessionScore(0);
    setShowCertificate(false);
    setActiveTab('practice');

    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `
You are an expert English teacher and assessment creator.
Generate EXACTLY ${config.count} English learning question(s) based on the following parameters:
- Rules to cover: ${config.rules.join(', ')} (distribute questions among these rules)
- Question Types: ${config.types.join(', ')} (distribute questions among these types)
- Difficulty: ${config.difficulty}

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

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: batchSchema,
          temperature: 0.7,
        }
      });

      const data = JSON.parse(response.text);
      if (!data.questions || data.questions.length === 0) {
        throw new Error("No questions were returned by the AI.");
      }
      setGeneratedQuestions(data.questions);
    } catch (error: any) {
      console.error("Error generating question:", error);
      setErrorMsg(`Failed to generate questions: ${error.message || 'Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAll = () => {
    let correctCount = 0;
    const newFeedbacks: Record<number, { isCorrect: boolean; explanation: string }> = {};
    const newHistory: Attempt[] = [];
    const sessionId = currentSessionId || Date.now().toString();

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
        timestamp: Date.now()
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
              {/* Rules Selection (Collapsible) */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
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
                          className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--theme-primary-500)] focus:border-[var(--theme-primary-500)]"
                        />
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
              <div className="border border-slate-200 rounded-lg overflow-hidden">
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
                          className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--theme-primary-500)] focus:border-[var(--theme-primary-500)]"
                        />
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
                  <input 
                    type="number" 
                    min="1" 
                    max="10" 
                    value={config.count}
                    onChange={e => setConfig({...config, count: Math.max(1, Math.min(10, parseInt(e.target.value) || 1))})}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-[var(--theme-primary-500)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-primary-500)] bg-white text-sm"
                  />
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
            </div>
          </div>

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
                    <p className="text-slate-500 font-medium animate-pulse">Crafting the perfect questions...</p>
                  </motion.div>
                ) : generatedQuestions.length > 0 ? (
                  <motion.div 
                    key="questions"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-8"
                  >
                    {generatedQuestions.map((q, index) => {
                      const feedback = feedbacks[index];
                      const isMCQ = q.choices && q.choices.length > 0;
                      const uAnswer = userAnswers[index] || '';

                      return (
                        <div key={index} className="bg-white p-6 sm:p-8 rounded-xl shadow-sm border border-slate-200 flex flex-col">
                          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                            <div className="flex items-center gap-2">
                              {isSubmitted ? (
                                <>
                                  <span className="px-3 py-1 bg-[var(--theme-primary-50)] text-[var(--theme-primary-700)] text-xs font-bold rounded-full uppercase tracking-wider border border-[var(--theme-primary-100)]">
                                    {q.rule}
                                  </span>
                                  <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-full uppercase tracking-wider border border-slate-200">
                                    {q.difficulty}
                                  </span>
                                </>
                              ) : (
                                <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-full uppercase tracking-wider border border-slate-200">
                                  {config.types.length === 1 ? config.types[0] : 'Mixed Practice'}
                                </span>
                              )}
                            </div>
                            <span className="text-sm text-slate-500 font-medium flex items-center gap-1.5">
                              Question {index + 1} of {generatedQuestions.length}
                            </span>
                          </div>

                          <h3 className="text-xl sm:text-2xl font-medium text-slate-900 mb-8 leading-relaxed">
                            {q.question}
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

                            {isSubmitted && feedback && (
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
                          </div>
                        </div>
                      );
                    })}

                    {!isSubmitted ? (
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
                    <h2 className="text-lg font-semibold flex items-center gap-2 text-slate-800">
                      <History className="w-5 h-5 text-slate-500" />
                      Recent History
                    </h2>
                    <span className="text-sm text-slate-500">{history.length} attempts</span>
                  </div>
                  
                  <div className="space-y-8">
                    {groupedHistory.map(([sessionId, attempts]) => (
                      <div key={sessionId} className="space-y-4">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
                          {formatSessionDate(sessionId)}
                        </h3>
                        <div className="space-y-4">
                          {attempts.map((attempt, idx) => (
                            <motion.div 
                              key={attempt.id} 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.3, delay: idx * 0.1 }}
                              className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-4 mb-3">
                                <p className="text-sm font-medium text-slate-900 leading-relaxed">{attempt.question}</p>
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
                                    {attempt.userAnswer}
                                  </p>
                                </div>
                                {!attempt.isCorrect && (
                                  <div>
                                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Correct answer</span>
                                    <p className="text-sm font-medium text-slate-900">{attempt.correctAnswer}</p>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    ))}
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
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-auto py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-slate-500 text-sm text-center sm:text-left">
            &copy; {new Date().getFullYear()} Created by Dr. Peter Ramsis [El-Pedro] - +201550452122. All rights reserved.
          </p>
          <p className="text-slate-400 text-xs font-mono font-medium">
            v1.0.006
          </p>
        </div>
      </footer>

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
