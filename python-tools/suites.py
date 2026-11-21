"""Callable contracts and deterministic black-box tests for seeded coding questions.

Each test runs in a fresh namespace after the submitted code. UUID5 IDs are
stable across restarts and independent of test ordering; names must not change.
"""

from uuid import NAMESPACE_URL, uuid5


SUITES = {}


def suite(question_id, instructions, starter, tests):
    SUITES[question_id] = {
        "starterCode": starter.strip() + "\n",
        "testInstructions": instructions,
        "tests": [
            {
                "id": str(uuid5(NAMESPACE_URL, f"interview-platform/{question_id}/{name}")),
                "code": code.strip() + "\n",
                "run": index < 2,
            }
            for index, (name, code) in enumerate(tests)
        ],
    }


suite("algorithms-two-sum", "Implement two_sum(nums, target). Return a pair of distinct zero-based indices whose values sum to target, in either order, or None if no pair exists. Any valid pair is accepted. Do not mutate nums.", '''
def two_sum(nums: list[int], target: int) -> list[int] | tuple[int, int] | None:
    pass
''', [
    ("basic", "r = two_sum([2, 7, 11, 15], 9)\nassert r is not None and sorted(r) == [0, 1]"),
    ("duplicates", "r = two_sum([3, 3], 6)\nassert r is not None and sorted(r) == [0, 1]"),
    ("absent", "assert two_sum([1, 2, 3], 10) is None\nassert two_sum([], 0) is None"),
    ("negative-multiple", "a = [-4, 0, 4, 4]; r = two_sum(a, 0)\nassert len(r) == 2 and r[0] != r[1] and sum(a[i] for i in r) == 0\nassert a == [-4, 0, 4, 4]"),
])

suite("algorithms-intervals", "Implement merge_intervals(intervals). Each interval is [start, end] with start <= end. Return intervals sorted by start, merging overlaps including touching endpoints; do not mutate the input. Empty input returns [].", '''
def merge_intervals(intervals: list[list[int]]) -> list[list[int]]:
    pass
''', [
    ("basic", "assert merge_intervals([[1,3],[2,6],[8,10],[15,18]]) == [[1,6],[8,10],[15,18]]"),
    ("touching", "assert merge_intervals([[4,5],[1,4]]) == [[1,5]]"),
    ("nested", "a = [[4,5],[1,10],[2,3],[1,10]]\nassert merge_intervals(a) == [[1,10]]\nassert a == [[4,5],[1,10],[2,3],[1,10]]"),
    ("empty-and-points", "assert merge_intervals([]) == []\nassert merge_intervals([[2,2],[-1,-1],[2,3]]) == [[-1,-1],[2,3]]"),
])

suite("algorithms-cache", "Implement LRUCache(capacity), get(key), and put(key, value). Capacity is nonnegative. get returns the value or -1 if absent and makes a hit most recently used. put inserts or updates and marks the key most recently used, evicting the least recently used key when necessary. Capacity zero stores nothing.", '''
from collections.abc import Hashable
from typing import Any


class LRUCache:
    def __init__(self, capacity: int) -> None:
        pass

    def get(self, key: Hashable) -> Any:
        pass

    def put(self, key: Hashable, value: Any) -> None:
        pass
''', [
    ("eviction", "c = LRUCache(2); c.put(1, 1); c.put(2, 2)\nassert c.get(1) == 1\nc.put(3, 3)\nassert c.get(2) == -1 and c.get(3) == 3"),
    ("update", "c = LRUCache(2); c.put('a', 1); c.put('b', 2); c.put('a', 4); c.put('c', 3)\nassert c.get('a') == 4 and c.get('b') == -1"),
    ("zero", "c = LRUCache(0); c.put(1, 2)\nassert c.get(1) == -1"),
    ("miss-does-not-evict", "c = LRUCache(1); c.put(1, 0)\nassert c.get(9) == -1 and c.get(1) == 0\nc.put(2, 5)\nassert c.get(1) == -1 and c.get(2) == 5"),
])

suite("google-message-dedup", "Implement MessageFilter.accept(timestamp, text), returning bool. Timestamps are nondecreasing numbers. Accept if no identical text was accepted less than 60 seconds ago; rejected messages do not reset the window. Evict expired entries so retained memory depends on recent accepted messages.", '''
class MessageFilter:
    def accept(self, timestamp: float, text: str) -> bool:
        pass
''', [
    ("window", "f = MessageFilter()\nassert f.accept(0, 'x') is True\nassert f.accept(59, 'x') is False\nassert f.accept(60, 'x') is True"),
    ("independent", "f = MessageFilter()\nassert f.accept(5, 'a') is True and f.accept(5, 'b') is True\nassert f.accept(5, 'a') is False"),
    ("rejected-does-not-reset", "f = MessageFilter()\nassert f.accept(1, '') is True\nassert f.accept(60, '') is False\nassert f.accept(61, '') is True"),
    ("repeated-windows", "f = MessageFilter()\nassert [f.accept(t, 'a') for t in [0, 60, 119, 120, 121, 180]] == [True, True, False, True, False, True]"),
])

