import { CreditCard } from "lucide-react";

/** Recognisable marks for the seeded merchants; a card icon for everything else. */
export function MerchantLogo({
  name,
  small = false,
}: {
  name: string;
  small?: boolean;
}) {
  const key = name.toLowerCase();
  return (
    <span
      className={`merchant-logo ${small ? "small" : ""} logo-${key.includes("amazon") ? "aws" : key.split(" ")[0]}`}
    >
      {key.includes("netflix") ? (
        <b className="netflix-n">N</b>
      ) : key.includes("spotify") ? (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="16" r="14" fill="#1ed760" />
          <path
            d="M8 12c6-2 12-1 17 2M9 17c5-2 10-1 14 1M11 21c4-1 7-1 10 1"
            fill="none"
            stroke="#14271c"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      ) : key.includes("chatgpt") ? (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <g stroke="currentColor" strokeWidth="1.7" fill="none">
            {[0, 60, 120].map((n) => (
              <path
                key={n}
                transform={`rotate(${n} 16 16)`}
                d="M11 7c-5 0-7 7-3 10l11 6c5 0 7-7 3-10L11 7Z"
              />
            ))}
          </g>
        </svg>
      ) : key.includes("amazon") ? (
        <span className="aws-logo">
          aws
          <svg viewBox="0 0 40 12">
            <path
              d="M3 2c10 9 24 6 33 0m-5 0h6v5"
              fill="none"
              stroke="#ffb75e"
              strokeWidth="2"
            />
          </svg>
        </span>
      ) : key.includes("canva") ? (
        <span className="canva-c">C</span>
      ) : key.includes("youtube") ? (
        <svg viewBox="0 0 32 32">
          <rect x="2" y="6" width="28" height="20" rx="6" fill="#ff4343" />
          <path d="m13 11 9 5-9 5" fill="white" />
        </svg>
      ) : (
        <CreditCard size={22} />
      )}
    </span>
  );
}
