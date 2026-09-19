import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Badge } from "@/components/ui/badge";
import { formatMs } from "@/lib/utils";

export function ApiDetailPage() {
  const { requestId } = useParams();
  const { data } = useQuery({ queryKey: ["api-request", requestId], queryFn: () => api<any>(`/api-requests/${requestId}`) });
  const item = data?.data;
  if (!item) return <p>Loading API evidence…</p>;

  return (
    <div className="space-y-6">
      <div>
        <p className="page-subtitle">Captured application API</p>
        <h1 className="page-title">{item.method} {item.endpoint}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{item.url}</p>
      </div>
      <div className="flex gap-2">
        <Badge>{item.response?.status ?? "no status"}</Badge>
        <Badge tone={item.result === "success" ? "success" : "danger"}>{item.result}</Badge>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Block title="Request headers" value={item.request?.headers} />
        <Block title="Request body" value={item.request?.body} />
        <Block title="Response headers" value={item.response?.headers} />
        <Block title="Response body" value={item.response?.body} />
      </div>
      <div className="stat-card grid gap-3 md:grid-cols-5 text-sm">
        <Metric label="DNS" value={formatMs(item.timing?.dnsMs)} />
        <Metric label="Connect" value={formatMs(item.timing?.connectMs)} />
        <Metric label="TTFB" value={formatMs(item.timing?.ttfbMs)} />
        <Metric label="Download" value={formatMs(item.timing?.downloadMs)} />
        <Metric label="Total" value={formatMs(item.timing?.durationMs)} />
      </div>
      <div className="stat-card text-sm space-y-2">
        <div>Related page: {item.pageUrl || "—"}</div>
        <div>AI analysis: {item.aiAnalysis?.issue || "No suspicious pattern flagged."}</div>
      </div>
    </div>
  );
}

function Block({ title, value }: { title: string; value: unknown }) {
  return (
    <section className="stat-card">
      <h2 className="mb-2 font-medium">{title}</h2>
      <pre className="overflow-auto text-xs">{JSON.stringify(value ?? {}, null, 2)}</pre>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}
