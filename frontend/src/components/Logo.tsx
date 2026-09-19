export function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M32 4c12 6 20 8 24 8v20c0 14.5-9.8 24.4-24 28-14.2-3.6-24-13.5-24-28V12c4 0 12-2 24-8z" fill="currentColor" className="text-navy-900 dark:text-navy-900" stroke="hsl(var(--primary))" strokeWidth="2.4"/>
      <path d="M22 30c0-6 4.5-10 10-10s10 4 10 10v10H22V30z" stroke="hsl(var(--primary))" strokeWidth="2"/>
      <circle cx="28" cy="30" r="1.4" fill="hsl(var(--primary))"/>
      <circle cx="36" cy="30" r="1.4" fill="hsl(var(--primary))"/>
      <path d="M22 34h20M18 32h4M42 32h4M20 40h4M40 40h4" stroke="hsl(var(--primary))" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M44 16l1.6 3.4L49 21l-3.4 1.6L44 26l-1.6-3.4L39 21l3.4-1.6L44 16z" fill="hsl(var(--primary))"/>
    </svg>
  );
}

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Logo />
      <div className={compact ? "hidden md:block" : ""}>
        <div className="text-sm font-semibold tracking-tight">BugPilot AI</div>
        <div className="text-xs text-muted-foreground">Your AI QA Engineer</div>
      </div>
    </div>
  );
}
