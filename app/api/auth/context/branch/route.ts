import { setBranch } from "@/lib/server/context/service";
import { setHandler } from "@/lib/server/api/context-route";

// POST /api/auth/context/branch { branchId } — validates the branch belongs to
// the selected school and the user has access, then persists.
export const POST = (request: Request) => setHandler(request, "branchId", setBranch);
