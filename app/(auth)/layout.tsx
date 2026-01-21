export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-slate-100">
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-30" />
      {children}
    </div>
  );
}
