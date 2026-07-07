export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white font-semibold">
            A
          </div>
          <h1 className="text-lg font-semibold text-slate-900">AgileBoard</h1>
          <p className="text-sm text-slate-500">Kanban planning for focused teams</p>
        </div>
        {children}
      </div>
    </div>
  );
}