suite("google-islands-lakes", "Implement count_islands_lakes(grid), returning (islands, lakes). Grid is rectangular, with 1 for land and 0 for water; only horizontal/vertical adjacency counts. A lake is a water component not touching the boundary. Empty grids have zero of each. Do not mutate grid.", '''
def count_islands_lakes(grid: list[list[int]]) -> tuple[int, int]:
    pass
''', [
    ("enclosed", "assert tuple(count_islands_lakes([[1,1,1],[1,0,1],[1,1,1]])) == (1,1)"),
    ("diagonal", "assert tuple(count_islands_lakes([[1,0,1],[0,1,0],[1,0,1]])) == (5,0)"),
    ("two-lakes", "g = [[1,1,1,1,1],[1,0,1,0,1],[1,1,1,1,1]]\nassert tuple(count_islands_lakes(g)) == (1,2)\nassert g == [[1,1,1,1,1],[1,0,1,0,1],[1,1,1,1,1]]"),
    ("empty-ocean", "assert tuple(count_islands_lakes([])) == (0,0)\nassert tuple(count_islands_lakes([[0,0],[0,0]])) == (0,0)\nassert tuple(count_islands_lakes([[1]])) == (1,0)"),
])

suite("google-shift-timeline", "Implement shift_timeline(shifts). Input contains (person, start, end), with start < end. Return a list of (start, end, people) maximal nonempty half-open segments in time order; people is a sorted list of unique names. Overlapping shifts of the same person count once; simultaneous starts and ends must be handled together.", '''
def shift_timeline(shifts: list[tuple[str, float, float]]) -> list[tuple[float, float, list[str]]]:
    pass
''', [
    ("overlap", "assert shift_timeline([('A',1,4),('B',2,5)]) == [(1,2,['A']),(2,4,['A','B']),(4,5,['B'])]"),
    ("same-person", "assert shift_timeline([('A',1,4),('A',2,5),('B',5,6)]) == [(1,5,['A']),(5,6,['B'])]"),
    ("gaps", "assert shift_timeline([('z',5,7),('a',1,2)]) == [(1,2,['a']),(5,7,['z'])]\nassert shift_timeline([]) == []"),
    ("simultaneous", "assert shift_timeline([('b',0,2),('a',0,2),('b',2,4),('a',2,4)]) == [(0,4,['a','b'])]"),
])

suite("google-meeting-rooms", "Implement min_meeting_rooms(intervals). Input intervals [start, end] are half-open with start < end. Return the minimum number of rooms; meetings ending when another starts can share a room. Empty input needs zero rooms.", '''
def min_meeting_rooms(intervals: list[list[float]]) -> int:
    pass
''', [
    ("overlap", "assert min_meeting_rooms([[0,30],[5,10],[15,20]]) == 2"),
    ("touching", "assert min_meeting_rooms([[1,2],[2,3],[3,4]]) == 1"),
    ("all-overlap", "assert min_meeting_rooms([[1,5],[1,5],[1,5]]) == 3"),
    ("empty-unsorted", "assert min_meeting_rooms([]) == 0\nassert min_meeting_rooms([[5,8],[0,5],[3,6],[6,9]]) == 2"),
])

suite("google-cheapest-flights", "Implement cheapest_flight(flights, source, destination, max_stops). Flights are directed (origin, destination, nonnegative price), including possible parallel edges. Return the minimum price using at most max_stops intermediate stops, or None if unreachable. Source equals destination costs 0. max_stops is nonnegative.", '''
from collections.abc import Hashable
from typing import TypeVar

Station = TypeVar("Station", bound=Hashable)


def cheapest_flight(
    flights: list[tuple[Station, Station, float]],
    source: Station,
    destination: Station,
    max_stops: int,
) -> float | None:
    pass
''', [
    ("stop-limit", "f = [('A','B',100),('B','C',100),('A','C',500)]\nassert cheapest_flight(f,'A','C',0) == 500\nassert cheapest_flight(f,'A','C',1) == 200"),
    ("direction", "assert cheapest_flight([('A','B',1)],'B','A',2) is None\nassert cheapest_flight([], 'A','A',0) == 0"),
    ("state-by-hops", "f = [('s','a',1),('a','b',1),('s','b',5),('b','t',1)]\nassert cheapest_flight(f,'s','t',1) == 6"),
    ("cycles-parallel", "f = [('s','a',3),('s','a',1),('a','s',0),('a','t',2),('x','t',0)]\nassert cheapest_flight(f,'s','t',3) == 3\nassert cheapest_flight(f,'t','s',3) is None"),
])

