import React, { useState, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { User, CheckCircle, XCircle, History, Trophy, Loader2, Play, ArrowRight, Settings, Rocket, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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

  const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; explanation: string } | null>(null);
  
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
    setCurrentQuestionIndex(0);
    setFeedback(null);
    setUserAnswer('');

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
        model: 'gemini-3.1-pro-preview',
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

  const currentQuestion = generatedQuestions[currentQuestionIndex];
  const isMCQ = currentQuestion?.choices && currentQuestion.choices.length > 0;

  const handleSubmit = () => {
    if (!currentQuestion || !userAnswer.trim()) return;

    const normalize = (str: string) => str.toLowerCase().replace(/[.,!?]/g, '').trim();
    
    const isCorrect = isMCQ 
      ? userAnswer === currentQuestion.answer
      : normalize(userAnswer) === normalize(currentQuestion.answer);

    setFeedback({
      isCorrect,
      explanation: currentQuestion.explanation
    });

    const newScore = {
      total: score.total + 1,
      correct: score.correct + (isCorrect ? 1 : 0)
    };
    setScore(newScore);

    const attempt: Attempt = {
      id: Date.now().toString(),
      question: currentQuestion.question,
      type: config.types.length === 1 ? config.types[0] : 'Mixed',
      rule: currentQuestion.rule,
      difficulty: currentQuestion.difficulty,
      userAnswer,
      correctAnswer: currentQuestion.answer,
      isCorrect,
      explanation: currentQuestion.explanation,
      timestamp: Date.now()
    };

    setHistory([attempt, ...history]);
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < generatedQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setFeedback(null);
      setUserAnswer('');
    } else {
      setGeneratedQuestions([]);
      setCurrentQuestionIndex(0);
      setFeedback(null);
      setUserAnswer('');
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
            <Rocket className="w-6 h-6 text-primary-600" />
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

      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 w-full">
        
        {/* Left Column: Configuration */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Configuration Card */}
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
                    <div className="flex justify-end mb-2">
                      <button 
                        onClick={() => setConfig({...config, rules: config.rules.length === ALL_RULES.length ? [] : ALL_RULES})}
                        className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                      >
                        {config.rules.length === ALL_RULES.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-4 pr-1">
                      {Object.entries(GRAMMAR_CATEGORIES).map(([category, rules]) => (
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
                                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 w-4 h-4"
                              />
                              <span className="text-sm text-slate-700">{rule}</span>
                            </label>
                          ))}
                        </div>
                      ))}
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
                    <div className="flex justify-end mb-2">
                      <button 
                        onClick={() => setConfig({...config, types: config.types.length === ALL_TYPES.length ? [] : ALL_TYPES})}
                        className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                      >
                        {config.types.length === ALL_TYPES.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    <div className="space-y-1">
                      {ALL_TYPES.map(type => (
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
                            className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 w-4 h-4"
                          />
                          <span className="text-sm text-slate-700">{type}</span>
                        </label>
                      ))}
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
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white text-sm"
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
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white text-sm"
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
                className="w-full mt-6 bg-primary-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-70 flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                {loading ? 'Generating...' : 'Generate Questions'}
              </button>
            </div>
          </div>

        </div>

        {/* Right Column: Question Engine & History */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Question Area */}
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div 
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-white p-12 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center min-h-[400px]"
              >
                <Loader2 className="w-12 h-12 text-primary-600 animate-spin mb-4" />
                <p className="text-slate-500 font-medium animate-pulse">Crafting the perfect questions...</p>
              </motion.div>
            ) : generatedQuestions.length > 0 && currentQuestion ? (
              <motion.div 
                key="question"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 sm:p-8 rounded-xl shadow-sm border border-slate-200 min-h-[400px] flex flex-col"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-primary-50 text-primary-700 text-xs font-bold rounded-full uppercase tracking-wider border border-primary-100">
                      {currentQuestion.rule}
                    </span>
                    <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-full uppercase tracking-wider border border-slate-200">
                      {currentQuestion.difficulty}
                    </span>
                  </div>
                  <span className="text-sm text-slate-500 font-medium flex items-center gap-1.5">
                    Question {currentQuestionIndex + 1} of {generatedQuestions.length}
                  </span>
                </div>

                <h3 className="text-xl sm:text-2xl font-medium text-slate-900 mb-8 leading-relaxed">
                  {currentQuestion.question}
                </h3>

                <div className="flex-grow">
                  {!feedback ? (
                    <div className="space-y-6">
                      {isMCQ ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                          {currentQuestion.choices.map((choice, idx) => (
                            <button
                              key={idx}
                              onClick={() => setUserAnswer(choice)}
                              className={`p-4 text-left rounded-xl border-2 transition-all ${
                                userAnswer === choice 
                                  ? 'border-primary-600 bg-primary-50 text-primary-900 shadow-sm' 
                                  : 'border-slate-200 hover:border-primary-300 hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <span className="font-medium">{choice}</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={userAnswer}
                          onChange={e => setUserAnswer(e.target.value)}
                          placeholder="Type your answer here..."
                          className="w-full p-4 text-lg rounded-xl border-2 border-slate-200 focus:border-primary-600 focus:ring-0 transition-colors bg-slate-50 focus:bg-white"
                          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                        />
                      )}

                      <div className="pt-4 flex justify-end">
                        <button
                          onClick={handleSubmit}
                          disabled={!userAnswer.trim()}
                          className="bg-slate-900 text-white py-3 px-8 rounded-xl font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-sm flex items-center gap-2"
                        >
                          Submit Answer
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`p-6 rounded-xl border ${
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
                              <p className="text-slate-900 font-medium">{currentQuestion.answer}</p>
                            </div>
                          )}
                          
                          <div className="mb-6">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Explanation</span>
                            <p className="text-slate-700 leading-relaxed">
                              {feedback.explanation}
                            </p>
                          </div>
                          
                          <button
                            onClick={handleNextQuestion}
                            className="bg-white border border-slate-300 text-slate-700 py-2.5 px-6 rounded-lg font-medium hover:bg-slate-50 transition-colors shadow-sm flex items-center gap-2"
                          >
                            {currentQuestionIndex < generatedQuestions.length - 1 ? 'Next Question' : 'Finish Quiz'}
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            ) : (
              <div className="bg-white p-12 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center min-h-[400px] text-center">
                <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mb-4">
                  <Rocket className="w-8 h-8 text-primary-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Ready to practice?</h3>
                <p className="text-slate-500 max-w-md mx-auto">
                  Select your grammar rules, question types, and difficulty on the left, then click "Generate Questions" to start learning.
                </p>
              </div>
            )}
          </AnimatePresence>

          {/* History Area */}
          {history.length > 0 && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold flex items-center gap-2 text-slate-800">
                  <History className="w-5 h-5 text-slate-500" />
                  Recent History
                </h2>
                <span className="text-sm text-slate-500">{history.length} attempts</span>
              </div>
              
              <div className="space-y-4">
                {history.slice(0, 5).map(attempt => (
                  <div key={attempt.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
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
                  </div>
                ))}
              </div>
            </div>
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
            v1.0.003
          </p>
        </div>
      </footer>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-800">Settings</h2>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600">
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
          </div>
        </div>
      )}
    </div>
  );
}
