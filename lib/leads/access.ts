import "server-only";

export {
  getOperatorAccessSecret as getLeadAccessSecret,
  isOperatorAccessConfigured as isLeadAccessConfigured,
  verifyOperatorAuthorization as verifyLeadAuthorization,
} from "@/lib/operator-access";