suite("google-train-schedule", "Implement earliest_train(trains, source, start_time, destination). Each directed train is (origin, destination, departure, arrival), with arrival > departure. Return None if unreachable, otherwise (arrival_time, itinerary), where itinerary is a list of the input train tuples in travel order. Transfers may depart at the arrival time. Source equals destination returns (start_time, []). Any earliest-arrival itinerary is accepted.", '''
from collections.abc import Hashable
from typing import TypeVar

Station = TypeVar("Station", bound=Hashable)


def earliest_train(
    trains: list[tuple[Station, Station, float, float]],
    source: Station,
    start_time: float,
    destination: Station,
) -> tuple[float, list[tuple[Station, Station, float, float]]] | None:
    pass
''', [
    ("transfer", "t = [('a','b',1,3),('b','c',3,5),('a','c',1,8)]\nr = earliest_train(t,'a',0,'c')\nassert r[0] == 5 and r[1] == t[:2]"),
    ("unreachable", "assert earliest_train([('a','b',1,2)],'b',0,'a') is None\nassert earliest_train([], 'a', 7, 'a') == (7, [])"),
    ("missed-connection", "t = [('a','b',0,5),('b','c',4,6),('b','c',5,9),('a','c',2,8)]\nr = earliest_train(t,'a',0,'c')\nassert r == (8, [t[3]])"),
    ("ties-and-cycle", "t = [('a','b',1,2),('b','a',2,3),('a','c',1,5),('b','c',2,5),('x','c',0,1)]\nr = earliest_train(t,'a',0,'c')\nassert r[0] == 5\ncur, now = 'a', 0\nfor train in r[1]:\n    assert train in t and train[0] == cur and train[2] >= now\n    cur, now = train[1], train[3]\nassert cur == 'c' and now == 5"),
])

suite("google-router-reachability", "Implement router_reachable(routers, broken, source, destination). routers maps ID to (x, y, radius), all radii nonnegative. A working router sends to working routers at Euclidean distance <= its own radius; links are directed. IDs exist. Return bool; a broken source or destination is unreachable, otherwise a source reaches itself.", '''
from collections.abc import Hashable
from typing import TypeVar

RouterId = TypeVar("RouterId", bound=Hashable)


def router_reachable(
    routers: dict[RouterId, tuple[float, float, float]],
    broken: set[RouterId],
    source: RouterId,
    destination: RouterId,
) -> bool:
    pass
''', [
    ("boundary-direction", "r = {'a':(0,0,5),'b':(3,4,0)}\nassert router_reachable(r, set(), 'a','b') is True\nassert router_reachable(r, set(), 'b','a') is False"),
    ("broken", "r = {'a':(0,0,1),'b':(1,0,1),'c':(2,0,0)}\nassert router_reachable(r, set(), 'a','c') is True\nassert router_reachable(r, {'b'}, 'a','c') is False"),
    ("self", "r = {'a':(0,0,0)}\nassert router_reachable(r, set(), 'a','a') is True\nassert router_reachable(r, {'a'}, 'a','a') is False"),
    ("cycles-disconnected", "r = {'a':(0,0,2),'b':(1,0,2),'c':(10,0,1),'d':(11,0,1)}\nassert router_reachable(r, set(), 'a','d') is False\nassert router_reachable(r, {'d'}, 'c','d') is False"),
])

suite("google-top-k-similar", "Implement top_similar(graph, scores, start, k). graph maps every movie ID to its undirected neighbor list (possibly cyclic or duplicated); scores maps every ID to its similarity score. Return at most k distinct reachable IDs excluding start, sorted by descending score then ascending ID. k is nonnegative.", '''
from collections.abc import Hashable
from typing import TypeVar

MovieId = TypeVar("MovieId", bound=Hashable)


def top_similar(
    graph: dict[MovieId, list[MovieId]],
    scores: dict[MovieId, float],
    start: MovieId,
    k: int,
) -> list[MovieId]:
    pass
''', [
    ("ties-cycle", "g = {'a':['b','c'],'b':['a','c'],'c':['a','b']}\ns = {'a':99,'b':4,'c':4}\nassert top_similar(g,s,'a',2) == ['b','c']"),
    ("disconnected", "g = {1:[2],2:[1],3:[]}\nassert top_similar(g,{1:0,2:1,3:10},1,5) == [2]"),
    ("rank-transitive", "g = {1:[2,2],2:[1,3],3:[2,4],4:[3]}\nassert top_similar(g,{1:0,2:2,3:9,4:5},1,2) == [3,4]"),
    ("empty", "g = {1:[]}\nassert top_similar(g,{1:0},1,0) == []\nassert top_similar(g,{1:0},1,4) == []"),
])

