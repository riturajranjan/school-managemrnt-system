"use client";

// Real PostgreSQL/API cutover (Phase 9H). Pure presentation over the frozen
// PayrollRunItem snapshot — never recomputed. The mock's QR-verify link and
// bank-account-last-4 are dropped (no real verification endpoint, no real
// bank-account data); PAN/UAN/ESI fields were never real and are not added.
import Link from "next/link";
import { use } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePayslip } from "@/lib/hooks/api/use-payroll-api";
import { formatCurrency } from "@/lib/utils";

export default function PayslipPage({ params }: { params: Promise<{ payslipId: string }> }) {
  const { payslipId } = use(params);
  const { data: payslip, loading } = usePayslip(payslipId);

  if (!loading && !payslip) {
    return (
      <div className="flex flex-col items-center gap-sm py-2xl text-center">
        <p className="text-sm font-medium text-foreground">Payslip not found</p>
        <Button asChild variant="outline">
          <Link href="/payroll/payslips">Back to payslips</Link>
        </Button>
      </div>
    );
  }
  if (!payslip) return null;

  const totalEarnings = payslip.earnings.reduce((s, e) => s + e.amount, 0);
  const totalDeductions = payslip.deductions.reduce((s, d) => s + d.amount, 0);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-sm print:hidden">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Payslip — {payslip.period}</h1>
          <p className="text-xs text-muted-foreground">{payslip.staffName}</p>
        </div>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="size-3.5" />
          Print / Save as PDF
        </Button>
      </div>

      <div className="mx-auto w-full max-w-[210mm] rounded-lg border border-border bg-white p-lg text-[#111827] shadow-card print:rounded-none print:border-0 print:shadow-none">
        <div className="mb-md flex items-center justify-between border-b border-[#e5e7eb] pb-sm">
          <div className="flex items-center gap-sm">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#022c43] text-base font-bold text-white">N</span>
            <div>
              <p className="text-base font-bold">{payslip.school}</p>
              <p className="text-xs text-[#6b7280]">Payslip · {payslip.period}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">{payslip.staffName}</p>
            <p className="text-xs text-[#6b7280]">{payslip.employeeCode}</p>
          </div>
        </div>

        <div className="mb-md grid grid-cols-2 gap-sm text-sm sm:grid-cols-4">
          <div>
            <p className="text-[10px] uppercase text-[#6b7280]">Period</p>
            <p className="font-medium">{payslip.period}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-[#6b7280]">Attendance (info)</p>
            <p className="font-medium">
              P{payslip.attendance.present} A{payslip.attendance.absent} OL{payslip.attendance.onLeave}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-[#6b7280]">Leave (info)</p>
            <p className="font-medium">{payslip.attendance.paidLeave + payslip.attendance.unpaidLeave} day(s)</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-[#6b7280]">Payment status</p>
            <p className="font-medium capitalize">{payslip.paymentStatus}{payslip.paidOn ? ` · ${payslip.paidOn}` : ""}</p>
          </div>
        </div>

        <div className="mb-md grid grid-cols-1 gap-md sm:grid-cols-2">
          <div>
            <p className="mb-1 text-[10px] uppercase text-[#6b7280]">Earnings</p>
            <table className="w-full border-collapse text-sm">
              <tbody>
                {payslip.earnings.map((e, i) => (
                  <tr key={i} className="border-b border-[#f3f4f6]">
                    <td className="py-1">{e.label}</td>
                    <td className="py-1 text-right">{formatCurrency(e.amount)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="pt-1">Total earnings</td>
                  <td className="pt-1 text-right">{formatCurrency(totalEarnings)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <p className="mb-1 text-[10px] uppercase text-[#6b7280]">Deductions</p>
            <table className="w-full border-collapse text-sm">
              <tbody>
                {payslip.deductions.map((d, i) => (
                  <tr key={i} className="border-b border-[#f3f4f6]">
                    <td className="py-1">{d.label}</td>
                    <td className="py-1 text-right">{formatCurrency(d.amount)}</td>
                  </tr>
                ))}
                {payslip.deductions.length === 0 && (
                  <tr>
                    <td className="py-1 text-[#9ca3af]">No deductions</td>
                    <td className="py-1 text-right">—</td>
                  </tr>
                )}
                <tr className="font-semibold">
                  <td className="pt-1">Total deductions</td>
                  <td className="pt-1 text-right">{formatCurrency(totalDeductions)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="mb-md flex flex-col gap-1 rounded-lg bg-[#f9fafb] p-sm text-sm">
          <div className="flex justify-between">
            <span className="text-[#6b7280]">Gross pay</span>
            <span className="font-medium">{formatCurrency(payslip.grossEarnings)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#6b7280]">Total deductions</span>
            <span className="font-medium">-{formatCurrency(payslip.totalDeductions)}</span>
          </div>
          <div className="flex justify-between border-t border-[#e5e7eb] pt-1 text-base font-bold">
            <span>Net pay</span>
            <span>{formatCurrency(payslip.netPay)}</span>
          </div>
        </div>

        <p className="mt-lg border-t border-[#e5e7eb] pt-sm text-center text-[10px] text-[#6b7280]">This is a computer-generated payslip and does not require a physical signature.</p>
      </div>
    </div>
  );
}
