export function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <div
      className="grid shrink-0 place-items-center rounded-[30%] bg-primary text-primary-foreground"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        width={size * 0.6}
        height={size * 0.6}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 6h14v9H11l-4 3v-3H5z" />
        <path d="M9 10.5h6" />
      </svg>
    </div>
  );
}
