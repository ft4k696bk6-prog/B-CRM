type BrandMarkProps = {
  size?: "sm" | "md";
};

export function BrandMark({ size = "md" }: BrandMarkProps) {
  const box = size === "sm" ? "h-10 w-10" : "h-11 w-11";

  return (
    <span
      className={`inline-flex ${box} flex-none items-center justify-center`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 64 64"
        role="img"
        className="h-full w-full"
        focusable="false"
      >
        <rect x="2" y="2" width="60" height="60" rx="14" fill="#101722" />
        <path
          d="M20 14v36h17c8 0 13-4 13-10 0-5.2-4.1-9-10.5-9H20m0-17h15c7.1 0 11 3.7 11 8.8 0 5-3.9 8.2-11 8.2H20"
          fill="none"
          stroke="#F7FBFF"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M16 22h8m-8 10h8m-8 10h8"
          fill="none"
          stroke="#16C7FF"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="15" cy="22" r="3" fill="#16C7FF" />
        <circle cx="15" cy="32" r="3" fill="#16C7FF" />
        <circle cx="15" cy="42" r="3" fill="#16C7FF" />
      </svg>
    </span>
  );
}
