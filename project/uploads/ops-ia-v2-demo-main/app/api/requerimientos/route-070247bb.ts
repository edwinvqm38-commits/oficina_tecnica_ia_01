import { NextResponse } from "next/server";
import { requirementService } from "@/services/requirementService";

export async function GET() {
  const data = await requirementService.list();
  return NextResponse.json(data);
}
