import { requestActor, failure } from '@/server/http';
import { getSalary } from '@/server/salary';
import { salaryPdf, type SalaryDetails } from '@/server/salary-pdf';
export const runtime = 'nodejs';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requestActor(new URL(request.url).searchParams.get('company') || '');
    const record = await getSalary(actor, (await context.params).id);
    const bytes = await salaryPdf(record.details as SalaryDetails);
    return new Response(Buffer.from(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="salary-slip-${record.month}-${record.id.slice(0, 8)}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    return failure(e);
  }
}
