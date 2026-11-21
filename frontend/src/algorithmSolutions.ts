import type { Solution } from './solutions'

export const algorithmSolutions: Record<string, Solution> = {
  'algorithms-two-sum': {
    name: 'Hash map',
    explanation: 'Scan the numbers once, remembering the index of each value already seen. Before storing the current value, look for its complement; this guarantees the two indices are distinct, including when the values are equal. Return None when no pair exists, and leave the input unchanged.',
    code: `def two_sum(nums, target):
    seen = {}
    for index, value in enumerate(nums):
        complement = target - value
        if complement in seen:
            return (seen[complement], index)
        seen[value] = index
    return None`,
    complexity: 'For n numbers, expected O(n) time and O(n) extra space.',
  },
  'algorithms-intervals': {
    name: 'Sorting and interval merging',
    explanation: 'Sort copies of the intervals by start, then extend the last merged interval whenever the next interval overlaps or touches it. Otherwise start a new interval. Copying keeps the input unchanged, and an empty input produces an empty result.',
    code: `def merge_intervals(intervals):
    merged = []
    for start, end in sorted(intervals):
        if merged and start <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    return merged`,
    complexity: 'For n intervals, O(n log n) time and O(n) extra space, including the sorted copy and result.',
  },
  'algorithms-cache': {
    name: 'Ordered dictionary',
    explanation: 'An ordered dictionary keeps keys from least to most recently used. Move a key to the end on a hit or update, and evict from the front when an insertion exceeds capacity. At capacity zero, nothing is retained; a missing get returns -1 without changing the order.',
    code: `from collections import OrderedDict

class LRUCache:
    def __init__(self, capacity):
        self.capacity = capacity
        self.items = OrderedDict()

    def get(self, key):
        if key not in self.items:
            return -1
        self.items.move_to_end(key)
        return self.items[key]

    def put(self, key, value):
        self.items[key] = value
        self.items.move_to_end(key)
        if len(self.items) > self.capacity:
            self.items.popitem(last=False)`,
    complexity: 'For capacity c, get and put take expected O(1) time each and the cache uses O(c) space.',
  },
  'google-message-dedup': {
    name: 'Sliding window with queue and set',
    explanation: 'Keep accepted messages in timestamp order and a set of their texts. Before each decision, evict acceptances at least 60 seconds old. A text still in the set is rejected without resetting its window; otherwise add it to both structures. Nondecreasing timestamps make the queue eviction valid.',
    code: `from collections import deque

class MessageFilter:
    def __init__(self):
        self.recent = deque()
        self.texts = set()

    def accept(self, timestamp, text):
        while self.recent and timestamp - self.recent[0][0] >= 60:
            _, expired = self.recent.popleft()
            self.texts.remove(expired)
        if text in self.texts:
            return False
        self.recent.append((timestamp, text))
        self.texts.add(text)
        return True`,
    complexity: 'For m calls and at most r accepted messages retained in the current window, expected O(m) total time and O(r) space; a single call can evict O(r) messages.',
  },
  'google-islands-lakes': {
    name: 'Flood fill',
    explanation: 'Flood-fill each unvisited component using four-directional neighbors, without changing the grid. Count every land component as an island; count a water component as a lake only if none of its cells touches the boundary. Empty grids have neither.',
    code: `def count_islands_lakes(grid):
    if not grid or not grid[0]:
        return (0, 0)
    rows, cols = len(grid), len(grid[0])
    seen = set()
    islands = lakes = 0
    for r in range(rows):
        for c in range(cols):
            if (r, c) in seen:
                continue
            value = grid[r][c]
            seen.add((r, c))
            stack = [(r, c)]
            boundary = False
            while stack:
                x, y = stack.pop()
                if x == 0 or x == rows - 1 or y == 0 or y == cols - 1:
                    boundary = True
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if (0 <= nx < rows and 0 <= ny < cols
                            and (nx, ny) not in seen and grid[nx][ny] == value):
                        seen.add((nx, ny))
                        stack.append((nx, ny))
            if value == 1:
                islands += 1
            elif not boundary:
                lakes += 1
    return (islands, lakes)`,
    complexity: 'For a grid with r rows and c columns, O(rc) time and O(rc) extra space.',
  },
  'google-shift-timeline': {
    name: 'Sweep line with active counts',
    explanation: 'Sweep the sorted shift endpoints, applying all changes at each time together. Track a count per person so overlapping shifts of one person still contribute only one name. Emit the active set for the next half-open span, merging adjacent spans with the same names to make segments maximal; skip empty spans.',
    code: `from collections import defaultdict

def shift_timeline(shifts):
    events = defaultdict(list)
    for person, start, end in shifts:
        events[start].append((person, 1))
        events[end].append((person, -1))
    times = sorted(events)
    counts = {}
    result = []
    for i, time in enumerate(times):
        for person, delta in events[time]:
            counts[person] = counts.get(person, 0) + delta
            if counts[person] == 0:
                del counts[person]
        if i + 1 == len(times) or not counts:
            continue
        end = times[i + 1]
        people = sorted(counts)
        if result and result[-1][1] == time and result[-1][2] == people:
            result[-1] = (result[-1][0], end, people)
        else:
            result.append((time, end, people))
    return result`,
    complexity: 'For n shifts, at most t = 2n distinct endpoints and p distinct people, O(n log n + t p log p) time and O(n + tp) space including the output.',
  },
  'google-meeting-rooms': {
    name: 'Sorting and min-heap',
    explanation: 'Sort meetings by start time and keep a min-heap of end times for occupied rooms. Release every room whose meeting ends at or before the next start, then allocate a room for that meeting. The largest heap size is the answer; empty input needs zero rooms.',
    code: `import heapq

def min_meeting_rooms(intervals):
    ends = []
    maximum = 0
    for start, end in sorted(intervals):
        while ends and ends[0] <= start:
            heapq.heappop(ends)
        heapq.heappush(ends, end)
        maximum = max(maximum, len(ends))
    return maximum`,
    complexity: 'For n meetings, O(n log n) time and O(n) extra space.',
  },
  'google-cheapest-flights': {
    name: 'Bounded Bellman–Ford',
    explanation: 'Use bounded Bellman-Ford relaxation: each round adds at most one flight, reading only the previous round so paths cannot use too many edges. At most k intermediate stops means at most k + 1 flights. Retain earlier prices to allow fewer flights, return zero for the source itself, and return None if the destination remains unreachable.',
    code: `def cheapest_flight(flights, source, destination, max_stops):
    prices = {source: 0}
    for _ in range(max_stops + 1):
        next_prices = prices.copy()
        for origin, end, price in flights:
            if origin in prices:
                candidate = prices[origin] + price
                if end not in next_prices or candidate < next_prices[end]:
                    next_prices[end] = candidate
        prices = next_prices
    return prices.get(destination)`,
    complexity: 'For e flights, v distinct airports and k allowed stops, O((k + 1)(e + v)) time and O(v) extra space.',
  },
  'google-train-schedule': {
    name: 'Departure-time sweep',
    explanation: 'Process trains in departure-time order, keeping the earliest known arrival at each station and the itinerary that achieved it. A train is usable when its departure is at or after that arrival. Since every train arrives after it departs, all trains that could improve a station before a given departure have already been considered. Store immutable predecessor links for each improvement so later updates cannot change a saved itinerary. The source itself needs no trains.',
    code: `def earliest_train(trains, source, start_time, destination):
    if source == destination:
        return (start_time, [])
    arrivals = {source: start_time}
    paths = {source: None}
    for train in sorted(trains, key=lambda item: item[2]):
        origin, end, departure, arrival = train
        if origin not in arrivals or arrivals[origin] > departure:
            continue
        if end not in arrivals or arrival < arrivals[end]:
            arrivals[end] = arrival
            paths[end] = (train, paths[origin])
    if destination not in arrivals:
        return None
    itinerary = []
    link = paths[destination]
    while link is not None:
        train, link = link
        itinerary.append(train)
    itinerary.reverse()
    return (arrivals[destination], itinerary)`,
    complexity: 'For n trains and v stations, O(n log n) time and O(n + v) extra space, including stored itinerary links.',
  },
}
