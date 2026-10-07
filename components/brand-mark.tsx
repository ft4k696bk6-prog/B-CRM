type BrandMarkProps = {
  size?: "sm" | "md";
};

export function BrandMark({ size = "md" }: BrandMarkProps) {
  const box = size === "sm" ? "h-10 w-10" : "h-11 w-11";
  const pixels = size === "sm" ? 40 : 44;

  return (
    <span
      className={`inline-flex ${box} flex-none items-center justify-center`}
      aria-hidden="true"
    >
      <img
        src="/icons/bcrm-logo-transparent.png"
        alt=""
        width={pixels}
        height={pixels}
        draggable={false}
        className="h-full w-full object-contain"
        style={{ filter: "drop-shadow(0 1px 1px rgba(15, 23, 42, 0.45))" }}
      />
    </span>
  );
}
