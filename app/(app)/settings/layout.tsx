import { PageContainer, PageHeader } from "@noirly-dev/ui";
import { SettingsNav } from "@/src/features/settings/SettingsNav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageContainer size="md" className="space-y-6 py-10">
      <PageHeader kicker="Account" title="Settings" />
      <SettingsNav />
      {children}
    </PageContainer>
  );
}