suite("google-dag-longest-path", "Implement longest_path(graph). graph maps each vertex to a list of outgoing neighbors and includes isolated vertices; it is a DAG. Return a list of vertices forming any longest directed path by edge count; return [] for an empty graph. Ties may be broken arbitrarily.", '''
from collections.abc import Hashable
from typing import TypeVar

Vertex = TypeVar("Vertex", bound=Hashable)


def longest_path(graph: dict[Vertex, list[Vertex]]) -> list[Vertex]:
    pass
''', [
    ("basic", "g = {'a':['b','c'],'b':['d'],'c':[],'d':[]}\nassert longest_path(g) == ['a','b','d']"),
    ("disconnected", "g = {0:[],1:[2],2:[3],3:[],4:[5],5:[]}\nassert longest_path(g) == [1,2,3]"),
    ("tie", "g = {0:[1,2],1:[],2:[]}\nr = longest_path(g)\nassert r in ([0,1],[0,2])"),
    ("empty-isolated", "assert longest_path({}) == []\nassert longest_path({'x':[]}) == ['x']"),
])

suite("google-dependency-order", "Implement dependency_order(tasks, prerequisites). tasks is a list of unique IDs; each directed pair (prerequisite, dependent) uses IDs in tasks. Return a list containing each task exactly once, with every prerequisite before its dependent, or None if cyclic. Any valid ordering is accepted; empty tasks yields []. Duplicate edges are allowed.", '''
from collections.abc import Hashable
from typing import TypeVar

Task = TypeVar("Task", bound=Hashable)


def dependency_order(tasks: list[Task], prerequisites: list[tuple[Task, Task]]) -> list[Task] | None:
    pass
''', [
    ("order", "tasks = ['a','b','c','d']; edges = [('a','c'),('b','c')]\nr = dependency_order(tasks, edges)\nassert len(r) == len(tasks) and set(r) == set(tasks)\nassert all(r.index(a) < r.index(b) for a,b in edges)"),
    ("cycle", "assert dependency_order(['a','b'], [('a','b'),('b','a')]) is None"),
    ("duplicate-and-disconnected", "tasks = [1,2,3,4]; edges = [(1,2),(1,2),(2,3)]\nr = dependency_order(tasks, edges)\nassert len(r) == 4 and set(r) == set(tasks) and r.index(1) < r.index(2) < r.index(3)"),
    ("self-empty", "assert dependency_order([1], [(1,1)]) is None\nassert dependency_order([], []) == []"),
])

suite("google-connect-sticks", "Implement connect_sticks(lengths), returning the minimum total cost to connect all nonnegative lengths; each join costs the sum of the two joined lengths. Fewer than two lengths cost zero. Do not mutate lengths.", '''
def connect_sticks(lengths: list[float]) -> float:
    pass
''', [
    ("basic", "assert connect_sticks([2,4,3]) == 14"),
    ("greedy", "assert connect_sticks([1,8,3,5]) == 30"),
    ("small", "assert connect_sticks([]) == 0\nassert connect_sticks([7]) == 0\nassert connect_sticks([0,0,1]) == 1"),
    ("duplicates", "a = [5,5,5,5]\nassert connect_sticks(a) == 40\nassert a == [5,5,5,5]"),
])

suite("google-string-transform", "Implement can_transform(source, target), returning bool. Strings have equal length and contain lowercase English letters. Each operation globally replaces every occurrence of one letter by another. Zero operations are allowed. Determine whether target can be reached, including cycles and spare-letter constraints.", '''
def can_transform(source: str, target: str) -> bool:
    pass
''', [
    ("mapping", "assert can_transform('aabcc', 'ccdee') is True\nassert can_transform('aa', 'ab') is False"),
    ("cycle-spare", "assert can_transform('ab', 'ba') is True\nassert can_transform('abc', 'abc') is True"),
    ("full-alphabet", "a = 'abcdefghijklmnopqrstuvwxyz'\nassert can_transform(a, a) is True\nassert can_transform(a, a[1:] + a[0]) is False"),
    ("empty-chain", "assert can_transform('', '') is True\nassert can_transform('abc', 'bcd') is True\nassert can_transform('ab', 'cc') is True"),
])

suite("google-dynamic-intervals", "Implement BookingCalendar.book(start, end) and cancel(start, end). Both return bool. Intervals are half-open with start < end. book rejects any overlap; cancel succeeds only for an exactly matching existing booking. Adjacent bookings are allowed.", '''
class BookingCalendar:
    def book(self, start: float, end: float) -> bool:
        pass

    def cancel(self, start: float, end: float) -> bool:
        pass
''', [
    ("overlap", "c = BookingCalendar()\nassert c.book(10,20) is True\nassert c.book(15,25) is False\nassert c.book(20,30) is True"),
    ("exact-cancel", "c = BookingCalendar()\nassert c.book(1,5) is True\nassert c.cancel(1,4) is False\nassert c.cancel(1,5) is True\nassert c.cancel(1,5) is False\nassert c.book(1,5) is True"),
    ("containment", "c = BookingCalendar()\nassert c.book(3,7) is True\nassert c.book(1,9) is False and c.book(4,5) is False\nassert c.book(3,7) is False"),
    ("neighbors", "c = BookingCalendar()\nassert c.book(0,2) is True and c.book(4,6) is True and c.book(2,4) is True\nassert c.cancel(2,4) is True and c.book(2,4) is True"),
])


