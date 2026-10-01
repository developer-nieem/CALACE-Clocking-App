import { LoginForm } from "@/components/auth/login-form";
import { PwaInstallBanner } from "@/components/layout/pwa-install";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#0D2A43_0%,#163b5c_45%,#F7F8FA_45%)] p-4 sm:p-6">
      <div className="w-full max-w-md space-y-4">
        <PwaInstallBanner />
        <LoginForm />
      </div>
    </div>
  );
}
