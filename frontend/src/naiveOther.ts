import type { Solution } from './solutions';

export const naiveOther: Record<string, Solution[]> = {
  'behavioral-conflict': [{
    name: 'Situation–action–result outline',
    explanation: 'Use a simple situation–action–result structure for a real disagreement: give the context, describe how you listened and worked toward a resolution, and report the actual result. Include the other person’s perspective and your own role; this outline is a preparation aid, not a fabricated story or a substitute for evidence.',
    code: `def conflict_outline(situation, action, result):
    return [situation, action, result]`,
    complexity: 'The illustrative outline takes O(1) time and O(1) auxiliary space, storing a fixed number of references.',
  }],
  'behavioral-failure': [{
    name: 'Failure and recovery outline',
    explanation: 'Start with a real setback, explain your responsibility and what you did to recover, and end with what you learned and changed. Report the outcome honestly, even if the recovery was incomplete. This structure helps organize an answer; it does not supply a personal experience.',
    code: `def failure_outline(setback, responsibility, recovery, learning):
    return [setback, responsibility, recovery, learning]`,
    complexity: 'The illustrative outline takes O(1) time and O(1) auxiliary space for a fixed number of references.',
  }],
  'behavioral-impact': [{
    name: 'Problem–contribution–result outline',
    explanation: 'Describe a real problem, your individual contribution, and the observed result, giving credit to collaborators. Use a known measure when available and otherwise describe the evidence qualitatively without inventing numbers or claiming unsupported causation. This function only organizes the account.',
    code: `def impact_outline(problem, contribution, result):
    return [problem, contribution, result]`,
    complexity: 'The illustrative outline takes O(1) time and O(1) auxiliary space for a fixed number of references.',
  }],
  'google-ambiguity': [{
    name: 'Uncertainty–action–outcome outline',
    explanation: 'Use a real example: name what was unclear, explain how you sought information and decided what to do, and report what actually happened. Distinguish assumptions from verified facts. This basic outline helps prepare an answer but does not establish that the experience occurred.',
    code: `def ambiguity_outline(uncertainty, action, outcome):
    return [uncertainty, action, outcome]`,
    complexity: 'The illustrative outline takes O(1) time and O(1) auxiliary space for a fixed number of references.',
  }],
  'google-user-first': [{
    name: 'User need–action–outcome outline',
    explanation: 'Describe a real user need, the action you took, and the observed result. Identify the evidence for the need and acknowledge relevant trade-offs and uncertainty rather than assuming your own preference represents all users. The outline is a preparation aid, not user research.',
    code: `def user_first_outline(user_need, action, outcome):
    return [user_need, action, outcome]`,
    complexity: 'The illustrative outline takes O(1) time and O(1) auxiliary space for a fixed number of references.',
  }],
  'technical-debugging': [{
    name: 'Mean latency calculation',
    explanation: 'A basic incident response is to establish impact, communicate, mitigate safely, and investigate with evidence before validating recovery. For an initial snapshot, calculate the mean of available latency samples; an empty sample has no mean. This toy summary cannot identify a root cause or reveal tail latency, and must not replace production monitoring.',
    code: `def mean_latency(samples):
    if not samples:
        return None
    return sum(samples) / len(samples)`,
    complexity: 'For n samples, the illustrative calculation takes O(n) time and O(1) auxiliary space, assuming fixed-width arithmetic.',
  }],
  'system-url-shortener': [{
    name: 'List index and linear lookup',
    explanation: 'A simple single-process toy stores each URL in a list and uses its index as the code. It demonstrates creation and lookup only: it has no URL validation, persistence, concurrency control, abuse protection, or distributed uniqueness, and predictable codes permit enumeration. A production design needs explicit requirements and durable, atomic storage.',
    code: `class Shortener:
    def __init__(self):
        self.urls = []

    def create(self, url):
        code = str(len(self.urls))
        self.urls.append(url)
        return code

    def resolve(self, code):
        for index, url in enumerate(self.urls):
            if str(index) == code:
                return url
        return None`,
    complexity: 'For n URLs and at most d digits per index, creation takes amortized O(d) time and resolution takes O(n d) time. The list stores O(n) references and retains URLs totaling O(total URL length) space.',
  }],
  'system-rate-limiter': [{
    name: 'Sliding-window request log',
    explanation: 'A basic sliding log records accepted request times and scans them for each decision, admitting at most the configured number in the preceding window. This toy assumes nondecreasing caller-supplied timestamps and a single process; it is not thread-safe, durable, or globally enforced, and retains inactive keys until they are used again. Production enforcement requires atomic shared state or an explicitly approximate policy.',
    code: `class SlidingLogLimiter:
    def __init__(self, limit, window_seconds):
        if limit < 0 or window_seconds <= 0:
            raise ValueError("invalid limit or window")
        self.limit = limit
        self.window_seconds = window_seconds
        self.requests = {}

    def allow(self, key, now):
        recent = [t for t in self.requests.get(key, [])
                  if now - t < self.window_seconds]
        if len(recent) >= self.limit:
            if recent:
                self.requests[key] = recent
            else:
                self.requests.pop(key, None)
            return False
        recent.append(now)
        self.requests[key] = recent
        return True`,
    complexity: 'If a key has m retained timestamps, allow takes O(m) time and O(m) temporary space. Across k retained keys, state is O(k plus the total number of retained timestamps), assuming fixed-size keys and expected constant-time dictionary operations.',
  }],
  'google-news-feed': [{
    name: 'Repeated best-post scans',
    explanation: 'As a toy ranking step, repeatedly scan an already-collected set of visible posts for the best remaining score, breaking ties by post ID. This does not build a distributed feed or implement access control, fanout, or pagination; those must be addressed separately. It leaves the input unchanged.',
    code: `def rank_feed(posts, limit):
    remaining = list(posts)
    result = []
    while remaining and len(result) < limit:
        best = min(range(len(remaining)),
                   key=lambda i: (-remaining[i][0], remaining[i][1]))
        result.append(remaining.pop(best))
    return result`,
    complexity: 'For n posts and r = min(n, max(0, limit)), repeated scans and removals take O(n r) time; the copied list and result use O(n) auxiliary space, assuming constant-time score and ID comparisons.',
  }],
  'google-video-distribution': [{
    name: 'Linear maximum bitrate scan',
    explanation: 'A basic playback toy scans available rendition bitrates and chooses the largest one within the estimated bandwidth, or None if none fits. It only selects a number: it does not implement uploading, transcoding, CDN delivery, buffering, or adaptive playback, and a real player needs a safety margin and changing network estimates.',
    code: `def choose_bitrate(bitrates, bandwidth):
    best = None
    for rate in bitrates:
        if rate <= bandwidth and (best is None or rate > best):
            best = rate
    return best`,
    complexity: 'For n available bitrates, selection takes O(n) time and O(1) auxiliary space, assuming constant-time numeric comparisons.',
  }],
};
