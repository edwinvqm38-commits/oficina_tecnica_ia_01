import { aiSummaryMock } from "@/lib/ai-office/aiSummaryMock";

const summaryStyles = [
  "border-l-blue-600 bg-blue-50/40",
  "border-l-sky-500 bg-sky-50/40",
  "border-l-orange-500 bg-orange-50/40",
  "border-l-violet-500 bg-violet-50/40",
];

export function AIStatusSummary() {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {aiSummaryMock.map((item, index) => (
        <article
          key={item.id}
          className={`rounded-lg border border-l-4 border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${summaryStyles[index % summaryStyles.length]}`}
        >
          <p className="text-sm font-medium text-slate-500">{item.label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">
            {item.value}
          </p>
          <p className="mt-1 text-sm text-slate-500">{item.detail}</p>
        </article>
      ))}
    </section>
  );
}