suite("patterns-strategy", "Implement RegularPricing, SeasonalPricing(rate), MemberPricing(rate), and Checkout(strategy). Each strategy exposes price(amount); regular returns amount, the others return amount * (1 - rate), with rates between 0 and 1 inclusive. Checkout.total(amount) delegates to its supplied strategy, including caller-defined strategies. All built-in strategies reject negative amounts with ValueError. Checkout must not hard-code strategy types.", '''
from typing import Any


class RegularPricing:
    def price(self, amount: float) -> float:
        pass


class SeasonalPricing:
    def __init__(self, rate: float) -> None:
        pass

    def price(self, amount: float) -> float:
        pass


class MemberPricing:
    def __init__(self, rate: float) -> None:
        pass

    def price(self, amount: float) -> float:
        pass


class Checkout:
    def __init__(self, strategy: Any) -> None:
        pass

    def total(self, amount: float) -> float:
        pass
''', [
    ("builtins", "assert Checkout(RegularPricing()).total(100) == 100\nassert Checkout(SeasonalPricing(0.2)).total(100) == 80\nassert Checkout(MemberPricing(0.5)).total(80) == 40"),
    ("custom", "class Custom:\n    def price(self, amount): return amount + 7\nassert Checkout(Custom()).total(5) == 12"),
    ("negative", "for s in (RegularPricing(), SeasonalPricing(0.2), MemberPricing(0.1)):\n    try:\n        s.price(-1)\n    except ValueError:\n        pass\n    else:\n        raise AssertionError('negative prices must be rejected')"),
    ("boundaries", "assert Checkout(SeasonalPricing(0)).total(0) == 0\nassert Checkout(MemberPricing(1)).total(20) == 0"),
])

suite("patterns-observer", "Implement OrderService.subscribe(observer), unsubscribe(observer), and update(order). An observer is a callable taking the order. Notify subscribed observers once each in subscription order. Duplicate subscriptions do nothing; unsubscribing an absent observer does nothing. If an observer raises Exception, continue notifying the rest; update returns a list of the exceptions, in notification order (empty on success).", '''
from collections.abc import Callable
from typing import Any


class OrderService:
    def subscribe(self, observer: Callable[[Any], None]) -> None:
        pass

    def unsubscribe(self, observer: Callable[[Any], None]) -> None:
        pass

    def update(self, order: Any) -> list[Exception]:
        pass
''', [
    ("notifications", "s = OrderService(); events = []\ndef email(order): events.append(('email', order))\ndef inventory(order): events.append(('inventory', order))\ns.subscribe(email); s.subscribe(inventory)\nassert s.update('paid') == []\nassert events == [('email','paid'),('inventory','paid')]"),
    ("duplicates-unsubscribe", "s = OrderService(); events = []\ndef obs(order): events.append(order)\ns.subscribe(obs); s.subscribe(obs)\nassert s.update(1) == [] and events == [1]\ns.unsubscribe(obs); s.unsubscribe(obs)\nassert s.update(2) == [] and events == [1]"),
    ("failure-isolation", "s = OrderService(); events = []\ndef bad(order): raise ValueError('bad')\ndef good(order): events.append(order)\ns.subscribe(bad); s.subscribe(good)\nr = s.update('new')\nassert len(r) == 1 and isinstance(r[0], ValueError) and str(r[0]) == 'bad'\nassert events == ['new']"),
    ("resubscribe", "s = OrderService(); events = []\ndef a(order): events.append('a')\ndef b(order): events.append('b')\ns.subscribe(a); s.subscribe(b); s.unsubscribe(a); s.subscribe(a)\nassert s.update({}) == [] and events == ['b','a']"),
])

suite("patterns-factory", "Implement create_sender(channel, transport). For channel 'email' or 'sms', return a sender exposing send(recipient, message), which calls and returns transport.send(channel, recipient, message). Pass the exact injected transport through; do not construct external services. Unsupported channel names raise ValueError.", '''
from typing import Any


def create_sender(channel: str, transport: Any) -> Any:
    pass
''', [
    ("email", "class Transport:\n    def __init__(self): self.calls = []\n    def send(self, *args): self.calls.append(args); return 'sent'\nt = Transport(); s = create_sender('email', t)\nassert s.send('alice@example.com', 'hello') == 'sent'\nassert t.calls == [('email','alice@example.com','hello')]"),
    ("sms", "class Transport:\n    def send(self, *args): return args\nassert create_sender('sms', Transport()).send('123', 'hi') == ('sms','123','hi')"),
    ("unsupported", "try:\n    create_sender('push', object())\nexcept ValueError:\n    pass\nelse:\n    raise AssertionError('unsupported channel must raise ValueError')"),
    ("dependency-errors", "class Transport:\n    def send(self, *args): raise RuntimeError('offline')\ntry:\n    create_sender('email', Transport()).send('a', 'b')\nexcept RuntimeError as e:\n    assert str(e) == 'offline'\nelse:\n    raise AssertionError('transport errors must propagate')"),
])

