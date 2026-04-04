import StaffCheckInClient from "@/components/StaffCheckInClient";

interface CheckInPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function StaffCheckInPage({ searchParams }: CheckInPageProps) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";

  return (
    <main className="min-h-screen bg-slate-100 py-6">
      <StaffCheckInClient initialToken={token} />
    </main>
  );
}
