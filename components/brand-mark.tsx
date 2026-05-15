type BrandMarkProps = {
  size?: "sm" | "md";
};

export function BrandMark({ size = "md" }: BrandMarkProps) {
  const box = size === "sm" ? "h-10 w-10" : "h-11 w-11";
  const text = size === "sm" ? "text-xl" : "text-2xl";

  return (
    <span
      className={`relative flex ${box} items-center justify-center overflow-hidden rounded-xl border border-leaf/25 bg-[#050b09] shadow-[0_16px_38px_rgba(0,0,0,0.32)]`}
      aria-hidden="true"
    >
      <span className="absolute inset-x-2 top-1 h-px rounded-full bg-leaf/70" />
      <span className="absolute bottom-0 h-7 w-7 rounded-full bg-leaf/10 blur-md" />
      <span className={`${text} font-black leading-none tracking-tight text-leaf`}>B</span>
    </span>
  );
}
