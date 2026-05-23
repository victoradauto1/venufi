interface StatProps {
  label: string;
  value: string;
}

export function Stat({ label, value }: StatProps) {
  return (
    <div>
      <p className="text-[13px] text-text-tertiary mb-2 font-sans tracking-wide uppercase">
        {label}
      </p>
      <p className="text-xl font-light text-text-primary font-serif tracking-tight">
        {value}
      </p>
    </div>
  );
}
