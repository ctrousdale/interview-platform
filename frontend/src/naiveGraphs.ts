import type { Solution } from './solutions';

export const naiveGraphs: Record<string, Solution[]> = {
  'google-router-reachability': [
    {
      name: 'Floyd–Warshall transitive closure',
      explanation: 'Build the directed reachability matrix for working routers, including the zero-hop path from each router to itself. An edge uses the sending router’s radius and includes the boundary. Repeatedly allow each working router as an intermediate (transitive closure); broken endpoints are never reachable.',
      code: `def router_reachable(routers, broken, source, destination):
    if source in broken or destination in broken:
        return False
    ids = [router for router in routers if router not in broken]
    n = len(ids)
    reachable = [[False] * n for _ in range(n)]
    for i, a in enumerate(ids):
        x, y, radius = routers[a]
        for j, b in enumerate(ids):
            nx, ny, _ = routers[b]
            reachable[i][j] = (nx - x) ** 2 + (ny - y) ** 2 <= radius ** 2
    for k in range(n):
        for i in range(n):
            for j in range(n):
                reachable[i][j] = reachable[i][j] or (reachable[i][k] and reachable[k][j])
    return reachable[ids.index(source)][ids.index(destination)]`,
      complexity: 'For n routers, O(n³) time and O(n²) auxiliary space.',
    },
  ],
  'google-top-k-similar': [
    {
      name: 'Repeated graph searches and sorting',
      explanation: 'For every other movie, independently search the undirected neighbor graph from the start to check reachability. A visited set handles cycles and duplicate entries. Sort the reachable IDs by descending score and ascending ID, then take at most k.',
      code: `def top_similar(graph, scores, start, k):
    candidates = []
    for candidate in graph:
        if candidate == start:
            continue
        seen = {start}
        stack = [start]
        while stack and candidate not in seen:
            movie = stack.pop()
            for neighbor in graph[movie]:
                if neighbor not in seen:
                    seen.add(neighbor)
                    stack.append(neighbor)
        if candidate in seen:
            candidates.append(candidate)
    candidates.sort(key=lambda movie: (-scores[movie], movie))
    return candidates[:k]`,
      complexity: 'For V movies and E neighbor-list entries, O(V(V + E) + V log V) time and O(V) auxiliary space.',
    },
    {
      name: 'Graph traversal and bounded heap',
      explanation: 'Discover the start’s component once, excluding the start. Select the k best IDs with a bounded heap using the same descending-score, ascending-ID ranking; nsmallest returns them in ranking order. Duplicate edges do not duplicate movies.',
      code: `import heapq

def top_similar(graph, scores, start, k):
    seen = {start}
    stack = [start]
    while stack:
        movie = stack.pop()
        for neighbor in graph[movie]:
            if neighbor not in seen:
                seen.add(neighbor)
                stack.append(neighbor)
    seen.remove(start)
    return heapq.nsmallest(k, seen, key=lambda movie: (-scores[movie], movie))`,
      complexity: 'For v reachable movies and e neighbor entries, O(v + e + v log(v + 1)) worst-case time and O(v) auxiliary space; when k is smaller than v, heap selection takes O(v log(k + 1)).',
    },
  ],
  'google-dag-longest-path': [
    {
      name: 'Enumerating all directed paths',
      explanation: 'Enumerate every directed path starting at every vertex, retaining the longest. The DAG guarantee makes recursion terminate; isolated vertices are valid zero-edge paths and an empty graph returns an empty list.',
      code: `def longest_path(graph):
    best = []
    path = []
    def explore(vertex):
        nonlocal best
        path.append(vertex)
        if len(path) > len(best):
            best = path.copy()
        for neighbor in graph[vertex]:
            explore(neighbor)
        path.pop()
    for vertex in graph:
        explore(vertex)
    return best`,
      complexity: 'If P is the number of directed paths, O(PV) time in the worst case including path copies and O(V) auxiliary space; P can be exponential in V (and counts duplicate adjacency entries).',
    },
    {
      name: 'Memoized depth-first search',
      explanation: 'Memoized DFS computes the longest directed suffix from each vertex. Store the best next vertex and reconstruct from the best starting vertex. The DAG guarantee prevents recursive cycles; isolated and disconnected vertices are included.',
      code: `def longest_path(graph):
    if not graph:
        return []
    distance = {}
    next_vertex = {}
    def visit(vertex):
        if vertex not in distance:
            distance[vertex] = 0
            for neighbor in graph[vertex]:
                candidate = 1 + visit(neighbor)
                if candidate > distance[vertex]:
                    distance[vertex] = candidate
                    next_vertex[vertex] = neighbor
        return distance[vertex]
    for vertex in graph:
        visit(vertex)
    vertex = max(graph, key=distance.get)
    path = [vertex]
    while vertex in next_vertex:
        vertex = next_vertex[vertex]
        path.append(vertex)
    return path`,
      complexity: 'O(V + E) time and O(V) auxiliary space, including the recursion stack.',
    },
  ],
  'google-dependency-order': [
    {
      name: 'Brute-force permutations',
      explanation: 'Try every permutation and check every prerequisite-to-dependent edge against its positions. Return the first valid order, or None if none exists. Duplicate edges are harmless; self-loops fail, while the empty permutation is a valid empty order.',
      code: `from itertools import permutations

def dependency_order(tasks, prerequisites):
    for order in permutations(tasks):
        position = {task: i for i, task in enumerate(order)}
        if all(position[a] < position[b] for a, b in prerequisites):
            return list(order)
    return None`,
      complexity: 'For V tasks and E edges, O(V! · (V + E)) time and O(V) auxiliary space.',
    },
    {
      name: 'Depth-first topological sort',
      explanation: 'Use DFS with unvisited, active, and completed states on prerequisite-to-dependent edges. An edge to an active task identifies a cycle, including self-loops. Reverse the completion order to put every prerequisite before its dependent; repeated edges and isolated tasks are safe.',
      code: `def dependency_order(tasks, prerequisites):
    outgoing = {task: [] for task in tasks}
    for prerequisite, dependent in prerequisites:
        outgoing[prerequisite].append(dependent)
    state = {task: 0 for task in tasks}
    order = []
    def visit(task):
        if state[task] == 1:
            return False
        if state[task] == 2:
            return True
        state[task] = 1
        for dependent in outgoing[task]:
            if not visit(dependent):
                return False
        state[task] = 2
        order.append(task)
        return True
    for task in tasks:
        if not visit(task):
            return None
    return order[::-1]`,
      complexity: 'O(V + E) time and O(V + E) auxiliary space, including adjacency lists and recursion.',
    },
  ],
  'google-connect-sticks': [
    {
      name: 'Exhaustive recursive merging',
      explanation: 'Try every possible first pair, then recursively solve the remaining merge problem; the minimum across choices is optimal. Each recursive list is new, so the input is unchanged, and fewer than two sticks cost zero.',
      code: `def connect_sticks(lengths):
    def solve(sticks):
        if len(sticks) < 2:
            return 0
        best = float('inf')
        for i in range(len(sticks)):
            for j in range(i + 1, len(sticks)):
                joined = sticks[i] + sticks[j]
                remaining = [sticks[k] for k in range(len(sticks)) if k != i and k != j]
                best = min(best, joined + solve(remaining + [joined]))
        return best
    return solve(list(lengths))`,
      complexity: 'For n sticks, there are n!(n−1)! / 2^(n−1) merge sequences; O(n) work per recursive node gives O(n · n!(n−1)! / 2^(n−1)) time and O(n²) peak auxiliary space for recursive lists.',
    },
    {
      name: 'Sorting and two queues',
      explanation: 'Sort a copy of the original lengths and keep generated sums in a second queue. Both queues are nondecreasing: each newly merged pair is at least as large as the previous pair. Repeatedly take the smallest head twice, implementing the same optimal greedy merge without a heap.',
      code: `from collections import deque

def connect_sticks(lengths):
    original = deque(sorted(lengths))
    merged = deque()
    def take():
        if not original:
            return merged.popleft()
        if not merged or original[0] <= merged[0]:
            return original.popleft()
        return merged.popleft()
    total = 0
    while len(original) + len(merged) > 1:
        joined = take() + take()
        total += joined
        merged.append(joined)
    return total`,
      complexity: 'O(n log n) time for sorting plus O(n) for merges, and O(n) auxiliary space.',
    },
  ],
  'google-string-transform': [
    {
      name: 'Breadth-first search over strings',
      explanation: 'First reject inconsistent source-to-target mappings. If all 26 target letters are present and the strings differ, no spare letter exists to break a required cycle. Otherwise breadth-first search strings reachable by globally replacing one lowercase letter with another. The visited set prevents cycles; this finite search is a correctness baseline, not practical for large inputs.',
      code: `from collections import deque
from string import ascii_lowercase

def can_transform(source, target):
    mapping = {}
    for old, new in zip(source, target):
        if old in mapping and mapping[old] != new:
            return False
        mapping[old] = new
    if source != target and len(set(target)) == 26:
        return False
    queue = deque([source])
    seen = {source}
    while queue:
        current = queue.popleft()
        if current == target:
            return True
        for old in set(current):
            for new in ascii_lowercase:
                if new == old:
                    continue
                changed = current.replace(old, new)
                if changed not in seen:
                    seen.add(changed)
                    queue.append(changed)
    return False`,
      complexity: 'For length n and d distinct source letters, at most 26^d strings are reachable. Time is O(26²(n + 1)26^d), and auxiliary space is O((n + 1)26^d).',
    },
  ],
  'google-dynamic-intervals': [
    {
      name: 'Unsorted list and linear scan',
      explanation: 'Store bookings in an unsorted list. Scan all existing half-open intervals for an overlap before appending; touching endpoints do not overlap. Cancellation removes only an exactly matching pair and leaves the calendar unchanged on failure.',
      code: `class BookingCalendar:
    def __init__(self):
        self.bookings = []

    def book(self, start, end):
        for left, right in self.bookings:
            if start < right and left < end:
                return False
        self.bookings.append((start, end))
        return True

    def cancel(self, start, end):
        interval = (start, end)
        if interval not in self.bookings:
            return False
        self.bookings.remove(interval)
        return True`,
      complexity: 'With n current bookings, each operation takes O(n) time in the worst case and storage is O(n).',
    },
  ],
};
