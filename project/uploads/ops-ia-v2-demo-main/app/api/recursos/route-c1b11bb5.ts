import { NextResponse } from "next/server";
import { resourceService } from "@/services/resourceService";

export async function GET() {
  const data = await resourceService.list();
  return NextResponse.json(data);
}
