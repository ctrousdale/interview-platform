import type { Solution } from './solutions';

export const graphSolutions: Record<string, Solution> = {
  'google-router-reachability': {
    name: 'Depth-first search with on-demand links',
    explanation: 'Run a graph search from the source, discovering outgoing links on demand. A link uses the sending router’s radius, so it need not work in the reverse direction. Compare squared distances to include routers exactly on the boundary without taking square roots. Never visit broken routers; if either endpoint is broken, return false even when they are the same. A working source reaches itself. Track visited IDs to terminate on cycles. To return a fewest-hop route instead, use a queue and record each newly discovered router’s predecessor.',
    code: `def router_reachable(routers, broken, source, destination):
    if source in broken or destination in broken:
        return False
    seen = {source}
    stack = [source]
    while stack:
        current = stack.pop()
        if current == destination:
            return True
        x, y, radius = routers[current]
        for neighbor, (nx, ny, _) in routers.items():
            if neighbor not in broken and neighbor not in seen:
                if (nx - x) ** 2 + (ny - y) ** 2 <= radius ** 2:
                    seen.add(neighbor)
                    stack.append(neighbor)
    return False`,
    complexity: 'For n routers, at most n searches each inspect n routers: O(n²) time and O(n) auxiliary space.',
  },
  'google-top-k-similar': {
    name: 'Graph traversal and sorting',
    explanation: 'Traverse the start movie’s connected component, marking movies when discovered so cycles and duplicate neighbor entries do not produce duplicates. Exclude the start, then sort all other reachable movies by descending similarity and ascending ID and take the first k. This also handles k = 0 and components with fewer than k candidates. For smaller ranking memory when k is small, maintain a size-k heap with the worst retained candidate at its root, while still keeping a visited set for traversal.',
    code: `def top_similar(graph, scores, start, k):
    if k == 0:
        return []
    seen = {start}
    stack = [start]
    candidates = []
    while stack:
        movie = stack.pop()
        for neighbor in graph[movie]:
            if neighbor not in seen:
                seen.add(neighbor)
                stack.append(neighbor)
                candidates.append(neighbor)
    candidates.sort(key=lambda movie: (-scores[movie], movie))
    return candidates[:k]`,
    complexity: 'For v reachable movies and e neighbor-list entries in their component, traversal takes O(v + e), sorting takes O(v log v), and auxiliary space is O(v).',
  },
  'google-dag-longest-path': {
    name: 'Topological dynamic programming',
    explanation: 'Topologically process the directed DAG using indegrees. Initially every vertex is a valid zero-edge path, including isolated vertices. Relax each outgoing edge to extend the longest path ending at its source, recording a predecessor when it improves the destination. After processing, follow predecessors from a vertex with maximum distance and reverse the result. Disconnected components are handled together; ties may use either path and an empty graph returns an empty list. For weighted edges, replace the increment of one by the edge weight and decide whether a zero-edge path is allowed when all weights are negative.',
    code: `from collections import deque

def longest_path(graph):
    if not graph:
        return []
    indegree = {vertex: 0 for vertex in graph}
    for neighbors in graph.values():
        for neighbor in neighbors:
            indegree[neighbor] += 1
    queue = deque(vertex for vertex in graph if indegree[vertex] == 0)
    distance = {vertex: 0 for vertex in graph}
    predecessor = {}
    while queue:
        vertex = queue.popleft()
        for neighbor in graph[vertex]:
            if distance[vertex] + 1 > distance[neighbor]:
                distance[neighbor] = distance[vertex] + 1
                predecessor[neighbor] = vertex
            indegree[neighbor] -= 1
            if indegree[neighbor] == 0:
                queue.append(neighbor)
    vertex = max(graph, key=distance.get)
    path = [vertex]
    while vertex in predecessor:
        vertex = predecessor[vertex]
        path.append(vertex)
    return path[::-1]`,
    complexity: 'For V vertices and E directed adjacency entries, time is O(V + E) and auxiliary space is O(V).',
  },
  'google-dependency-order': {
    name: 'Kahn’s topological sort',
    explanation: 'Interpret each pair as an edge from prerequisite to dependent. Kahn’s algorithm repeatedly emits a task with zero remaining incoming edges and removes its outgoing edges. Count duplicate edges separately and remove each separately, so they do not block a valid ordering. If fewer than all tasks can be emitted, a cycle (including a self-loop) remains and the answer is None. Isolated tasks appear in the result, and an empty task list yields an empty order. To obtain minimum parallel rounds with unlimited workers, process the current zero-indegree queue as one batch before starting the next.',
    code: `from collections import deque

def dependency_order(tasks, prerequisites):
    outgoing = {task: [] for task in tasks}
    indegree = {task: 0 for task in tasks}
    for prerequisite, dependent in prerequisites:
        outgoing[prerequisite].append(dependent)
        indegree[dependent] += 1
    queue = deque(task for task in tasks if indegree[task] == 0)
    order = []
    while queue:
        task = queue.popleft()
        order.append(task)
        for dependent in outgoing[task]:
            indegree[dependent] -= 1
            if indegree[dependent] == 0:
                queue.append(dependent)
    return order if len(order) == len(tasks) else None`,
    complexity: 'For V tasks and E prerequisite pairs, time and auxiliary space are O(V + E), including duplicate pairs.',
  },
  'google-connect-sticks': {
    name: 'Greedy min-heap',
    explanation: 'Repeatedly join the two shortest available segments using a min-heap, add their sum to the total, and put the combined segment back. In an optimal binary merge tree, the two smallest lengths can be placed at maximum depth as siblings; exchanging them with larger lengths cannot increase cost. Combining them reduces the problem to the same optimal subproblem. Copy the input before heapifying, and return zero when fewer than two segments exist. To return the joins, record each pair and its sum as it is removed from the heap.',
    code: `import heapq

def connect_sticks(lengths):
    heap = list(lengths)
    heapq.heapify(heap)
    total = 0
    while len(heap) > 1:
        joined = heapq.heappop(heap) + heapq.heappop(heap)
        total += joined
        heapq.heappush(heap, joined)
    return total`,
    complexity: 'For n segments, heap construction takes O(n), the joins take O(n log n) time, and the copied heap uses O(n) auxiliary space.',
  },
  'google-string-transform': {
    name: 'Character mapping and spare letter',
    explanation: 'Each source letter must map consistently to one target letter, because global replacement cannot split equal letters. If the strings already match, no operations are needed, even if all 26 letters are present. Otherwise, a consistent mapping is achievable exactly when some letter is absent from the target: it can serve as a temporary name to break cycles, while chains and merges are resolved in a safe order. If all 26 target letters occur, consistency forces a permutation of the whole alphabet; any nonidentity permutation has a cycle and no spare letter with which to break it.',
    code: `def can_transform(source, target):
    mapping = {}
    for original, replacement in zip(source, target):
        if original in mapping and mapping[original] != replacement:
            return False
        mapping[original] = replacement
    return source == target or len(set(target)) < 26`,
    complexity: 'For strings of length n and a fixed 26-letter alphabet, time is O(n) and auxiliary space is O(1).',
  },
  'google-dynamic-intervals': {
    name: 'Sorted intervals and binary search',
    explanation: 'Keep nonoverlapping bookings sorted by start time. Binary search locates where an interval belongs; only the immediately preceding and following bookings can overlap it. Strict comparisons allow half-open intervals to touch. Cancellation searches for the exact pair and removes it only if present, so a failed operation leaves the calendar unchanged. A balanced search tree could reduce insertion and removal costs; augmenting such a tree with gap information can support first-available-slot queries.',
    code: `from bisect import bisect_left

class BookingCalendar:
    def __init__(self):
        self.bookings = []

    def book(self, start, end):
        i = bisect_left(self.bookings, (start, end))
        if i > 0 and self.bookings[i - 1][1] > start:
            return False
        if i < len(self.bookings) and self.bookings[i][0] < end:
            return False
        self.bookings.insert(i, (start, end))
        return True

    def cancel(self, start, end):
        i = bisect_left(self.bookings, (start, end))
        if i == len(self.bookings) or self.bookings[i] != (start, end):
            return False
        self.bookings.pop(i)
        return True`,
    complexity: 'With n current bookings, searching takes O(log n), while a successful insertion or cancellation can shift O(n) entries. Failed operations take O(log n) time; storage is O(n).',
  },
};
