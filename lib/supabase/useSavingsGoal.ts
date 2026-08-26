"use client";

// Bespoke data hook for the personal Savings Goal feature (2026-08-23) —
// deliberately NOT built on useSupabaseSynced/ownerMap.resolveOwner.
// resolveOwner only ever emits 'shared_view' or 'mirrored_edit' visibility,
// never 'private', and a savings goal needs true owner-only privacy by
// default (private-by-default, with an explicit opt-in to share the whole
// goal with the household — see AGENTS.md/HANDOVER.md for the full ask).
// This hook talks to finance_savings_goals / finance_savings_goal_logs
// directly instead, with visibility set explicitly per action.
//
// One active goal per person for v1. owner_id is resolved via
// ownerMap.resolveOwner("shared").owner_id rather than raw auth.uid() —
// "shared" is never a real household member id, so resolveOwner always
// falls through to its actingOwnerId branch, which is the acting user
// normally, or the household's own first real member when an admin is
// viewing that household on their behalf. That's the same attribution
// every other Finance section already uses; reusing it here means admin
// overlay mode keeps working for Savings Goals with no special-casing.
//
// Reliability (2026-08-23): each action here already awaits its Supabase
// call before updating state, so it doesn't have the race/lost-write bug
// useSupabaseSynced had — but it also wasn't reporting into the shared
// syncStatus store, so a refresh mid-save had no beforeunload guard and a
// failure was console-only. Wrapped every write below with
// beginWrite()/reportError() for consistency — see useSupabaseSynced.ts's
// header for the incident this all traces back to.

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getOwnerMap } from "@/lib/supabase/ownerMap";
import { beginWrite, clearError, reportError } from "@/lib/supabase/syncStatus";

export type GoalVisibility = "private" | "shared_view";

export type SavingsGoal = {
  id: string;
  ownerId: string;
  label: string;
  targetAmount: number;
  currency: string;
  targetDate: string;
  visibility: GoalVisibility;
};

export type SavingsGoalLog = {
  id: string;
  goalId: string;
  month: string; // ISO date, always the 1st of the month
  amountSaved: number;
};

