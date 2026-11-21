"""Structured inputs for the canonical design-pattern cases."""

CANONICAL_INPUTS = {
    "patterns-strategy": [
        {"scenarios": [
            {"strategy": "regular", "amount": 100},
            {"strategy": "seasonal", "rate": 0.2, "amount": 100},
            {"strategy": "member", "rate": 0.5, "amount": 80},
        ]},
        {"strategy": "custom", "custom_strategy": {"operation": "add", "offset": 7}, "amount": 5},
        {"scenarios": [
            {"strategy": "regular", "amount": -1},
            {"strategy": "seasonal", "rate": 0.2, "amount": -1},
            {"strategy": "member", "rate": 0.1, "amount": -1},
        ]},
        {"scenarios": [
            {"strategy": "seasonal", "rate": 0, "amount": 0},
            {"strategy": "member", "rate": 1, "amount": 20},
        ]},
    ],
    "patterns-observer": [
        {"observers": {"email": None, "inventory": None}, "operations": [
            {"action": "subscribe", "observer": "email"},
            {"action": "subscribe", "observer": "inventory"},
            {"action": "update", "order": "paid"},
        ]},
        {"observers": {"obs": None}, "operations": [
            {"action": "subscribe", "observer": "obs"},
            {"action": "subscribe", "observer": "obs"},
            {"action": "update", "order": 1},
            {"action": "unsubscribe", "observer": "obs"},
            {"action": "unsubscribe", "observer": "obs"},
            {"action": "update", "order": 2},
        ]},
        {"observers": {"bad": {"raises": {"type": "ValueError", "message": "bad"}}, "good": None}, "operations": [
            {"action": "subscribe", "observer": "bad"},
            {"action": "subscribe", "observer": "good"},
            {"action": "update", "order": "new"},
        ]},
        {"observers": {"a": None, "b": None}, "operations": [
            {"action": "subscribe", "observer": "a"},
            {"action": "subscribe", "observer": "b"},
            {"action": "unsubscribe", "observer": "a"},
            {"action": "subscribe", "observer": "a"},
            {"action": "update", "order": {}},
        ]},
    ],
    "patterns-factory": [
        {"channel": "email", "transport": {"records_calls": True, "returns": "sent"}, "recipient": "alice@example.com", "message": "hello"},
        {"channel": "sms", "transport": {"returns": "arguments"}, "recipient": "123", "message": "hi"},
        {"channel": "push", "transport": {"type": "object"}},
        {"channel": "email", "transport": {"raises": {"type": "RuntimeError", "message": "offline"}}, "recipient": "a", "message": "b"},
    ],
    "patterns-decorator": [
        {"decorators": ["logging"], "client": {"operation": "uppercase"}, "value": "hi"},
        {"decorators": ["retry"], "attempts": 3, "client": {"failures": [
            {"type": "ValueError", "message": "retry"},
            {"type": "ValueError", "message": "retry"},
        ], "returns": "input"}, "value": "ok"},
        {"scenarios": [
            {"decorators": ["retry", "logging"], "attempts": 3, "client": {"failures": [
                {"type": "ValueError", "message": "retry"},
                {"type": "ValueError", "message": "retry"},
            ], "returns": "input"}, "value": "x"},
            {"decorators": ["logging", "retry"], "attempts": 3, "client": {"failures": [
                {"type": "ValueError", "message": "retry"},
                {"type": "ValueError", "message": "retry"},
            ], "returns": "input"}, "value": "x"},
        ]},
        {"decorators": ["retry"], "attempts": 2, "client": {"failures": [
            {"type": "ValueError", "message": "1"},
            {"type": "ValueError", "message": "2"},
        ]}, "value": "x"},
    ],
}
