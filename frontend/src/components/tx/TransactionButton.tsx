"use client";

import type { ReactNode, MouseEvent } from "react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TransactionButtonProps {
  children: ReactNode;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Reusable button for blockchain write actions.
 *
 * Integrates with the VenueFi design system:
 * - Dark background, light text, subtle hover
 * - Disabled state: reduced opacity + not-allowed cursor
 * - Loading state: inline spinner replaces interactivity
 */
export function TransactionButton({
  children,
  onClick,
  disabled = false,
  loading = false,
  className = "",
}: TransactionButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`
        w-full inline-flex items-center justify-center gap-2.5
        rounded-sm bg-[#1E1E1B] px-8 py-3.5
        text-[15px] font-normal text-[#F6F1E8] tracking-wide
        transition-colors duration-200 font-sans
        ${isDisabled ? "cursor-not-allowed opacity-60" : "hover:bg-[#3A3A35] cursor-pointer"}
        ${className}
      `.trim()}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Inline spinner — no external dependencies
// ---------------------------------------------------------------------------

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-current"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
