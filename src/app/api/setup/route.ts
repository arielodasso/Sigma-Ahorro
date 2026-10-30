import { NextResponse } from "next/server";
import { setupOwner } from "@/app/actions";

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
      { success: false, error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}