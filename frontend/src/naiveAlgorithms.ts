import type { Solution } from './solutions'

export const naiveAlgorithms: Record<string, Solution[]> = {
  'algorithms-two-sum': [
    {
      name: 'Brute-force pairs',
      explanation: 'Try every pair of distinct indices and return the first pair whose values sum to the target. The input is never changed.',
      code: `def two_sum(nums, target):
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                return (i, j)
    return None`,
      complexity: 'For n numbers, O(n²) time and O(1) extra space.',
    },
    {
      name: 'Sorting and two pointers',
      explanation: 'Sort value-index pairs, then move two pointers inward according to their sum. The original indices remain attached to their values, so duplicates and the unchanged input are handled correctly.',
      code: `def two_sum(nums, target):
    values = sorted((value, index) for index, value in enumerate(nums))
    left, right = 0, len(values) - 1
    while left < right:
        total = values[left][0] + values[right][0]
        if total == target:
            return (values[left][1], values[right][1])
        if total < target:
            left += 1
        else:
            right -= 1
    return None`,
      complexity: 'For n numbers, O(n log n) time and O(n) extra space.',
    },
  ],
  'algorithms-intervals': [
    {
      name: 'Repeated pairwise merging',
      explanation: 'Copy the intervals and repeatedly find and combine any overlapping or touching pair. Once no pair overlaps, sort the remaining components by start. Restarting after each merge handles overlaps revealed by earlier merges.',
      code: `def merge_intervals(intervals):
    work = [list(interval) for interval in intervals]
    while True:
        found = False
        for i in range(len(work)):
            for j in range(i + 1, len(work)):
                a, b = work[i], work[j]
                if a[0] <= b[1] and b[0] <= a[1]:
                    work[i] = [min(a[0], b[0]), max(a[1], b[1])]
                    work.pop(j)
                    found = True
                    break
            if found:
                break
        if not found:
            return sorted(work)`,
      complexity: 'For n intervals, O(n³) time in the worst case and O(n) extra space.',
    },
  ],
  'algorithms-cache': [
    {
      name: 'Recency-ordered list',
      explanation: 'Keep entries in a list ordered from least to most recently used. Search linearly, moving a hit or update to the end; evict the first entry when full.',
      code: `class LRUCache:
    def __init__(self, capacity):
        self.capacity = capacity
        self.items = []

    def get(self, key):
        for i, (stored, value) in enumerate(self.items):
            if stored == key:
                self.items.pop(i)
                self.items.append((stored, value))
                return value
        return -1

    def put(self, key, value):
        for i, (stored, _) in enumerate(self.items):
            if stored == key:
                self.items.pop(i)
                break
        if self.capacity == 0:
            return
        if len(self.items) == self.capacity:
            self.items.pop(0)
        self.items.append((key, value))`,
      complexity: 'For capacity c, each operation takes O(c) time and the cache uses O(c) space.',
    },
    {
      name: 'Hash map and doubly linked list',
      explanation: 'Map keys to nodes in a doubly linked list ordered by recency. Unlink and append a node on a hit or update, and evict the node after the least-recent sentinel when full.',
      code: `class Node:
    def __init__(self, key=None, value=None):
        self.key, self.value = key, value
        self.prev = self.next = None

class LRUCache:
    def __init__(self, capacity):
        self.capacity = capacity
        self.nodes = {}
        self.head, self.tail = Node(), Node()
        self.head.next = self.tail
        self.tail.prev = self.head

    def _remove(self, node):
        node.prev.next = node.next
        node.next.prev = node.prev

    def _append(self, node):
        node.prev, node.next = self.tail.prev, self.tail
        self.tail.prev.next = node
        self.tail.prev = node

    def get(self, key):
        if key not in self.nodes:
            return -1
        node = self.nodes[key]
        self._remove(node)
        self._append(node)
        return node.value

    def put(self, key, value):
        if key in self.nodes:
            node = self.nodes[key]
            node.value = value
            self._remove(node)
        else:
            if self.capacity == 0:
                return
            if len(self.nodes) == self.capacity:
                oldest = self.head.next
                self._remove(oldest)
                del self.nodes[oldest.key]
            node = Node(key, value)
            self.nodes[key] = node
        self._append(node)`,
      complexity: 'For capacity c, get and put take expected O(1) time and the cache uses O(c) space.',
    },
  ],
  'google-message-dedup': [
    {
      name: 'Linear scan of recent messages',
      explanation: 'Scan the retained accepted messages on each call, dropping expired ones and checking the remaining texts. Rejected messages are never added, so they do not extend a window.',
      code: `class MessageFilter:
    def __init__(self):
        self.recent = []

    def accept(self, timestamp, text):
        self.recent = [(time, value) for time, value in self.recent
                       if timestamp - time < 60]
        if any(value == text for _, value in self.recent):
            return False
        self.recent.append((timestamp, text))
        return True`,
      complexity: 'For r retained recent acceptances, each call takes O(r) time and O(r) space; over m calls the worst case is O(m²) time.',
    },
  ],
  'google-islands-lakes': [
    {
      name: 'Repeated component expansion',
      explanation: 'For each cell, repeatedly expand a set to include same-valued neighbors until its whole component is found. Deduplicate components by their cell sets, then count land components and water components that never touch an edge.',
      code: `def count_islands_lakes(grid):
    if not grid or not grid[0]:
        return (0, 0)
    rows, cols = len(grid), len(grid[0])
    components = set()
    for r in range(rows):
        for c in range(cols):
            component = {(r, c)}
            while True:
                expanded = set(component)
                for x, y in component:
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < rows and 0 <= ny < cols and grid[nx][ny] == grid[r][c]:
                            expanded.add((nx, ny))
                if expanded == component:
                    break
                component = expanded
            components.add(frozenset(component))
    islands = lakes = 0
    for component in components:
        x, y = next(iter(component))
        if grid[x][y] == 1:
            islands += 1
        elif all(0 < x < rows - 1 and 0 < y < cols - 1 for x, y in component):
            lakes += 1
    return (islands, lakes)`,
      complexity: 'For N = rows × columns cells, O(N³) expected time and O(N) extra space.',
    },
  ],
  'google-shift-timeline': [
    {
      name: 'Endpoint splitting and shift scans',
      explanation: 'Split time at every distinct shift endpoint. For each elementary span, scan all shifts to find the unique active people, sort them, and merge consecutive spans with identical nonempty sets.',
      code: `def shift_timeline(shifts):
    times = sorted({t for _, start, end in shifts for t in (start, end)})
    result = []
    for start, end in zip(times, times[1:]):
        people = sorted({person for person, a, b in shifts if a <= start and end <= b})
        if not people:
            continue
        if result and result[-1][1] == start and result[-1][2] == people:
            result[-1] = (result[-1][0], end, people)
        else:
            result.append((start, end, people))
    return result`,
      complexity: 'For n shifts, t distinct endpoints and p people, O(n log n + t(n + p log p)) time and O(n + tp) space including output.',
    },
  ],
  'google-meeting-rooms': [
    {
      name: 'Brute-force overlap counting',
      explanation: 'The maximum number of simultaneous meetings occurs at a start time. Count all half-open intervals containing each start and take the maximum.',
      code: `def min_meeting_rooms(intervals):
    maximum = 0
    for start, _ in intervals:
        count = sum(a <= start < b for a, b in intervals)
        maximum = max(maximum, count)
    return maximum`,
      complexity: 'For n meetings, O(n²) time and O(1) extra space.',
    },
    {
      name: 'Sorted starts and ends',
      explanation: 'Sort starts and ends separately. Scan starts in order, releasing every room whose end is at or before that start, and track the largest number simultaneously occupied.',
      code: `def min_meeting_rooms(intervals):
    starts = sorted(start for start, _ in intervals)
    ends = sorted(end for _, end in intervals)
    used = maximum = j = 0
    for start in starts:
        while j < len(ends) and ends[j] <= start:
            used -= 1
            j += 1
        used += 1
        maximum = max(maximum, used)
    return maximum`,
      complexity: 'For n meetings, O(n log n) time and O(n) extra space.',
    },
  ],
  'google-cheapest-flights': [
    {
      name: 'Bounded walk enumeration',
      explanation: 'Enumerate every directed walk with at most the permitted number of flights, checking its cost whenever it reaches the destination. Parallel edges and cycles are allowed, but the flight bound keeps enumeration finite.',
      code: `def cheapest_flight(flights, source, destination, max_stops):
    best = None
    stack = [(source, 0, 0)]
    while stack:
        station, cost, used = stack.pop()
        if station == destination and (best is None or cost < best):
            best = cost
        if used == max_stops + 1:
            continue
        for origin, end, price in flights:
            if origin == station:
                stack.append((end, cost + price, used + 1))
    return best`,
      complexity: 'For e flights and k stops, O((e + 1)^(k + 2)) time and O((e + 1)(k + 1)) space in the worst case.',
    },
    {
      name: 'Dijkstra with flight-count states',
      explanation: 'Run Dijkstra on states consisting of an airport and flights used. Nonnegative fares let the first destination state removed from the heap give the cheapest feasible price; distinct flight counts must remain separate states.',
      code: `import heapq
from itertools import count

def cheapest_flight(flights, source, destination, max_stops):
    edges = {}
    for origin, end, price in flights:
        edges.setdefault(origin, []).append((end, price))
    serial = count()
    heap = [(0, next(serial), source, 0)]
    best = {(source, 0): 0}
    while heap:
        cost, _, station, used = heapq.heappop(heap)
        if cost != best.get((station, used)):
            continue
        if station == destination:
            return cost
        if used == max_stops + 1:
            continue
        for end, price in edges.get(station, []):
            candidate = cost + price
            state = (end, used + 1)
            if state not in best or candidate < best[state]:
                best[state] = candidate
                heapq.heappush(heap, (candidate, next(serial), end, used + 1))
    return None`,
      complexity: 'For e flights and k stops, O((k + 1)e log(2 + (k + 1)e)) time and O(e + (k + 1)e) space in the worst case.',
    },
  ],
  'google-train-schedule': [
    {
      name: 'Itinerary enumeration',
      explanation: 'Enumerate every feasible itinerary by trying all trains that depart the current station no earlier than the current arrival. Arrival times strictly increase, so a train cannot be reused and enumeration terminates. Keep the earliest destination arrival.',
      code: `def earliest_train(trains, source, start_time, destination):
    best = None
    stack = [(source, start_time, [])]
    while stack:
        station, now, path = stack.pop()
        if station == destination:
            if best is None or now < best[0]:
                best = (now, path)
            continue
        for train in trains:
            origin, end, departure, arrival = train
            if origin == station and departure >= now:
                stack.append((end, arrival, path + [train]))
    return best`,
      complexity: 'For n trains, O(n² 2^n) time and O(n³) space in the worst case, including copied paths on the search stack.',
    },
    {
      name: 'Earliest-arrival Dijkstra',
      explanation: 'Use earliest-arrival Dijkstra: settle the station with the smallest known arrival, then consider every departing train that can still be caught. Waiting is allowed, so arriving earlier at a station never makes a connection worse. Save predecessor trains to reconstruct the itinerary.',
      code: `import heapq
from itertools import count

def earliest_train(trains, source, start_time, destination):
    if source == destination:
        return (start_time, [])
    departures = {}
    for train in trains:
        departures.setdefault(train[0], []).append(train)
    serial = count()
    heap = [(start_time, next(serial), source)]
    arrivals = {source: start_time}
    previous = {}
    while heap:
        now, _, station = heapq.heappop(heap)
        if now != arrivals[station]:
            continue
        if station == destination:
            path = []
            while station != source:
                train = previous[station]
                path.append(train)
                station = train[0]
            return (now, path[::-1])
        for train in departures.get(station, []):
            _, end, departure, arrival = train
            if departure >= now and (end not in arrivals or arrival < arrivals[end]):
                arrivals[end] = arrival
                previous[end] = train
                heapq.heappush(heap, (arrival, next(serial), end))
    return None`,
      complexity: 'For n trains, O(n log(n + 1)) time and O(n) extra space.',
    },
  ],
}
