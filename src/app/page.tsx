import { redirect } from "next/navigation";
import { countUsers } from "./actions";

export const metadata = {
  title: "Sigma Ahorro",
  description: "Aplicación de finanzas personales con IA",
};

export default async function Home() {
  try {
    const userCount = await countUsers();
    if (userCount === 0) {
      redirect("/setup");
    }
  } catch {
    // Base de datos no inicializada aún; continuar.
  }
  return null;
}