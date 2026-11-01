"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SetupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const form = new FormData(e.target as HTMLFormElement);
      const nameVal = form.get("name") as string;
      const emailVal = form.get("email") as string;
      const passwordVal = form.get("password") as string;
      
      const result = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameVal, email: emailVal, password: passwordVal }),
      }).then((r) => r.json());
      
      if (result.success) {
        router.push("/");
        router.refresh();
      } else {
        setError(result.error || "Error desconocido");
      }
    } catch (err) {
      setError("Error al conectar con el servidor");
    }
  };

  return (
    <section className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="bg-card text-card-foreground rounded-xl p-8 shadow-lg border border-border max-w-md w-full">
        <h1 className="text-2xl font-bold mb-2 text-center">Crear cuenta propietaria</h1>
        <p className="text-muted-foreground text-center mb-6">
          Completa los siguientes datos para crear tu cuenta. Esta será la única cuenta propietaria.
        </p>
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 text-sm">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-2 text-foreground">Nombre</label>
            <input
              id="name"
              type="text"
              name="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
              placeholder="Tu nombre"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2 text-foreground">Email</label>
            <input
              id="email"
              type="email"
              name="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
              placeholder="ejemplo@dominio.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-2 text-foreground">Contraseña</label>
            <input
              id="password"
              type="password"
              name="password"
              required
              minLength={10}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
              placeholder="Mínimo 10 caracteres"
            />
          </div>
          <button
            type="submit"
            className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition font-medium focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            Crear cuenta
          </button>
        </form>
      </div>
    </section>
  );
}