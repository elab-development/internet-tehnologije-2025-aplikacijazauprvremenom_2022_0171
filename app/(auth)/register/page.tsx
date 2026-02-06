import { RegisterForm } from "@/components/register-form";

export default function Page() {
  return (
    <main className="relative flex min-h-svh w-full items-center justify-center overflow-hidden p-6 md:p-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,oklch(0.78_0.12_200/.28),transparent_45%),radial-gradient(circle_at_bottom_right,oklch(0.82_0.12_95/.22),transparent_40%)]" />
      <div className="grid w-full max-w-5xl gap-4 md:grid-cols-[1fr_420px]">
        <section className="hidden rounded-2xl border bg-background/70 p-8 backdrop-blur md:flex md:flex-col md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Time Manager
            </p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight">
              Build your planning hub and start tracking tasks instantly.
            </h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Create your account to manage lists, assign priorities, and plan by calendar.
          </p>
        </section>
        <div className="w-full md:max-w-[420px]">
          <RegisterForm />
        </div>
      </div>
    </main>
  );
}
