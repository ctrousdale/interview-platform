import type { Solution } from './solutions';

export const otherSolutions: Record<string, Solution> = {
  'behavioral-conflict': {
    name: 'Conflict response checklist',
    explanation: 'Choose a real disagreement, not a hypothetical victory. Set the context and stakes, explain the other person’s perspective fairly, and describe how you listened, compared evidence, and reached a decision or escalation. Close with the outcome and what you would do differently; do not claim consensus or results you cannot substantiate. The code is only a checklist for preparing your own account, not a substitute for one.',
    code: `def conflict_outline(context, other_view, your_action, decision, outcome, learning):
    return [context, other_view, your_action, decision, outcome, learning]`,
    complexity: 'The illustrative function takes O(1) time and O(1) auxiliary space: it creates a fixed-size list of references, regardless of the lengths of the supplied strings.',
  },
  'behavioral-failure': {
    name: 'Failure response checklist',
    explanation: 'Pick a genuine setback and briefly explain the goal and your responsibility. Describe the actual failure and its effect, own your part without blaming others, then explain the recovery, the lesson, and a specific later change in behavior. Be candid if the eventual result was mixed. The code organizes a response; it cannot establish that the experience or lesson is real.',
    code: `def failure_outline(goal, responsibility, setback, recovery, lesson, changed_behavior):
    return [goal, responsibility, setback, recovery, lesson, changed_behavior]`,
    complexity: 'The illustrative function takes O(1) time and O(1) auxiliary space because it creates a fixed-size list of references.',
  },
  'behavioral-impact': {
    name: 'Percentage change calculation',
    explanation: 'Use a real project and distinguish the team’s work from your own contribution. State the user or business problem, your decisions and actions, and how success was measured against a baseline. Give numbers only when you know them; otherwise explain the qualitative evidence and its limits. Note trade-offs and credit collaborators. The code illustrates calculating a change, not proving causation.',
    code: `def percent_change(before, after):
    if before == 0:
        return None  # A percentage change from zero is undefined.
    return (after - before) / abs(before) * 100`,
    complexity: 'The illustrative calculation takes O(1) time and O(1) space under a fixed-width arithmetic model; before and after are the two numeric measurements.',
  },
  'google-ambiguity': {
    name: 'Filter unvalidated assumptions',
    explanation: 'Select a real ambiguous problem and explain what was unknown and why it mattered. Show how you clarified the desired outcome with stakeholders, listed assumptions, chose a small experiment or reversible decision, and used evidence to adjust. End with the measured or observed outcome and what you would change. Avoid implying that an assumption was validated before it actually was. The code is only an example of tracking uncertainty.',
    code: `def open_assumptions(assumptions):
    # Each item is (description, validated).
    return [description for description, validated in assumptions if not validated]`,
    complexity: 'For n assumptions and u unvalidated assumptions, the illustrative filter takes O(n) time and O(u) output space.',
  },
  'google-user-first': {
    name: 'Feedback frequency map',
    explanation: 'Describe an actual decision where user needs conflicted with a technical or business pressure. Explain whose needs were affected, the evidence and its limitations, the alternatives and costs, and how you aligned stakeholders or escalated. Report the observed outcome honestly, including any unresolved trade-off. The code illustrates summarizing feedback, not deciding what users need or replacing representative research.',
    code: `def feedback_counts(labels):
    counts = {}
    for label in labels:
        counts[label] = counts.get(label, 0) + 1
    return counts`,
    complexity: 'For n feedback labels and u distinct labels, the illustrative count takes expected O(n) time and O(u) space, assuming expected constant-time dictionary operations.',
  },
  'technical-debugging': {
    name: 'Sorted latency summary',
    explanation: 'First assess user impact, severity, and recent changes; communicate ownership and status. Mitigate safely, for example by rolling back a correlated deployment or shedding nonessential load, while preserving diagnostic evidence. Compare latency, traffic, errors, saturation, traces, and dependency health to isolate a bottleneck; distinguish correlation from cause. After recovery, validate the root cause and add targeted monitoring, tests, and a blameless follow-up. The code summarizes a small sample only: it cannot diagnose production latency, and averages can hide tail behavior.',
    code: `def summarize_latency(samples):
    if not samples:
        return None
    ordered = sorted(samples)
    # Nearest-rank p95, with one-based rank ceil(0.95 * n).
    rank = (95 * len(ordered) + 99) // 100
    return {"mean": sum(ordered) / len(ordered), "p95": ordered[rank - 1]}`,
    complexity: 'For n latency samples, sorting takes O(n log n) time and O(n) additional space; the remaining operations take O(n) time and O(1) additional space.',
  },
  'system-url-shortener': {
    name: 'Sequential IDs and hash map',
    explanation: 'Clarify traffic, retention, custom aliases, abuse prevention, and availability requirements. A create endpoint accepts a validated HTTP(S) URL and returns a short code; a redirect endpoint resolves it, with an explicit missing or expired response. Store a unique code-to-URL mapping durably, generate collision-resistant identifiers or allocate unique IDs, and enforce uniqueness atomically. Discuss caching hot redirects, partitioning, replication, rate limits, and malicious links. This in-memory example uses sequential IDs and demonstrates mapping and lookup only; it is not a distributed production system, durable, secure against enumeration, or safe for concurrent writers.',
    code: `class Shortener:
    def __init__(self):
        self.urls = {}
        self.next_id = 0

    def create(self, url):
        code = str(self.next_id)
        self.next_id += 1
        self.urls[code] = url
        return code

    def resolve(self, code):
        return self.urls.get(code)`,
    complexity: 'With n stored URLs and d digits in the generated ID, create takes expected O(d) time including ID conversion and storage, resolve takes expected O(len(code)) time for hashing a fresh string, and storage is O(n plus the total length of codes and URLs). Dictionary bounds are expected; integer operations assume a fixed-width model.',
  },
  'system-rate-limiter': {
    name: 'Fixed-window counter',
    explanation: 'Clarify the key (user, IP, or API token), quota, window, burst policy, and whether a global limit must be strict. A gateway can atomically update shared per-key counters or token buckets, returning 429 and retry guidance when rejected. Compare central atomic enforcement with local approximations: the former adds latency and a shared dependency, while the latter may overshoot. Discuss clock assumptions, partitioning, bounded state, and an explicit fail-open versus fail-closed policy. This single-process fixed-window example permits bursts across window boundaries; it is not a distributed production system, thread-safe, or resilient to restarts.',
    code: `class FixedWindowLimiter:
    def __init__(self, limit, window_seconds):
        if limit < 0 or window_seconds <= 0:
            raise ValueError("invalid limit or window")
        self.limit = limit
        self.window_seconds = window_seconds
        self.counts = {}

    def allow(self, key, now):
        window = int(now // self.window_seconds)
        old_window, count = self.counts.get(key, (window, 0))
        if old_window != window:
            count = 0
        if count >= self.limit:
            return False
        self.counts[key] = (window, count + 1)
        return True`,
    complexity: 'For k distinct keys retained, each allow call takes expected O(1) time and the limiter stores O(k) state, assuming fixed-size keys and expected constant-time dictionary operations. Entries are not evicted.',
  },
  'google-news-feed': {
    name: 'Sort posts by score',
    explanation: 'Clarify timeline scope, scale, freshness, ranking, privacy, and consistency. Define publish and cursor-paginated feed APIs; persist posts and follow relationships, filter access before returning results, and use a stable ordering key for pagination. Fanout on write makes reads cheap but amplifies writes for popular authors; fanout on read saves writes but increases read work. A hybrid can pull celebrity posts while materializing ordinary authors, with idempotent delivery, retries, and reconciliation for failures. The example ranks an already-collected set of visible posts only; it is not a distributed production system and does not implement fanout, privacy, or pagination.',
    code: `def rank_feed(posts, limit):
    # Each post is (score, post_id); break score ties by ID.
    if limit <= 0:
        return []
    return sorted(posts, key=lambda post: (-post[0], post[1]))[:limit]`,
    complexity: 'For n posts and a requested limit k, sorting takes O(n log n) time and O(n) auxiliary space; the returned slice uses O(min(n, k)) space. Comparison and key operations are assumed constant-time.',
  },
  'google-video-distribution': {
    name: 'Filter and select maximum bitrate',
    explanation: 'Clarify upload sizes, regions, view volume, latency, and supported devices. Use authenticated resumable uploads to object storage, enqueue idempotent transcoding jobs, produce multiple bitrate renditions and a manifest, and serve segments through a CDN with adaptive playback. Separate durable source storage from derived assets, retry failed jobs with bounded attempts, monitor pipeline lag, and handle cache misses, regional outages, access control, and content moderation. Discuss storage and egress cost versus rendition coverage and startup latency. This example only chooses an available bitrate; it is not a distributed production system, a transcoder, or a complete adaptive streaming algorithm.',
    code: `def choose_bitrate(bitrates, bandwidth):
    # Choose the highest rendition within the estimated bandwidth.
    eligible = [rate for rate in bitrates if rate <= bandwidth]
    return max(eligible) if eligible else None`,
    complexity: 'For n available bitrates and e eligible bitrates, the illustrative selection takes O(n) time and O(e) additional space.',
  },
};