suite("patterns-decorator", "Implement LoggingClient(client, log) and RetryClient(client, attempts), both exposing request(value). The wrapped client has request(value). LoggingClient calls log(value) once before each delegated request and returns its result, propagating errors. RetryClient retries exceptions from its wrapped client up to attempts total calls (attempts >= 1), returning the first success or re-raising the last exception. Decorators compose in either order; callers must only retry operations safe to repeat.", '''
from collections.abc import Callable
from typing import Any


class LoggingClient:
    def __init__(self, client: Any, log: Callable[[Any], Any]) -> None:
        pass

    def request(self, value: Any) -> Any:
        pass


class RetryClient:
    def __init__(self, client: Any, attempts: int) -> None:
        pass

    def request(self, value: Any) -> Any:
        pass
''', [
    ("logging", "class Client:\n    def request(self, value): return value.upper()\nlog = []\nassert LoggingClient(Client(), log.append).request('hi') == 'HI'\nassert log == ['hi']"),
    ("retry", "class Client:\n    def __init__(self): self.n = 0\n    def request(self, value):\n        self.n += 1\n        if self.n < 3: raise ValueError('retry')\n        return value\nc = Client()\nassert RetryClient(c, 3).request('ok') == 'ok' and c.n == 3"),
    ("ordering", "class Client:\n    def __init__(self): self.n = 0\n    def request(self, value):\n        self.n += 1\n        if self.n < 3: raise ValueError('retry')\n        return value\nlog = []; c = Client()\nassert RetryClient(LoggingClient(c, log.append), 3).request('x') == 'x' and log == ['x'] * 3\nlog = []; c = Client()\nassert LoggingClient(RetryClient(c, 3), log.append).request('x') == 'x' and log == ['x']"),
    ("exhaustion", "class Client:\n    def __init__(self): self.n = 0\n    def request(self, value):\n        self.n += 1\n        raise ValueError(str(self.n))\nc = Client()\ntry:\n    RetryClient(c, 2).request('x')\nexcept ValueError as e:\n    assert str(e) == '2' and c.n == 2\nelse:\n    raise AssertionError('last failure must propagate')"),
])


