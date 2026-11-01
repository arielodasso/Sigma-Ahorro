import { redirect } from "next/navigation";
import { countUsers } from "./actions";

export const metadata = {
  title: "Sigma Ahorro",
  description: "Aplicación de finanzas personales con IA",
};

export default async function Home() {
  try {
    // Try to count users in DB
    const userCount = await countUsers();
    if (userCount > 0) {
      redirect("/dashboard");
    }
    // No users in DB - check if onboarding was completed locally
    const completed = typeof window !== "undefined" && localStorage.getItem("sigma-onboarding-completed") === "1";
    if (completed) {
      redirect("/dashboard");
    }
    redirect("/setup");
  } catch {
    // If DB check fails, check localStorage
    if (typeof window !== "undefined" && localStorage.getItem("sigma-onboarding-completed") === "1") {
      redirect("/dashboard");
    } else {
      redirect("/setup");
    }
  }
}
