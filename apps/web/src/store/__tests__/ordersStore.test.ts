import { beforeEach, describe, expect, it } from "vitest";
import { useOrdersStore, type Order } from "../ordersStore";

const makeOrder = (overrides: Partial<Order> = {}): Order => ({
  id: "local-1",
  market: "BTC-USD",
  side: "buy",
  type: "limit",
  price: 100,
  size: 2,
  status: "pending",
  filledSize: 0,
  createdAt: 1,
  updatedAt: 1,
  source: "optimistic",
  ...overrides,
});

describe("ordersStore lifecycle", () => {
  beforeEach(() => {
    const state = useOrdersStore.getState();
    useOrdersStore.setState({
      ...state,
      openOrders: [],
      isLoading: false,
      error: null,
    });
  });

  it("acknowledges optimistic orders without changing the local id", () => {
    useOrdersStore.setState({ openOrders: [makeOrder()] });

    useOrdersStore.getState().acknowledgeOrder("local-1", "exchange-42");

    const order = useOrdersStore.getState().openOrders[0];
    expect(order.id).toBe("local-1");
    expect(order.exchangeOrderId).toBe("exchange-42");
    expect(order.status).toBe("open");
  });

  it("does not reopen filled orders when an acknowledgement arrives late", () => {
    useOrdersStore.setState({
      openOrders: [makeOrder({ status: "filled", filledSize: 2, exchangeOrderId: "exchange-1" })],
    });

    useOrdersStore.getState().acknowledgeOrder("local-1", "exchange-2");

    const order = useOrdersStore.getState().openOrders[0];
    expect(order.status).toBe("filled");
    expect(order.exchangeOrderId).toBe("exchange-1");
  });

  it("keeps fill progress monotonic when updates arrive out of order", () => {
    useOrdersStore.setState({
      openOrders: [makeOrder({ status: "open", exchangeOrderId: "exchange-1" })],
    });

    useOrdersStore.getState().markOrderFill("local-1", 1.5);
    useOrdersStore.getState().markOrderFill("local-1", 0.25);

    const order = useOrdersStore.getState().openOrders[0];
    expect(order.filledSize).toBe(1.5);
    expect(order.status).toBe("partially_filled");
  });

  it("allows fills to win a cancel race if execution lands first", () => {
    useOrdersStore.setState({
      openOrders: [makeOrder({ status: "cancel_pending", exchangeOrderId: "exchange-1" })],
    });

    useOrdersStore.getState().markOrderFill("local-1", 2);

    const order = useOrdersStore.getState().openOrders[0];
    expect(order.filledSize).toBe(2);
    expect(order.status).toBe("filled");
  });

  it("ignores cancel requests for already terminal orders", () => {
    useOrdersStore.setState({
      openOrders: [makeOrder({ status: "filled", filledSize: 2, exchangeOrderId: "exchange-1" })],
    });

    useOrdersStore.getState().markOrderCancelled("local-1");

    const order = useOrdersStore.getState().openOrders[0];
    expect(order.status).toBe("filled");
  });
});
