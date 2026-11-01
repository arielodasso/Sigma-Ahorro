import { NextResponse } from "next/server";
import { setupOwner } from "@/app/actions";
import { getDb } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password } = body;
    
    if (!name || !email || !password) {
      return NextResponse.json(
        { success: false, error: "Faltan campos obligatorios" },
        { status: 400 },
      );
    }
    
    // Test database connection first
    try {
      const db = await getDb();
      const count = await db.get<{ count: number | string }>("SELECT COUNT(*) AS count FROM users");
      console.log("DB users count:", count);
    } catch (dbError) {
      console.error("DB connection error:", dbError);
      return NextResponse.json(
        { success: false, error: "Error de conexión a la base de datos: " + (dbError instanceof Error ? dbError.message : String(dbError)) },
        { status: 500 },
      );
    }
    
    const result = await setupOwner(name, email, password);
    
    if (result.success) {
      return NextResponse.json({ success: true });
    }
    return NextResponse.json(
      { success: false, error: result.error || "Error desconocido" },
      { status: 400 },
    );
  } catch (error) {
    console.error("Setup API error:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 },
    );
  }
}