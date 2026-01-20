import LoginForm from '@/components/auth/LoginForm';

export default function LoginPage() {
    return (
        <main className="min-h-screen flex flex-col items-center justify-center bg-background px-4 sm:px-6 lg:px-8 relative overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary-blue/10 rounded-full blur-3xl animate-pulse" />
            <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-accent-purple/10 rounded-full blur-3xl animate-pulse" />

            <div className="z-10 w-full flex flex-col items-center">
                <LoginForm />

                <p className="mt-8 text-center text-xs text-gray-500 uppercase tracking-[0.2em] font-medium">
                    Sistema de Monitoreo de Producción v2.0
                </p>
            </div>
        </main>
    );
}
