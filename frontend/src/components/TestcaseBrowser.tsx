import { useEffect, useId, useRef, useState } from 'react'

export type CanonicalCase = { id: string; input: string; sample: boolean }
export type CustomCase = { id: string; input: string; expected: string | null }
export type CustomResult = CustomCase & { actual: string; passed: boolean | null; error: string | null }
export type CaseFailure = { id: string; input: string; expected: string; actual: string }
export type BrowserResult = { failedTestIds: string[]; failures: CaseFailure[] | null; error?: string; customResults?: CustomResult[] | null }

type Props = {
  cases: CanonicalCase[]
  template: { description: string; input: string }
  customCases: CustomCase[]
  onChange: (cases: CustomCase[]) => void
  result?: BrowserResult
  action?: 'run' | 'submit'
}

export function TestcaseBrowser({ cases, template, customCases, onChange, result, action }: Props) {
  const prefix = useId()
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [active, setActive] = useState('')
  const failures = result?.failures ?? []
  const extraFailures = failures.filter(failure => !cases.some(item => item.id === failure.id))
  const tabs = [
    ...cases.map((item, index) => ({ key: `canonical:${item.id}`, label: `${item.sample ? 'Sample' : 'Test'} ${index + 1}`, id: item.id, kind: 'canonical' as const })),
    ...extraFailures.map((item, index) => ({ key: `failure:${item.id}:${index}`, label: `Failed test ${index + 1}`, id: item.id, kind: 'failure' as const })),
    ...customCases.map((item, index) => ({ key: `custom:${item.id}`, label: `Custom ${index + 1}`, id: item.id, kind: 'custom' as const })),
  ]
  const current = tabs.find(tab => tab.key === active) ?? tabs[0]

  useEffect(() => {
    if (!result) return
    const failure = result.failures?.[0]
    let key: string | undefined
    if (failure) {
      const canonical = cases.find(item => item.id === failure.id)
      key = canonical ? `canonical:${canonical.id}` : `failure:${failure.id}:0`
    } else {
      const failedId = result.failedTestIds[0]
      if (failedId && cases.some(item => item.id === failedId)) key = `canonical:${failedId}`
      else {
        const customFailure = result.customResults?.find(item => item.passed === false)
        if (customFailure) key = `custom:${customFailure.id}`
      }
    }
    if (key) {
      setActive(key)
      const index = tabs.findIndex(tab => tab.key === key)
      if (index >= 0) tabRefs.current[index]?.focus()
    }
  }, [result, cases])
  function addCase(input = template.input) {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
    const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
    onChange([...customCases, { id, input, expected: null }])
    setActive(`custom:${id}`)
  }

  const custom = current?.kind === 'custom' ? customCases.find(item => item.id === current.id) : undefined
  const canonical = current?.kind === 'canonical' ? cases.find(item => item.id === current.id) : undefined
  const failure = current?.kind !== 'custom' ? failures.find(item => item.id === current?.id) : undefined
  const customResult = custom ? result?.customResults?.find(item => item.id === custom.id) : undefined
  const canonicalFailed = current && current.kind !== 'custom' && result?.failedTestIds.includes(current.id)
  const canonicalRan = canonical && result && !result.error && (action === 'submit' || canonical.sample)

  function updateCustom(patch: Partial<CustomCase>) {
    if (custom) onChange(customCases.map(item => item.id === custom.id ? { ...item, ...patch } : item))
  }

  return <section className="mt-5 border-t border-carbon-700 pt-4" aria-label="Test cases">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-medium">Test cases</h2>
      <button type="button" onClick={() => addCase()} disabled={customCases.length >= 10} className="rounded px-2 py-1 text-xs font-medium text-purple hover:underline disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple">+ Add custom case</button>
    </div>
    <p className="mt-2 text-xs leading-5 text-muted">{template.description} Enter custom input as a JSON object and optional expected output as JSON. Leave expected blank to inspect output without judging it.</p>
    {tabs.length > 0 ? <>
      <div role="tablist" aria-label="Test cases" className="mt-3 flex gap-1 overflow-x-auto border-b border-carbon-700" onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const index = tabs.findIndex(tab => tab.key === current?.key)
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
        setActive(tabs[next].key)
        tabRefs.current[next]?.focus()
      }}>
        {tabs.map((tab, index) => {
          const failed = tab.kind === 'custom' ? result?.customResults?.find(item => item.id === tab.id)?.passed === false : result?.failedTestIds.includes(tab.id) || failures.some(item => item.id === tab.id)
          return <button key={tab.key} ref={element => { tabRefs.current[index] = element }} type="button" role="tab" id={`${prefix}-tab-${index}`} aria-controls={`${prefix}-panel`} aria-selected={current?.key === tab.key} tabIndex={current?.key === tab.key ? 0 : -1} onClick={() => setActive(tab.key)} className={`shrink-0 rounded-t px-3 py-2 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple ${current?.key === tab.key ? 'border-b-2 border-purple text-ink' : 'text-muted hover:text-ink'}`}>{tab.label}{failed && <span className="ml-1 text-[#ff8389]"> · Failed</span>}</button>
        })}
      </div>
      <div role="tabpanel" id={`${prefix}-panel`} aria-labelledby={`${prefix}-tab-${tabs.findIndex(tab => tab.key === current?.key)}`} className="mt-3 space-y-3 text-xs">
        {custom ? <>
          <label className="block font-medium" htmlFor={`${prefix}-input`}>Input</label>
          <textarea id={`${prefix}-input`} value={custom.input} onChange={event => updateCustom({ input: event.target.value })} spellCheck={false} rows={3} className="field w-full font-mono text-xs" />
          <label className="block font-medium" htmlFor={`${prefix}-expected`}>Expected output (optional)</label>
          <textarea id={`${prefix}-expected`} value={custom.expected ?? ''} onChange={event => updateCustom({ expected: event.target.value === '' ? null : event.target.value })} spellCheck={false} rows={2} className="field w-full font-mono text-xs" />
          <button type="button" onClick={() => onChange(customCases.filter(item => item.id !== custom.id))} className="rounded text-[#ff8389] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple">Remove custom case</button>
          {customResult && <><p className={customResult.passed === false ? 'text-[#ff8389]' : customResult.passed === true ? 'text-mint' : 'text-muted'}>{customResult.passed === null ? 'Unjudged' : customResult.passed ? 'Passed' : 'Failed'}</p><Value label="Actual" value={customResult.actual} />{customResult.error && <Value label="Error" value={customResult.error} />}</>}
        </> : <>
          {canonical && <p className="text-muted">{canonical.sample ? 'Sample case' : 'Full-suite case'}{canonicalRan && !canonicalFailed ? ' · Passed' : ''}{canonicalFailed ? ' · Failed' : ''}</p>}
          <Value label="Input" value={formatObject(canonical?.input ?? failure?.input)} />
          {canonical && <button type="button" onClick={() => addCase(formatObject(canonical.input))} disabled={customCases.length >= 10} className="rounded text-purple hover:underline disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple">Try this input</button>}
          {failure && <><Value label="Expected" value={failure.expected} /><Value label="Actual" value={failure.actual} /></>}
          {canonicalFailed && !failure && <p className="text-muted">Diagnostic details are unavailable for this test.</p>}
        </>}
      </div>
    </> : <p className="mt-3 text-xs text-muted">No cases available. Add a custom case to try your own input.</p>}
  </section>
}

function formatObject(input: string | undefined) {
  if (!input) return 'Structured input unavailable for this test.'
  try {
    const parsed: unknown = JSON.parse(input)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return JSON.stringify(parsed, null, 2)
  } catch { /* Historical submissions may contain Python test code. */ }
  return 'Structured input unavailable for this test.'
}

function Value({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="font-medium">{label}</p><pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap break-all text-muted">{value}</pre></div>
}
