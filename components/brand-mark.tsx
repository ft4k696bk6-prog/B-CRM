type BrandMarkProps = {
  size?: "sm" | "md";
};

export function BrandMark({ size = "md" }: BrandMarkProps) {
  const box = size === "sm" ? "h-10 w-10" : "h-11 w-11";
  const text = size === "sm" ? "text-xl" : "text-2xl";

  return (
    <span
      className={`relative flex ${box} items-center justify-center overflow-hidden rounded-lg bg-[#10131a] shadow-sm`}
      aria-hidden="true"
    >
      <span className="absolute inset-x-2 top-1 h-1 rounded-full bg-solar/80" />
      <span className={`${text} font-black leading-none text-solar`}>B</span>
    </span>
  );
}
