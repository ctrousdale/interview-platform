import { useEffect, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowRight, BookOpen, Check, ChevronDown, Clock3, Code2, FileText, Layers3, LoaderCircle, MessageSquareText, RefreshCw, Sparkles } from 'lucide-react'
import { Button } from './components/ui/button'

type Question = { id: string; category: string; difficulty: string; title: string; prompt: string }
type Session = { id: string; questionId: string; questionTitle: string; category: string; answer: string; createdAt: string }

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options)
  if (!response.ok) throw new Error(`Request failed (${response.status}). Please try again.`)
  return response.json() as Promise<T>
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

function App() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [questionsLoading, setQuestionsLoading] = useState(true)
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [questionsError, setQuestionsError] = useState('')
  const [sessionsError, setSessionsError] = useState('')
  const [reloadQuestions, setReloadQuestions] = useState(0)
  const [reloadSessions, setReloadSessions] = useState(0)
  const [selectedId, setSelectedId] = useState('')
  const [category, setCategory] = useState('All topics')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [savedId, setSavedId] = useState('')
  const [expandedSession, setExpandedSession] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    setQuestionsLoading(true)
    setQuestionsError('')
    request<Question[]>('/api/questions', { signal: controller.signal })
      .then(data => { setQuestions(data); setSelectedId(current => data.some(q => q.id === current) ? current : data[0]?.id ?? '') })
      .catch(error => { if (!controller.signal.aborted) setQuestionsError(error instanceof Error ? error.message : 'Could not load questions.') })
      .finally(() => { if (!controller.signal.aborted) setQuestionsLoading(false) })
    return () => controller.abort()
  }, [reloadQuestions])

  useEffect(() => {
    const controller = new AbortController()
    setSessionsLoading(true)
    setSessionsError('')
    request<Session[]>('/api/sessions', { signal: controller.signal })
      .then(data => setSessions(current => [...current.filter(item => !data.some(session => session.id === item.id)), ...data]))
      .catch(error => { if (!controller.signal.aborted) setSessionsError(error instanceof Error ? error.message : 'Could not load sessions.') })
      .finally(() => { if (!controller.signal.aborted) setSessionsLoading(false) })
    return () => controller.abort()
  }, [reloadSessions])

  const categories = useMemo(() => ['All topics', ...Array.from(new Set(questions.map(q => q.category)))], [questions])
  const filtered = category === 'All topics' ? questions : questions.filter(q => q.category === category)
  const selected = questions.find(q => q.id === selectedId)
  const answer = drafts[selectedId] ?? ''
  const recentSessions = useMemo(() => [...sessions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [sessions])

  function chooseQuestion(id: string) {
    if (saving) return
    setSelectedId(id)
    setSaveError('')
    setSavedId('')
  }

  async function saveAnswer(event: React.FormEvent) {
    event.preventDefault()
    if (!selected || !answer.trim() || saving) return
    const questionId = selected.id
    setSaving(true)
    setSaveError('')
    setSavedId('')
    try {
      const session = await request<Session>('/api/sessions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, answer: answer.trim() }),
      })
      setSessions(current => [session, ...current.filter(item => item.id !== session.id)])
      if (sessionsError) setReloadSessions(n => n + 1)
      setDrafts(current => ({ ...current, [questionId]: '' }))
      setSavedId(questionId)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save your answer.')
    } finally { setSaving(false) }
  }

  return (
    <div className="min-h-screen bg-carbon-950 text-ink">
      <header className="border-b border-carbon-700/80 bg-carbon-950">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <a href="#top" className="flex items-center gap-3 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple" aria-label="Practice Studio home">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple text-carbon-950"><Code2 size={20} strokeWidth={2.4} /></span>
            <span className="text-[15px] font-bold tracking-tight">practice<span className="text-purple">.</span>studio</span>
          </a>
          <div className="flex items-center gap-2 text-xs font-medium text-muted"><span className="h-1.5 w-1.5 rounded-full bg-mint" /> YOUR PRACTICE SPACE</div>
        </div>
      </header>

      <main id="top" className="mx-auto max-w-[1440px] px-5 pb-16 pt-10 sm:px-8 lg:px-12 lg:pt-14">
        <section className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <div className="eyebrow mb-4"><Sparkles size={14} className="text-purple" /> A LITTLE PRACTICE GOES A LONG WAY</div>
            <h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-[42px] sm:leading-tight">Show up <span className="text-purple">ready.</span></h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-muted sm:text-[15px]">A quiet space to think out loud, sharpen your answers, and build confidence for your next interview.</p>
          </div>
          <div className="flex items-center gap-3 self-start rounded-lg border border-carbon-700 bg-carbon-900 px-4 py-3 md:self-auto">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-purple/10 text-purple"><Layers3 size={17} /></span>
            <div><div className="text-sm font-semibold">One answer at a time</div><div className="mt-0.5 text-xs text-muted">Progress, not perfection.</div></div>
          </div>
        </section>

        <div className="grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_290px]">
          <aside className="panel overflow-hidden" aria-label="Question library">
            <div className="border-b border-carbon-700 p-5">
              <div className="flex items-start justify-between gap-3"><div><div className="eyebrow text-purple">THE LIBRARY</div><h2 className="mt-2 text-lg font-semibold tracking-tight">Choose a question</h2><p className="mt-1 text-xs leading-5 text-muted">Pick a prompt and start practicing.</p></div><span className="icon-box"><BookOpen size={17} /></span></div>
              <label htmlFor="category" className="sr-only">Filter by topic</label>
              <div className="relative mt-5"><select id="category" value={category} onChange={event => setCategory(event.target.value)} className="field w-full appearance-none py-2.5 pl-3 pr-9 text-xs"><option>All topics</option>{categories.slice(1).map(item => <option key={item}>{item}</option>)}</select><ChevronDown size={15} className="pointer-events-none absolute right-3 top-3 text-muted" /></div>
            </div>
            <div className="px-3 py-3">
              <div className="flex items-center justify-between px-2 pb-2 pt-1"><span className="eyebrow">QUESTIONS</span><span className="mono text-[10px] text-muted">{filtered.length.toString().padStart(2, '0')}</span></div>
              {questionsLoading ? <Loading label="Loading questions..." /> : questionsError ? <ErrorState message={questionsError} retry={() => setReloadQuestions(n => n + 1)} /> : filtered.length === 0 ? <p className="px-2 py-5 text-sm text-muted">No questions found for this topic.</p> : <div className="space-y-1">{filtered.map((question, index) => <button key={question.id} type="button" onClick={() => chooseQuestion(question.id)} aria-pressed={selectedId === question.id} className={`group flex w-full gap-3 rounded-md border px-3 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple ${selectedId === question.id ? 'border-purple/30 bg-purple/10' : 'border-transparent hover:bg-carbon-800'}`}><span className={`mono pt-0.5 text-[10px] ${selectedId === question.id ? 'text-purple' : 'text-muted'}`}>{String(index + 1).padStart(2, '0')}</span><span className="min-w-0 flex-1"><span className="block text-[13px] font-medium leading-5 text-ink">{question.title}</span><span className="mt-1 block text-[11px] text-muted">{question.category} <span className="px-1">·</span> {question.difficulty}</span></span><ArrowRight size={14} className={`mt-1 shrink-0 ${selectedId === question.id ? 'text-purple' : 'text-transparent group-hover:text-muted'}`} /></button>)}</div>}
            </div>
          </aside>

          <section className="panel overflow-hidden" aria-labelledby="workspace-title">
            <div className="flex items-center justify-between gap-3 border-b border-carbon-700 px-5 py-4 sm:px-7"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-mint" /><span id="workspace-title" className="eyebrow text-ink">PRACTICE WORKSPACE</span></div><span className="mono text-[10px] text-muted">YOUR SPACE TO THINK</span></div>
            {selected ? <div className="p-5 sm:p-7 lg:p-8">
              <div className="flex flex-wrap items-center gap-2"><span className="tag border-purple/25 bg-purple/10 text-purple">{selected.category}</span><span className="tag border-carbon-700 text-muted">{selected.difficulty}</span></div>
              <h2 className="mt-6 text-2xl font-semibold leading-tight tracking-[-0.035em] sm:text-[30px]">{selected.title}</h2>
              <div className="mt-5 flex gap-3 rounded-lg border border-carbon-700 bg-carbon-950/50 p-4 sm:p-5"><span className="mt-0.5 text-purple"><MessageSquareText size={18} /></span><div><div className="eyebrow mb-2">THE PROMPT</div><p className="whitespace-pre-wrap text-sm leading-6 text-[#d5d8dc]">{selected.prompt}</p></div></div>
              <form onSubmit={saveAnswer} className="mt-8">
                <div className="mb-3 flex items-end justify-between gap-3"><div><label htmlFor="answer" className="text-sm font-semibold">Your answer</label><p className="mt-1 text-xs text-muted">Take your time. This is just for you.</p></div><span className="mono text-[10px] text-muted">{answer.trim() ? `${answer.trim().split(/\s+/).length} WORDS` : 'YOUR DRAFT'}</span></div>
                <textarea id="answer" value={answer} disabled={saving} onChange={event => { setDrafts(current => ({ ...current, [selected.id]: event.target.value })); setSavedId(''); setSaveError('') }} placeholder="Start writing your answer here..." className="field min-h-[220px] w-full resize-y p-4 text-sm leading-6 placeholder:text-[#72767b] disabled:opacity-60" />
                <div className="mt-4 flex flex-wrap items-center justify-between gap-4"><p className="flex items-center gap-2 text-xs text-muted"><FileText size={14} /> Your answer is saved when you submit.</p><Button disabled={!answer.trim() || saving} type="submit">{saving ? <><LoaderCircle size={15} className="animate-spin" /> Saving...</> : <>Save answer <ArrowRight size={15} /></>}</Button></div>
                {saveError && <p role="alert" className="mt-4 text-sm text-[#ff8389]">{saveError}</p>}
                {savedId === selected.id && <p role="status" className="mt-4 flex items-center gap-2 text-sm text-mint"><Check size={16} /> Answer saved to your history.</p>}
              </form>
            </div> : <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center"><span className="icon-box mb-4"><MessageSquareText size={20} /></span><h2 className="font-semibold">Your practice starts here</h2><p className="mt-2 max-w-xs text-sm leading-6 text-muted">{questionsLoading ? 'Loading your questions...' : 'Choose a question from the library to start writing.'}</p></div>}
          </section>

          <aside className="panel overflow-hidden lg:col-span-2 xl:col-span-1" aria-labelledby="history-title">
            <div className="border-b border-carbon-700 p-5"><div className="flex items-start justify-between"><div><div className="eyebrow text-purple">KEEP SHOWING UP</div><h2 id="history-title" className="mt-2 text-lg font-semibold tracking-tight">Recent practice</h2><p className="mt-1 text-xs leading-5 text-muted">Every answer is progress.</p></div><span className="icon-box"><Clock3 size={17} /></span></div></div>
            <div className="p-4">{sessionsLoading ? <Loading label="Loading history..." /> : sessionsError ? <ErrorState message={sessionsError} retry={() => setReloadSessions(n => n + 1)} /> : recentSessions.length === 0 ? <div className="px-2 py-6 text-center"><div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-carbon-800 text-muted"><Clock3 size={18} /></div><p className="text-sm font-medium">A fresh start</p><p className="mt-2 text-xs leading-5 text-muted">Your saved answers will show up here. Ready when you are.</p></div> : <div className="space-y-1">{recentSessions.map(session => <div key={session.id} className="rounded-md border border-transparent hover:border-carbon-700"><button type="button" onClick={() => setExpandedSession(current => current === session.id ? '' : session.id)} aria-expanded={expandedSession === session.id} className="flex w-full gap-3 rounded-md p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple"><span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-cyan/10 text-cyan"><FileText size={15} /></span><span className="min-w-0 flex-1"><span className="block text-xs font-medium leading-5">{session.questionTitle}</span><span className="mt-1 block text-[11px] text-muted">{session.category} · {formatDate(session.createdAt)}</span></span><ChevronDown size={14} className={`mt-1 shrink-0 text-muted transition-transform ${expandedSession === session.id ? 'rotate-180' : ''}`} /></button>{expandedSession === session.id && <p className="whitespace-pre-wrap break-words border-t border-carbon-700 px-3 py-3 text-xs leading-5 text-muted">{session.answer}</p>}</div>)}</div>}</div>
            <div className="m-4 mt-0 rounded-lg border border-purple/15 bg-purple/[0.06] p-4"><div className="flex items-center gap-2 text-xs font-semibold text-purple"><Sparkles size={14} /> A little reminder</div><p className="mt-2 text-xs leading-5 text-muted">Great answers aren't memorized. They're practiced.</p><ArrowDownRight size={16} className="ml-auto mt-2 text-purple" /></div>
          </aside>
        </div>
        <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted"><span>MADE FOR THE MOMENTS THAT MATTER.</span><span>Keep practicing. You've got this.</span></footer>
      </main>
    </div>
  )
}

function Loading({ label }: { label: string }) { return <p role="status" className="flex items-center gap-2 px-2 py-5 text-xs text-muted"><LoaderCircle size={15} className="animate-spin" />{label}</p> }
function ErrorState({ message, retry }: { message: string; retry: () => void }) { return <div role="alert" className="px-2 py-4"><p className="text-xs leading-5 text-[#ff8389]">{message}</p><button type="button" onClick={retry} className="mt-3 flex items-center gap-1.5 rounded text-xs font-medium text-purple hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple"><RefreshCw size={13} /> Try again</button></div> }

export default App
