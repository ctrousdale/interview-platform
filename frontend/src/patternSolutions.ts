import type { Solution } from './solutions';

export const patternSolutions: Record<string, Solution> = {
  'patterns-strategy': {
    name: 'Delegated pricing strategies',
    explanation: 'Each pricing strategy implements the same price(amount) interface. Checkout delegates to the supplied object, so a caller can introduce a new pricing rule without changing Checkout. The built-in strategies reject negative amounts; a zero rate leaves the price unchanged and a rate of one makes it zero. Rates are assumed to be in the specified range from zero to one.',
    code: `class RegularPricing:
    def price(self, amount):
        if amount < 0:
            raise ValueError("amount must not be negative")
        return amount


class SeasonalPricing:
    def __init__(self, rate):
        self.rate = rate

    def price(self, amount):
        if amount < 0:
            raise ValueError("amount must not be negative")
        return amount * (1 - self.rate)


class MemberPricing:
    def __init__(self, rate):
        self.rate = rate

    def price(self, amount):
        if amount < 0:
            raise ValueError("amount must not be negative")
        return amount * (1 - self.rate)


class Checkout:
    def __init__(self, strategy):
        self.strategy = strategy

    def total(self, amount):
        return self.strategy.price(amount)`,
    complexity: 'Each built-in pricing calculation and Checkout delegation takes O(1) time and O(1) extra space, excluding the work of a caller-defined strategy.',
  },
  'patterns-observer': {
    name: 'Observer list with snapshot notification',
    explanation: 'Keep observers in subscription order in a list. Ignore a duplicate subscription or an attempt to remove an absent observer; an observer removed and later added goes to the end. For each update, notify a snapshot of the list so changes during a callback do not disrupt the current notification. Collect Exception instances in notification order and continue after a failure.',
    code: `class OrderService:
    def __init__(self):
        self.observers = []

    def subscribe(self, observer):
        if observer not in self.observers:
            self.observers.append(observer)

    def unsubscribe(self, observer):
        if observer in self.observers:
            self.observers.remove(observer)

    def update(self, order):
        errors = []
        for observer in self.observers[:]:
            try:
                observer(order)
            except Exception as error:
                errors.append(error)
        return errors`,
    complexity: 'For n subscribed observers, subscribe and unsubscribe take O(n) time; update takes O(n) time excluding callback work and O(n) extra space for the snapshot and errors. The stored subscriptions use O(n) space.',
  },
  'patterns-factory': {
    name: 'Shared sender factory',
    explanation: 'The factory accepts only the supported channel names and returns a sender holding that channel and the exact injected transport. Sending delegates the channel, recipient, and message to the transport and returns its result. Unsupported channels raise ValueError, and transport exceptions propagate unchanged.',
    code: `class Sender:
    def __init__(self, channel, transport):
        self.channel = channel
        self.transport = transport

    def send(self, recipient, message):
        return self.transport.send(self.channel, recipient, message)


def create_sender(channel, transport):
    if channel not in ("email", "sms"):
        raise ValueError("unsupported channel")
    return Sender(channel, transport)`,
    complexity: 'Creating a sender and delegating a send each take O(1) time and O(1) extra space, excluding the transport\'s own work.',
  },
  'patterns-decorator': {
    name: 'Composable logging and retry wrappers',
    explanation: 'Both wrappers expose the same request interface as the underlying client, so they can be nested in either order. Logging calls the supplied function before delegation and propagates errors. Retry makes at most attempts total calls, returning on the first success and re-raising the final exception on exhaustion. An inner logger runs on every attempt; an outer logger runs once per outer request. Only retry operations that are safe to repeat.',
    code: `class LoggingClient:
    def __init__(self, client, log):
        self.client = client
        self.log = log

    def request(self, value):
        self.log(value)
        return self.client.request(value)


class RetryClient:
    def __init__(self, client, attempts):
        self.client = client
        self.attempts = attempts

    def request(self, value):
        for attempt in range(self.attempts):
            try:
                return self.client.request(value)
            except Exception:
                if attempt == self.attempts - 1:
                    raise`,
    complexity: 'For a configured maximum of a attempts, retry takes O(a) time and O(1) extra space, excluding the wrapped calls. Logging adds O(1) time and space per call, excluding the logger and wrapped client.',
  },
};
