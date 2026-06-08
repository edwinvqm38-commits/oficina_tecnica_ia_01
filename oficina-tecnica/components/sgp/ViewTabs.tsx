"use client";

type ViewTabsProps = {
  tabs: string[];
  active: string;
  onSelect: (tab: string) => void;
};

export function ViewTabs({ tabs, active, onSelect }: ViewTabsProps) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-panel p-1">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onSelect(tab)}
          className={`rounded-md px-3 py-1.5 text-sm ${
            active === tab ? "bg-stone-100 text-text" : "text-muted"
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
