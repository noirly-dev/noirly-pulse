type PublishInput = {
  channel: string;
  event: string;
  data: unknown;
  ephemeral?: boolean;
};

export async function publishRealtime(input: PublishInput): Promise<void> {
  const base = process.env.REALTIME_INTERNAL_URL;
  const secret =
    process.env.REALTIME_INTERNAL_SECRET ?? process.env.REALTIME_JWT_SECRET;
  if (!base || !secret) return;

  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/internal/publish`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      console.error("realtime publish failed", res.status, await res.text());
    }
  } catch (error) {
    console.error("realtime publish error", error);
  }
}
