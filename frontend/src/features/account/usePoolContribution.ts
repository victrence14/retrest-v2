"use client";

import { useEffect, useState } from "react";
import type { ContributionRecord } from "@retrest/shared";
import { isAbort } from "@/lib/api/client";
import { useToast } from "@/hooks/useToast";
import { contributeToAccountPool, getAccountContribution } from "./api";
import type { AccountContextValue } from "./AccountContext";
import { beginAccountOperation, finishAccountOperation, readAccountOperation, rememberAccountOperation } from "./operations";

export function usePoolContribution(userId: string, poolId: string, run: AccountContextValue["run"], onError: (failure: unknown) => void) {
  const { notify } = useToast();
  const [contribution, setContribution] = useState<ContributionRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const scope = `pool-contribution:${poolId}`;
  useEffect(() => {
    const controller = new AbortController();
    const operation = readAccountOperation(userId, scope);
    if (operation?.id) {
      setLoading(true);
      getAccountContribution(operation.id, controller.signal).then(result => { if (!controller.signal.aborted) setContribution(result.contribution); })
        .catch(failure => { if (!isAbort(failure)) onError(failure); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }
    return () => controller.abort();
  }, [userId, scope, onError]);
  async function request() {
    const result = await run(async () => {
      const previous = readAccountOperation(userId, scope);
      if (contribution?.status === "FAILED" && previous) finishAccountOperation(userId, scope, previous.key);
      const operation = await beginAccountOperation(userId, scope);
      const result = await contributeToAccountPool(poolId, operation.key);
      rememberAccountOperation(userId, scope, { ...operation, id: result.contribution.id });
      return result;
    });
    if (result) {
      setContribution(result.contribution);
      notify(result.contribution.status === "SETTLED" ? "Your contribution is confirmed."
        : result.contribution.status === "FAILED" ? "Your contribution failed. You can request another attempt."
        : result.replayed ? "Your recorded contribution is still awaiting payment confirmation." : "Contribution requested. Payment confirmation is pending.", result.contribution.status === "FAILED");
    }
    return result?.contribution ?? null;
  }
  async function check() {
    if (!contribution) return null;
    const result = await run(() => getAccountContribution(contribution.id));
    if (result) {
      setContribution(result.contribution);
      notify(result.contribution.status === "SETTLED" ? "Your contribution is confirmed."
        : result.contribution.status === "FAILED" ? "Your contribution failed. You can request another attempt."
        : "Your contribution is still awaiting payment confirmation.", result.contribution.status === "FAILED");
    }
    return result?.contribution ?? null;
  }
  return { contribution, loading, request, check };
}