# Harness code runs in the submitted solution's namespace with a JSON object
# available as custom_input.
CUSTOM_CASES = {
    "algorithms-two-sum": {
        "description": "nums is a list of numbers; target is the desired sum.",
        "input": '{"nums": [2, 7, 11, 15], "target": 9}',
        "code": "custom_actual = two_sum(custom_input['nums'], custom_input['target'])",
    },
    "algorithms-intervals": {
        "description": "intervals is a list of [start, end] pairs.",
        "input": '{"intervals": [[1, 3], [2, 6], [8, 10]]}',
        "code": "custom_actual = merge_intervals(custom_input['intervals'])",
    },
    "algorithms-cache": {
        "description": "capacity is the cache capacity. operations contains objects with op (put or get), key, and value for put, or arrays such as [\"put\", key, value] and [\"get\", key]; output includes each return value.",
        "input": '{"capacity": 2, "operations": [{"op": "put", "key": 1, "value": 1}, {"op": "put", "key": 2, "value": 2}, {"op": "get", "key": 1}, {"op": "put", "key": 3, "value": 3}, {"op": "get", "key": 2}]}',
        "code": """
cache = LRUCache(custom_input['capacity'])
custom_actual = []
for op in custom_input['operations']:
    if isinstance(op, list):
        op = {'op': op[0], 'key': op[1], **({'value': op[2]} if len(op) > 2 else {})}
    if op['op'] == 'put':
        custom_actual.append(cache.put(op['key'], op['value']))
    elif op['op'] == 'get':
        custom_actual.append(cache.get(op['key']))
    else:
        raise ValueError('unknown cache operation: ' + str(op['op']))
""",
    },
    "google-message-dedup": {
        "description": "messages contains objects with timestamp and text or [timestamp, text] pairs, in nondecreasing timestamp order; output contains each accept result.",
        "input": '{"messages": [{"timestamp": 0, "text": "hello"}, {"timestamp": 59, "text": "hello"}, {"timestamp": 60, "text": "hello"}]}',
        "code": """
message_filter = MessageFilter()
custom_actual = [message_filter.accept(message['timestamp'], message['text']) if isinstance(message, dict) else message_filter.accept(*message) for message in custom_input['messages']]
""",
    },
    "google-islands-lakes": {
        "description": "grid is a rectangular list of rows containing 0 and 1.",
        "input": '{"grid": [[1, 1, 1], [1, 0, 1], [1, 1, 1]]}',
        "code": "custom_actual = count_islands_lakes(custom_input['grid'])",
    },
    "google-shift-timeline": {
        "description": "shifts contains [person, start, end] records.",
        "input": '{"shifts": [["Ada", 1, 4], ["Ben", 2, 5]]}',
        "code": "custom_actual = shift_timeline([tuple(shift) for shift in custom_input['shifts']])",
    },
    "google-meeting-rooms": {
        "description": "intervals contains half-open [start, end] meetings.",
        "input": '{"intervals": [[0, 30], [5, 10], [15, 20]]}',
        "code": "custom_actual = min_meeting_rooms(custom_input['intervals'])",
    },
    "google-cheapest-flights": {
        "description": "flights contains [origin, destination, price] records; source, destination, and max_stops define the trip.",
        "input": '{"flights": [["A", "B", 100], ["B", "C", 100], ["A", "C", 500]], "source": "A", "destination": "C", "max_stops": 1}',
        "code": "custom_actual = cheapest_flight([tuple(flight) for flight in custom_input['flights']], custom_input['source'], custom_input['destination'], custom_input['max_stops'])",
    },
    "google-train-schedule": {
        "description": "trains contains [origin, destination, departure, arrival] records; source, start_time, and destination define the trip.",
        "input": '{"trains": [["A", "B", 1, 3], ["B", "C", 3, 5]], "source": "A", "start_time": 0, "destination": "C"}',
        "code": "custom_actual = earliest_train([tuple(train) for train in custom_input['trains']], custom_input['source'], custom_input['start_time'], custom_input['destination'])",
    },
    "google-router-reachability": {
        "description": "routers maps string IDs to [x, y, radius], or is an array of [ID, [x, y, radius]] pairs for numeric IDs. broken is an array of IDs; source and destination are router IDs.",
        "input": '{"routers": {"A": [0, 0, 2], "B": [2, 0, 1]}, "broken": [], "source": "A", "destination": "B"}',
        "code": """
routers = custom_input['routers']
routers = {key: tuple(value) for key, value in (routers.items() if isinstance(routers, dict) else routers)}
custom_actual = router_reachable(routers, set(custom_input['broken']), custom_input['source'], custom_input['destination'])
""",
    },
    "google-top-k-similar": {
        "description": "graph maps IDs to neighbor arrays and scores maps IDs to scores. Each may be an object for string IDs or an array of [ID, value] pairs for numeric IDs. start is the starting ID and k is the result limit.",
        "input": '{"graph": {"A": ["B", "C"], "B": ["A"], "C": ["A"]}, "scores": {"A": 0, "B": 8, "C": 9}, "start": "A", "k": 2}',
        "code": """
graph = custom_input['graph']
scores = custom_input['scores']
custom_actual = top_similar(dict(graph), dict(scores), custom_input['start'], custom_input['k'])
""",
    },
    "google-dag-longest-path": {
        "description": "graph maps every vertex to its outgoing neighbors and must be acyclic. Use an object for string IDs or an array of [ID, neighbors] pairs for numeric IDs.",
        "input": '{"graph": {"A": ["B", "C"], "B": ["C"], "C": []}}',
        "code": "custom_actual = longest_path(dict(custom_input['graph']))",
    },
    "google-dependency-order": {
        "description": "tasks is an array of IDs; prerequisites contains [prerequisite, dependent] pairs.",
        "input": '{"tasks": ["build", "test", "deploy"], "prerequisites": [["build", "test"], ["test", "deploy"]]}',
        "code": "custom_actual = dependency_order(custom_input['tasks'], [tuple(edge) for edge in custom_input['prerequisites']])",
    },
    "google-connect-sticks": {
        "description": "lengths is an array of nonnegative numbers.",
        "input": '{"lengths": [2, 4, 3]}',
        "code": "custom_actual = connect_sticks(custom_input['lengths'])",
    },
    "google-string-transform": {
        "description": "source and target are equal-length strings of lowercase English letters.",
        "input": '{"source": "aabcc", "target": "ccdee"}',
        "code": "custom_actual = can_transform(custom_input['source'], custom_input['target'])",
    },
    "google-dynamic-intervals": {
        "description": "operations contains objects with op (book or cancel), start, and end, or [op, start, end] arrays; output contains each boolean result.",
        "input": '{"operations": [{"op": "book", "start": 10, "end": 20}, {"op": "book", "start": 15, "end": 25}, {"op": "cancel", "start": 10, "end": 20}, {"op": "book", "start": 15, "end": 25}]}',
        "code": """
calendar = BookingCalendar()
custom_actual = []
for op in custom_input['operations']:
    if isinstance(op, list):
        op = {'op': op[0], 'start': op[1], 'end': op[2]}
    if op['op'] == 'book':
        custom_actual.append(calendar.book(op['start'], op['end']))
    elif op['op'] == 'cancel':
        custom_actual.append(calendar.cancel(op['start'], op['end']))
    else:
        raise ValueError('unknown calendar operation: ' + str(op['op']))
""",
    },
    "patterns-strategy": {
        "description": "strategy is regular, seasonal, member, or custom; rate is the discount for seasonal or member, custom_strategy specifies an add operation and offset, and amount is the price.",
        "input": '{"strategy": "seasonal", "rate": 0.2, "amount": 100}',
        "code": """
kind, amount = custom_input['strategy'], custom_input['amount']
parameter = custom_input['custom_strategy']['offset'] if kind == 'custom' else custom_input.get('rate')
class CustomStrategy:
    def price(self, amount):
        return amount + parameter
strategies = {
    'regular': lambda: RegularPricing(),
    'seasonal': lambda: SeasonalPricing(parameter),
    'member': lambda: MemberPricing(parameter),
    'custom': lambda: CustomStrategy(),
}
custom_actual = Checkout(strategies[kind]()).total(amount)
""",
    },
    "patterns-observer": {
        "description": "observers maps names to null or an object with raises containing type ValueError and a message. operations contains objects with action (subscribe, unsubscribe, or update), observer for subscriptions, and order for updates. Output contains events and errors for each update; failing observers record their event before raising.",
        "input": '{"observers": {"email": null, "inventory": {"raises": {"type": "ValueError", "message": "offline"}}}, "operations": [{"action": "subscribe", "observer": "email"}, {"action": "subscribe", "observer": "inventory"}, {"action": "update", "order": "paid"}]}',
        "code": """
observer_specs, operations = custom_input['observers'], custom_input['operations']
events = []
def make_observer(name, error):
    def observer(order):
        events.append((name, order))
        if error is not None:
            raise ValueError(error['raises']['message'])
    return observer
observers = {name: make_observer(name, error) for name, error in observer_specs.items()}
service = OrderService()
errors = []
for op in operations:
    action = op['action']
    if action == 'update':
        errors.append([(type(error).__name__, str(error)) for error in service.update(op['order'])])
    elif action == 'subscribe':
        service.subscribe(observers[op['observer']])
    elif action == 'unsubscribe':
        service.unsubscribe(observers[op['observer']])
    else:
        raise ValueError('unknown observer operation: ' + str(action))
custom_actual = {'events': events, 'errors': errors}
""",
    },
    "patterns-factory": {
        "description": "channel, recipient, and message define the send. transport contains returns (a value or arguments) or raises (type RuntimeError and message). On success output contains result and calls.",
        "input": '{"channel": "email", "recipient": "ada@example.com", "message": "hello", "transport": {"returns": "sent"}}',
        "code": """
channel = custom_input['channel']
spec = custom_input['transport']
class Transport:
    def __init__(self):
        self.calls = []
    def send(self, channel, recipient, message):
        self.calls.append((channel, recipient, message))
        if 'raises' in spec:
            raise RuntimeError(spec['raises']['message'])
        return (channel, recipient, message) if spec.get('returns') == 'arguments' else spec.get('returns')
transport = Transport()
sender = create_sender(channel, transport)
result = sender.send(custom_input['recipient'], custom_input['message'])
custom_actual = {'result': result, 'calls': transport.calls}
""",
    },
    "patterns-decorator": {
        "description": "decorators lists retry and/or logging from outermost to innermost; attempts sets the retry limit. client may specify failures as objects with type and message, returns as a value or input, or operation as uppercase. value is the request. Output contains result, calls, and log; exhausted retries raise an error.",
        "input": '{"decorators": ["retry", "logging"], "attempts": 3, "client": {"failures": [{"type": "RuntimeError", "message": "request failed"}, {"type": "RuntimeError", "message": "request failed"}], "returns": "ok"}, "value": "hello"}',
        "code": """
spec, value = custom_input['client'], custom_input['value']
failures = spec.get('failures', [])
class Client:
    def __init__(self):
        self.calls = []
    def request(self, value):
        self.calls.append(value)
        if len(self.calls) <= len(failures):
            failure = failures[len(self.calls) - 1]
            error_type = {'ValueError': ValueError, 'RuntimeError': RuntimeError}[failure['type']]
            raise error_type(failure['message'])
        if spec.get('operation') == 'uppercase':
            return value.upper()
        return value if spec.get('returns') == 'input' else spec.get('returns')
client = Client()
log = []
decorated = client
for decorator in reversed(custom_input['decorators']):
    if decorator == 'retry':
        decorated = RetryClient(decorated, custom_input['attempts'])
    elif decorator == 'logging':
        decorated = LoggingClient(decorated, log.append)
    else:
        raise ValueError('unknown decorator: ' + str(decorator))
result = decorated.request(value)
custom_actual = {'result': result, 'calls': client.calls, 'log': log}
""",
    },
}

for custom_case in CUSTOM_CASES.values():
    custom_case["description"] += (
        ' To run independent inputs together, use {"scenarios": [input1, input2, ...]};'
        " output is an array of results."
    )
