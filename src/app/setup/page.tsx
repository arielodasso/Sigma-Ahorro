"use client";

import { useState } from "react";
import { redirect } from "next/navigation";

export default function SetupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const form = new FormData(e.target as HTMLFormElement);
      const name = form.get("name") as string;
      const email = form.get("email") as string;
      const password = form.get("password") as string;
      
      // Import server action
      const result = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      }).then((r) => r.json());
      
      if (result.success) {
        redirect("/");
      } else {
        setError(result.error || "Error desconocido");
      }
    } catch (err) {
      setError("Error al conectar con el servidor");
    }
  };

  return (
    <section className="min-h-screen flex items-center justify-center bg-background/80 p-6">
      <div className="bg-white/90 rounded-xl p-8 shadow-xl max-w-md w-full">
        <h2 className="text-2xl font-bold mb-6 text-center">Crear cuenta propietaria</h2>
        <p className="text-gray-600 text-center mb-8">
          Completa los siguientes datos para crear tu cuenta. Esta será la única cuenta propietaria.
        </p>
        {error && (
          <div className="mb-4 p-3 rounded bg-red-100 text-red-800 text-sm">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Nombre</label>
            <input
              type="text"
              name="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value as string)}
              className="w-full rounded border px-3 py-2 focus:ring-primary focus:border-outline"
              placeholder="Tu nombre"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              name="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value as string)}
              className="w-full rounded border px-3 py-2 focus:ring-primary focus:border-outline"
              placeholder="ejemplo@dominio.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Contraseña</label>
            <input
              type="password"
              name="password"
              required
              minLength={10}
              value={password}
              onChange={(e) => setPassword(e.target.value as string)}
              className="w-full rounded border px-3 py-2 focus:ring-primary focus:border-outline"
              placeholder="Mínimo 10 caracteres"
            />
          </div>
          <button
            type="submit"
            className="w-full px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition font-medium"
          >
            Crear cuenta
          </button>
        </form>
      </div>
    </section>
  );
}