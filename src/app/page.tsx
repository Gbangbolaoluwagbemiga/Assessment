'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Github, Code2, Clock, CheckCircle2, ChevronRight, Play, Send, CheckSquare, Square, Lock, Loader2 } from 'lucide-react'

type Step = 'intake' | 'loading' | 'assessment' | 'repo' | 'success'

interface Question {
  id: number
  type: 'mcq' | 'multiplechoice' | 'truefalse' | 'fillintheblank' | 'fillinblank'
  question: string
  options?: string[]
  answer: string | boolean
}

interface Repo {
  id: number
  name: string
  description: string | null
  created_at: string
  updated_at: string
  html_url: string
  stargazers_count: number
}

const conceptOptions = ['Not familiar', 'Basic', 'Proficient', 'Expert']
const coreConcepts = [
  { label: 'Object-oriented programming', key: 'oop' },
  { label: 'Data structures', key: 'datastructures' },
  { label: 'APIs & REST', key: 'apis' },
  { label: 'Databases', key: 'databases' }
]

export default function AssessmentApp() {
  const [step, setStep] = useState<Step>('intake')
  
  // Local State
  const [githubUsername, setGithubUsername] = useState('')
  const [repos, setRepos] = useState<Repo[]>([])
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Intake Form State (Webhook Schema specific)
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    language: '',
    proficiency: '',
    yearsExperience: '',
    lastUsed: '',
    frameworks: [] as string[],
    oop: '',
    datastructures: '',
    apis: '',
    databases: ''
  })
  
  // Assessment State
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, any>>({})
  const [loadingText, setLoadingText] = useState('> Initializing Assessment...')
  const [timeRemaining, setTimeRemaining] = useState(600)
  const [isAlreadyCompleted, setIsAlreadyCompleted] = useState(false)
  const [hasWarned3Min, setHasWarned3Min] = useState(false)

  // 0. Completion Check
  // 0. Persistence Logic
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isDone = localStorage.getItem('web3bridge_assessment_done') === 'true'
      setIsAlreadyCompleted(isDone)
      
      if (!isDone) {
        const saved = localStorage.getItem('web3bridge_assessment_session')
        if (saved) {
          try {
            const data = JSON.parse(saved)
            setFormData(data.formData)
            setGithubUsername(data.githubUsername)
            setQuestions(data.questions)
            setAnswers(data.answers)
            setCurrentQuestionIndex(data.currentQuestionIndex)
            setTimeRemaining(data.timeRemaining)
            setStep(data.step)
          } catch (e) {
            // console.error("Failed to restore assessment session", e)
          }
        }
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined' && step !== 'success' && !isAlreadyCompleted) {
      const sessionData = {
        formData,
        githubUsername,
        questions,
        answers,
        currentQuestionIndex,
        timeRemaining,
        step
      }
      localStorage.setItem('web3bridge_assessment_session', JSON.stringify(sessionData))
    }
  }, [step, formData, githubUsername, questions, answers, currentQuestionIndex, timeRemaining, isAlreadyCompleted])

  // 1. Repo Fetching Logic
  const fetchRepos = async (username: string): Promise<boolean> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(`https://api.github.com/users/${username}/repos?sort=updated&per_page=100`, {
        signal: controller.signal
      })
      clearTimeout(timeoutId);

      if (!res.ok) {
        toast.error("GitHub Discovery Failure", {
          description: `The GitHub profile '${username}' was not found. Verify the handle and try again.`,
          duration: Infinity, 
          action: { label: 'Dismiss', onClick: () => {} }
        })
        return false
      }
      const data: Repo[] = await res.json()
      
      const ninetyDaysAgo = new Date()
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
      
      const filtered = data.filter(repo => new Date(repo.created_at) < ninetyDaysAgo)
      
      if (filtered.length === 0) {
        toast.warning("Portfolio Criteria Not Met", {
          description: `The GitHub profile '${username}' was found, but it has no public repositories older than 3 months. Our evaluation engine requires established projects.`,
          duration: Infinity, 
          action: { label: 'Dismiss', onClick: () => {} }
        })
      }
      
      setRepos(filtered)
      return true
    } catch (err: any) {
      clearTimeout(timeoutId);
      // console.error("Failed to fetch repos:", err)
      const isTimeout = err.name === 'AbortError';
      toast.error(isTimeout ? "GitHub Verification Timeout" : "GitHub Network Error", {
        description: isTimeout 
          ? `The GitHub API is currently experiencing high latency. Switch network or check the profile '${username}' manually.`
          : `Failed to connect to GitHub. Verify your profile '${username}' exists and try again.`,
        duration: Infinity,
        action: { label: 'Dismiss', onClick: () => {} }
      })
      setRepos([])
      return false
    }
  }

  // 2. Intake Form Handlers
  const toggleFramework = (fw: string) => {
    const fwKey = fw.split(' ')[0].toLowerCase().replace('.', '')
    setFormData(prev => ({
      ...prev,
      frameworks: prev.frameworks.includes(fwKey) 
        ? prev.frameworks.filter(f => f !== fwKey)
        : [...prev.frameworks, fwKey]
    }))
  }

  const submitIntake = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Basic Valdiation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!formData.fullName || !formData.email || !formData.language || !formData.proficiency || !githubUsername) {
      return toast.error("Please fill all required fields including GitHub Username.")
    }

    if (!emailRegex.test(formData.email)) {
      return toast.error("Invalid Email Format", {
        description: "Please provide a valid email address to proceed.",
        duration: Infinity,
        action: { label: 'Dismiss', onClick: () => {} }
      })
    }
    
    const unrated = coreConcepts.filter(c => !formData[c.key as keyof typeof formData])
    if (unrated.length > 0) {
      return toast.error(`Please rate your familiarity with ${unrated[0].label}`)
    }

    setStep('loading')
    setLoadingText('> Synchronizing assessment cloud...')
    setIsProcessing(true)
    
    try {
      // Parallelize Question Generation and Portfolio Discovery
      const payload = {
        fullName: formData.fullName,
        email: formData.email,
        language: formData.language,
        proficiency: formData.proficiency,
        yearsExperience: parseInt(formData.yearsExperience) || 0,
        lastUsed: formData.lastUsed,
        frameworks: formData.frameworks,
        oop: formData.oop,
        datastructures: formData.datastructures,
        apis: formData.apis,
        databases: formData.databases
      }

      const results = await Promise.all([
        fetchRepos(githubUsername),
        fetch('https://assessment-n8n.web3bridge.com/webhook/student', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      ])

      const [githubSuccess, response] = results;

      if (!githubSuccess) {
        setIsProcessing(false)
        setStep('intake')
        return
      }

      const responseText = await response.text();
      let data: any = {};
      
      if (responseText) {
        try {
          data = JSON.parse(responseText);
          // console.log("> n8n Webhook Response:", data);
        } catch (e) {
          throw new Error("Invalid response format from server.");
        }
      } else {
        throw new Error("Empty response from assessment server.");
      }

      const rawQs = data[0]?.questions || data[0]?.output?.questions || data.questions || (Array.isArray(data) ? data : []);
      
      const qList = rawQs.map((q: any) => ({
        ...q,
        type: (q.type || 'multiple_choice').toString().toLowerCase().replace(/[\/\-_\s]/g, '')
      }));

      if (qList.length > 0) {
        setQuestions(qList)
        setLoadingText('> Environment provisioned. Starting quiz...')
        setIsProcessing(false)
        setTimeout(() => setStep('assessment'), 800)
      } else {
        throw new Error("Evaluation engine returned no questions. Contact support.")
      }
    } catch (err: any) {
      toast.error("Assessment Engine Failed", {
        description: err.message || "Failed to load questions. Check your connection.",
        duration: Infinity,
        action: { label: 'Dismiss', onClick: () => {} }
      })
      setStep('intake')
    } finally {
      setIsProcessing(false)
    }
  }

  // 3. Quiz Handlers
  const handleAnswer = (val: any) => {
    setAnswers(prev => ({ ...prev, [curQ.id]: val }))
  }

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1)
    } else if (answers[curQ.id]) {
      setStep('repo')
    } else {
      toast.error("Answer required", {
        description: "Please provide an answer to proceed to the next challenge.",
        duration: 3000
      })
    }
  }

  // Timer Effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 'assessment' && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev === 181 && !hasWarned3Min) {
            toast.warning("Critial Update: 3 minutes remaining!", {
              description: "The evaluation engine will auto-submit when the timer hits zero.",
              duration: 5000
            })
            setHasWarned3Min(true)
          }
          return prev - 1
        })
      }, 1000)
    } else if (timeRemaining === 0 && step === 'assessment') {
      toast.error("Time's up! Transitioning to final selection.")
      setStep('repo')
    }
    return () => clearInterval(interval)
  }, [step, timeRemaining, hasWarned3Min])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const renderQuestionText = (text: string) => {
    // Detect code blocks (multiline or single statements)
    // We look for parts that look like JS/programming syntax
    const codeRegex = /(?:^|\n)(?:(?:function|const|let|var|console\.log|if|for|while|return|import|export|class)[\s\S]+?)(?=\n\n|\n[^\s]|$(?![\s\S]))/g;
    
    // Fallback: If no large blocks found, try backticks
    const backtickRegex = /`([^`]+)`/g;
    
    // First, let's see if we can identify blocks of code
    let content = text;
    const blocks: string[] = [];
    content = content.replace(codeRegex, (match) => {
      blocks.push(match.trim());
      return `__CODE_BLOCK_${blocks.length - 1}__`;
    });
    
    content = content.replace(backtickRegex, (match, code) => {
      blocks.push(code.trim());
      return `__CODE_BLOCK_${blocks.length - 1}__`;
    });

    const parts = content.split(/(__CODE_BLOCK_\d+__)/g);
    
    return parts.map((part, i) => {
      const blockMatch = part.match(/__CODE_BLOCK_(\d+)__/);
      if (blockMatch) {
        const index = parseInt(blockMatch[1]);
        const block = blocks[index];
        return (
          <pre key={i} className="block w-full bg-[#0d0d0d] border border-white/5 rounded-2xl p-8 my-8 font-mono text-xl text-indigo-400 overflow-x-auto shadow-2xl leading-relaxed custom-scrollbar">
            {block.split('\n').map((line, j) => (
              <div key={j} className="flex gap-4">
                <span className="text-gray-700 select-none w-6 text-right text-sm mt-1">{j + 1}</span>
                <span>{line}</span>
              </div>
            ))}
          </pre>
        );
      }
      return <span key={i} className="text-gray-200">{part}</span>;
    });
  }

  const variants = {
    initial: { opacity: 0, scale: 0.98 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.98 }
  }

  const curQ = questions[currentQuestionIndex]

  return (
    <div className="w-full flex-1 flex flex-col items-center justify-center py-10">
      <AnimatePresence mode="wait">
        
        {isAlreadyCompleted ? (
          <motion.div key="completed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-2xl bg-[#0A0A0F]/60 backdrop-blur-2xl border border-white/5 shadow-2xl rounded-[2.5rem] p-12 text-center">
            <div className="w-24 h-24 bg-indigo-500/10 rounded-full flex items-center justify-center border border-indigo-500/20 mx-auto mb-8">
              <Lock className="w-10 h-10 text-indigo-400" />
            </div>
            <h2 className="text-3xl font-black mb-4 tracking-tight uppercase italic">Assessment Locked</h2>
            <p className="text-gray-500 text-lg font-medium leading-relaxed">
              Our records show that you have already completed the Web3bridge technical intake. Multiple attempts are strictly prohibited to ensure candidate integrity.
            </p>
          </motion.div>
        ) : (
          <div className="w-full max-w-4xl bg-[#0A0A0F]/60 backdrop-blur-2xl border border-white/5 shadow-2xl rounded-[2.5rem] p-8 md:p-12 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar space-y-12">
              
              {step === 'intake' && (
                <motion.div key="intake" variants={variants} initial="initial" animate="animate" exit="exit" className="space-y-10">
                  <div className="text-center mb-12 py-6">
                    <h1 className="text-3xl font-black mb-3 tracking-tight text-white uppercase italic">Developer Assessment Form</h1>
                    <p className="text-gray-400 text-lg font-medium tracking-tight">Initial profile setup for the Web3bridge evaluation engine.</p>
                  </div>

                  <form onSubmit={submitIntake} className="space-y-12">
                    {/* Basic Section */}
                    <div className="space-y-6">
                      <h3 className="text-lg font-bold text-white border-b border-white/10 pb-2 flex items-center gap-3">
                        <div className="w-1 h-5 bg-indigo-500" />
                        Basic Information
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-2 font-black uppercase tracking-widest">Full name *</label>
                          <input required type="text" placeholder="Amara Okafor" className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 focus:border-indigo-500 transition-all text-base font-bold text-white placeholder-gray-800" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-2 font-black uppercase tracking-widest">Email *</label>
                          <input required type="email" placeholder="amara.okafor@example.com" className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 focus:border-indigo-500 transition-all text-base font-bold text-white placeholder-gray-800" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-[10px] text-gray-500 mb-2 font-black uppercase tracking-widest">GitHub Username *</label>
                          <div className="relative group">
                            <input required type="text" placeholder="Github Username" className="w-full bg-black/40 border border-white/5 rounded-xl pl-10 pr-4 py-3 focus:border-indigo-500 transition-all text-lg font-black text-white placeholder-gray-800" value={githubUsername} onChange={e => setGithubUsername(e.target.value)} />
                            <Github className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-indigo-500 transition-colors" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Experience Section */}
                    <div className="space-y-6">
                      <h3 className="text-lg font-bold text-white border-b border-white/10 pb-2 flex items-center gap-3">
                        <div className="w-1 h-5 bg-indigo-500" />
                        Programming Proficiency
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-2 font-black uppercase tracking-widest">Target Language *</label>
                          <select required className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 focus:border-indigo-500 transition-colors text-base font-bold text-white appearance-none" value={formData.language} onChange={e => setFormData({...formData, language: e.target.value.toLowerCase()})}>
                            <option value="">-- SELECT --</option>
                            <option value="javascript">JAVASCRIPT</option>
                            <option value="python">PYTHON</option>
                            <option value="php">PHP</option>
                            <option value="go">GO</option>
                            <option value="rust">RUST</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-2 font-black uppercase tracking-widest">Years of Experience *</label>
                          <input required type="number" min="0" placeholder="03" className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 focus:border-indigo-500 transition-colors text-base font-bold text-white placeholder-gray-800" value={formData.yearsExperience} onChange={e => setFormData({...formData, yearsExperience: e.target.value})} />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] mb-3 text-gray-500 font-black uppercase tracking-widest">Self-assess skill *</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {['Beginner', 'Intermediate', 'Advanced', 'Expert'].map(l => (
                            <label key={l} className={`flex items-center gap-3 cursor-pointer p-4 rounded-xl border transition-all ${formData.proficiency === l.toLowerCase() ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-white/5 bg-white/5 hover:bg-white/10 text-gray-600'}`}>
                              <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${formData.proficiency === l.toLowerCase() ? 'border-indigo-400' : 'border-white/20'}`}>
                                {formData.proficiency === l.toLowerCase() && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
                              </div>
                              <span className="text-xs font-black uppercase italic">{l}</span>
                              <input type="radio" className="hidden" name="proficiency" value={l.toLowerCase()} onChange={e => setFormData({...formData, proficiency: e.target.value})} />
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] text-gray-500 mb-2 font-black uppercase tracking-widest">Last Active Activity *</label>
                        <select required className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 focus:border-indigo-500 transition-colors text-base font-bold text-white appearance-none" value={formData.lastUsed} onChange={e => setFormData({...formData, lastUsed: e.target.value})}>
                          <option value="">-- SELECT STATUS --</option>
                          <option value="current">CURRENTLY ACTIVE</option>
                          <option value="past_week">WITHIN PAST WEEK</option>
                          <option value="past_month">WITHIN PAST MONTH</option>
                          <option value="older">OLDER THAN A MONTH</option>
                        </select>
                      </div>
                    </div>

                    {/* Concepts Matrix */}
                    <div className="space-y-6">
                      <h3 className="text-lg font-bold text-white border-b border-white/10 pb-2 flex items-center gap-3">
                        <div className="w-1 h-5 bg-indigo-500" />
                        Core Concepts
                      </h3>
                      <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/20">
                        <table className="w-full text-left border-collapse min-w-[600px]">
                          <thead>
                            <tr className="bg-white/5">
                              <th className="py-4 px-6 font-black text-gray-600 uppercase text-[10px] tracking-widest w-1/3">Technical Domain</th>
                              {conceptOptions.map(opt => <th key={opt} className="py-4 px-2 text-center font-black text-gray-600 uppercase text-[10px] tracking-widest">{opt}</th>)}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {coreConcepts.map((concept, idx) => (
                              <tr key={concept.key} className={idx % 2 === 1 ? 'bg-white/[0.02]' : ''}>
                                <td className="py-5 px-6 font-bold text-sm text-white italic">{concept.label}</td>
                                {conceptOptions.map(opt => (
                                  <td key={opt} className="py-5 px-2 text-center">
                                    <label className="inline-flex cursor-pointer items-center justify-center p-2 group w-full h-full">
                                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${formData[concept.key as keyof typeof formData] === opt.toLowerCase() ? 'border-indigo-500 bg-indigo-500' : 'border-white/10 group-hover:border-white/30'}`}>
                                        {formData[concept.key as keyof typeof formData] === opt.toLowerCase() && <div className="w-2 h-2 rounded-full bg-white" />}
                                      </div>
                                      <input type="radio" name={`concept_${concept.key}`} className="hidden" value={opt.toLowerCase()} onChange={() => setFormData({...formData, [concept.key]: opt.toLowerCase()})} />
                                    </label>
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="pt-10 flex justify-center pb-12">
                      <button type="submit" disabled={isProcessing} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black rounded-xl px-12 py-4 transition-all shadow-xl shadow-indigo-500/20 flex items-center gap-4 text-sm uppercase italic transform active:scale-95">
                        {isProcessing ? <Loader2 className="w-5 h-5 animate-spin"/> : <>Initialize Evaluation <ChevronRight className="w-5 h-5" /></>}
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}

              {step === 'loading' && (
                <motion.div key="loading" variants={variants} initial="initial" animate="animate" exit="exit" className="flex flex-col items-center justify-center py-40 text-center">
                   <div className="relative w-16 h-16 mb-8">
                     <div className="absolute inset-0 border-4 border-indigo-500/10 rounded-full" />
                     <div className="absolute inset-0 border-4 border-l-indigo-500 rounded-full animate-spin" />
                   </div>
                   <h2 className="text-2xl font-bold mb-4 tracking-tight text-white">Loading Questions</h2>
                   <div className="bg-black/60 border border-white/5 rounded-xl p-6 font-mono text-xs text-emerald-400 w-full max-w-sm shadow-2xl">
                      {loadingText}
                   </div>
                </motion.div>
              )}

              {step === 'assessment' && curQ && (
                <motion.div 
                  key="assessment" 
                  variants={variants} 
                  initial="initial" 
                  animate="animate" 
                  exit="exit" 
                  className="w-full space-y-12 py-10 select-none"
                  onCopy={(e) => e.preventDefault()}
                  onPaste={(e) => e.preventDefault()}
                  onCut={(e) => e.preventDefault()}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  {/* Header */}
                  <div className="flex justify-between items-center mb-10 pb-6 border-b border-white/5">
                     <div className="flex items-center gap-4">
                        <div className="bg-indigo-500/10 text-indigo-400 px-3 py-1.5 rounded-lg border border-indigo-500/20 text-[10px] font-black tracking-widest">
                          LIVE CHALLENGE
                        </div>
                        <h2 className="font-bold text-sm tracking-widest text-white uppercase italic">
                           {currentQuestionIndex + 1} <span className="text-gray-600">/ {questions.length}</span>
                        </h2>
                     </div>
                     <div className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono font-black border transition-all text-sm tracking-tighter ${timeRemaining <= 180 ? 'text-rose-400 bg-rose-400/5 border-rose-400/20 animate-pulse' : 'text-emerald-400 bg-emerald-400/5 border-emerald-500/20'}`}>
                       <Clock className="w-4 h-4" />
                       <span>{formatTime(timeRemaining)}</span>
                     </div>
                  </div>

                  {/* Content */}
                  <div className="space-y-8">
                     <h3 className="text-xl font-bold leading-relaxed text-white tracking-tight">
                       {renderQuestionText(curQ.question)}
                     </h3>

                     <div className="w-full space-y-8">
                       {(curQ.type === 'mcq' || curQ.type === 'multiplechoice') && (
                         <div className="grid grid-cols-1 gap-3">
                           {curQ.options?.map((opt: string, i: number) => (
                             <button
                               key={i}
                               onClick={() => {
                                 handleAnswer(opt)
                                 setTimeout(nextQuestion, 400)
                               }}
                               className={`p-5 rounded-xl border text-left transition-all text-base flex items-center gap-4 ${answers[curQ.id] === opt ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-white/5 bg-white/[0.03] hover:border-white/10 hover:bg-white/5'}`}
                             >
                               <div className={`w-7 h-7 rounded-lg border flex items-center justify-center font-black text-xs transition-all ${answers[curQ.id] === opt ? 'bg-indigo-500 border-indigo-400 text-white' : 'bg-black/20 border-white/10 text-gray-600'}`}>
                                 {String.fromCharCode(65 + i)}
                               </div>
                               <span className={`${answers[curQ.id] === opt ? 'font-bold' : 'text-gray-300'}`}>{opt}</span>
                             </button>
                           ))}
                         </div>
                       )}

                       {curQ.type === 'truefalse' && (
                         <div className="flex gap-4 max-w-sm mx-auto">
                           {(curQ.options && curQ.options.length === 2 ? curQ.options : ['True', 'False']).map((val: any) => (
                             <button
                               key={val.toString()}
                               onClick={() => {
                                 handleAnswer(val)
                                 setTimeout(nextQuestion, 400)
                               }}
                               className={`flex-1 p-6 rounded-xl border text-center transition-all text-lg font-black uppercase tracking-widest italic ${answers[curQ.id] === val ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-white/5 bg-white/[0.03] hover:border-white/10 text-gray-500'}`}
                             >
                               {val.toString()}
                             </button>
                           ))}
                         </div>
                       )}

                       {(curQ.type === 'fillintheblank' || curQ.type === 'fillinblank') && (
                         <div className="w-full max-w-lg mx-auto">
                           <input
                             type="text"
                             className="w-full bg-black/20 border border-white/10 rounded-xl p-5 text-xl focus:border-indigo-500 focus:outline-none transition-all placeholder-gray-800 font-mono text-white text-center tracking-widest font-black uppercase"
                             placeholder="..."
                             value={answers[curQ.id] || ''}
                             onChange={(e) => handleAnswer(e.target.value)}
                           />
                         </div>
                       )}
                     </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-16 pt-8 border-t border-white/5 flex justify-between items-center pb-10">
                     <button disabled={currentQuestionIndex === 0} onClick={() => setCurrentQuestionIndex(p => p - 1)} className="px-6 py-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition disabled:opacity-10 text-white font-bold text-[10px] uppercase">
                       Back
                     </button>
                     <button onClick={nextQuestion} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-black transition-all flex items-center gap-3 text-white text-sm uppercase italic active:scale-95">
                       {currentQuestionIndex === questions.length - 1 ? 'Analyze All' : 'Continue Step'}
                       <ChevronRight className="w-5 h-5" />
                     </button>
                  </div>
                </motion.div>
              )}

              {step === 'repo' && (
                <motion.div key="repo" variants={variants} initial="initial" animate="animate" exit="exit" className="space-y-12 py-10">
                  <div className="text-center mb-10">
                    <h2 className="text-3xl font-black mb-4 text-white uppercase italic">Verification Engine</h2>
                    <p className="text-gray-500 text-base max-w-xl mx-auto">Identify your benchmark project for architectural review. Mandatory 3-month age requirement applies.</p>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-12">
                    {repos.length > 0 ? repos.map(repo => (
                      <div 
                        key={repo.id}
                        onClick={() => setSelectedRepo(repo)}
                        className={`p-6 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between h-48 ${selectedRepo?.id === repo.id ? 'border-emerald-500 bg-emerald-500/5' : 'border-white/5 bg-black/20 hover:border-white/10'}`}
                      >
                        <h3 className="font-bold text-base text-white line-clamp-1">{repo.name}</h3>
                        <p className="text-xs text-gray-600 mt-2 line-clamp-2">{repo.description || 'Verified public repository.'}</p>
                        <div className="flex items-center justify-between mt-auto">
                          <span className="text-[10px] font-black text-gray-700 uppercase">Age: {new Date(repo.created_at).toLocaleDateString()}</span>
                          <div className="text-[10px] font-bold text-amber-500/50 flex items-center gap-1">Stars: {repo.stargazers_count}</div>
                        </div>
                      </div>
                    )) : (
                      <div className="col-span-full py-20 text-center border border-dashed border-white/5 rounded-2xl">
                         <p className="text-gray-700 text-sm font-bold uppercase tracking-widest">No matching benchmark repositories found.</p>
                      </div>
                    )}
                  </div>

                  <div className="pt-10 flex justify-center pb-12">
                    <button 
                      onClick={async () => {
                        if(!selectedRepo && repos.length > 0) return toast.error("Select a repository.")
                        
                        setIsProcessing(true)
                        setStep('loading')
                        setLoadingText('> Finalizing architectural evaluation...')

                        try {
                          const finalPayload = {
                            candidate: {
                              fullName: formData.fullName,
                              email: formData.email,
                              github: githubUsername
                            },
                            results: Object.entries(answers).map(([id, ans]) => ({
                              questionId: id,
                              answer: ans
                            })),
                            selectedRepo: selectedRepo
                          }

                          await fetch('https://assessment-n8n.web3bridge.com/webhook/submit', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(finalPayload)
                          })

                          localStorage.setItem('web3bridge_assessment_done', 'true')
                          localStorage.removeItem('web3bridge_assessment_session')
                          setStep('success')
                        } catch (err) {
                          toast.error("Submission Failure", {
                            description: "Failed to sync metrics with evaluation cloud. Check your network.",
                            duration: 5000
                          })
                          setStep('repo')
                        } finally {
                          setIsProcessing(false)
                        }
                      }} 
                      disabled={isProcessing}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl px-12 py-5 transition-all flex items-center gap-4 text-sm uppercase italic active:scale-95 shadow-xl shadow-emerald-600/10 disabled:opacity-50"
                    >
                      {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Sync Submission <Send className="w-5 h-5" /></>}
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 'success' && (
                 <motion.div key="success" variants={variants} initial="initial" animate="animate" exit="exit" className="flex flex-col items-center justify-center py-24 text-center">
                   <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20 mb-8 mx-auto">
                     <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                   </div>
                   <h2 className="text-4xl font-black mb-4 text-white uppercase italic">Assessment Logged</h2>
                   <p className="text-gray-500 max-w-md mx-auto text-lg font-medium italic">
                     The evaluation engine has recorded your phase metrics. You will be notified via the primary mailbox provided.
                   </p>
                 </motion.div>
              )}

            </div>
          </div>
        )}

      </AnimatePresence>
    </div>
  )
}
