import { NextResponse } from "next/server";
import { quotationService } from "@/services/quotationService";

export async function GET() {
  const data = await quotationService.list();
  return NextResponse.json(data);
}
