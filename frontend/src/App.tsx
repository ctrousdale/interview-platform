import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Route, Routes, useMatch, useNavigate } from 'react-router-dom'
import { ArrowRight, BookOpen, Check, ChevronDown, Clock3, Code2, FileText, List, LoaderCircle, RefreshCw } from 'lucide-react'
import { Button } from './components/ui/button'
import { AnswerEditor } from './components/AnswerEditor'
import { LearningsPage } from './components/LearningsPage'

type Question = { id: string; category: string; difficulty: string; title: string; prompt: string; coding: boolean; complete: boolean; starterCode?: string; testInstructions?: string }
type Session = { id: string; questionId: string; questionTitle: string; category: string; answer: string; createdAt: string }
type TestResult = { passed: boolean; total: number; failedTestIds: string[]; error?: string }
type Submission = TestResult & { code: string; createdAt: string }

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options)
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string; message?: string } | null
    throw new Error(body?.error || body?.message || `Request failed (${response.status}). Please try again.`)
  }
  return response.json() as Promise<T>
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

function App() {
  const navigate = useNavigate()
  const problemMatch = useMatch('/problems/:problemId')
  const selectedId = problemMatch?.params.problemId ?? ''
  const [questions, setQuestions] = useState<Question[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [questionsLoading, setQuestionsLoading] = useState(true)
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [questionsError, setQuestionsError] = useState('')
  const [sessionsError, setSessionsError] = useState('')
  const [reloadQuestions, setReloadQuestions] = useState(0)
  const [reloadSessions, setReloadSessions] = useState(0)
  const [category, setCategory] = useState('All topics')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<{ questionId: string; message: string } | null>(null)
  const [savedId, setSavedId] = useState('')
  const [expandedSession, setExpandedSession] = useState('')
  const [testing, setTesting] = useState<Record<string, 'run' | 'submit' | undefined>>({})
  const [testResults, setTestResults] = useState<Record<string, { code: string; result?: TestResult; error?: string; action: 'run' | 'submit' }>>({})
  const [submissions, setSubmissions] = useState<{ questionId: string; items: Submission[]; error: string; loading: boolean }>({ questionId: '', items: [], error: '', loading: false })
  const [reloadSubmissions, setReloadSubmissions] = useState(0)
  const [expandedSubmission, setExpandedSubmission] = useState(-1)
  const problemLayoutRef = useRef<HTMLElement>(null)
  const [descriptionWidth, setDescriptionWidth] = useState(50)
  const descriptionWidthRef = useRef(50)
  const resizedRef = useRef(false)
  const preferenceSaveRef = useRef<Promise<void>>(Promise.resolve())
  const [preferenceError, setPreferenceError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    request<{ descriptionWidth: number }>('/api/preferences', { signal: controller.signal })
      .then(preferences => {
        if (!resizedRef.current) {
          descriptionWidthRef.current = preferences.descriptionWidth
          setDescriptionWidth(preferences.descriptionWidth)
        }
      })
      .catch(() => { if (!controller.signal.aborted && !resizedRef.current) setPreferenceError('Could not load panel width preference.') })
    return () => controller.abort()
  }, [])

  function updateDescriptionWidth(width: number) {
    const next = Math.max(20, Math.min(80, width))
    resizedRef.current = true
    descriptionWidthRef.current = next
    setDescriptionWidth(next)
  }

  function saveDescriptionWidth() {
    const width = descriptionWidthRef.current
    preferenceSaveRef.current = preferenceSaveRef.current.then(async () => {
      try {
        await request('/api/preferences', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ descriptionWidth: width }),
        })
        setPreferenceError('')
      } catch {
        setPreferenceError('Could not save panel width preference. Adjust the separator to try again.')
      }
    })
  }

  useEffect(() => {
    const controller = new AbortController()
    setQuestionsLoading(true)
    setQuestionsError('')
    request<Question[]>('/api/questions', { signal: controller.signal })
      .then(setQuestions)
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
  const selected = questions.find(q => q.id === selectedId)
  const activeCategory = selected && category !== 'All topics' && selected.category !== category ? 'All topics' : category
  const filtered = activeCategory === 'All topics' ? questions : questions.filter(q => q.category === activeCategory)
  const answer = drafts[selectedId] ?? (selected?.coding ? selected.starterCode ?? '' : '')
  const recentSessions = useMemo(() => [...sessions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [sessions])
  const testResult = testResults[selectedId]?.code === answer ? testResults[selectedId] : undefined

  useEffect(() => {
    if (!selected?.coding) return
    const controller = new AbortController()
    const questionId = selected.id
    setSubmissions({ questionId, items: [], error: '', loading: true })
    setExpandedSubmission(-1)
    request<Submission[]>(`/api/questions/${encodeURIComponent(questionId)}/submissions`, { signal: controller.signal })
      .then(items => { if (!controller.signal.aborted) setSubmissions({ questionId, items, error: '', loading: false }) })
      .catch(error => { if (!controller.signal.aborted) setSubmissions({ questionId, items: [], error: error instanceof Error ? error.message : 'Could not load submissions.', loading: false }) })
    return () => controller.abort()
  }, [selected?.id, selected?.coding, reloadSubmissions])

  async function testCode(action: 'run' | 'submit') {
    if (!selected?.coding || !answer.trim() || testing[selected.id]) return
    const questionId = selected.id
    const code = answer
    setTesting(current => ({ ...current, [questionId]: action }))
    setTestResults(current => {
      const next = { ...current }
      delete next[questionId]
      return next
    })
    try {
      const result = await request<TestResult>(`/api/questions/${encodeURIComponent(questionId)}/${action}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }),
      })
      setTestResults(current => ({ ...current, [questionId]: { code, result, action } }))
      if (action === 'submit') {
        setReloadQuestions(n => n + 1)
        setReloadSubmissions(n => n + 1)
      }
    } catch (error) {
      setTestResults(current => ({ ...current, [questionId]: { code, action, error: error instanceof Error ? error.message : 'Could not execute your code.' } }))
    } finally {
      setTesting(current => ({ ...current, [questionId]: undefined }))
    }
  }

  function chooseQuestion(id: string) {
    if (saving) return
    navigate(`/problems/${encodeURIComponent(id)}`)
    setSaveError(null)
    setSavedId('')
  }

  async function saveAnswer(event: React.FormEvent) {
    event.preventDefault()
    if (!selected || !answer.trim() || saving) return
    const questionId = selected.id
    setSaving(true)
    setSaveError(null)
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
      setSaveError({ questionId, message: error instanceof Error ? error.message : 'Could not save your answer.' })
    } finally { setSaving(false) }
  }

  return (
    <div className="min-h-screen bg-carbon-950 text-ink">
      <header className="flex min-h-14 flex-wrap items-center gap-x-5 gap-y-2 border-b border-carbon-700 bg-carbon-900 px-4 py-2">
        <Link to="/" className="flex items-center gap-2 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple" aria-label="Practice Studio home">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-purple text-carbon-950"><Code2 size={18} strokeWidth={2.4} /></span>
          <span className="hidden text-sm font-semibold sm:inline">practice<span className="text-purple">.</span>studio</span>
        </Link>
        {problemMatch && <><span className="hidden h-6 w-px bg-carbon-700 sm:block" />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <List size={16} className="shrink-0 text-muted" />
          <label htmlFor="category" className="sr-only">Filter by topic</label>
          <select id="category" value={activeCategory} disabled={saving} onChange={event => {
            const next = event.target.value
            setCategory(next)
            const matching = next === 'All topics' ? questions : questions.filter(q => q.category === next)
            if (!matching.some(q => q.id === selectedId) && matching[0]) chooseQuestion(matching[0].id)
          }} className="field max-w-[140px] px-2 py-1.5 text-xs">
            {categories.map(item => <option key={item}>{item}</option>)}
          </select>
          <label htmlFor="question" className="sr-only">Choose a question</label>
          <select id="question" value={selectedId} disabled={saving || questionsLoading || !filtered.length} onChange={event => chooseQuestion(event.target.value)} className="field min-w-0 max-w-[260px] flex-1 px-2 py-1.5 text-xs">
            {!selected && <option value={selectedId}>{questionsLoading ? 'Loading questions...' : 'Problem not found'}</option>}
            {filtered.map(question => <option key={question.id} value={question.id}>{question.title}</option>)}
          </select>
        </div></>}
        <nav aria-label="Main navigation" className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted md:ml-auto">
          <Link to="/ai-interviews" className="rounded hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple">AI interviews</Link>
          <Link to="/algorithms" className="rounded hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple">Algorithms</Link>
          <Link to="/design-patterns" className="rounded hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple">Design patterns</Link>
          <Link to="/learnings" className="rounded hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple">Learnings</Link>
          <Link to="/problems" className="rounded hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple">All problems</Link>
        </nav>
      </header>

      <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/algorithms" element={<CatalogPage key="algorithms" title="Algorithms" description="Practice coding problems inspired by reported Google SWE interviews, including follow-ups." questionCategory="Algorithms" questions={questions} loading={questionsLoading} error={questionsError} retry={() => setReloadQuestions(n => n + 1)} />} />
      <Route path="/design-patterns" element={<CatalogPage key="design-patterns" title="Design patterns" description="Practice software design patterns and their applications." questionCategory="Design Patterns" questions={questions} loading={questionsLoading} error={questionsError} retry={() => setReloadQuestions(n => n + 1)} />} />
      <Route path="/problems" element={<CatalogPage key="all" title="All problems" description="Practice for Google SWE III and senior interviews, alongside general interview questions." questions={questions} loading={questionsLoading} error={questionsError} retry={() => setReloadQuestions(n => n + 1)} />} />
      <Route path="/ai-interviews" element={<main className="mx-auto max-w-5xl px-4 py-10 sm:px-8 sm:py-14"><p className="text-xs font-semibold uppercase tracking-widest text-purple">Work in progress</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">AI interviews</h1><p className="mt-3 text-sm text-muted">AI interviews are a work in progress and are not yet available.</p></main>} />
      <Route path="/learnings" element={<LearningsPage />} />
      <Route path="/problems/:problemId" element={
      <main id="top" ref={problemLayoutRef} style={{ '--description-width': descriptionWidth } as React.CSSProperties} className="grid gap-2 p-2 lg:min-h-[calc(100vh-56px)] lg:grid-cols-[minmax(0,calc((100%_-_8px)*var(--description-width)/100))_8px_minmax(0,1fr)] lg:gap-0">
        <section id="problem-description" className="min-w-0 overflow-hidden rounded-lg bg-carbon-900" aria-labelledby="description-title">
          <div className="flex h-11 items-center gap-2 border-b border-carbon-700 bg-carbon-800 px-4 text-sm font-medium">
            <BookOpen size={16} className="text-purple" /><span id="description-title">Description</span>
          </div>
          {questionsLoading ? <div className="p-4"><Loading label="Loading questions..." /></div> : questionsError ? <div className="p-4"><ErrorState message={questionsError} retry={() => setReloadQuestions(n => n + 1)} /></div> : selected ? <div className="p-5 sm:p-7">
            <h1 className="text-xl font-semibold tracking-tight">{selected.title}</h1>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-purple/10 px-3 py-1 text-xs font-medium text-purple">{selected.difficulty}</span>
              <span className="rounded-full bg-carbon-800 px-3 py-1 text-xs text-muted">{selected.category}</span>
              {selected.coding && selected.complete && <span className="rounded-full bg-mint/10 px-3 py-1 text-xs font-medium text-mint">Complete</span>}
            </div>
            <p className="mt-7 whitespace-pre-wrap text-sm leading-7 text-ink">{selected.prompt}</p>
            {selected.coding && selected.testInstructions && <div className="mt-6"><h2 className="text-sm font-semibold">Test instructions</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-ink">{selected.testInstructions}</p></div>}
          </div> : <div className="p-6"><h1 className="text-lg font-semibold">Problem not found</h1><p className="mt-2 text-sm text-muted">This problem does not exist.</p><Link to="/problems" className="mt-4 inline-block text-sm text-purple hover:underline">Browse problems</Link></div>}

          <div className="border-t border-carbon-700">
            <div className="flex items-center gap-2 px-5 py-4 text-sm font-medium"><Clock3 size={16} className="text-purple" /> Recent practice</div>
            <div className="px-5 pb-5">
              {sessionsLoading ? <Loading label="Loading history..." /> : sessionsError ? <ErrorState message={sessionsError} retry={() => setReloadSessions(n => n + 1)} /> : recentSessions.length === 0 ? <p className="text-xs text-muted">Saved answers will appear here.</p> : <div className="space-y-1">{recentSessions.map(session => <div key={session.id} className="rounded-md bg-carbon-800">
                <button type="button" onClick={() => setExpandedSession(current => current === session.id ? '' : session.id)} aria-expanded={expandedSession === session.id} className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple">
                  <FileText size={15} className="shrink-0 text-muted" /><span className="min-w-0 flex-1"><span className="block text-xs font-medium">{session.questionTitle}</span><span className="mt-1 block text-[11px] text-muted">{session.category} · {formatDate(session.createdAt)}</span></span><ChevronDown size={14} className={`shrink-0 text-muted transition-transform ${expandedSession === session.id ? 'rotate-180' : ''}`} />
                </button>
                {expandedSession === session.id && <p className="whitespace-pre-wrap break-words border-t border-carbon-700 px-3 py-3 text-xs leading-5 text-muted">{session.answer}</p>}
              </div>)}</div>}
            </div>
          </div>
        </section>

        <div
          role="separator"
          aria-label="Resize description and answer panels"
          aria-orientation="vertical"
          aria-controls="problem-description"
          aria-valuemin={20}
          aria-valuemax={80}
          aria-valuenow={Math.round(descriptionWidth)}
          tabIndex={0}
          className="hidden cursor-col-resize touch-none items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple lg:flex"
          onPointerDown={event => {
            if (event.button !== 0) return
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerMove={event => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
            const bounds = problemLayoutRef.current?.getBoundingClientRect()
            if (bounds) updateDescriptionWidth((event.clientX - bounds.left - 12) / (bounds.width - 24) * 100)
          }}
          onPointerUp={event => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) saveDescriptionWidth()
          }}
          onPointerCancel={event => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) saveDescriptionWidth()
          }}
          onKeyDown={event => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
            event.preventDefault()
            updateDescriptionWidth(descriptionWidthRef.current + (event.key === 'ArrowLeft' ? -2 : 2))
            saveDescriptionWidth()
          }}
        >
          <span className="h-10 w-0.5 rounded-full bg-carbon-700" />
        </div>

        <section className="flex min-w-0 flex-col overflow-hidden rounded-lg bg-carbon-900" aria-labelledby="workspace-title">
          {preferenceError && <p role="alert" className="px-4 pt-3 text-xs text-[#ff8389]">{preferenceError}</p>}
          <div className="flex h-11 items-center gap-2 border-b border-carbon-700 bg-carbon-800 px-4 text-sm font-medium">
            <Code2 size={16} className="text-mint" /><span id="workspace-title">Your answer</span>
          </div>
          {selected ? <form onSubmit={event => { if (selected.coding) { event.preventDefault(); void testCode('submit') } else void saveAnswer(event) }} className="flex flex-1 flex-col p-4">
            <AnswerEditor key={`${selected.id}-${selected.coding}`} coding={selected.coding} value={answer} disabled={saving || !!testing[selected.id]} onChange={value => { setDrafts(current => ({ ...current, [selected.id]: value })); setSavedId(''); setSaveError(null) }} />
            <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-carbon-700 pt-4">
              {selected.coding ? <>
                <span className="text-xs text-muted">Run tests without saving, or submit to record your attempt.</span>
                <div className="flex gap-2">
                  <Button type="button" disabled={!answer.trim() || !!testing[selected.id]} onClick={() => void testCode('run')}>{testing[selected.id] === 'run' ? 'Running...' : 'Run'}</Button>
                  <Button type="submit" disabled={!answer.trim() || !!testing[selected.id]}>{testing[selected.id] === 'submit' ? 'Submitting...' : 'Submit'}</Button>
                </div>
              </> : <>
                <span className="text-xs text-muted">Saved when you submit</span>
                <Button disabled={!answer.trim() || saving} type="submit">{saving ? <><LoaderCircle size={15} className="animate-spin" /> Saving...</> : <>Save answer <ArrowRight size={15} /></>}</Button>
              </>}
            </div>
            {selected.coding && testResult && <div role={testResult.error || testResult.result?.error ? 'alert' : 'status'} className="mt-3 text-sm">
              {testResult.error ? <p className="text-[#ff8389]">{testResult.error}</p> : testResult.result && <>
                <p className={testResult.result.passed ? 'text-mint' : 'text-[#ff8389]'}>{testResult.action === 'submit' ? 'Submission' : 'Run'}: {testResult.result.passed ? 'Passed' : 'Failed'} ({testResult.result.total - testResult.result.failedTestIds.length}/{testResult.result.total} tests passed)</p>
                {testResult.result.error && <p className="mt-2 whitespace-pre-wrap text-[#ff8389]">{testResult.result.error}</p>}
                {testResult.result.failedTestIds.length > 0 && <p className="mt-2 break-words text-xs text-muted">Failed test IDs: {testResult.result.failedTestIds.join(', ')}</p>}
              </>}
            </div>}
            {!selected.coding && saveError?.questionId === selected.id && <p role="alert" className="mt-3 text-sm text-[#ff8389]">{saveError.message}</p>}
            {!selected.coding && savedId === selected.id && <p role="status" className="mt-3 flex items-center gap-2 text-sm text-mint"><Check size={16} /> Answer saved to your history.</p>}
            {selected.coding && <div className="mt-6 border-t border-carbon-700 pt-4">
              <h2 className="text-sm font-medium">Submission history</h2>
              {submissions.questionId !== selected.id || submissions.loading ? <Loading label="Loading submissions..." /> : submissions.error ? <ErrorState message={submissions.error} retry={() => setReloadSubmissions(n => n + 1)} /> : submissions.items.length === 0 ? <p className="mt-3 text-xs text-muted">No submissions yet.</p> : <div className="mt-3 space-y-1">{submissions.items.map((submission, index) => <div key={`${submission.createdAt}-${index}`} className="rounded-md bg-carbon-800">
                <button type="button" onClick={() => setExpandedSubmission(current => current === index ? -1 : index)} aria-expanded={expandedSubmission === index} className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple">
                  <span>{submission.passed ? 'Passed' : 'Failed'} · {formatDate(submission.createdAt)} · {submission.total - submission.failedTestIds.length}/{submission.total} tests passed</span><ChevronDown size={14} />
                </button>
                {expandedSubmission === index && <div className="border-t border-carbon-700 px-3 py-3 text-xs text-muted">
                  {submission.failedTestIds.length > 0 && <p className="mb-2 break-words">Failed test IDs: {submission.failedTestIds.join(', ')}</p>}
                  {submission.error && <p className="mb-2 whitespace-pre-wrap">{submission.error}</p>}
                  <pre className="overflow-auto whitespace-pre-wrap break-words">{submission.code}</pre>
                </div>}
              </div>)}</div>}
            </div>}
          </form> : <p className="p-6 text-sm text-muted">Choose a question to write an answer.</p>}
        </section>
      </main>
      } />
      <Route path="*" element={<main className="mx-auto max-w-5xl p-8"><h1 className="text-xl font-semibold">Page not found</h1><Link to="/" className="mt-4 inline-block text-sm text-purple hover:underline">Go to home</Link></main>} />
      </Routes>
    </div>
  )
}

function HomePage() {
  const sections = [
    { to: '/ai-interviews', title: 'AI interviews', description: 'Interview practice with AI, currently a work in progress.', label: 'Work in progress' },
    { to: '/algorithms', title: 'Algorithms', description: 'Practice Google-inspired coding problems and follow-ups.', label: 'Practice' },
    { to: '/design-patterns', title: 'Design patterns', description: 'Explore software design patterns through practice questions.', label: 'Practice' },
    { to: '/learnings', title: 'Learnings', description: 'Explore resources for your interview preparation.', label: 'Learn' },
  ]

  return <main className="mx-auto max-w-5xl px-4 py-10 sm:px-8 sm:py-14">
    <p className="text-xs font-semibold uppercase tracking-widest text-purple">Practice studio</p>
    <h1 className="mt-3 text-3xl font-semibold tracking-tight">Prepare for Google SWE interviews</h1>
    <p className="mt-2 text-sm text-muted">Practice coding, design, and behavioral questions for SWE III and senior roles.</p>
    <div className="mt-8 grid gap-4 sm:grid-cols-2">
      {sections.map(section => <Link key={section.to} to={section.to} className="group flex min-h-44 flex-col rounded-lg border border-carbon-700 bg-carbon-900 p-5 transition-colors hover:bg-carbon-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple">
        <span className="text-xs font-medium text-purple">{section.label}</span>
        <span className="mt-3 text-lg font-semibold">{section.title}</span>
        <span className="mt-2 text-sm leading-6 text-muted">{section.description}</span>
        <ArrowRight size={18} className="mt-auto self-end text-muted group-hover:text-purple" />
      </Link>)}
    </div>
    <Link to="/problems" className="mt-8 inline-flex items-center gap-2 rounded text-sm text-purple hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple">Browse all problems <ArrowRight size={15} /></Link>
  </main>
}

function CatalogPage({ title, description, questionCategory, questions, loading, error, retry }: { title: string; description: string; questionCategory?: string; questions: Question[]; loading: boolean; error: string; retry: () => void }) {
  const [topic, setTopic] = useState('All topics')
  const topics = ['All topics', ...Array.from(new Set(questions.map(question => question.category)))]
  const visibleQuestions = questions.filter(question => questionCategory ? question.category === questionCategory : topic === 'All topics' || question.category === topic)

  return <main className="mx-auto max-w-5xl px-4 py-10 sm:px-8 sm:py-14">
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-purple">Practice library</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted">{description}</p>
      </div>
      {!questionCategory && <label className="flex items-center gap-2 text-xs text-muted">Topic
        <select value={topic} onChange={event => setTopic(event.target.value)} className="field px-3 py-2 text-xs">
          {topics.map(item => <option key={item}>{item}</option>)}
        </select>
      </label>}
    </div>
    <section aria-label="Problems" className="overflow-hidden rounded-lg border border-carbon-700 bg-carbon-900">
      <div className="flex items-center justify-between border-b border-carbon-700 bg-carbon-800 px-5 py-3 text-xs font-medium text-muted">
        <span>Problems</span><span>{visibleQuestions.length} available</span>
      </div>
      {loading ? <div className="p-4"><Loading label="Loading questions..." /></div> : error ? <div className="p-4"><ErrorState message={error} retry={retry} /></div> : visibleQuestions.length === 0 ? <p className="p-5 text-sm text-muted">No problems available for this topic.</p> : <ul className="divide-y divide-carbon-700">
        {visibleQuestions.map(question => <li key={question.id}>
          <Link to={`/problems/${encodeURIComponent(question.id)}`} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-carbon-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-purple">
            <span className="flex min-w-0 flex-1 flex-col gap-1"><span className="text-sm font-medium">{question.title}</span><span className="text-xs text-muted">{question.category}</span></span>
            <span className="rounded-full bg-purple/10 px-3 py-1 text-xs text-purple">{question.difficulty}</span>
            <ArrowRight size={16} className="shrink-0 text-muted group-hover:text-purple" />
          </Link>
        </li>)}
      </ul>}
    </section>
  </main>
}

function Loading({ label }: { label: string }) { return <p role="status" className="flex items-center gap-2 px-2 py-5 text-xs text-muted"><LoaderCircle size={15} className="animate-spin" />{label}</p> }
function ErrorState({ message, retry }: { message: string; retry: () => void }) { return <div role="alert" className="px-2 py-4"><p className="text-xs leading-5 text-[#ff8389]">{message}</p><button type="button" onClick={retry} className="mt-3 flex items-center gap-1.5 rounded text-xs font-medium text-purple hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple"><RefreshCw size={13} /> Try again</button></div> }

export default App
