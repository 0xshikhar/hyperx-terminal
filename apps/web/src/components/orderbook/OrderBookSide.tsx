import { FixedSizeList, type ListChildComponentProps } from "react-window";
import { OrderBookRow, type OrderBookRowData } from "@/components/orderbook/OrderBookRow";

type OrderBookSideProps = {
  rows: OrderBookRowData[];
  height: number;
};

function RowRenderer({ index, style, data }: ListChildComponentProps<OrderBookRowData[]>) {
  const row = data[index];
  return (
    <div style={style}>
      <OrderBookRow {...row} />
    </div>
  );
}

export function OrderBookSide({ rows, height }: OrderBookSideProps) {
  return (
    <FixedSizeList
      height={height}
      width="100%"
      itemCount={rows.length}
      itemSize={32}
      itemData={rows}
    >
      {RowRenderer}
    </FixedSizeList>
  );
}
