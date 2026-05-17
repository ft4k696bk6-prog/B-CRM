type BrandMarkProps = {
  size?: "sm" | "md";
};

export function BrandMark({ size = "md" }: BrandMarkProps) {
  const box = size === "sm" ? "h-10 w-10" : "h-11 w-11";

  return (
    <span
      className={`relative flex ${box} items-center justify-center overflow-hidden rounded-lg bg-[#111722] shadow-sm ring-1 ring-[#d7ad55]/25`}
      aria-hidden="true"
    >
      <span className="absolute inset-0 bg-[linear-gradient(145deg,#202a3b_0%,#0e131d_58%,#273145_100%)]" />
      <span className="absolute left-1.5 top-1.5 h-3 w-3 rounded-sm border-l border-t border-[#f1ca75]/80" />
      <span className="absolute bottom-1.5 right-1.5 h-3 w-3 rounded-sm border-b border-r border-[#b8832f]/80" />
      <svg viewBox="0 0 64 64" className="relative h-[72%] w-[72%]" role="img" aria-label="B-CRM">
        <path
          d="M17 12h18.5c8.7 0 14.4 4.4 14.4 11.8 0 4.6-2.3 8.1-6.4 10 5.1 1.8 7.8 5.8 7.8 11.3 0 8-6.3 12.9-15.9 12.9H17V12Z"
          fill="#f1c76f"
        />
        <path d="M25.5 20v10.2h9.1c4.5 0 7-1.8 7-5.2 0-3.2-2.4-5-6.9-5h-9.2Z" fill="#111722" />
        <path d="M25.5 38v11.5h10.4c5 0 7.6-2 7.6-5.7 0-3.8-2.7-5.8-7.8-5.8H25.5Z" fill="#111722" />
        <path d="M13.5 52.5h34.8" stroke="#ffffff" strokeOpacity="0.72" strokeWidth="2.8" strokeLinecap="round" />
      </svg>
    </span>
  );
}
