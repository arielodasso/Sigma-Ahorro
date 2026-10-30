import { notFound } from "next/navigation";
import { redirect } from "next/navigation";

export default function LoginPage() {
  return (
    <section className="min-h-screen flex items-center justify-center bg-background/80 p-6">
      <div className="bg-white/90 rounded-xl p-8 shadow-xl max-w-md w-full">
        <h2 className="text-2xl font-bold mb-6 text-center">Iniciar sesión</h2>
        <p className="text-gray-600 text-center mb-8">
          No hay cuentas registradas. Completa el <a href="/setup" className="underline">setup</a> para crear tu cuenta.
        </p>
        <div className="text-center">
          <a href="/setup" className="inline-block px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition">
            Ir al setup
          </a>
        </div>
      </div>
    </section>
  );
}