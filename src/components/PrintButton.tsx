"use client";

export function PrintButton() {
  return (
    <button type="button" className="secondary" onClick={() => window.print()}>
      Print / PDF
    </button>
  );
}
