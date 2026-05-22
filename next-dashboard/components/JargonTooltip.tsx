type JargonTooltipProps = {
  /**
   * Short label used by screen readers so the tooltip is understandable
   * without relying only on the visible question-mark icon.
   */
  term: string;

  /**
   * Beginner-friendly explanation. Keep this short enough to scan quickly.
   */
  explanation: string;
};

export function JargonTooltip({ term, explanation }: JargonTooltipProps) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 outline-none ring-offset-2 transition hover:bg-teal-50 hover:text-teal-700 focus:ring-2 focus:ring-teal-600"
        aria-label={`${term}: ${explanation}`}
      >
        ?
      </button>

      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-7 z-20 hidden w-64 -translate-x-1/2 rounded-md border border-slate-200 bg-white p-3 text-left text-xs font-medium leading-5 text-slate-700 shadow-lg group-hover:block group-focus-within:block"
      >
        {explanation}
      </span>
    </span>
  );
}