function firstOfMonth(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function useSavingsGoal() {
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [logs, setLogs] = useState<SavingsGoalLog[]>([]);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    try {
      const ownerMap = await getOwnerMap(supabase);
      const resolvedOwnerId = ownerMap.resolveOwner("shared").owner_id;
      setOwnerId(resolvedOwnerId || null);

      if (ownerMap.householdId) {
        const { data: members } = await supabase
          .from("profiles")
          .select("id, display_name")
          .eq("household_id", ownerMap.householdId);
        const names: Record<string, string> = {};
        (members ?? []).forEach((m: any) => {
          names[m.id] = m.display_name;
        });
        setMemberNames(names);
      }

      // Same admin-scoping fix as useSupabaseSynced.ts (2026-08-26) — see
      // that file's comment for the full explanation.
      const adminIds = ownerMap.isAdmin
        ? (ownerMap.memberIds.length > 0 ? ownerMap.memberIds : ["00000000-0000-0000-0000-000000000000"])
        : null;
      let goalsQuery = supabase.from("finance_savings_goals").select("*");
      let logsQuery = supabase.from("finance_savings_goal_logs").select("*");
      if (adminIds) {
        goalsQuery = goalsQuery.in("owner_id", adminIds);
        logsQuery = logsQuery.in("owner_id", adminIds);
      }
      const [{ data: goalRows, error: goalErr }, { data: logRows, error: logErr }] = await Promise.all([
        goalsQuery,
        logsQuery,
      ]);

      if (goalErr) {
        console.error("[useSavingsGoal] load goals failed", goalErr);
      } else {
        setGoals(
          (goalRows ?? []).map((r: any) => ({
            id: r.id,
            ownerId: r.owner_id,
            label: r.label,
            targetAmount: Number(r.target_amount) || 0,
            currency: r.currency,
            targetDate: r.target_date,
            visibility: r.visibility,
          }))
        );
      }

      if (logErr) {
        console.error("[useSavingsGoal] load logs failed", logErr);
      } else {
        setLogs(
          (logRows ?? []).map((r: any) => ({
            id: r.id,
            goalId: r.goal_id,
            month: r.month,
            amountSaved: Number(r.amount_saved) || 0,
          }))
        );
      }
    } catch (err) {
      console.error("[useSavingsGoal] load failed", err);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const myGoal = goals.find((g) => g.ownerId === ownerId) ?? null;
  const householdGoals = goals.filter((g) => g.ownerId !== ownerId);
  const myLogs = myGoal
    ? logs.filter((l) => l.goalId === myGoal.id).sort((a, b) => (a.month < b.month ? 1 : -1))
    : [];
  const totalSavedFor = useCallback(
    (goalId: string) => logs.filter((l) => l.goalId === goalId).reduce((sum, l) => sum + l.amountSaved, 0),
    [logs]
  );

  const createGoal = async (input: {
    label: string;
    targetAmount: number;
    currency: string;
    targetDate: string;
    visibility: GoalVisibility;
  }) => {
    if (!ownerId) return;
    const endWrite = beginWrite();
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("finance_savings_goals")
        .insert({
          owner_id: ownerId,
          label: input.label,
          target_amount: input.targetAmount,
          currency: input.currency,
          target_date: input.targetDate,
          visibility: input.visibility,
        })
        .select("*")
        .single();
      if (error) {
        console.error("[useSavingsGoal] create failed", error);
        reportError("finance_savings_goals", "Couldn't save your savings goal — check your connection and try again.");
        return;
      }
      clearError("finance_savings_goals");
      setGoals((prev) => [
        ...prev,
        {
          id: data.id,
          ownerId: data.owner_id,
          label: data.label,
          targetAmount: Number(data.target_amount) || 0,
          currency: data.currency,
          targetDate: data.target_date,
          visibility: data.visibility,
        },
      ]);
    } finally {
      endWrite();
    }
  };

  const updateGoal = async (
    id: string,
    patch: Partial<{ label: string; targetAmount: number; currency: string; targetDate: string; visibility: GoalVisibility }>
  ) => {
    const endWrite = beginWrite();
    try {
      const supabase = createClient();
      const row: Record<string, unknown> = {};
      if (patch.label !== undefined) row.label = patch.label;
      if (patch.targetAmount !== undefined) row.target_amount = patch.targetAmount;
      if (patch.currency !== undefined) row.currency = patch.currency;
      if (patch.targetDate !== undefined) row.target_date = patch.targetDate;
      if (patch.visibility !== undefined) row.visibility = patch.visibility;
      const { error } = await supabase.from("finance_savings_goals").update(row).eq("id", id);
      if (error) {
        console.error("[useSavingsGoal] update failed", error);
        reportError("finance_savings_goals", "Couldn't save your savings goal changes — check your connection and try again.");
        return;
      }
      clearError("finance_savings_goals");
      setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
      // Keep this goal's logged months in sync with its own sharing setting, so
      // a household member can (or can't) see the numbers behind the shared
      // progress bar exactly as they can see the goal itself.
      if (patch.visibility !== undefined) {
        const { error: logsErr } = await supabase
          .from("finance_savings_goal_logs")
          .update({ visibility: patch.visibility })
          .eq("goal_id", id);
        if (logsErr) console.error("[useSavingsGoal] log visibility sync failed", logsErr);
      }
    } finally {
      endWrite();
    }
  };

  const deleteGoal = async (id: string) => {
    const endWrite = beginWrite();
    try {
      const supabase = createClient();
      const { error } = await supabase.from("finance_savings_goals").delete().eq("id", id);
      if (error) {
        console.error("[useSavingsGoal] delete failed", error);
        reportError("finance_savings_goals", "Couldn't delete that savings goal — check your connection and try again.");
        return;
      }
      clearError("finance_savings_goals");
      setGoals((prev) => prev.filter((g) => g.id !== id));
      setLogs((prev) => prev.filter((l) => l.goalId !== id));
    } finally {
      endWrite();
    }
  };

  const logMonth = async (goalId: string, amount: number, visibility: GoalVisibility, month: string = firstOfMonth()) => {
    if (!ownerId) return;
    const endWrite = beginWrite();
    try {
      const supabase = createClient();
      const existing = logs.find((l) => l.goalId === goalId && l.month === month);
      if (existing) {
        const { error } = await supabase.from("finance_savings_goal_logs").update({ amount_saved: amount }).eq("id", existing.id);
        if (error) {
          console.error("[useSavingsGoal] log update failed", error);
          reportError("finance_savings_goal_logs", "Couldn't save this month's savings log — check your connection and try again.");
          return;
        }
        clearError("finance_savings_goal_logs");
        setLogs((prev) => prev.map((l) => (l.id === existing.id ? { ...l, amountSaved: amount } : l)));
      } else {
        const { data, error } = await supabase
          .from("finance_savings_goal_logs")
          .insert({ goal_id: goalId, owner_id: ownerId, visibility, month, amount_saved: amount })
          .select("*")
          .single();
        if (error) {
          console.error("[useSavingsGoal] log insert failed", error);
          reportError("finance_savings_goal_logs", "Couldn't save this month's savings log — check your connection and try again.");
          return;
        }
        clearError("finance_savings_goal_logs");
        setLogs((prev) => [...prev, { id: data.id, goalId: data.goal_id, month: data.month, amountSaved: Number(data.amount_saved) || 0 }]);
      }
    } finally {
      endWrite();
    }
  };

  return {
    ready,
    ownerId,
    memberNames,
    myGoal,
    myLogs,
    householdGoals,
    totalSavedFor,
    createGoal,
    updateGoal,
    deleteGoal,
    logMonth,
    currentMonth: firstOfMonth(),
  };
}
