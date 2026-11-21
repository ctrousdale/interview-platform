const examples = {
  hashMap: `def two_sum(nums, target):
    seen = {}  # value -> index
    for i, value in enumerate(nums):
        complement = target - value
        if complement in seen:
            return seen[complement], i
        seen[value] = i
    return None

print(two_sum([2, 7, 11, 15], 9))  # (0, 1)`,
  binarySearch: `def binary_search(values, target):
    left, right = 0, len(values) - 1
    while left <= right:
        mid = (left + right) // 2
        if values[mid] == target:
            return mid
        if values[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1

print(binary_search([1, 3, 5, 7], 5))  # 2`,
  strategy: `def standard_shipping(weight):
    return 5 + weight * 2

def express_shipping(weight):
    return 10 + weight * 3

def shipping_cost(weight, pricing_strategy):
    return pricing_strategy(weight)

print(shipping_cost(2, standard_shipping))  # 9
print(shipping_cost(2, express_shipping))   # 16`,
  observer: `class Inventory:
    def __init__(self):
        self.listeners = []

    def subscribe(self, listener):
        self.listeners.append(listener)

    def restock(self, item):
        for listener in self.listeners:
            listener(item)

inventory = Inventory()
inventory.subscribe(lambda item: print(f"Restocked: {item}"))
inventory.restock("notebook")  # Restocked: notebook`,
  factory: `class JsonReport:
    def render(self):
        return '{"status": "ok"}'

class TextReport:
    def render(self):
        return "status: ok"

def make_report(format_name):
    if format_name == "json":
        return JsonReport()
    if format_name == "text":
        return TextReport()
    raise ValueError(f"Unsupported format: {format_name}")

print(make_report("text").render())  # status: ok`,
}

function CodeExample({ code }: { code: string }) {
  return (
    <pre className="mt-4 overflow-x-auto rounded-lg border border-carbon-700 bg-carbon-950 p-4 text-xs leading-6 text-ink"><code>{code}</code></pre>
  )
}

