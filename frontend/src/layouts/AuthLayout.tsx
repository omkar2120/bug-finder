import { Outlet } from "react-router-dom";
import { BrandMark } from "@/components/Logo";

export function AuthLayout() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-navy-950 p-10 lg:flex">
        <BrandMark />
        <div className="max-w-md">
          <h1 className="text-3xl font-semibold leading-tight">An AI QA engineer that tests with evidence, not guesses.</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Discover authorized applications, execute Playwright tests, capture APIs, and confirm real bugs — then persist every finding in MongoDB.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">Only test applications you own or are authorized to assess.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
