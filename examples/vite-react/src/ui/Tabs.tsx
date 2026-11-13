import * as s from "./Tabs.styles.js";

type TabsProps<T extends string> = {
  value: T;
  onChange: (next: T) => void;
  items: readonly { id: T; label: string }[];
};

export function Tabs<T extends string>({ value, onChange, items }: TabsProps<T>) {
  return (
    <div role="tablist" className={s.list}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={item.id === value}
          className={s.tab}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
