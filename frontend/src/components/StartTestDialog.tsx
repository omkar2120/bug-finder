import { FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import { APP_ENVS, ENV_LABELS, envUrl, envUrls, normalizeEnv, type AppEnv } from "@/lib/environments";

export type StartTestPayload = {
  watchBrowser: boolean;
  environment: AppEnv;
  captureScreenshots: boolean;
  focusMode: "full" | "page" | "validation" | "flow";
  focusPages: string[];
  instructions: string;
  customCases: string[];
};

const MODES: Array<{ id: StartTestPayload["focusMode"]; label: string; hint: string }> = [
  { id: "full", label: "Whole app", hint: "Discover pages and generate a broad suite" },
  { id: "page", label: "These pages only", hint: "Stay on the URLs you list" },
  { id: "validation", label: "Validations", hint: "Empty fields, invalid formats, required errors" },
  { id: "flow", label: "This flow", hint: "Follow the journey you describe" },
];

export function StartTestDialog({
  application,
  starting,
  defaultWatch = true,
  defaultCaptureScreenshots = false,
  onClose,
  onStart,
}: {
  application?: {
    baseUrl?: string;
    environment?: string;
    environments?: Partial<Record<AppEnv, { url?: string }>>;
  };
  starting?: boolean;
  defaultWatch?: boolean;
  defaultCaptureScreenshots?: boolean;
  onClose: () => void;
  onStart: (payload: StartTestPayload) => void;
}) {
  const urls = envUrls(application);
  const [focusMode, setFocusMode] = useState<StartTestPayload["focusMode"]>("page");
  const [watchBrowser, setWatchBrowser] = useState(defaultWatch);
  const [captureScreenshots, setCaptureScreenshots] = useState(defaultCaptureScreenshots);
  const [environment, setEnvironment] = useState<AppEnv>(() => {
    const preferred = normalizeEnv(application?.environment);
    if (urls[preferred]) return preferred;
    return APP_ENVS.find((env) => urls[env]) ?? preferred;
  });
  const selectedUrl = useMemo(() => envUrl(application, environment), [application, environment]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const focusPages = String(form.get("focusPages") || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const customCases = String(form.get("customCases") || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    onStart({
      watchBrowser,
      environment,
      captureScreenshots,
      focusMode,
      focusPages,
      instructions: String(form.get("instructions") || "").trim(),
      customCases,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <form onSubmit={submit} className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-2xl border bg-card p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Tell the AI what to test</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose PROD, QA, or UAT. BugPilot opens that environment’s URL, not the others.
            </p>
          </div>
          <Button type="button" variant="ghost" onClick={onClose}>Close</Button>
        </div>

        <div className="mt-5">
          <Label>Environment</Label>
          <select
            value={environment}
            onChange={(event) => setEnvironment(event.target.value as AppEnv)}
            className="mt-2 h-10 w-full rounded-lg border bg-background px-3 text-sm"
          >
            {APP_ENVS.map((env) => (
              <option key={env} value={env} disabled={!urls[env]}>
                {ENV_LABELS[env]} — {urls[env] || "no URL yet"}
              </option>
            ))}
          </select>
          <p className="mt-2 text-sm text-muted-foreground">
            This run will open <span className="font-medium text-foreground">{selectedUrl || "no URL for this environment"}</span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => setWatchBrowser((value) => !value)}
          className={`mt-5 w-full rounded-2xl border p-4 text-left ${watchBrowser ? "border-primary bg-primary/10" : "hover:bg-muted/40"}`}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Watch live in Chrome</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Playwright opens Google Chrome on this Mac. You will see every page, click, and form fill. This BugPilot tab also shows the current test and URL.
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${watchBrowser ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              {watchBrowser ? "On" : "Off"}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setCaptureScreenshots((value) => !value)}
          className={`mt-3 w-full rounded-2xl border p-4 text-left ${captureScreenshots ? "border-primary bg-primary/10" : "hover:bg-muted/40"}`}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Capture page screenshots</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Optional. Leave this off while watching live so Chrome does not flash. Failed tests and bugs still get a screenshot.
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${captureScreenshots ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              {captureScreenshots ? "On" : "Off"}
            </span>
          </div>
        </button>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setFocusMode(mode.id)}
              className={`rounded-xl border p-3 text-left ${focusMode === mode.id ? "border-primary bg-primary/10" : "hover:bg-muted/40"}`}
            >
              <div className="text-sm font-medium">{mode.label}</div>
              <div className="mt-1 text-xs text-muted-foreground">{mode.hint}</div>
            </button>
          ))}
        </div>

        <div className="mt-5">
          <Label>Pages to test (one URL or path per line)</Label>
          <Textarea
            name="focusPages"
            className="mt-2 font-mono text-sm"
            rows={3}
            placeholder={`${selectedUrl || "https://app.example.com"}/signup\n/login`}
          />
        </div>

        <div className="mt-4">
          <Label>What should the AI check?</Label>
          <Textarea
            name="instructions"
            className="mt-2"
            rows={4}
            placeholder="Check form validations: required name, empty submit, invalid email, password mismatch. Then one valid submit stays on this domain."
          />
        </div>

        <div className="mt-4">
          <Label>Optional test cases (one per line)</Label>
          <Textarea
            name="customCases"
            className="mt-2"
            rows={4}
            placeholder={"Submit empty form → show field errors\nType not-an-email → email validation message\nValid signup → lands on /dashboard"}
          />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={starting || !selectedUrl}>{starting ? "Queuing…" : "Start this test"}</Button>
        </div>
      </form>
    </div>
  );
}
