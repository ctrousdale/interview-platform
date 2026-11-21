import { useEffect, useRef, useState } from 'react'
import { basicSetup } from 'codemirror'
import { autocompletion, type CompletionContext } from '@codemirror/autocomplete'
import { indentWithTab } from '@codemirror/commands'
import { indentUnit } from '@codemirror/language'
import { python } from '@codemirror/lang-python'
import { setDiagnostics, type Diagnostic } from '@codemirror/lint'
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView, keymap, placeholder } from '@codemirror/view'
import { vim } from '@replit/codemirror-vim'

type Position = { line: number; character: number }
type ServerDiagnostic = { range: { start: Position; end: Position }; severity?: number; message: string; source?: string }
type CompletionItem = { label: string; insertText?: string; detail?: string }

async function post<T>(path: string, body: object, signal: AbortSignal): Promise<T> {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal })
  if (!response.ok) throw new Error(`Request failed (${response.status}).`)
  return response.json() as Promise<T>
}

function offset(state: EditorState, position: Position) {
  const line = state.doc.line(Math.max(1, Math.min(state.doc.lines, position.line + 1)))
  return Math.max(line.from, Math.min(line.to, line.from + position.character))
}

const theme = EditorView.theme({
  '&': { backgroundColor: '#161616', color: '#f2f4f8', fontSize: '14px' },
  '.cm-scroller': { minHeight: 'clamp(280px, 55vh, 560px)', maxHeight: '65vh', overflow: 'auto', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', lineHeight: '1.6' },
  '.cm-content': { padding: '12px 0' },
  '.cm-gutters': { backgroundColor: '#161616', color: '#72767b', borderRight: '1px solid #393939' },
  '&.cm-focused': { outline: '2px solid #be95ff', outlineOffset: '2px' },
  '.cm-activeLine': { backgroundColor: '#252525' },
  '.cm-activeLineGutter': { backgroundColor: '#252525' },
  '.cm-tooltip': { backgroundColor: '#262626', color: '#f2f4f8', borderColor: '#525252' },
  '.cm-tooltip-autocomplete ul li[aria-selected]': { backgroundColor: '#5e3c88', color: '#fff' },
}, { dark: true })

export function AnswerEditor({ value, onChange, disabled, coding = false }: { value: string; onChange: (value: string) => void; disabled: boolean; coding?: boolean }) {
  const [mode, setMode] = useState<'text' | 'python'>(coding ? 'python' : 'text')
  const [vimEnabled, setVimEnabled] = useState(() => {
    try { return localStorage.getItem('answer-editor-vim') === 'true' } catch { return false }
  })
  const [formatter, setFormatter] = useState(false)
  const [lsp, setLsp] = useState(false)
  const [formatStatus, setFormatStatus] = useState('')
  const [lspStatus, setLspStatus] = useState('')
  const container = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const syncingValue = useRef(false)
  onChangeRef.current = onChange
  const language = useRef(new Compartment()).current
  const editable = useRef(new Compartment()).current
  const completion = useRef(new Compartment()).current
  const vimKeys = useRef(new Compartment()).current
  const formatRequest = useRef<AbortController | null>(null)
  const diagnosticsRequest = useRef<AbortController | null>(null)
  const completionRequest = useRef<AbortController | null>(null)

  useEffect(() => {
    const editor = new EditorView({
      parent: container.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          vimKeys.of([]), basicSetup, theme, placeholder('Start writing your answer here...'),
          keymap.of([indentWithTab]), indentUnit.of('    '),
          EditorView.domEventHandlers({
            mousedown(event, editor) {
              if (event.button !== 0 || event.detail !== 1 || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return false
              const content = editor.contentDOM.getBoundingClientRect()
              const end = editor.coordsAtPos(editor.state.doc.length)
              if (!end || event.clientY <= end.bottom || event.clientX < content.left || event.clientX > content.right) return false
              event.preventDefault()
              editor.dispatch({ selection: { anchor: editor.state.doc.length } })
              editor.focus()
              return true
            },
          }),
          EditorView.contentAttributes.of({ 'aria-label': 'Your answer', 'aria-multiline': 'true' }),
          language.of([]), editable.of([]), completion.of([]),
          EditorView.updateListener.of(update => {
            if (!update.docChanged) return
            formatRequest.current?.abort()
            diagnosticsRequest.current?.abort()
            completionRequest.current?.abort()
            setFormatStatus('')
            if (!syncingValue.current) onChangeRef.current(update.state.doc.toString())
          }),
        ],
      }),
    })
    view.current = editor
    return () => {
      formatRequest.current?.abort()
      diagnosticsRequest.current?.abort()
      completionRequest.current?.abort()
      editor.destroy()
      view.current = null
    }
    // A question's editor is mounted once; subsequent changes use compartments.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const editor = view.current
    if (editor && editor.state.doc.toString() !== value) {
      syncingValue.current = true
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } })
      syncingValue.current = false
    }
  }, [value])

  useEffect(() => {
    view.current?.dispatch({ effects: vimKeys.reconfigure(vimEnabled ? vim() : []) })
  }, [vimEnabled, vimKeys])

  useEffect(() => {
    if (disabled) {
      formatRequest.current?.abort()
      setFormatStatus('')
    }
    view.current?.dispatch({ effects: [
      language.reconfigure(mode === 'python' ? python() : []),
      editable.reconfigure([EditorState.readOnly.of(disabled), EditorView.editable.of(!disabled)]),
    ] })
  }, [mode, disabled, language, editable])

  useEffect(() => {
    const editor = view.current
    if (!editor) return
    completionRequest.current?.abort()
    if (mode !== 'python' || !lsp || disabled) {
      editor.dispatch({ effects: completion.reconfigure([]) })
      return
    }
    const source = async (context: CompletionContext) => {
      completionRequest.current?.abort()
      const controller = new AbortController()
      completionRequest.current = controller
      context.addEventListener('abort', () => controller.abort())
      const line = context.state.doc.lineAt(context.pos)
      try {
        const result = await post<{ items: CompletionItem[] }>('/python/completion', {
          code: context.state.doc.toString(), line: line.number - 1, character: context.pos - line.from,
        }, controller.signal)
        if (controller.signal.aborted) return null
        const word = context.matchBefore(/[\w]+/)
        return { from: word?.from ?? context.pos, options: result.items.map(item => ({ label: item.label, apply: item.insertText, detail: item.detail })) }
      } catch (error) {
        if (!controller.signal.aborted) setLspStatus(`Completion error: ${error instanceof Error ? error.message : 'Request failed.'}`)
        return null
      }
    }
    editor.dispatch({ effects: completion.reconfigure(autocompletion({ override: [source] })) })
    return () => { completionRequest.current?.abort() }
  }, [mode, lsp, disabled, completion])

  useEffect(() => {
    const editor = view.current
    diagnosticsRequest.current?.abort()
    if (!editor) return
    editor.dispatch(setDiagnostics(editor.state, []))
    if (mode !== 'python' || !lsp || disabled) {
      setLspStatus('')
      return
    }
    const controller = new AbortController()
    diagnosticsRequest.current = controller
    setLspStatus('Checking Python diagnostics...')
    const timer = window.setTimeout(async () => {
      try {
        const result = await post<{ diagnostics: ServerDiagnostic[] }>('/python/diagnostics', { code: value }, controller.signal)
        if (controller.signal.aborted || editor.state.doc.toString() !== value) return
        const diagnostics: Diagnostic[] = result.diagnostics.map(item => {
          const from = offset(editor.state, item.range.start)
          return { from, to: Math.max(from, offset(editor.state, item.range.end)), severity: item.severity === 1 ? 'error' : item.severity === 2 ? 'warning' : 'info', message: item.message, source: item.source }
        })
        editor.dispatch(setDiagnostics(editor.state, diagnostics))
        setLspStatus(diagnostics.length ? `${diagnostics.length} diagnostic${diagnostics.length === 1 ? '' : 's'} found.` : 'No Python diagnostics.')
      } catch (error) {
        if (!controller.signal.aborted) setLspStatus(`Diagnostics error: ${error instanceof Error ? error.message : 'Request failed.'}`)
      }
    }, 400)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [value, mode, lsp, disabled])

  async function format() {
    if (!formatter || mode !== 'python' || disabled || !view.current) return
    formatRequest.current?.abort()
    const controller = new AbortController()
    formatRequest.current = controller
    const code = view.current.state.doc.toString()
    setFormatStatus('Formatting Python...')
    try {
      const result = await post<{ code: string }>('/python/format', { code }, controller.signal)
      const editor = view.current
      if (controller.signal.aborted || !editor || editor.state.doc.toString() !== code) return
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: result.code } })
      setFormatStatus('Python formatted.')
    } catch (error) {
      if (!controller.signal.aborted) setFormatStatus(`Formatter error: ${error instanceof Error ? error.message : 'Request failed.'}`)
    }
  }

  return <div>
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
      {coding ? <span>Python</span> : <label className="flex items-center gap-2">Answer mode <select value={mode} disabled={disabled} onChange={event => { formatRequest.current?.abort(); diagnosticsRequest.current?.abort(); completionRequest.current?.abort(); setFormatStatus(''); setMode(event.target.value as 'text' | 'python') }} className="field px-2 py-1"><option value="text">Plain text</option><option value="python">Python</option></select></label>}
      <label className="flex items-center gap-1.5"><input type="checkbox" checked={vimEnabled} disabled={disabled} onChange={event => {
        const enabled = event.target.checked
        setVimEnabled(enabled)
        try { localStorage.setItem('answer-editor-vim', String(enabled)) } catch { /* Keep the preference for this editor. */ }
      }} /> Vim mode</label>
      <label className="flex items-center gap-1.5"><input type="checkbox" checked={formatter} disabled={disabled} onChange={event => { formatRequest.current?.abort(); setFormatStatus(''); setFormatter(event.target.checked) }} /> Enable formatter</label>
      <label className="flex items-center gap-1.5"><input type="checkbox" checked={lsp} disabled={disabled} onChange={event => { diagnosticsRequest.current?.abort(); completionRequest.current?.abort(); setLsp(event.target.checked) }} /> Enable Python LSP</label>
      <button type="button" disabled={disabled || !formatter || mode !== 'python'} onClick={format} className="rounded border border-carbon-700 px-2 py-1 text-ink hover:bg-carbon-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple disabled:cursor-not-allowed disabled:opacity-50">Format Python</button>
    </div>
    <div ref={container} className={`overflow-hidden rounded-md border border-carbon-700 ${disabled ? 'opacity-60' : ''}`} />
    {formatStatus && <p role="status" className="mt-2 text-xs text-muted">{formatStatus}</p>}
    {lspStatus && <p role="status" className="mt-2 text-xs text-muted">{lspStatus}</p>}
  </div>
}
