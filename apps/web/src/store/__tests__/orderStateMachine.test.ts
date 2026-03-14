import { describe, expect, it } from "vitest";
import {
  createDraftOrder,
  orderReducer,
  transitions,
  type Order,
  type OrderEvent,
} from "../../hooks/useOrderStateMachine";

const makeOrder = (): Order =>
  createDraftOrder({
    side: "buy",
    size: 1,
    price: 100,
    type: "limit",
  });

describe("orderReducer", () => {
  it("transitions draft -> pending on submit", () => {
    const next = orderReducer(makeOrder(), { type: "SUBMIT" });
    expect(next.state).toBe("pending");
  });

  it("transitions pending -> open on accepted", () => {
    const draft = makeOrder();
    const originalId = draft.id;
    const pending = orderReducer(draft, { type: "SUBMIT" });
    const next = orderReducer(pending, { type: "ACCEPTED", orderId: "ex-1" });
    expect(next.state).toBe("open");
    expect(next.id).toBe(originalId);
    expect(next.exchangeOrderId).toBe("ex-1");
  });

  it("transitions open -> partially_filled on partial fill", () => {
    const open = orderReducer(
      orderReducer(makeOrder(), { type: "SUBMIT" }),
      { type: "ACCEPTED", orderId: "ex-1" }
    );
    const next = orderReducer(open, {
      type: "FILL",
      filledSize: 0.4,
      totalSize: 1,
    });
    expect(next.state).toBe("partially_filled");
    expect(next.filledSize).toBe(0.4);
  });

  it("transitions open -> filled on complete fill", () => {
    const open = orderReducer(
      orderReducer(makeOrder(), { type: "SUBMIT" }),
      { type: "ACCEPTED", orderId: "ex-1" }
    );
    const next = orderReducer(open, {
      type: "FILL",
      filledSize: 1,
      totalSize: 1,
    });
    expect(next.state).toBe("filled");
    expect(next.filledSize).toBe(1);
  });

  it("transitions to cancel_pending and then cancelled", () => {
    const open = orderReducer(
      orderReducer(makeOrder(), { type: "SUBMIT" }),
      { type: "ACCEPTED", orderId: "ex-1" }
    );
    const cancelPending = orderReducer(open, { type: "CANCEL" });
    const cancelled = orderReducer(cancelPending, { type: "CANCELLED" });
    expect(cancelPending.state).toBe("cancel_pending");
    expect(cancelled.state).toBe("cancelled");
  });

  it("transitions pending -> rejected", () => {
    const pending = orderReducer(makeOrder(), { type: "SUBMIT" });
    const rejected = orderReducer(pending, {
      type: "REJECTED",
      reason: "Insufficient margin",
    });
    expect(rejected.state).toBe("rejected");
    expect(rejected.rejectReason).toBe("Insufficient margin");
  });

  it("returns same state for invalid transitions", () => {
    const draft = makeOrder();
    const next = orderReducer(draft, { type: "CANCEL" });
    expect(next).toEqual(draft);
  });

  it("caps overfills at total size", () => {
    const open = orderReducer(
      orderReducer(makeOrder(), { type: "SUBMIT" }),
      { type: "ACCEPTED", orderId: "ex-1" }
    );
    const next = orderReducer(open, {
      type: "FILL",
      filledSize: 3,
      totalSize: 1,
    });
    expect(next.state).toBe("filled");
    expect(next.filledSize).toBe(1);
  });
});

describe("transitions", () => {
  it("covers all known order states", () => {
    expect(Object.keys(transitions).sort()).toEqual([
      "cancel_pending",
      "cancelled",
      "draft",
      "filled",
      "open",
      "partially_filled",
      "pending",
      "rejected",
    ]);
  });

  it("only uses supported events in the transition table", () => {
    const validEvents: OrderEvent["type"][] = [
      "SUBMIT",
      "ACCEPTED",
      "FILL",
      "CANCEL",
      "CANCELLED",
      "REJECTED",
      "RESET",
    ];

    Object.values(transitions).forEach((mapping) => {
      Object.keys(mapping).forEach((event) => {
        expect(validEvents).toContain(event as OrderEvent["type"]);
      });
    });
  });
});
