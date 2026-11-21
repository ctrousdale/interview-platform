import type { Solution } from './solutions';

export const naivePatterns: Record<string, Solution[]> = {
  'patterns-strategy': [{
    name: 'Shared discounted pricing strategy',
    explanation: 'Use a shared discounted-pricing implementation for the two discounted strategies, while regular pricing handles its own validation. Checkout still delegates to any supplied strategy. This is a straightforward way to share the formula, not an asymptotic improvement over separate implementations.',
    code: `class RegularPricing:
    def price(self, amount):
        if amount < 0:
            raise ValueError("amount must not be negative")
        return amount


class DiscountedPricing:
    def __init__(self, rate):
        self.rate = rate

    def price(self, amount):
        if amount < 0:
            raise ValueError("amount must not be negative")
        return amount * (1 - self.rate)


class SeasonalPricing(DiscountedPricing):
    pass


class MemberPricing(DiscountedPricing):
    pass


class Checkout:
    def __init__(self, strategy):
        self.strategy = strategy

    def total(self, amount):
        return self.strategy.price(amount)`,
    complexity: 'Each built-in price calculation and checkout delegation takes O(1) time and O(1) extra space, excluding a custom strategy’s work.',
  }],
  'patterns-observer': [{
    name: 'Immutable tuple subscriptions',
    explanation: 'Store subscriptions in an immutable tuple. Adding or removing an observer constructs a new tuple, so an update can iterate over the tuple captured at its start even when callbacks change subscriptions. Duplicate subscriptions are ignored, and exceptions are collected without stopping later observers.',
    code: `class OrderService:
    def __init__(self):
        self.observers = ()

    def subscribe(self, observer):
        if observer not in self.observers:
            self.observers = self.observers + (observer,)

    def unsubscribe(self, observer):
        if observer in self.observers:
            index = self.observers.index(observer)
            self.observers = self.observers[:index] + self.observers[index + 1:]

    def update(self, order):
        errors = []
        for observer in self.observers:
            try:
                observer(order)
            except Exception as error:
                errors.append(error)
        return errors`,
    complexity: 'For n observers, subscription and unsubscription take O(n) time and up to O(n) temporary space. An update takes O(n) time excluding callbacks and O(n) space for errors; subscriptions occupy O(n) space. Tuple copies shift the snapshot cost to subscription changes.',
  }],
  'patterns-factory': [{
    name: 'Channel-specific sender factory',
    explanation: 'Choose a separate sender class for each supported channel. Each instance holds the exact injected transport and forwards its channel when sending. This explicit branching is simple for two channels, but adding channels requires another class and branch; it has the same asymptotic cost as a shared sender.',
    code: `class EmailSender:
    def __init__(self, transport):
        self.transport = transport

    def send(self, recipient, message):
        return self.transport.send("email", recipient, message)


class SmsSender:
    def __init__(self, transport):
        self.transport = transport

    def send(self, recipient, message):
        return self.transport.send("sms", recipient, message)


def create_sender(channel, transport):
    if channel == "email":
        return EmailSender(transport)
    if channel == "sms":
        return SmsSender(transport)
    raise ValueError("unsupported channel")`,
    complexity: 'Sender creation and each send take O(1) time and O(1) extra space, excluding transport work.',
  }],
  'patterns-decorator': [{
    name: 'Logging and retry wrappers with final attempt',
    explanation: 'Wrap the client independently for logging and retrying. The retry wrapper makes the first attempts in a loop and makes the final attempt outside the exception handler, allowing its error to propagate naturally. Wrappers compose in either order; retries are appropriate only for operations safe to repeat. This direct implementation has the same asymptotic cost as other bounded retry loops.',
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
        remaining = self.attempts
        while remaining > 1:
            try:
                return self.client.request(value)
            except Exception:
                remaining -= 1
        return self.client.request(value)`,
    complexity: 'For a maximum of a attempts, retry takes O(a) time and O(1) extra space, excluding client work. Logging adds O(1) time and space per call, excluding logger and client work.',
  }],
};