export function LearningsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8">
        <p className="eyebrow">LEARNING HUB</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Build your foundations</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">Practical notes on choosing algorithms and organizing code. Read a topic, run the Python examples locally, and adapt them to a problem of your own.</p>
      </header>

      <nav aria-label="Learning topics" className="panel mb-8 p-5">
        <h2 className="text-sm font-semibold text-ink">Explore topics</h2>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {[['complexity', 'Complexity'], ['approaches', 'Algorithm approaches'], ['strategy', 'Strategy'], ['observer', 'Observer'], ['factory', 'Factory']].map(([id, label]) => (
            <a key={id} href={`#${id}`} className="rounded-md border border-carbon-700 bg-carbon-800 px-3 py-2 text-ink transition-colors hover:border-purple hover:text-purple focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple">{label}</a>
          ))}
        </div>
      </nav>

      <div className="space-y-6 text-sm leading-6 text-muted">
        <section id="complexity" className="panel scroll-mt-6 p-5 sm:p-7">
          <p className="eyebrow">ALGORITHMS / 01</p>
          <h2 className="mt-2 text-xl font-semibold text-ink">Reason about complexity</h2>
          <p className="mt-3">Big O describes how a resource grows with input size, ignoring constant factors and lower-order terms. State what <code>n</code> represents, whether you mean worst-case or average-case time, and count extra space separately from the input.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-carbon-700 bg-carbon-800 p-4"><h3 className="font-semibold text-ink">Common growth rates</h3><p className="mt-2">O(1): fixed work; O(log n): repeatedly halve a search space; O(n): one pass; O(n log n): typical comparison sorting; O(n²): compare every pair.</p></div>
            <div className="rounded-lg border border-carbon-700 bg-carbon-800 p-4"><h3 className="font-semibold text-ink">Look beyond the label</h3><p className="mt-2">Nested loops are not always quadratic: count how often each pointer moves. Recursion also uses stack space. Input constraints, memory limits, and constants influence the practical choice.</p></div>
          </div>
        </section>

        <section id="approaches" className="panel scroll-mt-6 p-5 sm:p-7">
          <p className="eyebrow">ALGORITHMS / 02</p>
          <h2 className="mt-2 text-xl font-semibold text-ink">Choose an approach</h2>
          <p className="mt-3">Start with a correct simple solution, identify repeated work, then choose a data structure that removes it. Explain the invariant: what remains true after each step. Check empty input, duplicates, boundaries, and whether mutation is allowed.</p>
          <h3 className="mt-5 font-semibold text-ink">Hash map: trade memory for lookup time</h3>
          <p className="mt-2">For two sum, checking all pairs takes O(n²) time and O(1) extra space. Store earlier values to find a complement in expected O(1) lookup time: expected O(n) time and O(n) extra space overall. Checking before insertion prevents using the same index twice and handles duplicates.</p>
          <CodeExample code={examples.hashMap} />
          <h3 className="mt-6 font-semibold text-ink">Binary search: narrow an ordered range</h3>
          <p className="mt-2">When the input is sorted, discard half the remaining range each iteration. This returns any matching index, or -1 when absent, in O(log n) time and O(1) extra space. Sorting an unsorted input first costs time and changes indices, so it is not always worthwhile for one search.</p>
          <CodeExample code={examples.binarySearch} />
          <p className="mt-4">Other useful starting points: two pointers for a sorted pair or shrinking window, a queue for breadth-first traversal, and dynamic programming when overlapping subproblems have reusable answers. Each depends on the problem’s constraints; name those assumptions before applying a template.</p>
        </section>

        <section id="strategy" className="panel scroll-mt-6 p-5 sm:p-7">
          <p className="eyebrow">DESIGN PATTERNS / 01</p>
          <h2 className="mt-2 text-xl font-semibold text-ink">Strategy</h2>
          <p className="mt-3">Use Strategy when the same task has interchangeable ways to perform it. The caller supplies the behavior; the context uses it without branching on every option. In Python, a function can be a strategy when no shared state is needed.</p>
          <CodeExample code={examples.strategy} />
          <p className="mt-4"><strong className="text-ink">Tradeoff:</strong> Strategies isolate variation and are easy to test, but the caller must choose one and the extra indirection may be unnecessary for a single stable rule. Try adding a flat-rate function without changing <code>shipping_cost</code>.</p>
        </section>

        <section id="observer" className="panel scroll-mt-6 p-5 sm:p-7">
          <p className="eyebrow">DESIGN PATTERNS / 02</p>
          <h2 className="mt-2 text-xl font-semibold text-ink">Observer</h2>
          <p className="mt-3">Use Observer when a change should notify multiple independent consumers. The publisher keeps subscribers and calls them when an event occurs, rather than knowing each consumer’s implementation.</p>
          <CodeExample code={examples.observer} />
          <p className="mt-4"><strong className="text-ink">Tradeoff:</strong> Subscribers can be added independently, but notification order, exceptions, and retained references can complicate behavior. This example calls listeners synchronously; an exception stops later notifications. For a longer-lived publisher, consider explicit unsubscribe and a documented error policy.</p>
        </section>

        <section id="factory" className="panel scroll-mt-6 p-5 sm:p-7">
          <p className="eyebrow">DESIGN PATTERNS / 03</p>
          <h2 className="mt-2 text-xl font-semibold text-ink">Factory</h2>
          <p className="mt-3">Use a factory to centralize object creation when the concrete type depends on configuration or construction needs coordination. Callers use the returned object’s common interface rather than repeating selection logic.</p>
          <CodeExample code={examples.factory} />
          <p className="mt-4"><strong className="text-ink">Tradeoff:</strong> A factory keeps construction decisions in one place but adds another layer and must be updated for new types. Prefer direct construction when there is only one simple choice. Try adding another report type with a <code>render</code> method and a factory branch.</p>
        </section>
      </div>
    </div>
  )
}
