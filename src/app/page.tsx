import { redirect } from "next/navigation";

export const metadata = {
  title: "Sigma Ahorro",
  description: "Aplicación de finanzas personales con IA",
};

export default async function Home() {
  redirect("/dashboard");
}
