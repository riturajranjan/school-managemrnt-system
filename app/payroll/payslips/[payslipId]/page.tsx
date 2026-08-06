"use client";

import Link from "next/link";
import { use } from "react";
import { Printer, QrCode, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePayslips } from "@/lib/hooks/use-finance";
import { formatMoney, sumMoney } from "@/lib/finance/money";
import { formatDate } from "@/lib/utils";

export default function PayslipPage({ params }: { params: Promise<{ payslipId: string }> }) {
  const { payslipId } = use(params);
  const payslips = usePayslips();
  const payslip = payslips.find((p) => p.id === payslipId);

  if (!payslip) {
    return (
      <div className="flex flex-col items-center gap-sm py-2xl text-center">
        <p className="text-sm font-medium text-foreground">Payslip not found</p>
        <Button asChild variant="outline">
          <Link href="/payroll/payslips">Back to payslips</Link>
        </Button>
      </div>
    );
  }

  const totalEarnings = sumMoney(payslip.earnings.map((e) => e.amount), payslip.grossPay.currency);
  const totalDeductions = sumMoney(payslip.deductions.map((d) => d.amount), payslip.grossPay.currency);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-sm print:hidden">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Payslip — {payslip.period}</h1>
          <p className="text-xs text-muted-foreground">{payslip.employeeName}</p>
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
              <p className="text-base font-bold">Novyra Public School</p>
              <p className="text-xs text-[#6b7280]">Payslip · {payslip.period}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">{payslip.employeeName}</p>
            <p className="text-xs text-[#6b7280]">Generated {formatDate(payslip.generatedAt)}</p>
          </div>
        </div>

        <div className="mb-md grid grid-cols-2 gap-sm text-sm sm:grid-cols-4">
          <div>
            <p className="text-[10px] uppercase text-[#6b7280]">Period</p>
            <p className="font-medium">{payslip.period}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-[#6b7280]">Attendance</p>
            <p className="font-medium">
              {payslip.attendanceDays}/{payslip.workingDays} days
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-[#6b7280]">Leave days</p>
            <p className="font-medium">{payslip.leaveDays}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-[#6b7280]">Bank account</p>
            <p className="font-medium">{payslip.bankAccountLast4 ? `••••${payslip.bankAccountLast4}` : "—"}</p>
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
                    <td className="py-1 text-right">{formatMoney(e.amount)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="pt-1">Total earnings</td>
                  <td className="pt-1 text-right">{formatMoney(totalEarnings)}</td>
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
                    <td className="py-1 text-right">{formatMoney(d.amount)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="pt-1">Total deductions</td>
                  <td className="pt-1 text-right">{formatMoney(totalDeductions)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="mb-md flex flex-col gap-1 rounded-lg bg-[#f9fafb] p-sm text-sm">
          <div className="flex justify-between">
            <span className="text-[#6b7280]">Gross pay</span>
            <span className="font-medium">{formatMoney(payslip.grossPay)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#6b7280]">Total deductions</span>
            <span className="font-medium">-{formatMoney(totalDeductions)}</span>
          </div>
          <div className="flex justify-between border-t border-[#e5e7eb] pt-1 text-base font-bold">
            <span>Net pay</span>
            <span>{formatMoney(payslip.netPay)}</span>
          </div>
        </div>

        <div className="mb-md flex items-center gap-sm text-xs text-[#6b7280]">
          <span className="flex size-12 items-center justify-center rounded-md border border-dashed border-[#9ca3af]">
            <QrCode className="size-6" />
          </span>
          <span className="flex items-center gap-1">
            <ShieldCheck className="size-3.5" /> Scan to verify this payslip at novyra.edu.in/verify/{payslip.id}
          </span>
        </div>

        <p className="mt-lg border-t border-[#e5e7eb] pt-sm text-center text-[10px] text-[#6b7280]">This is a computer-generated payslip (v{payslip.version}) and does not require a physical signature.</p>
      </div>
    </div>
  );
}
