"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Terminal, Lock, User, AlertCircle } from 'lucide-react';
import { signIn } from '@/lib/auth-service';
import { cn } from '@/lib/utils';

export default function LoginForm() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Intentamos iniciar sesión con Firebase Auth
            const { metadata } = await signIn(username, password);

            if (metadata) {
                router.push('/procesos');
            } else {
                setError('El usuario no tiene un rol asignado en el sistema.');
            }
        } catch (err: any) {
            console.error('Login error:', err);
            if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                setError('Correo o contraseña incorrectos');
            } else {
                setError('Error al conectar con el servidor: ' + err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md space-y-8 glass p-10 rounded-2xl shadow-2xl transition-all duration-300 hover:shadow-primary-blue/10">
            <div className="text-center">
                <div className="mx-auto h-16 w-16 bg-primary-blue/20 rounded-full flex items-center justify-center mb-4">
                    <Terminal className="h-8 w-8 text-primary-blue" />
                </div>
                <h2 className="text-3xl font-extrabold tracking-tight text-white">
                    Monitor de Línea
                </h2>
                <p className="mt-2 text-sm text-gray-400 font-medium">
                    Ingrese sus credenciales para continuar
                </p>
            </div>

            <form className="mt-8 space-y-6" onSubmit={handleLogin}>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-1" htmlFor="username">
                            Correo Electrónico
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <User className="h-5 w-5 text-gray-500" />
                            </div>
                            <input
                                id="username"
                                name="username"
                                type="email"
                                required
                                className="block w-full pl-10 pr-3 py-3 border border-white/10 rounded-xl bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-blue/50 focus:border-primary-blue transition-all duration-200"
                                placeholder="usuario@tuempresa.com"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-1" htmlFor="password">
                            Contraseña
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Lock className="h-5 w-5 text-gray-500" />
                            </div>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                className="block w-full pl-10 pr-3 py-3 border border-white/10 rounded-xl bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-blue/50 focus:border-primary-blue transition-all duration-200"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="flex items-center space-x-2 bg-danger-red/10 border border-danger-red/20 p-3 rounded-xl animate-pulse-soft">
                        <AlertCircle className="h-5 w-5 text-danger-red" />
                        <p className="text-sm text-danger-red font-medium">{error}</p>
                    </div>
                )}

                <div>
                    <button
                        type="submit"
                        disabled={loading}
                        className={cn(
                            "group relative w-full flex justify-center py-4 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-primary-blue hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-blue transition-all duration-200 shadow-lg shadow-primary-blue/20",
                            loading && "opacity-70 cursor-not-allowed"
                        )}
                    >
                        {loading ? "Iniciando sesión..." : "INGRESAR AL SISTEMA"}
                    </button>
                </div>
            </form>
        </div>
    );
}
